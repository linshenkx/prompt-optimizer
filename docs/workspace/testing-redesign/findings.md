# 测试方案重新设计 - 研究发现

## 技术选型对比与推荐（2025-2026）

### 1. 单元/集成测试框架：Vitest vs Jest

#### 性能对比

| 指标 | Vitest | Jest |
|------|--------|------|
| **执行速度** | 快 30-70% | 基准 |
| **冷启动** | 4x 更快（esbuild） | 基准（Babel/ts-jest） |
| **内存占用** | 低 30% | 基准 |
| **Watch 模式** | HMR，近瞬时 | 需要重新运行 |

**真实基准测试**：
- Vitest 在大型项目中有时会略慢，但 watch 模式体验远优于 Jest
- [来源：DEV Community 基准测试](https://dev.to/thejaredwilcurt/vitest-vs-jest-benchmarks-on-a-5-year-old-real-work-spa-4mf1)

#### TypeScript 支持

**Vitest**:
- ✅ 开箱即用，无需配置
- ✅ 复用 Vite 的 esbuild 管道
- ✅ 原生 ESM 支持

**Jest**:
- ⚠️ 需要 ts-jest 或 Babel 转译
- ⚠️ ESM 支持仍处于实验阶段（Jest 30）
- ⚠️ 配置复杂

#### Vue 3 生态适配

**Vitest**:
- ✅ 由 Vite 团队开发（Evan You 创建 Vite 和 Vue）
- ✅ 与 Vue 3 + Vite 项目天然契合
- ✅ Nuxt 官方推荐

**Jest**:
- ⚠️ 需要额外配置 Vue 转换器
- ⚠️ 不支持 Vite 的 HMR

#### 生态系统成熟度

**Jest**:
- ✅ 3500 万月下载量
- ✅ 自 2014 年以来经过实战检验
- ✅ 44k GitHub stars
- ✅ React 生态主导地位

**Vitest**:
- ⚠️ 380 万月下载量
- ⚠️ 相对较新（但快速成长）
- ✅ 与 Vite 生态深度集成

#### 推荐结论

**✅ 保持 Vitest**（当前已使用）

**理由**：
1. **项目已使用 Vite + Vue 3**：天然契合，无需迁移
2. **TypeScript 支持更好**：开箱即用，无额外配置
3. **性能优势明显**：watch 模式体验远超 Jest
4. **生态足够成熟**：Vitest 4.0 已稳定，社区活跃

[来源：Medium - Jest vs Vitest 2025](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)

---

### 2. E2E 测试框架：Playwright vs Cypress

#### 性能对比

| 指标 | Playwright | Cypress |
|------|-----------|---------|
| **并行执行** | ✅ 内置，免费 | ⚠️ 需付费或自行配置 |
| **执行速度** | 快 35-45%（并行） | 基准 |
| **跨浏览器** | Chromium/Firefox/WebKit | Chromium/Firefox（有限） |
| **移动设备模拟** | ✅ 原生支持 | ⚠️ 有限 |

#### 架构差异

**Playwright**：
- 在浏览器外运行，通过 CDP (Chrome DevTools Protocol) 控制
- 支持真正的并行执行
- 支持多标签页、多窗口

**Cypress**：
- 在浏览器内运行
- 并行需要额外配置或付费服务
- 单标签页限制

#### 适用场景对比

**Playwright 适合**：
- ✅ 需要跨浏览器测试（Safari 支持）
- ✅ 大规模并行执行（CI/CD 加速）
- ✅ 复杂交互（多标签页、文件上传/下载）
- ✅ 稳定性优先（更少 flaky tests）

**Cypress 适合**：
- ✅ 快速上手，可视化调试
- ✅ 小型团队，Chrome 优先
- ✅ 开发者体验优先

#### 推荐结论

**✅ 保持 Playwright**（当前已使用）

**理由**：
1. **项目需求匹配**：需要稳定、快速的并行执行
2. **跨浏览器支持**：未来可能需要 Safari 测试
3. **CI/CD 友好**：免费并行，无额外成本
4. **2025 趋势**：Playwright 社区增长迅速

[来源：BugBug - Cypress vs Playwright 2025](https://bugbug.io/blog/test-automation-tools/cypress-vs-playwright/)
[来源：Medium - Cypress vs Playwright 2025](https://medium.com/@crissyjoshua/cypress-vs-playwright-who-owns-the-top-spot-in-2025-c248c021508f)

---

### 3. HTTP Mocking / VCR 模式：技术选型

#### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **MSW (Mock Service Worker)** | 网络层拦截，浏览器+Node 通用，类型安全 | 初始配置复杂 | ⭐⭐⭐⭐⭐ |
| **nock** | 简单易用，HTTP mocking | 仅支持 Node.js | ⭐⭐⭐ |
| **Polly.js** | 自动录制-回放 | 维护不活跃（2021 年后） | ⭐⭐ |
| **自定义 VCR** | 完全控制 | 开发成本高 | ⭐⭐⭐⭐ |

#### MSW 核心优势

**网络层拦截**：
```typescript
// MSW 使用 Service Worker API 拦截真实请求
// 无需修改生产代码
fetch('/api/optimize') // 会被 MSW 拦截
```

**框架无关**：
- 无论使用 fetch、Axios、GraphQL 都能拦截
- 同一套 handlers 可用于开发、测试、演示

**类型安全**：
```typescript
// 路径参数、请求体、响应体都有类型
http.post<OptimizeRequest, OptimizeResponse>('/api/optimize', ...)
```

**最佳实践（2025-2026）**：

1. **集中化 Handlers 管理**
```typescript
// mocks/handlers.ts
export const handlers = [
  http.post('/api/optimize', () => {
    return HttpResponse.json({ optimizedPrompt: '...' })
  })
]
```

2. **环境特定集成**
```typescript
// Node.js (Vitest)
const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Browser (Playwright)
const worker = setupWorker(...handlers)
await worker.start()
```

3. **模拟真实场景**
```typescript
// 模拟延迟
http.get('/api/slow', () => delay(2000))

// 模拟错误
http.get('/api/error', () => HttpResponse.error())

// 模拟流式响应（需自定义）
http.post('/api/stream', async () => {
  const stream = new ReadableStream(...)
  return new HttpResponse(stream)
})
```

[来源：MSW 官方文档](https://mswjs.io/)
[来源：Callstack - MSW 综合指南](https://www.callstack.com/blog/guide-to-mock-service-worker-msw)

#### VCR 自动化录制-回放架构

**推荐方案**：MSW + 自定义 Fixtures 管理

```
┌────────────────────────────────────────────┐
│  测试代码                                   │
│  test('优化提示词', async () => { ... })    │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│  VCR Middleware                            │
│  - 检测 fixture 是否存在                    │
│  - 存在: MSW 回放 fixture                  │
│  - 不存在: 真实 API 并录制                  │
└────────────────────────────────────────────┘
                    ↓
        ┌───────────┴──────────┐
        ↓                       ↓
┌───────────────┐       ┌──────────────┐
│  Mock 模式     │       │  真实 API     │
│  MSW handlers │       │  录制响应     │
└───────────────┘       └──────────────┘
```

#### 推荐结论

**✅ MSW + 自定义 Fixtures**

**理由**：
1. **网络层拦截**：最接近真实环境
2. **跨环境复用**：Vitest + Playwright 通用
3. **类型安全**：TypeScript 优先
4. **生态活跃**：持续更新，社区支持好

[来源：Leapcell - MSW 测试实践](https://leapcell.io/blog/seamless-api-mocking-in-tests-with-mock-service-worker)

---

### 4. 视觉回归测试：技术选型

#### 方案对比

| 方案 | 类型 | 优点 | 缺点 | 成本 |
|------|------|------|------|------|
| **Playwright Visual Testing** | 内置代码 | 免费，集成简单，本地运行 | 像素级敏感，baseline 管理需手动 | 免费 |
| **Percy** | 云服务 | 智能对比，跨浏览器，UI 审查 | 依赖外部服务，收费 | $149/月起 |
| **Chromatic** | 云服务（Storybook） | Storybook 集成，组件驱动 | 限于 Storybook，收费 | $99/月起 |
| **Applitools Eyes** | 云服务（AI） | AI 驱动，智能忽略差异 | 贵，依赖外部 | $799/月起 |

#### Playwright Visual Testing 详解

**基本用法**：
```typescript
test('视觉回归测试', async ({ page }) => {
  await page.goto('/')

  // 生成 baseline 或对比
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,    // 允许 100 像素差异
    threshold: 0.2,        // 20% 差异阈值
    animations: 'disabled' // 禁用动画
  })
})
```

**Baseline 管理**：
```bash
# 首次运行：生成 baseline
pnpm test:e2e --update-snapshots

# 后续运行：自动对比
pnpm test:e2e

# 失败时：生成对比图
# tests/e2e/.screenshots/
# ├── homepage-actual.png
# ├── homepage-expected.png
# └── homepage-diff.png
```

**优点**：
- ✅ 完全免费
- ✅ 本地运行，无需外部服务
- ✅ 失败时生成对比图
- ✅ 像素级精确

**缺点**：
- ⚠️ 字体渲染差异（跨 OS）
- ⚠️ 动画/loading 需要等待
- ⚠️ Baseline 更新需人工审查

**最佳实践**：
1. **Docker 统一环境**（减少跨 OS 差异）
2. **禁用动画**（animations: 'disabled'）
3. **等待稳定状态**（waitForLoadState）
4. **设置合理阈值**（threshold: 0.1-0.3）

#### 推荐结论

**✅ Playwright Visual Testing**

**理由**：
1. **成本**：完全免费，无订阅费用
2. **集成度**：已使用 Playwright，无需额外工具
3. **控制权**：本地运行，Baseline 纳入版本控制
4. **项目需求**：初期不需要复杂的 AI 对比

**未来考虑**：
- 如果团队扩大，Baseline 审查负担过重，可考虑 Percy/Chromatic
- 如果需要跨多浏览器视觉对比，可考虑云服务

---

### 5. Vue 组件测试：Vue Test Utils vs Testing Library

#### 方案对比

| 特性 | Vue Test Utils | Testing Library (Vue) |
|------|---------------|----------------------|
| **哲学** | 实现细节测试 | 用户行为测试 |
| **API 风格** | 包装器，完全访问组件内部 | 查询 DOM，模拟用户交互 |
| **学习曲线** | Vue 特定，需了解组件 API | 框架无关，接近用户视角 |
| **重构友好** | ⚠️ 实现变化需修改测试 | ✅ UI 不变则测试不变 |

**Vue Test Utils 示例**：
```typescript
const wrapper = mount(Component)
wrapper.vm.someMethod() // 直接访问组件实例
expect(wrapper.vm.someData).toBe('value')
```

**Testing Library 示例**：
```typescript
render(Component)
const button = screen.getByRole('button', { name: /submit/i })
await userEvent.click(button)
expect(screen.getByText('Success')).toBeInTheDocument()
```

#### 推荐结论

**✅ Vue Test Utils（主要）+ Testing Library（补充）**

**理由**：
1. **项目已使用 Vue Test Utils**：迁移成本高
2. **需要测试实现细节**：某些测试确实需要访问组件内部（如 Pinia Store 集成）
3. **逐步引入 Testing Library**：新测试优先使用 Testing Library 风格

**指导原则**：
- **组件单元测试**：Vue Test Utils（测试组件逻辑）
- **集成测试**：Testing Library 风格（测试用户行为）
- **E2E 测试**：Playwright（真实用户视角）

---

### 6. 技术栈总结与推荐

| 层级 | 推荐工具 | 决策 |
|------|---------|------|
| **单元/集成测试** | Vitest 4.0 | ✅ 保持现有选择 |
| **E2E 测试** | Playwright 1.56 | ✅ 保持现有选择 |
| **HTTP Mocking** | MSW 2.0 + 自定义 VCR | ✅ 新增实现 |
| **视觉回归** | Playwright Visual Testing | ✅ 新增实现 |
| **Vue 组件测试** | Vue Test Utils + Testing Library | ✅ 保持+补充 |
| **Pinia 测试** | 现有 pinia-test-helpers | ✅ 保持+增强 |

**关键决策**：
1. **无需大规模迁移**：现有技术栈（Vitest + Playwright）已是 2025 最佳实践
2. **重点增强**：VCR 模式、视觉回归、UI 错误检测
3. **成本优先**：选择免费开源方案（Playwright Visual Testing），避免云服务订阅

**下一步行动**：
- [ ] 实现 MSW + VCR 基础设施
- [ ] 配置 Playwright 视觉回归测试
- [ ] 实现全局错误检测机制

## 项目当前状态

### 现有测试基础

**测试文件统计**（2026-01-09 探索）:
- 总计: 111 个测试文件
- Core 包: 71 个（52 单元 + 19 集成）
- UI 包: 21 个（18 单元 + 2 集成 + 1 E2E）
- E2E 测试: 6 个（根目录）
- 其他: 12 个

**测试框架**:
- Vitest 4.0.15 - 单元/集成测试
- Playwright 1.56.1 - E2E 测试
- @vue/test-utils 2.4.5 - Vue 组件测试
- jsdom 26.0.0 - DOM 模拟环境

**测试配置文件**:
- `vitest.config.ts` (UI/Web) - jsdom 环境，5 秒超时
- `vitest.config.js` (Core) - node 环境，30 秒超时
- `playwright.config.ts` - Chromium 浏览器，端口 15555
- `packages/ui/tests/setup.ts` - 全局测试设置（i18n, Naive UI, Mock APIs）
- `packages/core/tests/setup.js` - Core 全局设置（localStorage Mock）

**测试辅助工具**:
- `packages/ui/tests/utils/pinia-test-helpers.ts` - Pinia 测试工具
  - `createTestPinia()` - 创建测试 Pinia 实例
  - `createPreferenceServiceStub()` - PreferenceService stub
  - `withMockPiniaServices()` - 自动清理的测试入口

### 核心发现

#### 1. 测试覆盖不足的领域

**UI 包测试薄弱**:
- 仅 18 个组件单元测试（对比 Core 的 52 个）
- 缺少 Workspace 组件测试（BasicSystemWorkspace, BasicUserWorkspace 等）
- 缺少路由、Store 整体流程测试

**Desktop/Extension 完全无测试**:
- Desktop 包: 0 个测试（Electron 主进程、IPC 通信无覆盖）
- Extension 包: 0 个测试（Chrome Extension 功能无覆盖）

**性能测试缺失**:
- `/packages/core/tests/performance` 目录存在但为空

#### 2. 当前测试的问题

**无法发现 UI 错误**:
- 控制台错误需要手动查看 DevTools
- 组件渲染错误无法被单元测试捕获
- 状态同步问题需要手动交互才能发现
- 视觉渲染错误需要人工检查界面

**测试不可靠**:
- 缺少真实 API 集成测试（仅有少量 `real-api.test.ts`）
- Mock 服务无法模拟流式响应
- 无视觉回归测试

**执行效率低**:
- 无覆盖率门禁配置
- 无 pre-commit hook
- 无测试分组（fast/full）

#### 3. 最近重构（Session Store 单一真源）

**重构背景** (commit 5ea1004):
- 实现 Pinia Session Stores 作为单一真源
- 6 个 Session Store: BasicSystem, BasicUser, ProSystem, ProUser, ImageText2Image, ImageImage2Image
- 关键机制: 状态隔离、持久化保护、并发锁、顺序恢复

**关键风险点**（需重点测试）:
- 跨模式状态污染
- 持久化保护机制（未恢复前禁止保存）
- 并发竞态（saveInFlight/isSwitching 锁）
- 对比模式一致性（originalResult vs optimizedResult）
- 子模式隔离（System/User 状态独立）

### 技术栈分析

**前端框架**:
- Vue 3 + TypeScript + Composition API
- Pinia 状态管理（独立 refs，非 wrapped state）
- Naive UI 组件库

**核心服务** (`packages/core/src/services/`):
- LLM 服务: OpenAI, Gemini, DeepSeek, 自定义模型
- Prompt 服务: 优化、测试、评估
- Template 服务: CSP 安全处理，变量替换
- Image 服务: IndexedDB 存储，LRU 清理
- Storage 服务: 多适配器（localStorage, IndexedDB, file system）
- Preference 服务: 用户偏好，跨平台同步

**多平台支持**:
- Web: Vite 构建
- Desktop: Electron + IPC 代理
- Extension: Chrome Extension

## UI 错误检测技术调研

### 1. 控制台错误检测

#### Vitest 环境

**方案 A: 全局 console spy**
```typescript
// tests/setup.ts
const originalError = console.error
const originalWarn = console.warn
const errors: string[] = []

global.console.error = (...args) => {
  errors.push(args.join(' '))
  originalError(...args)
}

afterEach(() => {
  if (errors.length > 0) {
    throw new Error(`Console errors detected: ${errors.join('\n')}`)
  }
  errors.length = 0
})
```

**优点**:
- 自动捕获所有 console.error/warn
- 测试失败时提供清晰错误信息
- 无需修改现有测试

**缺点**:
- 可能误报（某些库的合法警告）
- 需要白名单机制

**方案 B: Vue warn handler**
```typescript
// tests/setup.ts
import { createApp } from 'vue'

const app = createApp({})
app.config.warnHandler = (msg, instance, trace) => {
  throw new Error(`Vue warning: ${msg}\n${trace}`)
}
```

**优点**:
- 专门捕获 Vue 警告
- 提供组件栈信息

**缺点**:
- 仅限 Vue 警告，无法捕获其他错误

**推荐**: 方案 A + 方案 B 结合，白名单过滤合法警告

#### Playwright 环境

**方案: page.on('console') 监听器**
```typescript
// playwright.config.ts
test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      throw new Error(`Console ${msg.type()}: ${msg.text()}`)
    }
  })

  page.on('pageerror', error => {
    throw new Error(`Uncaught exception: ${error.message}`)
  })
})
```

**优点**:
- 捕获真实浏览器控制台错误
- 捕获未捕获异常

**缺点**:
- 需要针对每个测试配置

**推荐**: 在 Playwright 全局配置中启用

### 2. 视觉渲染检测

#### 方案对比

| 方案 | 工具 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| **截图对比** | Playwright Visual Testing | 内置，无需额外服务 | 像素级对比敏感 | ⭐⭐⭐⭐ |
| **云端服务** | Percy, Chromatic | 智能对比，UI 审查 | 收费，依赖外部服务 | ⭐⭐⭐ |
| **DOM 结构验证** | Testing Library | 快速，稳定 | 无法检测样式问题 | ⭐⭐⭐⭐⭐ |

**推荐方案**: DOM 结构验证 + Playwright 截图对比

#### Playwright Visual Testing

```typescript
// tests/e2e/visual-regression.spec.ts
test('Basic workspace 视觉对比', async ({ page }) => {
  await page.goto('/')
  await page.getByText(/Basic.*System/i).click()

  // 生成 baseline 或对比
  await expect(page).toHaveScreenshot('basic-system-workspace.png', {
    maxDiffPixels: 100, // 允许 100 像素差异
    threshold: 0.2      // 20% 差异阈值
  })
})
```

**Baseline 管理**:
- 首次运行: `pnpm test:e2e --update-snapshots` 生成 baseline
- 后续运行: 自动对比，差异超过阈值则失败
- Baseline 存储: `tests/e2e/.screenshots/`
- 纳入版本控制

**优点**:
- 自动化，无需云服务
- 像素级精确对比
- 失败时生成对比图

**缺点**:
- 字体渲染差异（需要 headless 浏览器一致性）
- 动画/loading 状态需要 wait
- Baseline 更新需要人工审查

#### DOM 结构验证

```typescript
// packages/ui/tests/unit/components/BasicSystemWorkspace.spec.ts
test('应该渲染所有必需元素', () => {
  const wrapper = mount(BasicSystemWorkspace)

  // 验证关键元素存在
  expect(wrapper.find('[data-testid="prompt-input"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="optimize-button"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="test-area"]').exists()).toBe(true)

  // 验证 CSS 类
  expect(wrapper.find('.workspace-container').classes()).toContain('theme-light')

  // 验证可见性
  expect(wrapper.find('[data-testid="optimize-button"]').isVisible()).toBe(true)
})
```

**优点**:
- 快速，稳定
- 无像素级敏感度
- 语义化验证

**缺点**:
- 无法检测样式问题（颜色、字体、布局细节）

**推荐**: 组件测试用 DOM 验证，E2E 测试用截图对比

### 3. 状态同步检测

#### 方案: Pinia Store 监听 + UI 断言

```typescript
// packages/ui/tests/integration/state-sync.spec.ts
test('Store 更新应同步到 UI', async () => {
  const { pinia } = createTestPinia()
  const wrapper = mount(BasicSystemWorkspace, {
    global: { plugins: [pinia] }
  })

  const store = useBasicSystemSession(pinia)

  // 更新 Store
  store.updatePrompt('New Prompt')

  await wrapper.vm.$nextTick()

  // 验证 UI 同步
  const input = wrapper.find('[data-testid="prompt-input"]')
  expect(input.element.value).toBe('New Prompt')
})

test('UI 更新应同步到 Store', async () => {
  const { pinia } = createTestPinia()
  const wrapper = mount(BasicSystemWorkspace, {
    global: { plugins: [pinia] }
  })

  const store = useBasicSystemSession(pinia)
  const input = wrapper.find('[data-testid="prompt-input"]')

  // 更新 UI
  await input.setValue('User Input')

  // 验证 Store 同步
  expect(store.prompt).toBe('User Input')
})
```

**检测响应式失效**:
```typescript
test('computed 应正确触发', async () => {
  const { pinia } = createTestPinia()
  const store = useBasicSystemSession(pinia)

  // 监听 computed 变化
  let computedTriggered = false
  const stopWatch = watch(
    () => store.hasOptimizedResult,
    () => { computedTriggered = true }
  )

  // 触发依赖变化
  store.updateOptimizedResult({
    optimizedPrompt: 'Result',
    reasoning: 'Reason',
    chainId: 'chain',
    versionId: 'ver'
  })

  await nextTick()
  expect(computedTriggered).toBe(true)
  stopWatch()
})
```

### 4. 交互行为检测

#### 方案: 用户事件模拟 + 行为断言

**按钮点击响应**:
```typescript
test('优化按钮应触发优化流程', async () => {
  const mockOptimize = vi.fn().mockResolvedValue({
    optimizedPrompt: 'Optimized',
    reasoning: 'Reason',
    chainId: 'chain',
    versionId: 'ver'
  })

  const { pinia, services } = createTestPinia({
    promptService: { optimizePrompt: mockOptimize }
  })

  const wrapper = mount(BasicSystemWorkspace, {
    global: { plugins: [pinia] }
  })

  // 设置输入
  const store = useBasicSystemSession(pinia)
  store.updatePrompt('Test Prompt')

  // 点击按钮
  const button = wrapper.find('[data-testid="optimize-button"]')
  await button.trigger('click')

  // 验证行为
  expect(mockOptimize).toHaveBeenCalledWith(
    'Test Prompt',
    expect.any(Object)
  )

  await wrapper.vm.$nextTick()
  expect(store.optimizedPrompt).toBe('Optimized')
})
```

**表单提交流程**:
```typescript
test('表单提交应验证并保存', async () => {
  const { page } = await context.newPage()
  await page.goto('/')

  // 填写表单
  await page.fill('[data-testid="title-input"]', 'Test Title')
  await page.fill('[data-testid="content-input"]', 'Test Content')

  // 提交
  const submitButton = page.getByRole('button', { name: /保存/i })
  await submitButton.click()

  // 验证成功提示
  await expect(page.locator('.n-message')).toContainText('保存成功')

  // 验证数据持久化
  await page.reload()
  await expect(page.locator('[data-testid="title-input"]')).toHaveValue('Test Title')
})
```

**模态框行为**:
```typescript
test('模态框关闭应清理状态', async () => {
  const wrapper = mount(ImportExportDialog, {
    props: { show: true }
  })

  // 触发关闭
  await wrapper.find('[data-testid="close-button"]').trigger('click')

  // 验证 emit
  expect(wrapper.emitted('update:show')).toBeTruthy()
  expect(wrapper.emitted('update:show')[0]).toEqual([false])

  // 验证状态清理
  const internalState = wrapper.vm.exportData
  expect(internalState).toBeNull()
})
```

## VCR 模式技术调研

### 录制-回放库对比

| 库 | 优点 | 缺点 | 推荐度 |
|-----|------|------|--------|
| **MSW (Mock Service Worker)** | 拦截 fetch/XHR，支持浏览器和 Node | 需要手动编写 handlers | ⭐⭐⭐⭐⭐ |
| **nock** | HTTP mocking，简单易用 | 仅支持 Node.js | ⭐⭐⭐ |
| **Polly.js** | 自动录制-回放，适配器丰富 | 维护不活跃（最后更新 2021） | ⭐⭐ |
| **自定义 VCR** | 完全控制，定制化强 | 开发成本高 | ⭐⭐⭐⭐ |

**推荐方案**: MSW + 自定义 Fixtures 管理

### MSW + 自定义 VCR 实现

#### 架构设计

```
┌─────────────────────────────────────────────────────┐
│  测试代码                                            │
│  test('优化提示词', async () => { ... })             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  VCR Middleware                                     │
│  - 检测 fixture 是否存在                             │
│  - 存在: 回放 fixture (Mock)                         │
│  - 不存在: 调用真实 API 并录制                        │
└─────────────────────────────────────────────────────┘
                        ↓
         ┌──────────────┴──────────────┐
         ↓                              ↓
┌──────────────────┐          ┌──────────────────┐
│  Mock 模式        │          │  真实 API 模式    │
│  MSW handlers    │          │  真实 LLM 服务   │
│  读取 fixtures   │          │  录制响应        │
└──────────────────┘          └──────────────────┘
```

#### Fixtures 文件结构

```
packages/core/tests/fixtures/
├── llm/
│   ├── openai/
│   │   ├── chat-completion-simple.json
│   │   ├── chat-completion-streaming.json
│   │   └── error-rate-limit.json
│   ├── gemini/
│   │   └── generate-content.json
│   └── deepseek/
│       └── chat-completion.json
├── prompt/
│   ├── optimize-basic-system.json
│   ├── optimize-context-multi.json
│   └── test-prompt.json
└── image/
    ├── text2image-success.json
    └── image2image-success.json
```

**Fixture 格式**:
```json
{
  "request": {
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      { "role": "user", "content": "帮我写一封邮件" }
    ],
    "stream": true
  },
  "response": {
    "type": "streaming",
    "chunks": [
      { "content": "尊敬的", "timestamp": 0 },
      { "content": "张经理", "timestamp": 50 },
      { "content": "：", "timestamp": 100 }
    ],
    "finalResult": {
      "content": "尊敬的张经理：...",
      "usage": { "prompt_tokens": 10, "completion_tokens": 50 }
    }
  },
  "metadata": {
    "recordedAt": "2026-01-09T10:30:00Z",
    "scenarioName": "optimize-basic-system",
    "duration": 1500
  }
}
```

#### VCR 工具实现

```typescript
// packages/core/tests/utils/vcr.ts
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface VCROptions {
  fixturePath: string
  mode: 'auto' | 'record' | 'replay' | 'off'
}

export class VCR {
  constructor(private options: VCROptions) {}

  async intercept<T>(
    key: string,
    realFn: () => Promise<T>
  ): Promise<T> {
    const fixturePath = this.getFixturePath(key)

    // 模式判断
    if (this.options.mode === 'off') {
      return realFn()
    }

    if (this.options.mode === 'replay' ||
        (this.options.mode === 'auto' && existsSync(fixturePath))) {
      // 回放模式
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'))
      return this.simulateResponse(fixture)
    }

    if (this.options.mode === 'record' ||
        (this.options.mode === 'auto' && !existsSync(fixturePath))) {
      // 录制模式
      const result = await realFn()
      const fixture = this.serializeResult(key, result)
      writeFileSync(fixturePath, JSON.stringify(fixture, null, 2))
      return result
    }
  }

  private simulateResponse<T>(fixture: any): Promise<T> {
    // 模拟延迟
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(fixture.response.finalResult)
      }, fixture.metadata.duration || 100)
    })
  }

  private getFixturePath(key: string): string {
    return join(this.options.fixturePath, `${key}.json`)
  }
}
```

#### 流式响应 Mock

```typescript
// packages/core/tests/utils/stream-simulator.ts
export class StreamSimulator {
  constructor(private chunks: Array<{ content: string, timestamp: number }>) {}

  async *generate(): AsyncGenerator<string> {
    let lastTimestamp = 0

    for (const chunk of this.chunks) {
      // 模拟真实延迟
      const delay = chunk.timestamp - lastTimestamp
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      yield chunk.content
      lastTimestamp = chunk.timestamp
    }
  }
}

// 使用示例
const simulator = new StreamSimulator(fixture.response.chunks)
for await (const chunk of simulator.generate()) {
  callback(chunk)
}
```

### 环境变量控制

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      // 默认使用 Mock（VCR 回放）
      VCR_MODE: process.env.VCR_MODE || 'auto',

      // 可选: 强制使用真实 API
      ENABLE_REAL_LLM: process.env.ENABLE_REAL_LLM || 'false'
    }
  }
})
```

**测试命令**:
```bash
# 默认: 自动模式（有 fixture 则回放，无则录制）
pnpm test

# 强制录制（更新所有 fixtures）
VCR_MODE=record pnpm test

# 强制回放（仅使用 fixtures，无则失败）
VCR_MODE=replay pnpm test

# 禁用 VCR（始终使用真实 API）
VCR_MODE=off pnpm test
# 或
ENABLE_REAL_LLM=true pnpm test
```

## 测试分层与执行时间优化

### 目标

提交前测试必须 < 10 分钟，分层如下：

| 层级 | 执行时间 | 测试类型 | 说明 |
|------|---------|---------|------|
| **Fast** | 1-2 分钟 | 单元测试（纯逻辑） | 无 I/O，无 Mock，纯计算 |
| **Standard** | 3-4 分钟 | 单元+集成（Mock） | VCR 回放，Pinia 测试 |
| **Full** | 5-6 分钟 | E2E（浏览器） | Playwright，视觉回归 |
| **Total** | **< 10 分钟** | 提交前完整测试 | Fast + Standard + Full |

### 并行化策略

**Vitest 并行化**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // 最大并发 workers（CPU 核心数 - 1）
    maxWorkers: Math.max(1, os.cpus().length - 1),

    // 最小并发 workers
    minWorkers: 1,

    // 每个 worker 隔离模式
    pool: 'threads', // 或 'forks'

    // 超时配置
    testTimeout: 5000,
    hookTimeout: 10000
  }
})
```

**Playwright 并行化**:
```typescript
// playwright.config.ts
export default defineConfig({
  // 并发 workers
  workers: process.env.CI ? 1 : undefined, // CI 串行，本地并发

  // Sharding（分片执行）
  shard: process.env.SHARD ? {
    current: parseInt(process.env.SHARD_INDEX),
    total: parseInt(process.env.SHARD_TOTAL)
  } : undefined,

  // 失败重试
  retries: process.env.CI ? 2 : 0
})
```

**CI 分片执行**:
```yaml
# .github/workflows/test.yml
jobs:
  e2e:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - name: Run E2E tests (shard ${{ matrix.shard }}/4)
        run: pnpm test:e2e
        env:
          SHARD_INDEX: ${{ matrix.shard }}
          SHARD_TOTAL: 4
```

### 慢速测试标记

```typescript
// packages/ui/tests/unit/slow.spec.ts
test.skipIf(process.env.SKIP_SLOW === 'true')(
  '大型数据集性能测试',
  async () => {
    // 耗时测试
  },
  { timeout: 60000 }
)
```

**快速模式**:
```bash
# 跳过慢速测试（提交前快速验证）
SKIP_SLOW=true pnpm test

# 完整测试（CI 或发布前）
pnpm test
```

## 未解决问题

### 1. 视觉回归测试 baseline 管理

**问题**:
- Baseline 截图在不同操作系统可能有细微差异
- 字体渲染在 Windows/Mac/Linux 不一致

**待调研**:
- Docker 容器统一测试环境
- 云端 baseline 存储（Percy, Chromatic）
- 差异阈值调优

### 2. 流式响应录制的完整性

**问题**:
- 如何准确录制流式响应的时序？
- chunk 之间的延迟如何模拟？

**待实现**:
- 高精度时间戳记录（ms 级）
- 模拟网络抖动

### 3. Electron Desktop 测试

**问题**:
- Playwright 如何测试 Electron 应用？
- IPC 通信如何 Mock？

**待调研**:
- `@playwright/test` 的 Electron 支持
- Spectron（已废弃，需寻找替代方案）

## 下一步行动

1. **完成 Phase 1 调研**
   - [ ] 选定视觉回归测试工具（Playwright Visual Testing）
   - [ ] 设计 VCR 系统架构（MSW + 自定义 Fixtures）
   - [ ] 设计测试分层策略（Fast/Standard/Full）

2. **开始 Phase 2 实现**
   - [ ] 实现 VCR 基础设施
   - [ ] 录制首批 fixtures（OpenAI, DeepSeek）

3. **输出架构文档**
   - [ ] 编写 `architecture.md`
   - [ ] 更新 `task_plan.md` 决策日志
