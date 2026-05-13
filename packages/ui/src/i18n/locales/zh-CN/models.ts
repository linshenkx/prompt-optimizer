const messages = {
  "modelManager": {
    "title": "模型管理",
    "textModels": "文本模型",
    "imageModels": "图像模型",
    "functionModels": "功能模型",
    "modelList": "模型列表",
    "testConnection": "测试连接",
    "editModel": "编辑",
    "deleteModel": "删除",
    "displayName": "显示名称",
    "enabled": "启用",
    "enabledStatus": "启用状态",
    "modelKey": "模型标识",
    "apiUrl": "API地址",
    "apiUrlHint": "示例：https://api.example.com/v1；多数提供商地址通常以 /v1 结尾",
    "apiUrlHintAriaLabel": "显示 API 地址说明",
    "defaultModel": "默认模型",
    "selectModel": "选择模型",
    "clickToFetchModels": "点击箭头获取模型列表",
    "apiKey": "API密钥",
    "getApiKey": "获取API密钥",
    "addModel": "添加",
    "addImageModel": "添加图像模型",
    "provider": {
      "section": "提供商配置",
      "label": "提供商",
      "placeholder": "选择提供商",
      "openaiHint": "官方 OpenAI API 入口。如果你想接入自定义 Base URL、第三方兼容服务或本地模型，请选择“Custom API (OpenAI Compatible)”。",
      "customApiHint": "用于接入自定义 OpenAI 兼容接口。你可以配置 Base URL、自定义模型名，并选择 Chat Completions 或 Responses 请求风格。",
      "dashscopeHint": "阿里百炼已支持 OpenAI 兼容的 Chat Completions 与 Responses 接口。当前可直接在这里切换请求风格进行使用。",
      "minimaxHint": "默认地址是 MiniMax 海外 OpenAI 兼容接口。国内用户请将 API 地址改为 https://api.minimaxi.com/v1；这里不要使用 MiniMax 的 Anthropic 格式地址。"
    },
    "connection": {
      "accountId": "账户 ID",
      "requestStyle": "请求风格",
      "requestStyleOptions": {
        "chatCompletions": "Chat Completions",
        "responses": "Responses"
      }
    },
    "model": {
      "section": "模型配置"
    },
    "advancedParameters": {
      "title": "高级参数",
      "noParamsConfigured": "未配置高级参数",
      "customParam": "自定义",
      "advancedTag": "高级",
      "add": "添加参数",
      "select": "选择参数",
      "selectTitle": "添加高级参数",
      "custom": "自定义参数",
      "customKeyPlaceholder": "输入参数名称",
      "customValuePlaceholder": "输入参数值",
      "stopSequencesPlaceholder": "输入停止序列（逗号分隔）",
      "unitLabel": "单位",
      "currentProvider": "当前提供商",
      "customProvider": "自定义",
      "availableParams": "个可选参数",
      "noAvailableParams": "无可选参数",
      "validation": {
        "unknownParam": "参数定义不存在",
        "customKeyRequired": "参数名称不能为空",
        "customValueRequired": "参数值不能为空",
        "duplicateParam": "参数已存在",
        "dangerousParam": "此参数名称包含潜在危险字符，不允许使用",
        "invalidNumber": "参数值必须是有效的{type}",
        "belowMin": "参数值不能小于 {min}",
        "aboveMax": "参数值不能大于 {max}",
        "mustBeInteger": "参数值必须是整数"
      },
      "formatJson": "JSON",
      "formatString": "字符串",
      "parsedAsObject": "已解析为 Object ✓",
      "invalidJson": "无效 JSON，将作为字符串发送"
    },
    "modelKeyPlaceholder": "请输入模型标识",
    "displayNamePlaceholder": "请输入显示名称",
    "apiUrlPlaceholder": "https://api.example.com/v1",
    "defaultModelPlaceholder": "输入或选择模型名称",
    "apiKeyPlaceholder": "请输入API密钥（可选）",
    "modelKeyRequired": "模型标识不能为空",
    "modelKeyReserved": "模型标识“{id}”与内置配置冲突，请换一个标识，或直接编辑对应的内置模型配置",
    "modelKeyAlreadyExists": "模型标识“{id}”已存在，请换一个标识",
    "modelIdGenerateFailed": "生成唯一的模型标识失败，请重试",
    "deleteConfirm": "确定要删除此模型吗？此操作不可恢复。",
    "testing": "正在测试连接...",
    "testSuccess": "{provider}连接测试成功",
    "testFailed": "{provider}连接测试失败：{error}",
    "updateSuccess": "更新成功",
    "updateFailed": "更新失败：{error}",
    "addSuccess": "添加成功",
    "addFailed": "添加失败：{error}",
    "createSuccess": "创建成功",
    "createFailed": "创建失败：{error}",
    "enableSuccess": "启用成功",
    "enableFailed": "启用失败：{error}",
    "disableSuccess": "禁用成功",
    "disableFailed": "禁用失败：{error}",
    "cloneModel": "克隆",
    "cloneSuccess": "模型克隆成功",
    "cloneFailed": "模型克隆失败",
    "deleteSuccess": "删除成功",
    "deleteFailed": "删除失败：{error}",
    "toggleFailed": "切换失败：{error}",
    "fetchModelsSuccess": "成功获取 {count} 个模型",
    "loadingModels": "正在加载模型选项...",
    "noModelsAvailable": "没有可用模型",
    "fetchModelsFailed": "获取模型列表失败：{error}",
    "fetchModelsFallback": "获取模型列表失败：{error}（已回退到默认的 {count} 个模型）",
    "needApiKeyAndBaseUrl": "请先填写API地址和密钥",
    "needBaseUrl": "请先填写API地址",
    "corsRestrictedTag": "CORS受限",
    "corsRestrictedConfirm": "{provider} 存在浏览器CORS跨域限制，Web端连接测试可能会失败。\n\n这不代表API Key有问题，而是浏览器安全策略阻止了请求。\n建议下载桌面版APP使用，或确保该提供商支持浏览器直连。\n\n是否继续测试？",
    "errors": {
      "crossOriginConnectionFailed": "跨域连接失败，请检查网络连接",
      "connectionFailed": "连接失败，请检查API地址和网络连接",
      "missingV1Suffix": "API地址格式错误，OpenAI兼容API需要包含\"/v1\"后缀",
      "invalidResponseFormat": "API返回格式不兼容，请检查API服务是否为OpenAI兼容格式",
      "emptyModelList": "API返回空的模型列表，该服务可能没有可用模型",
      "apiError": "API错误：{error}"
    },
    "disabled": "已禁用",
    "capabilities": {
      "tools": "工具调用",
      "reasoning": "推理模式",
      "vision": "视觉理解"
    },
    "testConnectionAriaLabel": "测试连接到{name}",
    "editModelAriaLabel": "编辑模型{name}",
    "enableModelAriaLabel": "启用模型{name}",
    "disableModelAriaLabel": "禁用模型{name}",
    "deleteModelAriaLabel": "删除模型{name}",
    "displayNameAriaLabel": "模型显示名称",
    "apiUrlAriaLabel": "模型API地址",
    "defaultModelAriaLabel": "默认模型名称",
    "apiKeyAriaLabel": "API密钥",
    "cancelEditAriaLabel": "取消编辑模型",
    "saveEditAriaLabel": "保存模型修改",
    "cancelAddAriaLabel": "取消添加模型",
    "confirmAddAriaLabel": "确认添加模型"
  },
  "functionModel": {
    "evaluationModel": "评估模型",
    "evaluationModelHint": "用于智能评估和变量提取，默认使用全局优化模型",
    "imageRecognitionModel": "图像识别模型",
    "imageRecognitionModelHint": "用于从图片提取 JSON 提示词和变量初始值，需单独设置",
    "noImageRecognitionModel": "请先在功能模型中设置图像识别模型",
    "unsupportedImageRecognitionModel": "当前图像识别模型暂不支持图片提取：{provider}"
  },
  "model": {
    "select": {
      "placeholder": "请选择模型",
      "configure": "配置模型",
      "noModels": "请配置模型",
      "noAvailableModels": "暂无可用模型"
    },
    "manager": {
      "displayName": "例如: 自定义模型",
      "apiUrl": "API 地址",
      "defaultModel": "默认模型名称",
      "modelNamePlaceholder": "例如: gpt-3.5-turbo"
    }
  },
  "params": {
    "temperature": {
      "label": "温度 (Temperature)",
      "description": "控制随机性：较低的值（例如0.2）使输出更集中和确定，较高的值（例如0.8）使其更随机。"
    },
    "top_p": {
      "label": "Top P (核心采样)",
      "description": "核心采样。仅考虑累积概率达到Top P阈值的Token。例如，0.1表示仅考虑构成最高10%概率质量的Token。"
    },
    "max_tokens": {
      "label": "最大Token数",
      "description": "在补全中生成的最大Token数量。"
    },
    "presence_penalty": {
      "label": "存在惩罚 (Presence Penalty)",
      "description": "介于-2.0和2.0之间的数字。正值会根据新Token是否已在文本中出现来惩罚它们，增加模型谈论新主题的可能性。"
    },
    "frequency_penalty": {
      "label": "频率惩罚 (Frequency Penalty)",
      "description": "介于-2.0和2.0之间的数字。正值会根据新Token在文本中已出现的频率来惩罚它们，降低模型逐字重复相同行的可能性。"
    },
    "timeout": {
      "label": "超时时间 (毫秒)",
      "description_openai": "OpenAI客户端连接的请求超时时间（毫秒）。"
    },
    "maxOutputTokens": {
      "label": "最大输出Token数",
      "description": "模型在单个响应中可以输出的最大Token数。"
    },
    "top_k": {
      "label": "Top K (K选顶)",
      "description": "将下一个Token的选择范围限制为K个最可能的Token。有助于减少无意义Token的生成。"
    },
    "candidateCount": {
      "label": "候选数量",
      "description": "返回的生成响应数量。必须介于1和8之间。"
    },
    "stopSequences": {
      "label": "停止序列",
      "description": "遇到时将停止输出生成的自定义字符串。用逗号分隔多个序列。"
    },
    "thinkingBudget": {
      "label": "思考预算",
      "description": "分配给模型思考过程的最大令牌数(仅 Gemini 2.5+)。范围：1-8192 令牌。"
    },
    "includeThoughts": {
      "label": "包含思考过程",
      "description": "是否在响应中包含模型的思考过程(仅 Gemini 2.5+)。启用后可以看到模型的推理步骤。"
    },
    "reasoning_effort": {
      "label": "推理强度",
      "description": "控制支持思考模式的模型投入的推理强度。"
    },
    "deepseek": {
      "thinking_type": {
        "label": "思考模式",
        "description": "控制 DeepSeek 思考模式，会作为 thinking.type 发送到 API 请求中。",
        "disabled": "关闭",
        "enabled": "开启"
      }
    },
    "tokens": {
      "unit": "令牌"
    },
    "size": {
      "label": "图像尺寸",
      "description": "生成图像的分辨率/尺寸，如 1024x1024"
    },
    "quality": {
      "label": "图像质量",
      "description": "生成图像的质量等级：auto（自动）、high（高质量）、medium（中等）、low（低质量）"
    },
    "background": {
      "label": "背景透明度",
      "description": "设置图像背景：auto（自动）、transparent（透明）、opaque（不透明）"
    },
    "imageSize": {
      "label": "图像尺寸",
      "description": "生成图像的分辨率/尺寸，如 1024x1024"
    },
    "steps": {
      "label": "迭代步数",
      "description": "扩散/推理迭代次数，步数越多通常质量越高但更慢"
    },
    "guidance": {
      "label": "引导强度",
      "description": "提示词遵循强度，值越大越贴近提示"
    },
    "cfg": {
      "label": "CFG强度",
      "description": "无分类器引导强度，用于控制生成图像与提示词的匹配程度（仅Qwen-Image模型）"
    },
    "negativePrompt": {
      "label": "负向提示词",
      "description": "不希望图像出现的内容或风格"
    },
    "responseFormat": {
      "label": "响应格式",
      "description": "返回图片的格式（URL 或 Base64 编码）"
    },
    "outputFormat": {
      "label": "输出格式",
      "description": "指定生成图像的文件格式（如 PNG、JPEG 或 WebP）"
    },
    "watermark": {
      "label": "水印",
      "description": "是否在生成的图像上添加水印"
    },
    "sequentialGeneration": {
      "label": "序列生成",
      "description": "控制序列图像生成模式（支持的模型）"
    },
    "tools": {
      "label": "工具",
      "description": "5.0 系列扩展工具列表，每行一个工具名"
    },
    "seed": {
      "label": "随机种子",
      "description": "用于控制生成结果的随机数种子，相同种子产生相同结果"
    },
    "enable_thinking": {
      "label": "启用思考",
      "description": "启用思考模式，让模型进行推理（仅支持部分模型）"
    },
    "thinking_budget": {
      "label": "思考Token预算",
      "description": "分配给思考过程的最大Token数，用于限制推理长度"
    },
    "enable_search": {
      "label": "启用联网搜索",
      "description": "启用联网搜索功能，让模型获取实时信息（仅支持部分模型）"
    },
    "max_completion_tokens": {
      "label": "最大补全Token数",
      "description": "在补全中生成的最大Token数量（推荐使用，替代 max_tokens）。范围：1-1,000,000。"
    },
    "logprobs": {
      "label": "返回对数概率",
      "description": "是否在响应中返回输出Token的对数概率信息。启用后可以看到模型对每个Token的置信度。"
    },
    "top_logprobs": {
      "label": "Top对数概率数量",
      "description": "返回每个Token位置上概率最高的N个备选Token及其对数概率。范围：0-20。需要先启用 logprobs。"
    },
    "n": {
      "label": "生成数量",
      "description": "为每个输入生成多少个补全结果。范围：1-128。注意：生成多个结果会消耗更多Token配额。"
    }
  }
} as const;

export default messages;
