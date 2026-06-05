# GlobalCloud XiaoC 桌面应用开发者指南

## 1. 项目背景与目标

用户希望将现有的 GlobalCloud XiaoC Web 应用改造为桌面端应用，其核心目标是**利用 Electron 主进程代理 API 请求，从而彻底解决浏览器的 CORS 跨域问题**。

### 技术选型：为何选择 Electron？

-   **技术栈统一**: Electron 允许我们复用现有的 JavaScript/TypeScript 和 Vue 技术栈，无需引入 Rust (Tauri 方案) 等新技术，降低了团队的学习成本和开发门槛。
-   **最小化代码侵入**: 通过 Electron 的进程间通信（IPC）机制，我们可以实现一个无缝的 API 请求代理，仅需在 SDK 初始化时注入一个自定义的网络请求函数，对核心业务逻辑 (`packages/core`) 的侵入极小。
-   **生态成熟**: Electron 拥有庞大而成熟的社区和生态系统，为未来的功能扩展（如自动更新、系统通知）提供了强有力的保障。

## 2. 架构设计

应用采用**高层服务代理**架构，职责清晰，维护性强。主进程作为后端服务提供者，渲染进程作为前端消费者。

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron 桌面应用                        │
├─────────────────────────────────────────────────────────────┤
│                  主进程 (main.js) - 服务端                   │
│  - 窗口管理                                                  │
│  - **直接消费 @prompt-optimizer/core 包**                      │
│  - **实例化并持有核心服务 (LLMService, ModelManager)**         │
│  - **作为后端，通过 IPC 提供高层服务接口 (如 testConnection)** │
├─────────────────────────────────────────────────────────────┤
│              预加载脚本 (preload.js) - 安全桥梁                │
│  - 将主进程的高层服务接口 (`llm.testConnection`)             │
│  - 安全地暴露给渲染进程 (`window.electronAPI.llm.*`)         │
├─────────────────────────────────────────────────────────────┤
│            渲染进程 (Vue 应用) - 纯前端消费者                  │
│  - UI 界面与用户交互                                         │
│  - **通过 `core` 包中的代理对象 (`ElectronLLMProxy`)**         │
│  - **调用 `window.electronAPI.llm.testConnection()`**          │
│  - **不直接处理网络请求，只调用定义好的服务接口**                │
└─────────────────────────────────────────────────────────────┘
```

### 服务调用数据流

```
1. 用户在UI上操作，触发 Vue 组件中的方法
2. Vue 组件调用 `core` 包中面向 Electron 的代理服务 (`ElectronLLMProxy`)
3. 代理服务调用预加载脚本暴露的 `window.electronAPI.llm.testConnection()` (IPC 调用)
4. 预加载脚本通过 `ipcRenderer` 将请求发送给主进程
5. 主进程的 `ipcMain` 监听器捕获请求，直接调用**主进程中持有的真实 LLMService 实例**
6. LLMService 实例在 Node.js 环境中，使用 `node-fetch` 发起真实的 API 请求
7. 最终结果 (JSON 数据，非 Response 对象) 沿原路返回：主进程 → 预加载脚本 → 代理服务 → Vue 组件 → UI 更新
```

### 核心架构详解：代理模式与进程间通信 (IPC)

为了深刻理解新架构的健壮性，必须理解其背后的核心理念：**主进程是"大脑"，渲染进程是"四肢"**。所有的记忆、思考和决策（核心服务）都必须由"大脑"统一做出，而"四肢"（UI）只负责感知和行动。

#### 1. 为何不能在UI层直接调用 `core` 模块？

在纯Web应用中，UI和Core生活在同一个世界里（单进程），可以直接通信。但在Electron中，主进程和渲染进程是两个**完全隔离的操作系统进程**，拥有各自独立的内存空间。

如果在UI层（渲染进程）直接调用 `createModelManager()`，会发生什么？
- **数据孤岛**：会在渲染进程中创建一个**全新的、空白的**`ModelManager`实例。它与主进程中那个拥有真实数据的实例**互不相通**，导致数据永远无法同步。
- **能力缺失**：`core`模块的部分功能（如未来要实现的文件读写）依赖于Node.js环境。渲染进程（基于Chromium）没有这些能力，调用相关功能将直接导致**应用崩溃**。

#### 2. `ipcRenderer` 与 `ipcMain`：两个世界的电话

进程间通信（IPC）是连接这两个隔离世界的唯一桥梁。
- **`ipcRenderer`**: 安装在**渲染进程**的"电话"，专门用于向主进程"打电话"（发起请求）。
- **`ipcMain`**: 安装在**主进程**的"总机"，专门用于"接电话"（处理请求）。

我们主要使用`invoke`/`handle`这种**双向通信**模式，它完美地模拟了"请求-响应"的异步流程。

#### 3. `ElectronModelManagerProxy`：优雅的"全权代理"

直接让UI层去操作`ipcRenderer.invoke('channel-name', ...)`这种底层的"电话指令"是混乱且不安全的。为此，我们引入了**代理模式 (Proxy Pattern)**。

`ElectronModelManagerProxy`这类代理类的核心作用是**"假装"自己是真正的 `ModelManager`**，从而让UI层的代码可以像以前一样无缝调用，无需关心背后复杂的跨进程通信。

它的工作流程是一场精密的"拦截-转发-返回"：
1. **UI调用**：UI调用`modelManager.getModels()`。
2. **Proxy拦截**：实际上调用的是`ElectronModelManagerProxy`实例的同名方法。
3. **Proxy转发**：该方法不包含业务逻辑，只负责通过`preload.js`暴露的`electronAPI`，最终调用`ipcRenderer.invoke('model-getModels')`。
4. **主进程处理**：`ipcMain.handle`捕获请求，调用**主进程中唯一的、真实的`ModelManager`实例**，处理并返回数据。
5. **数据返回**：结果沿原路返回，最终交付给UI组件。

这个模式虽然在新增方法时需要在多个文件（`main.js`, `preload.js`, `proxy.ts`）中添加"样板代码"，但这并非无意义的重复，而是为了换取**单一数据源、安全的边界和优雅的类型安全抽象**所付出的、性价比极高的代价。

## 3. 快速启动 (开发模式)

### 系统要求

-   Windows 10/11, macOS, or Linux
-   Node.js 18+
-   pnpm 8+

### 启动步骤

```bash
# 1. (首次) 在项目根目录安装所有依赖
pnpm install

# 2. 运行桌面应用开发模式
pnpm dev:desktop
```

此命令将同时启动 Vite 开发服务器（用于前端界面）和 Electron 应用实例，并开启热重载。

## 4. 核心技术实现

当前架构放弃了脆弱的底层 `fetch` 代理，转向更稳定、更易于维护的**高层服务代理模型**。

### 服务消费模型

主进程 (`main.js`) 现在作为后端服务，直接消费 `packages/core` 的能力，完全复用其业务逻辑，避免了代码冗余。

```javascript
// main.js - 主进程直接导入并使用 core 包
const { 
    createLLMService, 
    createModelManager,
    // ... 其他服务
} = require('@prompt-optimizer/core');

// 在主进程启动时实例化服务
let llmService;
app.whenReady().then(() => {
    // 此处需要一个适合 Node.js 的存储方案 (见下文)
    const modelManager = createModelManager(/* ... */);
    
    // 创建一个在 Node.js 环境中运行的真实 LLMService 实例
    llmService = createLLMService(modelManager);
    
    // 将服务实例传递给 IPC 设置函数
    setupIPC(llmService);
});
```

### 高层 IPC 接口

渲染进程与主进程之间的通信"契约"，从不稳定的 `fetch` API 升级为我们自己定义的、稳定的 `ILLMService` 接口。

```javascript
// main.js - 提供服务接口
function setupIPC(llmService) {
    ipcMain.handle('llm-testConnection', async (event, provider) => {
        try {
            await llmService.testConnection(provider);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ... 其他接口的实现
}

// preload.js - 暴露服务接口
contextBridge.exposeInMainWorld('electronAPI', {
    llm: {
        testConnection: (provider) => ipcRenderer.invoke('llm-testConnection', provider),
        // ... 其他接口的暴露
    }
});
```

### 存储策略

由于渲染进程的 `IndexedDB` 在主进程 (Node.js) 中不可用，我们为桌面端设计了分阶段的存储方案：

-   **第一阶段 (当前实现):** 采用一个临时的**内存存储**方案。这使得新架构可以快速运行起来，但应用关闭后数据会丢失。
-   **第二阶段 (未来计划):** 实现一个**文件存储 (`FileStorageProvider`)**，将模型、模板等数据以 JSON 文件的形式持久化存储在用户本地磁盘上，充分利用桌面环境的优势。

## 5. 构建与部署

### 开发脚本

-   `pnpm dev:desktop`: 同时启动前端开发服务器和 Electron 应用，用于日常开发。
-   `pnpm build:web`: 仅构建前端 Web 应用，产物输出到 `packages/desktop/web-dist`。
-   `pnpm build:desktop`: 构建最终的可分发桌面应用程序（如 `.exe` 或 `.dmg`）。

### 生产版本构建流程

```bash
# 完整构建流程，将自动先构建 web 内容
pnpm build:desktop

# 构建完成后，可执行文件位于以下目录
# packages/desktop/dist/
```

### Electron Builder 配置

打包配置位于 `packages/desktop/package.json` 的 `build` 字段中。

```json
{
  "build": {
    "appId": "com.promptoptimizer.desktop",
    "productName": "GlobalCloud XiaoC",
    "directories": { "output": "dist" },
    "files": [
      "main.js", 
      "preload.js", 
      "web-dist/**/*", // 将构建好的前端应用打包进去
      "node_modules/**/*"
    ],
    "win": {
      "target": "nsis", // Windows 安装包格式
      "icon": "icon.ico" // 应用图标
    }
  }
}
```

## 6. 故障排除

**1. 应用启动失败或界面空白**
-   确保 `pnpm install` 已成功执行。
-   确认 `pnpm build:web` 是否成功执行，并且 `packages/desktop/web-dist` 目录已生成且内容不为空。
-   尝试清理并重新安装: `pnpm store prune && pnpm install`。

**2. Electron 安装不完整**
-   这通常是网络问题。仓库默认不再提交 `electron_mirror` 镜像配置；如本地网络需要，请在用户级 `~/.npmrc` 或 shell 环境变量中按需配置，再重试安装。
-   手动安装命令:
    ```bash
    # (路径可能因 pnpm 版本而异)
    cd node_modules/.pnpm/electron@<version>/node_modules/electron
    node install.js
    ```

**3. API 调用失败**
-   检查 API 密钥是否在桌面应用的 "模型管理" 页面中正确配置。
-   打开开发者工具 (`Ctrl+Shift+I`) 查看渲染进程的 `Console`。
-   **关键：** 由于核心 API 调用逻辑已移至主进程，请务必**检查启动桌面应用的终端（命令行窗口）中的日志输出**，那里会包含最直接的 `node-fetch` 错误信息。
-   确认网络连接正常。

## 7. 未来架构改进方向

当前手动维护多个文件的IPC"样板代码"是清晰和健壮的，但随着功能扩展，开发效率和一致性会成为挑战。未来，我们可以采用**代码生成 (Code Generation)**的方案来彻底解决这个问题。

### 核心理念

我们唯一的、需要手动维护的文件，应该是服务的**接口定义**（例如 `IModelManager`）。我们将这个接口作为**"单一事实源" (Single Source of Truth)**。

### 自动化工作流

1.  **定义蓝图**: 在`core`包的`types.ts`文件中维护`IModelManager`等接口。
2.  **编写生成器脚本**: 使用`ts-morph`等库编写一个Node.js脚本，该脚本能够读取并解析TypeScript接口的结构（方法名、参数、返回值等）。
3.  **自动生成样板代码**: 脚本遍历接口中的每个方法，并根据预设模板，自动生成`main.js`中的`ipcMain.handle`、`preload.js`中的`ipcRenderer`调用，以及`electron-proxy.ts`中的代理方法。
4.  **一键更新**: 将此脚本集成到`package.json`中。未来新增/修改/删除一个接口方法时，开发者只需修改接口定义，然后运行一个命令（如`pnpm generate:ipc`），所有相关的IPC代码都会被自动、无误地更新。

### 备选方案

社区中成熟的`tRPC`框架也提供了类似的思路，其核心就是"零代码生成"的类型安全API层。我们可以借鉴其思想，甚至尝试将其集成到Electron的IPC机制中。

采用此方案后，我们的开发流程将变得极为高效和安全，彻底消除手动维护IPC调用可能带来的所有潜在错误。
