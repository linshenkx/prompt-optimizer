# 国际化（i18n）规范指南

## 翻译键名规范

为了保持翻译文件的一致性和可维护性，请遵循以下键名规范：

### 1. 命名结构

使用嵌套对象结构，按照以下层次组织翻译键：

```
{
  "模块名": {
    "子模块或功能": {
      "具体文本": "翻译内容"
    }
  }
}
```

### 2. 模块划分

- `common`: 通用文本，如按钮文本、常见操作等
- 具体功能模块: 如 `promptOptimizer`, `settings`, `modelManager` 等

### 3. 参数化文本

对于包含变量的文本，使用花括号标记参数：

```typescript
// 定义
"version": "V{version}"

// 使用
t('common.version', { version: '1.0.0' })
```

### 4. 示例结构

```typescript
export default {
  // 通用文本
  common: {
    buttons: {
      save: '保存',
      cancel: '取消',
      confirm: '确认',
    },
    labels: {
      createdAt: '创建于',
      lastModified: '最后修改',
    },
    messages: {
      loading: '加载中...',
      noData: '暂无数据',
    },
  },
  
  // 功能模块
  promptOptimizer: {
    title: '小词',
    form: {
      inputPlaceholder: '请输入需要优化的prompt...',
      templateLabel: '优化提示词',
    },
    actions: {
      optimize: '开始优化 →',
      save: '保存提示词',
      share: '分享',
    },
  },
  
  // 设置模块
  settings: {
    title: '设置',
    sections: {
      language: '语言设置',
      theme: '主题设置',
      api: 'API设置',
    },
  },
}
```

## 最佳实践

1. **保持一致性**: 同类型的文本应使用相同的键名结构
2. **避免重复**: 通用文本应放在 `common` 下，避免在多个模块中重复定义
3. **描述性键名**: 键名应清晰描述文本的用途，而不是直接使用翻译内容
4. **模块化**: 按功能模块组织翻译，便于维护和查找
5. **注释**: 对于复杂或特殊用途的文本，添加注释说明

## 添加新语言

添加新语言时，请确保：

1. 在 `locales` 目录下创建对应的语言文件，如 `ja-JP.ts`
2. 复制现有语言文件的结构，确保键名完全一致
3. 在 `packages/ui/src/plugins/i18n.ts` 中：
   - 导入新语言文件
   - 添加到 `SupportedLocale` 类型
   - 添加到 `SUPPORTED_LOCALES` 数组
   - 配置 fallback 规则
   - 添加到 `messages` 对象
4. 在 `packages/ui/src/components/LanguageSwitchDropdown.vue` 中添加新语言选项
5. 测试所有页面在新语言下的显示效果

## 当前支持的语言

- **简体中文 (zh-CN)**: 默认语言，适用于中国大陆用户
- **繁體中文 (zh-TW)**: 适用于台湾、香港等地区用户，基于简体中文翻译并适配港台用语习惯
- **English (en-US)**: 英语，适用于国际用户 