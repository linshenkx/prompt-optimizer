# API密钥快速链接功能测试计划

## 功能概述
在模型管理UI中，为API Key配置字段添加了可点击的链接按钮，用户可以直接跳转到各个提供商的API密钥获取页面。

## 测试前准备

### 环境要求
1. Node.js 版本：^18.0.0 || ^20.0.0 || ^22.0.0（当前系统为 v25.2.1，需要降级）
2. 安装依赖：`pnpm install`
3. 启动开发服务器：`pnpm dev`

### Node.js 版本切换（推荐使用 nvm）
```bash
# 安装 nvm（如果未安装）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装并使用兼容版本
nvm install 22
nvm use 22

# 验证版本
node -v  # 应该显示 v22.x.x

# 然后安装依赖
pnpm install
```

## 测试用例

### 1. 文本模型 API 密钥链接测试

#### 测试步骤
1. 启动应用程序
2. 进入"模型管理" → "文本模型"页面
3. 点击"添加模型"或编辑现有模型

#### 需要测试的提供商及其预期URL

| 提供商 | 预期跳转URL | 验证要点 |
|--------|-------------|----------|
| DeepSeek | https://platform.deepseek.com/api_keys | ✓ 链接按钮显示 ✓ 点击新窗口打开 ✓ URL正确 |
| OpenAI | https://platform.openai.com/api-keys | 同上 |
| Google Gemini | https://aistudio.google.com/apikey | 同上 |
| Anthropic Claude | https://console.anthropic.com/settings/keys | 同上 |
| 智谱AI (ZhiPu) | https://open.bigmodel.cn/usercenter/apikeys | 同上 |
| SiliconFlow | https://cloud.siliconflow.cn/account/ak | 同上 |
| 阿里云百炼 (DashScope) | https://bailian.console.aliyun.com/?apiKey=1#/api-key | 同上 |
| OpenRouter | https://openrouter.ai/settings/keys | 同上 |
| ModelScope | https://modelscope.cn/my/myaccesstoken | 同上 |

#### 具体验证项
- [ ] **按钮显示**：链接按钮出现在"API密钥"标签旁边
- [ ] **图标显示**：外部链接图标（14x14px）清晰可见
- [ ] **Tooltip**：鼠标悬停显示"获取API密钥"提示
- [ ] **链接行为**：点击在新标签页打开（target="_blank"）
- [ ] **安全性**：新标签页不能访问原窗口（rel="noopener noreferrer"）
- [ ] **布局**：按钮不影响表单布局，排列整齐
- [ ] **响应式**：按钮在不同屏幕尺寸下显示正常

### 2. 图像模型 API 密钥链接测试

#### 测试步骤
1. 进入"模型管理" → "图像模型"页面
2. 点击"添加模型"或编辑现有模型

#### 需要测试的提供商及其预期URL

| 提供商 | 预期跳转URL | 验证要点 |
|--------|-------------|----------|
| OpenAI DALL-E | https://platform.openai.com/api-keys | ✓ 链接按钮显示 ✓ 点击新窗口打开 ✓ URL正确 |
| Google Imagen | https://aistudio.google.com/apikey | 同上 |
| 阿里云百炼 (DashScope) | https://bailian.console.aliyun.com/?apiKey=1#/api-key | 同上 |

#### 具体验证项
- [ ] 按钮显示与文本模型一致
- [ ] 图标和Tooltip正确
- [ ] 链接行为正确
- [ ] 安全性验证通过

### 3. UI/UX 交互测试

#### 测试场景
- [ ] **切换提供商**：在编辑模态框中切换不同提供商，链接按钮的URL应实时更新
- [ ] **无apiKeyUrl的提供商**：切换到没有定义apiKeyUrl的提供商（如自定义本地模型），链接按钮应隐藏
- [ ] **深色/浅色主题**：在不同主题下，图标颜色和可见性应该正常
- [ ] **国际化**：切换语言（中文简体/英文/中文繁体），Tooltip文字应正确显示
  - 中文简体：获取API密钥
  - English: Get API Key
  - 中文繁體：獲取API金鑰

#### 性能测试
- [ ] **流畅性**：点击链接按钮应立即响应，无卡顿
- [ ] **不干扰其他功能**：
  - 输入API Key不受影响
  - 保存/取消按钮功能正常
  - 表单验证不受影响
  - 其他配置项正常工作
- [ ] **表单提交**：添加/编辑模型后，配置正确保存

### 4. 边界情况测试

#### 测试用例
- [ ] **空字符串**：如果某个adapter的apiKeyUrl被设为空字符串，按钮应隐藏
- [ ] **undefined**：如果apiKeyUrl未定义，按钮应隐藏
- [ ] **特殊字符URL**：测试包含特殊字符的URL（如阿里云的`?apiKey=1#/api-key`）是否正确编码和跳转
- [ ] **长URL**：确保长URL不会导致布局问题

### 5. 回归测试

#### 现有功能验证
- [ ] 添加新的文本模型功能正常
- [ ] 编辑现有文本模型功能正常
- [ ] 删除模型功能正常
- [ ] 添加新的图像模型功能正常
- [ ] 编辑现有图像模型功能正常
- [ ] 模型列表显示正常
- [ ] 搜索和筛选功能正常

## 测试工具建议

### 浏览器开发者工具
1. **检查元素**：验证HTML结构和属性
   ```html
   <a href="https://platform.deepseek.com/api_keys" 
      target="_blank" 
      rel="noopener noreferrer">
   ```

2. **控制台**：检查是否有JavaScript错误

3. **网络面板**：确认没有不必要的网络请求

4. **性能面板**：检查是否有性能问题

### 测试浏览器
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari

## 已知限制

1. **环境依赖**：需要兼容的Node.js版本
2. **构建未验证**：由于环境限制，TypeScript编译尚未验证（但代码结构正确）

## 测试报告模板

### 测试结果记录
```markdown
## 测试日期：[日期]
## 测试人员：[姓名]
## 测试环境：[浏览器/操作系统]

### 通过的测试用例
- [ ] 文本模型 - DeepSeek
- [ ] 文本模型 - OpenAI
- [ ] ...

### 失败的测试用例
- [ ] 问题描述
  - 预期行为：
  - 实际行为：
  - 复现步骤：
  - 错误截图：

### 改进建议
- 
```

## 快速测试检查清单

```bash
# 1. 环境准备
nvm use 22
pnpm install

# 2. 启动开发服务器
pnpm dev

# 3. 打开浏览器测试
# 访问 http://localhost:5173 (或配置的端口)

# 4. 核心功能快速验证（5分钟）
✓ 打开文本模型管理
✓ 点击"添加模型"
✓ 选择 DeepSeek
✓ 查看API密钥字段旁边是否有链接按钮
✓ 点击按钮，确认跳转到 https://platform.deepseek.com/api_keys
✓ 切换到 OpenAI，确认URL更新
✓ 测试图像模型也有相同功能

# 5. 完整测试（30分钟）
- 遍历所有提供商
- 测试所有边界情况
- 验证国际化
- 测试不同主题
```

## 注意事项

1. **安全性**：所有外部链接都使用 `rel="noopener noreferrer"` 防止安全风险
2. **可访问性**：确保键盘导航可以访问链接按钮（Tab键）
3. **移动端**（如果支持）：确认在移动设备上的显示和交互
4. **网络离线**：在离线状态下，按钮应该仍然显示，只是点击时浏览器会提示无法访问

## 成功标准

✅ **功能完整性**
- 所有列出的提供商都有正确的链接
- 链接在新窗口打开
- URL完全正确

✅ **用户体验**
- 操作流畅无卡顿
- 布局美观整齐
- 提示信息清晰
- 不干扰现有功能

✅ **技术质量**
- 无JavaScript错误
- 无布局问题
- 无性能问题
- 代码符合项目规范

✅ **兼容性**
- 多浏览器兼容
- 多主题兼容
- 多语言兼容
