export default {
  common: {
    loading: '加载中...',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    search: '搜索',
    settings: '设置',
    language: '语言',
    templates: '功能提示词',
    history: '历史记录',
    close: '关闭',
    test: '测试',
    enable: '启用',
    disable: '禁用',
    enabled: '已启用',
    disabled: '已禁用',
    add: '添加',
    remove: '移除',
    title: '标题',
    description: '描述',
    lastModified: '最后修改',
    noDescription: '暂无描述',
    builtin: '内置',
    custom: '自定义',
    currentTemplate: '当前提示词',
    use: '使用',
    expand: '展开',
    collapse: '收起',
    clear: '清空',
    createdAt: '创建于',
    version: 'V{version}',
    optimize: '优化',
    iterate: '迭代',
    copySuccess: '复制成功',
    copyFailed: '复制失败',
    appName: '提示词优化器',
    selectFile: '选择文件',
    exporting: '导出中...',
    importing: '导入中...',
    number: '数字',
    integer: '整数',
    optional: '可选',
  },
  nav: {
    home: '首页',
    dashboard: '仪表盘',
    promptOptimizer: '提示词优化器',
    modelManager: '模型管理',
    history: '历史记录',
    templates: '功能提示词',
    dataManager: '数据管理',
  },
  promptOptimizer: {
    title: '提示词优化器',
    inputPlaceholder: '请输入需要优化的prompt...',
    optimize: '开始优化 →',
    history: '历史记录',
    save: '保存提示词',
    share: '分享',
    export: '导出',
    originalPrompt: '原始提示词',
    optimizeModel: '优化模型',
    templateLabel: '优化提示词',

    // 新增：优化模式相关
    optimizationMode: '优化模式',
    systemPrompt: '系统提示词优化',
    userPrompt: '用户提示词优化',
    systemPromptInput: '系统提示词',
    userPromptInput: '用户提示词',
    systemPromptPlaceholder: '请输入需要优化的系统提示词...',
    userPromptPlaceholder: '请输入需要优化的用户提示词...',
    systemPromptHelp: '系统提示词优化模式：优化用于定义AI助手角色、行为和回应风格的系统提示词',
    userPromptHelp: '用户提示词优化模式：优化用户与AI交互时使用的提示词，提高交互效果和准确性'
  },
  settings: {
    title: '设置',
    language: '语言设置',
    theme: '主题设置',
    apiSettings: 'API设置',
    about: '关于',
  },
  modelManager: {
    title: '模型管理',
    modelList: '模型列表',
    testConnection: '测试连接',
    editModel: '编辑',
    deleteModel: '删除',
    displayName: '显示名称',
    modelKey: '模型标识',
    apiUrl: 'API地址',
    defaultModel: '默认模型',
    clickToFetchModels: '点击箭头获取模型列表',
    apiKey: 'API密钥',
    useVercelProxy: '使用Vercel代理',
    useVercelProxyHint: '使用Vercel代理可以解决跨域问题，但可能触发某些提供商的风控，请谨慎使用',
    addModel: '添加',

    // 高级参数
    advancedParameters: {
      title: '高级参数',
      noParamsConfigured: '未配置高级参数',
      customParam: '自定义',
      add: '添加参数',
      select: '选择参数',
      selectTitle: '添加高级参数',
      custom: '自定义参数',
      customKeyPlaceholder: '输入参数名称',
      customValuePlaceholder: '输入参数值',
      stopSequencesPlaceholder: '输入停止序列（逗号分隔）',
      unitLabel: '单位',
      currentProvider: '当前提供商',
      customProvider: '自定义',
      availableParams: '个可选参数',
      noAvailableParams: '无可选参数',
      validation: {
        dangerousParam: '此参数名称包含潜在危险字符，不允许使用',
        invalidNumber: '参数值必须是有效的{type}',
        belowMin: '参数值不能小于 {min}',
        aboveMax: '参数值不能大于 {max}',
        mustBeInteger: '参数值必须是整数'
      }
    },

    // 占位符
    modelKeyPlaceholder: '请输入模型标识',
    displayNamePlaceholder: '请输入显示名称',
    apiUrlPlaceholder: '请输入API地址',
    defaultModelPlaceholder: '输入或选择模型名称',
    apiKeyPlaceholder: '请输入API密钥',

    // 确认信息
    deleteConfirm: '确定要删除此模型吗？此操作不可恢复。',

    // 操作结果
    testSuccess: '{provider}连接测试成功',
    testFailed: '{provider}连接测试失败：{error}',
    updateSuccess: '更新成功',
    updateFailed: '更新失败：{error}',
    addSuccess: '添加成功',
    addFailed: '添加失败：{error}',
    enableSuccess: '启用成功',
    enableFailed: '启用失败：{error}',
    disableSuccess: '禁用成功',
    disableFailed: '禁用失败：{error}',
    deleteSuccess: '删除成功',
    deleteFailed: '删除失败：{error}',
    fetchModelsSuccess: '成功获取 {count} 个模型',
    loadingModels: '正在加载模型选项...',
    noModelsAvailable: '没有可用模型',
    selectModel: '选择一个模型',
    fetchModelsFailed: '获取模型列表失败：{error}',
    needApiKeyAndBaseUrl: '请先填写API地址和密钥',

    // 状态文本
    disabled: '已禁用',

    // 无障碍标签
    testConnectionAriaLabel: '测试连接到{name}',
    editModelAriaLabel: '编辑模型{name}',
    enableModelAriaLabel: '启用模型{name}',
    disableModelAriaLabel: '禁用模型{name}',
    deleteModelAriaLabel: '删除模型{name}',
    displayNameAriaLabel: '模型显示名称',
    apiUrlAriaLabel: '模型API地址',
    defaultModelAriaLabel: '默认模型名称',
    apiKeyAriaLabel: 'API密钥',
    useVercelProxyAriaLabel: '是否使用Vercel代理',
    cancelEditAriaLabel: '取消编辑模型',
    saveEditAriaLabel: '保存模型修改',
    cancelAddAriaLabel: '取消添加模型',
    confirmAddAriaLabel: '确认添加模型'
  },
  templateManager: {
    title: '功能提示词管理',
    optimizeTemplates: '系统提示词优化模板',
    iterateTemplates: '迭代优化模板',
    optimizeTemplateList: '系统提示词优化模板列表',
    iterateTemplateList: '迭代优化模板列表',
    userOptimizeTemplates: '用户提示词优化模板',
    userOptimizeTemplateList: '用户提示词优化模板列表',
    addTemplate: '添加',
    editTemplate: '编辑',
    deleteTemplate: '删除',
    templateCount: '{count}个提示词',

    // 按钮文本
    importTemplate: '导入',
    exportTemplate: '导出',
    copyTemplate: '复制',
    useTemplate: '使用此提示词',
    viewTemplate: '查看',
    migrate: '升级',
    help: '帮助',

    // 模板格式
    templateFormat: '模板格式',
    simpleTemplate: '简单模板',
    advancedTemplate: '高级模板',
    simpleTemplateHint: '不使用模板技术，直接将模板内容作为系统提示词，用户输入作为用户消息',
    advancedTemplateHint: '支持多消息结构和高级模板语法，可使用变量：originalPrompt、lastOptimizedPrompt、iterateInput',

    // 消息模板
    messageTemplates: '消息模板',
    addMessage: '添加消息',
    removeMessage: '删除消息',
    moveUp: '上移',
    moveDown: '下移',
    messageContentPlaceholder: '输入消息内容，支持变量如 originalPrompt',

    // 角色
    roleSystem: '系统',
    roleUser: '用户',
    roleAssistant: '助手',

    // 预览
    preview: '预览',

    // 迁移
    convertToAdvanced: '转换为高级格式',
    migrationDescription: '将简单模板转换为高级消息格式，提供更灵活的控制能力。',
    originalTemplate: '原始模板',
    convertedTemplate: '转换后模板',
    applyMigration: '应用转换',
    migrationSuccess: '模板转换成功',
    migrationFailed: '模板转换失败',

    // 语法指南
    syntaxGuide: '语法指南',

    // 表单字段
    name: '提示词名称',
    content: '提示词内容',
    description: '描述',
    type: '类型',

    // 占位符
    namePlaceholder: '请输入提示词名称',
    contentPlaceholder: '请输入提示词内容',
    descriptionPlaceholder: '请输入提示词描述（可选）',
    searchPlaceholder: '搜索提示词...',

    // 验证错误
    noMessagesError: '高级模板至少需要一条消息',
    emptyMessageError: '消息内容不能为空',
    emptyContentError: '模板内容不能为空',

    // 确认信息
    deleteConfirm: '确定要删除此提示词吗？此操作不可恢复。',

    // 操作结果
    updateSuccess: '提示词更新成功',
    updateFailed: '提示词更新失败',
    addSuccess: '提示词添加成功',
    addFailed: '提示词添加失败',
    deleteSuccess: '提示词删除成功',
    deleteFailed: '提示词删除失败',
    copySuccess: '提示词复制成功',
    copyFailed: '提示词复制失败',
    importSuccess: '提示词导入成功',
    importFailed: '提示词导入失败',
    exportSuccess: '提示词导出成功',
    exportFailed: '提示词导出失败',

    // 无障碍标签
    editTemplateAriaLabel: '编辑提示词{name}',
    deleteTemplateAriaLabel: '删除提示词{name}',
    nameAriaLabel: '提示词名称输入框',
    contentAriaLabel: '提示词内容输入框',
    descriptionAriaLabel: '提示词描述输入框',
    typeAriaLabel: '提示词类型选择',
    searchAriaLabel: '搜索提示词',
    cancelEditAriaLabel: '取消编辑提示词',
    saveEditAriaLabel: '保存提示词修改',
    cancelAddAriaLabel: '取消添加提示词',
    confirmAddAriaLabel: '确认添加提示词',
    importTemplateAriaLabel: '导入提示词',
    exportTemplateAriaLabel: '导出提示词',
    copyTemplateAriaLabel: '复制提示词{name}',
    useTemplateAriaLabel: '使用提示词{name}',
    viewTemplateAriaLabel: '查看提示词{name}'
  },
  history: {
    title: '历史记录',
    iterationNote: '迭代说明',
    optimizedPrompt: '优化后',
    confirmClear: '确定要清空所有历史记录吗？此操作不可恢复。',
    confirmDeleteChain: '确定要删除此条历史记录吗？此操作不可恢复。',
    cleared: '历史记录已清空',
    chainDeleted: '历史记录已删除',
    useThisVersion: '使用此版本',
    noHistory: '暂无历史记录'
  },
  theme: {
    title: '主题设置',
    light: '日间模式',
    dark: '夜间模式',
    blue: '蓝色模式',
    green: '绿色模式',
    purple: '暗紫模式'
  },
  test: {
    content: '测试内容',
    placeholder: '请输入要测试的内容...',
    model: '模型',
    startTest: '开始测试 →',
    startCompare: '开始对比 →',
    testing: '测试中...',
    toggleCompare: {
      enable: '开启对比',
      disable: '关闭对比'
    },
    originalResult: '原始提示词结果',
    optimizedResult: '优化后提示词结果',
    testResult: '测试结果',
    userPromptTest: '用户提示词测试',
    error: {
      failed: '测试失败',
      noModel: '请先选择测试模型',
      noTestContent: '请输入测试内容'
    },
    enableMarkdown: '启用Markdown渲染',
    disableMarkdown: '关闭Markdown渲染',
    thinking: '思考过程'
  },
  template: {
    noDescription: '暂无描述',
    configure: '配置提示词',
    selected: '已选择',
    select: '选择',
    builtinLanguage: '内置模板语言',
    switchBuiltinLanguage: '切换内置模板语言',
    languageChanged: '内置模板语言已切换为 {language}',
    languageChangeError: '切换内置模板语言失败',
    languageInitError: '初始化内置模板语言失败',
    type: {
      optimize: '优化',
      iterate: '迭代'
    },
    view: '查看',
    edit: '编辑',
    add: '添加',
    name: '提示词名称',
    namePlaceholder: '输入提示词名称',
    content: '提示词内容',
    contentPlaceholder: '输入提示词内容',
    description: '描述',
    descriptionPlaceholder: '输入提示词描述（可选）',
    close: '关闭',
    cancel: '取消',
    save: '保存修改',
    import: {
      title: '导入提示词',
      supportFormat: '支持 .json 格式的提示词文件'
    },
    unknownTime: '未知',
    deleteConfirm: '确定要删除这个提示词吗？此操作不可恢复。',
    success: {
      updated: '提示词已更新',
      added: '提示词已添加',
      deleted: '提示词已删除',
      exported: '提示词已导出',
      imported: '提示词已导入'
    },
    error: {
      loadFailed: '加载提示词失败',
      saveFailed: '保存提示词失败',
      deleteFailed: '删除提示词失败',
      exportFailed: '导出提示词失败',
      importFailed: '导入提示词失败',
      readFailed: '读取文件失败'
    }
  },
  prompt: {
    optimized: '优化后的提示词',
    optimizing: '优化中...',
    continueOptimize: '继续优化',
    copy: '复制',
    optimizedPlaceholder: '优化后的提示词将显示在这里...',
    iterateDirection: '请输入需要优化的方向：',
    iteratePlaceholder: '例如：使提示词更简洁、增加特定功能描述等...',
    confirmOptimize: '确认优化',
    iterateTitle: '迭代功能提示词',
    selectIterateTemplate: '请选择迭代提示词：',
    diff: {
      compare: '与上版对比',
      exit: '退出对比',
      enable: '启用文本对比',
      disable: '关闭文本对比'
    },
    error: {
      noTemplate: '请先选择迭代提示词'
    }
  },
  output: {
    title: '测试结果',
    copy: '复制',
    placeholder: '测试结果将显示在这里...',
    processing: '处理中...',
    success: {
      copied: '复制成功'
    },
    error: {
      copyFailed: '复制失败'
    }
  },
  model: {
    select: {
      placeholder: '请选择模型',
      configure: '配置模型',
      noModels: '请配置模型',
      noAvailableModels: '暂无可用模型'
    },
    manager: {
      displayName: '例如: 自定义模型',
      apiUrl: 'API 地址',
      defaultModel: '默认模型名称',
      modelNamePlaceholder: '例如: gpt-3.5-turbo'
    }
  },
  toast: {
    error: {
      serviceInit: '服务未初始化，请稍后重试',
      optimizeFailed: '优化失败',
      iterateFailed: '迭代失败',
      compareFailed: '对比分析失败',
      noVersionsToCompare: '没有足够的版本进行对比',
      noPreviousVersion: '没有前一版本可供对比',
      testFailed: '测试失败',
      testError: '测试过程中发生错误',
      loadTemplatesFailed: '加载提示词失败',
      initFailed: '初始化失败：{error}',
      loadModelsFailed: '加载模型列表失败',
      initModelSelectFailed: '初始化模型选择失败',
      initTemplateSelectFailed: '初始化模板选择失败',
      loadHistoryFailed: '加载历史记录失败',
      clearHistoryFailed: '清空历史记录失败',
      historyChainDeleteFailed: '删除历史记录失败',
      selectTemplateFailed: '选择提示词失败：{error}',
      noOptimizeTemplate: '请先选择优化提示词',
      noOptimizeModel: '请先选择优化模型',
      noIterateTemplate: '请先选择迭代提示词',
      incompleteTestInfo: '请填写完整的测试信息',
      noDefaultTemplate: '无法加载默认提示词',
      optimizeProcessFailed: '优化过程出错',
      testProcessError: '测试过程中发生错误',
      initTemplateFailed: '初始化模板选择失败'
    },
    success: {
      optimizeSuccess: '优化成功',
      iterateComplete: '迭代优化完成',
      iterateSuccess: '迭代优化成功',
      modelSelected: '已选择模型: {name}',
      templateSelected: '已选择{type}提示词: {name}',
      historyClear: '历史记录已清空',
      historyChainDeleted: '历史记录已删除',
      exitCompare: '已退出对比模式',
      compareEnabled: '对比模式已启用'
    },
    warn: {
      loadOptimizeTemplateFailed: '加载已保存的优化提示词失败',
      loadIterateTemplateFailed: '加载已保存的迭代提示词失败'
    },
    info: {
      modelUpdated: '模型已更新',
      templateSelected: '选择模板'
    }
  },
  log: {
    info: {
      initBaseServicesStart: '开始初始化基础服务...',
      templateList: '模板列表',
      createPromptService: '创建提示词服务...',
      initComplete: '初始化完成',
      templateSelected: '已选择模板'
    },
    error: {
      initBaseServicesFailed: '初始化基础服务失败'
    }
  },
  dataManager: {
    title: '数据管理',
    export: {
      title: '导出数据',
      description: '导出所有历史记录、模型配置、自定义提示词和用户设置（包括主题、语言、模型选择等）',
      button: '导出数据',
      success: '数据导出成功',
      failed: '数据导出失败'
    },
    import: {
      title: '导入数据',
      description: '导入之前导出的数据文件（将覆盖现有数据和用户设置）',
      selectFile: '点击选择文件或拖拽文件到此处',
      changeFile: '更换文件',
      button: '导入数据',
      success: '数据导入成功',
      failed: '数据导入失败',
      successWithRefresh: '数据导入成功，页面将刷新以更新数据'
    },
    warning: '导入数据将覆盖现有的历史记录、模型配置、自定义提示词和所有用户设置（包括主题、语言偏好等），请确保已备份重要数据。'
  },
  params: {
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
    "tokens": {
      "unit": "令牌"
    }
  }
}; 