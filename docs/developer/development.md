# 开发指南 (Development Guide)

## 目录

- [本地开发环境配置](#本地开发环境配置)
- [Docker开发和部署](#docker开发和部署)
- [环境变量配置](#环境变量配置)
- [开发工作流程](#开发工作流程)
- [项目构建和部署](#项目构建和部署)
- [常见问题解决](#常见问题解决)

## 本地开发环境配置

### 基础环境要求
- Node.js 22.x
- pnpm >= 8
- Git >= 2.0
- VSCode (推荐)

### 开发环境设置
```bash
# 1. 克隆项目
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. 安装依赖
pnpm install

# 3. 启动开发服务
pnpm dev               # Web开发：构建core/ui并运行web应用
pnpm dev:fresh         # Web开发（完整重置）：清理+重装+启动
pnpm dev:desktop       # Desktop开发：构建core/ui，同时运行web和desktop
pnpm dev:desktop:fresh # Desktop开发（完整重置）：清理+重装+启动
```

## Docker开发和部署

### 环境要求
- Docker >= 20.10.0

### Docker构建和运行

#### 基础构建
```bash
# 获取package.json中的版本号
$VERSION=$(node -p "require('./package.json').version")

# 构建镜像（使用动态版本号）
docker build -t linshen/prompt-optimizer:$VERSION .

# 添加latest标签
docker tag linshen/prompt-optimizer:$VERSION linshen/prompt-optimizer:latest

# 运行容器
docker run -d -p 80:80 --restart unless-stopped --name globalcloud-xiaoc -e ACCESS_PASSWORD=1234!@#$  linshen/prompt-optimizer:$VERSION


# 推送
docker push linshen/prompt-optimizer:$VERSION
docker push linshen/prompt-optimizer:latest

```

docker本地构建测试
```shell
docker build -t linshen/prompt-optimizer:test .
docker rm -f prompt-optimizer
docker run -d -p 80:80 --restart unless-stopped --name globalcloud-xiaoc -e VITE_GEMINI_API_KEY=111 linshen/prompt-optimizer:test

```


### 多阶段构建说明

Dockerfile使用了多阶段构建优化镜像大小：

1. `base`: 基础Node.js环境，安装pnpm
2. `builder`: 构建阶段，安装依赖并构建项目
3. `production`: 最终镜像，只包含构建产物和nginx

## 环境变量配置

### 本地开发环境变量
在项目根目录创建 `.env.local` 文件：

```env
# OpenAI API配置
VITE_OPENAI_API_KEY=your_openai_api_key

# Gemini API配置
VITE_GEMINI_API_KEY=your_gemini_api_key

# DeepSeek API配置
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key

# 自定义API配置
VITE_CUSTOM_API_KEY=your_custom_api_key
VITE_CUSTOM_API_BASE_URL=your_custom_api_base_url
VITE_CUSTOM_API_MODEL=your_custom_model_name
```

### Docker环境变量
通过 `-e` 参数设置容器环境变量：

```bash
docker run -d -p 80:80 \
  -e VITE_OPENAI_API_KEY=your_key \
  -e VITE_CUSTOM_API_BASE_URL=your_api_url \
  prompt-optimizer
```

## 开发工作流程

### 代码提交规范
```bash
# 提交格式
<type>(<scope>): <subject>

# 示例
feat(ui): 添加新的提示词编辑器组件
fix(core): 修复API调用超时问题
```

### 测试流程
```bash
# 运行所有包的测试
pnpm test

# 运行特定包的测试（直接使用pnpm workspace命令）
pnpm -F @prompt-optimizer/core test
pnpm -F @prompt-optimizer/ui test
pnpm -F @prompt-optimizer/web test
```

## 项目构建和部署

### 分支管理策略

#### 🌿 分支结构
- **`main`**: 生产分支，触发 Vercel 自动部署
- **`develop`**: 开发分支，不触发 Vercel 部署
- **`feature/*`**: 功能分支，从 develop 分出

#### 🔄 开发工作流
```bash
# 1. 从 develop 分支开始开发
git checkout develop
git pull origin develop

# 2. 创建功能分支
git checkout -b feature/new-feature

# 3. 开发完成后推送到功能分支
git add .
git commit -m "feat: 添加新功能"
git push origin feature/new-feature

# 4. 合并到 develop 分支（不会触发 Vercel 部署）
git checkout develop
git merge feature/new-feature
git push origin develop

# 5. 准备发布时，合并到 main 分支（触发 Vercel 部署）
git checkout main
git merge develop
git push origin main
```

### 版本发布流程

#### 📋 版本号管理
使用语义化版本控制，通过 pnpm 命令管理版本号：

```bash
# 更新版本号（不创建 tag）
pnpm version:prepare patch   # 1.0.0 → 1.0.1
pnpm version:prepare minor   # 1.0.0 → 1.1.0
pnpm version:prepare major   # 1.0.0 → 2.0.0

# 提交版本更改
git commit -m "chore: bump version to $(node -p \"require('./package.json').version\")"
```

#### 🚀 Desktop 应用发布
项目配置了基于 Git Tag 的自动化发布流程，支持多平台构建和自动生成 Release Notes。

**发布正式版本**：
```bash
# 1. 在 develop 分支准备版本
git checkout develop
pnpm version:prepare minor
git commit -m "chore: bump version to $(node -p \"require('./package.json').version\")"
git push origin develop

# 2. 合并到 main 分支（触发 Vercel 部署）
git checkout main
git merge develop
git push origin main

# 3. 创建并推送版本标签（触发 Desktop 构建）
pnpm run version:tag
pnpm run version:publish
```

**发布预览版本**：
```bash
# 在 develop 分支创建预览版本标签
git checkout develop

# 手动创建预览版本标签
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1

# 或使用脚本（需要先手动修改版本号为预览格式）
# 编辑 package.json: "version": "1.2.0-beta.1"
# pnpm run version:tag && pnpm run version:publish
```

#### 📦 自动化构建特性
- **多平台构建**：自动在 Windows、macOS、Linux 上构建对应的安装包
- **智能 Release Notes**：自动提取两个版本间的 commit 信息
- **版本类型识别**：自动区分正式版本和预览版本
- **Commit 优化**：自动截断过长的 commit（80字符），限制显示数量（20个）

#### 🎯 发布结果
推送标签后，GitHub Actions 会自动：
1. 在三个平台上并行构建 Desktop 应用
2. 生成包含 commit 历史的 Release Notes
3. 创建 GitHub Release 并上传所有构建文件
4. 正式版本标记为 Release，预览版本标记为 Pre-release

### 构建说明
项目采用 monorepo 架构，包含以下子包：
- `@prompt-optimizer/core`: 核心逻辑包
- `@prompt-optimizer/ui`: UI组件包
- `@prompt-optimizer/web`: Web应用
- `@prompt-optimizer/extension`: 浏览器扩展
- `@prompt-optimizer/desktop`: Desktop应用

构建顺序：core → ui → (web/extension/desktop 并行)

### 本地构建
```bash
# 构建所有包（按依赖顺序：core → ui → web/ext/desktop并行）
pnpm build

# 构建特定包
pnpm build:core        # 构建核心包
pnpm build:ui          # 构建UI组件包
pnpm build:web         # 构建Web应用
pnpm build:ext         # 构建浏览器扩展
pnpm build:desktop     # 构建Desktop应用（包含打包）

# Desktop可执行文件构建
pnpm build:desktop             # 完整构建：core→ui→web→desktop打包
```

### 手动发布（本地构建）
如果需要本地构建和测试：

```bash
# 构建所有平台（仅在对应平台上有效）
pnpm build:desktop

# 查看构建结果
ls packages/desktop/dist/
```

### 版本管理最佳实践

#### 📋 版本号规范
- **正式版本**：`v1.0.0`, `v2.1.3` - 遵循语义化版本控制
- **预览版本**：`v1.0.0-beta.1`, `v1.0.0-rc.1`, `v1.0.0-alpha.1`

#### ⚠️ electron-updater 版本号注意事项

**重要**：electron-updater 对预发布版本的处理有特殊限制，必须使用正确的版本号格式。

**✅ 推荐格式（符合 SemVer 2.0.0 标准）**：
```bash
v1.2.6-alpha.1, v1.2.6-alpha.2, v1.2.6-alpha.3
v1.2.6-beta.1, v1.2.6-beta.2, v1.2.6-beta.3
v1.2.6-rc.1, v1.2.6-rc.2, v1.2.6-rc.3
```

**❌ 避免格式（可能导致 electron-updater 检测问题）**：
```bash
v1.2.6-alpha1, v1.2.6-alpha2, v1.2.6-alpha3
v1.2.6-beta1, v1.2.6-beta2, v1.2.6-beta3
v1.2.6-rc1, v1.2.6-rc2, v1.2.6-rc3
```

**问题说明**：
- electron-updater 将预发布版本的第一部分（如 `beta2` 中的 `beta`）视为**频道标识符**
- 使用 `beta1`, `beta2`, `beta3` 格式时，可能出现版本检测异常
- 从 `v1.2.6-beta2` 无法正确检测到 `v1.2.6-beta3` 的更新
- 使用点分隔格式 `beta.1`, `beta.2`, `beta.3` 可以避免此问题

**最佳实践**：
1. 始终使用点分隔的预发布版本号格式
2. 遵循 `<version>-<stage>.<number>` 的命名规范
3. 如果遇到版本检测问题，考虑跳过问题版本或重新发布

#### 🔄 完整发布流程
1. **开发阶段**：在 `develop` 分支开发新功能
2. **版本准备**：在 `develop` 分支使用 `pnpm version:prepare` 更新版本号
3. **预览测试**：在 `develop` 分支创建 `beta` 标签进行测试
4. **生产部署**：合并到 `main` 分支触发 Vercel 部署
5. **正式发布**：在 `main` 分支创建正式版本标签

#### 🐛 Bug 修复和版本覆盖

**发现 bug 后的处理方案**：

**方案一：覆盖现有版本（不推荐用于正式版本）**
```bash
# 1. 修复 bug 并提交
git add .
git commit -m "fix: 修复关键bug"

# 2. 删除本地和远程 tag
git tag -d v1.2.0                    # 删除本地 tag
git push origin :refs/tags/v1.2.0    # 删除远程 tag

# 3. 手动删除 GitHub Release
# 访问 GitHub → Releases → 找到对应版本 → Delete

# 4. 重新创建 tag 和发布
pnpm run version:tag      # 重新创建 tag
pnpm run version:publish  # 重新推送 tag（触发新的构建）
```

**方案二：发布补丁版本（推荐）**
```bash
# 1. 修复 bug
git add .
git commit -m "fix: 修复关键bug"

# 2. 发布补丁版本
pnpm version:prepare patch  # 1.2.0 → 1.2.1
git commit -m "chore: bump version to v1.2.1"
pnpm run version:tag
pnpm run version:publish
```

**预览版本覆盖（相对安全）**
```bash
# 预览版本可以安全覆盖
git tag -d v1.2.0-beta.1
git push origin :refs/tags/v1.2.0-beta.1

# 修复后重新发布
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

#### ⚠️ 重要说明
- **避免直接使用 `pnpm version`**：会自动创建 tag，可能导致意外发布
- **使用 `pnpm version:prepare`**：只更新版本号，不创建 tag
- **手动控制 tag 创建时机**：使用 `pnpm run version:tag` 和 `pnpm run version:publish`
- **正式版本覆盖需谨慎**：可能影响已下载的用户
- **推荐使用补丁版本**：而不是覆盖现有版本
- **Vercel 部署**：只有推送到 `main` 分支才会触发
- **Desktop 发布**：推送 Git Tag 会触发 Desktop 应用构建

#### 📝 Commit 规范
为了生成更好的 Release Notes，建议使用规范的 commit 格式：
```bash
# 功能添加
git commit -m "feat(ui): 添加新的提示词编辑器"

# 问题修复
git commit -m "fix(core): 修复API调用超时问题"

# 文档更新
git commit -m "docs: 更新开发指南"

# 性能优化
git commit -m "perf(web): 优化页面加载速度"
```

### Vercel 部署控制

#### 🎯 分支控制策略
项目配置了基于分支的 Vercel 部署控制，简单有效。

**部署规则**：
- ✅ **`main/master` 分支**：自动触发 Vercel 部署
- ❌ **其他分支**：不会触发 Vercel 部署

#### 📝 手动控制构建

**跳过 Vercel 构建**：
```bash
# 使用 Git 标准的跳过标记
git commit -m "docs: 更新文档 [skip ci]"
git commit -m "fix(desktop): 修复桌面应用问题 [skip ci]"
```

**正常 Vercel 构建**：
```bash
# 推送到 main 分支会自动触发构建
git checkout main
git merge develop
git push origin main
```

#### 🔧 最佳实践
- **开发阶段**：在 `develop` 分支工作，不会触发 Vercel 部署
- **测试阶段**：在 `develop` 分支发布预览版本测试 Desktop 应用
- **生产部署**：合并到 `main` 分支时才触发 Vercel 部署

### 常用Docker命令

```bash
# 查看容器日志
docker logs -f prompt-optimizer

# 进入容器
docker exec -it globalcloud-xiaoc sh

# 容器管理
docker stop prompt-optimizer
docker start prompt-optimizer
docker restart globalcloud-xiaoc

# 清理资源
docker rm prompt-optimizer
docker rmi prompt-optimizer
```

## 发布故障排除

### 🚨 紧急修复流程

#### 场景一：正式版本有严重 bug
```bash
# 1. 立即修复 bug
git checkout main
git pull origin main
# ... 修复代码 ...
git add .
git commit -m "hotfix: 修复严重bug"

# 2. 发布热修复版本
pnpm version:prepare patch  # 1.2.0 → 1.2.1
git commit -m "chore: hotfix version v1.2.1"
git push origin main

# 3. 发布新版本
pnpm run version:tag
pnpm run version:publish

# 4. 在 GitHub Release 中标记旧版本为 "不推荐使用"
```

#### 场景二：预览版本需要快速迭代
```bash
# 删除现有预览版本
git tag -d v1.2.0-beta.1
git push origin :refs/tags/v1.2.0-beta.1

# 修复后重新发布相同版本
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

#### 场景三：构建失败需要重新触发
```bash
# 删除 tag 重新触发构建
git push origin :refs/tags/v1.2.0
git push origin v1.2.0

# 或者创建新的 patch 版本
pnpm version:prepare patch
pnpm run version:tag
pnpm run version:publish
```

### 📋 GitHub Release 管理

#### 删除 Release
1. 访问 GitHub 项目页面
2. 点击 "Releases" 标签
3. 找到要删除的版本
4. 点击 "Edit" → "Delete this release"
5. 确认删除

#### 编辑 Release
1. 在 Release 页面点击 "Edit"
2. 可以修改标题、描述、标记为预发布
3. 可以删除或重新上传构建文件
4. 保存更改

### ⚡ 快速命令参考

```bash
# 删除本地 tag
git tag -d v1.2.0

# 删除远程 tag
git push origin :refs/tags/v1.2.0

# 查看所有 tag
git tag -l

# 查看远程 tag
git ls-remote --tags origin

# 强制推送 tag（覆盖远程）
git push origin v1.2.0 --force

# 重新创建并推送 tag
git tag v1.2.0
git push origin v1.2.0
```

## 常见问题解决

### 依赖安装问题
```bash
# 清理依赖缓存
pnpm clean

# 重新安装依赖
pnpm install --force
```

### 开发环境问题
```bash
# 完全重置Web开发环境
pnpm dev:fresh

# 完全重置Desktop开发环境
pnpm dev:desktop:fresh

# 清理构建缓存
pnpm clean
rm -rf node_modules
pnpm install
```

### 构建失败处理
1. 检查Node.js版本是否符合要求
2. 清理构建缓存：`pnpm clean`
3. 重新安装依赖：`pnpm install`
4. 查看详细构建日志：`pnpm build --debug`

### 容器运行问题
1. 检查端口占用：`netstat -ano | findstr :80`
2. 检查容器日志：`docker logs globalcloud-xiaoc`
3. 检查容器状态：`docker ps -a`
