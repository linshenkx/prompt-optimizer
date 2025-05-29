export default {
  common: {
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    settings: 'Settings',
    language: 'Language',
    templates: 'Templates',
    history: 'History',
    close: 'Close',
    test: 'Test',
    enable: 'Enable',
    disable: 'Disable',
    enabled: 'Enabled',
    disabled: 'Disabled',
    add: 'Add',
    title: 'Title',
    description: 'Description',
    lastModified: 'Last Modified',
    noDescription: 'No description',
    builtin: 'Built-in',
    custom: 'Custom',
    currentTemplate: 'Current Template',
    use: 'Use',
    expand: 'Expand',
    collapse: 'Collapse',
    clear: 'Clear',
    createdAt: 'Created at',
    version: 'V{version}',
    optimize: 'Optimize',
    iterate: 'Iterate',
    copySuccess: 'Copy Success',
    copyFailed: 'Copy Failed',
    appName: 'Prompt Optimizer',
    selectFile: 'Select File',
    exporting: 'Exporting...',
    importing: 'Importing...',
  },
  nav: {
    home: 'Home',
    dashboard: 'Dashboard',
    promptOptimizer: 'Prompt Optimizer',
    modelManager: 'Model Manager',
    history: 'History',
    templates: 'Templates',
    dataManager: 'Data Manager',
  },
  promptOptimizer: {
    title: 'Prompt Optimizer',
    inputPlaceholder: 'Enter your prompt to optimize...',
    optimize: 'Optimize →',
    history: 'History',
    save: 'Save Prompt',
    share: 'Share',
    export: 'Export',
    originalPrompt: 'Original Prompt',
    optimizeModel: 'Optimization Model',
    templateLabel: 'Optimization Template',
  },
  settings: {
    title: 'Settings',
    language: 'Language Settings',
    theme: 'Theme Settings',
    apiSettings: 'API Settings',
    about: 'About',
  },
  modelManager: {
    title: 'Model Manager',
    modelList: 'Model List',
    testConnection: 'Test Connection',
    editModel: 'Edit',
    deleteModel: 'Delete',
    displayName: 'Display Name',
    modelKey: 'Model Key',
    apiUrl: 'API URL',
    defaultModel: 'Default Model',
    clickToFetchModels: 'Click arrow to fetch model list',
    apiKey: 'API Key',
    useVercelProxy: 'Use Vercel Proxy',
    useVercelProxyHint: 'Using Vercel proxy can solve CORS issues, but may trigger risk control from some providers. Please use with caution',
    addModel: 'Add',

    // Placeholders
    modelKeyPlaceholder: 'Enter model key',
    displayNamePlaceholder: 'Enter display name',
    apiUrlPlaceholder: 'Enter API URL',
    defaultModelPlaceholder: 'Type or select a model name',
    apiKeyPlaceholder: 'Enter API key',

    // Confirmation
    deleteConfirm: 'Are you sure you want to delete this model? This action cannot be undone.',

    // Operation Results
    testSuccess: 'Connection successful for {provider}!',
    testFailed: 'Connection failed for {provider}: {error}',
    updateSuccess: 'Update successful',
    updateFailed: 'Update failed: {error}',
    addSuccess: 'Model added successfully',
    addFailed: 'Failed to add model: {error}',
    enableSuccess: 'Model enabled',
    enableFailed: 'Failed to enable model: {error}',
    disableSuccess: 'Model disabled',
    disableFailed: 'Failed to disable model: {error}',
    deleteSuccess: 'Model deleted',
    deleteFailed: 'Failed to delete model: {error}',
    fetchModelsSuccess: 'Successfully retrieved 1 model | Successfully retrieved {count} models',
    loadingModels: 'Loading model options...',
    noModelsAvailable: 'No models available',
    selectModel: 'Select a model',
    fetchModelsFailed: 'Failed to fetch models: {error}',
    needApiKeyAndBaseUrl: 'Please fill API key and base URL first',

    // Status Text
    disabled: 'Disabled',

    // Accessibility Labels
    testConnectionAriaLabel: 'Test connection to {name}',
    editModelAriaLabel: 'Edit model {name}',
    enableModelAriaLabel: 'Enable model {name}',
    disableModelAriaLabel: 'Disable model {name}',
    deleteModelAriaLabel: 'Delete model {name}',
    displayNameAriaLabel: 'Model display name',
    apiUrlAriaLabel: 'Model API URL',
    defaultModelAriaLabel: 'Default model name',
    apiKeyAriaLabel: 'API key',
    useVercelProxyAriaLabel: 'Use Vercel proxy',
    cancelEditAriaLabel: 'Cancel editing model',
    saveEditAriaLabel: 'Save model changes',
    cancelAddAriaLabel: 'Cancel adding model',
    confirmAddAriaLabel: 'Confirm add model'
  },
  templateManager: {
    title: 'Template Manager',
    optimizeTemplates: 'Optimization Templates',
    iterateTemplates: 'Iteration Templates',
    optimizeTemplateList: 'Optimization Template List',
    iterateTemplateList: 'Iteration Template List',
    addTemplate: 'Add',
    editTemplate: 'Edit',
    deleteTemplate: 'Delete',
    templateCount: '{count} template | {count} templates',

    // Button Text
    importTemplate: 'Import',
    exportTemplate: 'Export',
    copyTemplate: 'Copy',
    useTemplate: 'Use',
    viewTemplate: 'View',

    // Form Fields
    name: 'Template Name',
    content: 'Template Content',
    description: 'Description',
    type: 'Type',

    // Placeholders
    namePlaceholder: 'Enter template name',
    contentPlaceholder: 'Enter template content',
    descriptionPlaceholder: 'Enter template description (optional)',
    searchPlaceholder: 'Search templates...',

    // Confirmation
    deleteConfirm: 'Are you sure you want to delete this template? This action cannot be undone.',

    // Operation Results
    updateSuccess: 'Template updated successfully',
    updateFailed: 'Failed to update template',
    addSuccess: 'Template added successfully',
    addFailed: 'Failed to add template',
    deleteSuccess: 'Template deleted successfully',
    deleteFailed: 'Failed to delete template',
    copySuccess: 'Template copied successfully',
    copyFailed: 'Failed to copy template',
    importSuccess: 'Template imported successfully',
    importFailed: 'Failed to import template',
    exportSuccess: 'Template exported successfully',
    exportFailed: 'Failed to export template',

    // Accessibility Labels
    editTemplateAriaLabel: 'Edit template {name}',
    deleteTemplateAriaLabel: 'Delete template {name}',
    nameAriaLabel: 'Template name input',
    contentAriaLabel: 'Template content input',
    descriptionAriaLabel: 'Template description input',
    typeAriaLabel: 'Template type selection',
    searchAriaLabel: 'Search templates',
    cancelEditAriaLabel: 'Cancel editing template',
    saveEditAriaLabel: 'Save template changes',
    cancelAddAriaLabel: 'Cancel adding template',
    confirmAddAriaLabel: 'Confirm add template',
    importTemplateAriaLabel: 'Import template',
    exportTemplateAriaLabel: 'Export template',
    copyTemplateAriaLabel: 'Copy template {name}',
    useTemplateAriaLabel: 'Use template {name}',
    viewTemplateAriaLabel: 'View template {name}'
  },
  history: {
    title: 'History',
    iterationNote: 'Iteration Note',
    optimizedPrompt: 'Optimized Prompt',
    confirmClear: 'Are you sure you want to clear all history records? This action cannot be undone.',
    confirmDeleteChain: 'Are you sure you want to delete this history record? This action cannot be undone.',
    cleared: 'History cleared',
    chainDeleted: 'History record deleted',
    useThisVersion: 'Use This Version',
    noHistory: 'No history records'
  },
  theme: {
    title: 'Theme Settings',
    light: 'Light Mode',
    dark: 'Dark Mode',
    blue: 'Blue Mode',
    green: 'Green Mode',
    purple: 'Purple Mode'
  },
  test: {
    content: 'Test Content',
    placeholder: 'Enter content to test...',
    model: 'Model',
    startTest: 'Start Test →',
    startCompare: 'Start Compare Test →',
    testing: 'Testing...',
    toggleCompare: {
      enable: 'Enable Compare',
      disable: 'Disable Compare'
    },
    originalResult: 'Original Prompt Result',
    optimizedResult: 'Optimized Prompt Result',
    testResult: 'Test Result',
    error: {
      failed: 'Test Failed',
      noModel: 'Please select a test model first'
    },
    enableMarkdown: 'Enable Markdown rendering',
    disableMarkdown: 'Disable Markdown rendering',
    thinking: 'Thinking Process'
  },
  template: {
    noDescription: 'No Description',
    configure: 'Configure Template',
    selected: 'Selected',
    select: 'Select',
    type: {
      optimize: 'Optimize',
      iterate: 'Iterate'
    },
    view: 'View',
    edit: 'Edit',
    add: 'Add',
    name: 'Template Name',
    namePlaceholder: 'Enter template name',
    content: 'Template Content',
    contentPlaceholder: 'Enter template content',
    description: 'Description',
    descriptionPlaceholder: 'Enter template description (optional)',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save Changes',
    import: {
      title: 'Import Template',
      supportFormat: 'Supports .json format template files'
    },
    unknownTime: 'Unknown',
    deleteConfirm: 'Are you sure you want to delete this template? This action cannot be undone.',
    success: {
      updated: 'Template updated',
      added: 'Template added',
      deleted: 'Template deleted',
      exported: 'Template exported',
      imported: 'Template imported'
    },
    error: {
      loadFailed: 'Failed to load template',
      saveFailed: 'Failed to save template',
      deleteFailed: 'Failed to delete template',
      exportFailed: 'Failed to export template',
      importFailed: 'Failed to import template',
      readFailed: 'Failed to read file'
    }
  },
  prompt: {
    optimized: 'Optimized Prompt',
    optimizing: 'Optimizing...',
    continueOptimize: 'Continue Optimize',
    copy: 'Copy',
    optimizedPlaceholder: 'Optimized prompt will be shown here...',
    iterateDirection: 'Please enter optimization direction:',
    iteratePlaceholder: 'e.g., Make the prompt more concise, add specific functionality description, etc...',
    confirmOptimize: 'Confirm Optimize',
    iterateTitle: 'Iteration Template',
    selectIterateTemplate: 'Please select iteration template:',
    error: {
      noTemplate: 'Please select an iteration template first'
    }
  },
  output: {
    title: 'Test Result',
    copy: 'Copy',
    placeholder: 'Test result will be shown here...',
    processing: 'Processing...',
    success: {
      copied: 'Copied successfully'
    },
    error: {
      copyFailed: 'Copy failed'
    }
  },
  model: {
    select: {
      placeholder: 'Please select a model',
      configure: 'Configure Model',
      noModels: 'No model',
      noAvailableModels: 'No available models'
    },
    manager: {
      displayName: 'e.g., Custom Model',
      apiUrl: 'API URL',
      defaultModel: 'Default Model Name',
      modelNamePlaceholder: 'e.g., gpt-3.5-turbo'
    }
  },
  toast: {
    error: {
      serviceInit: 'Service not initialized, please try again later',
      optimizeFailed: 'Optimization failed',
      iterateFailed: 'Iteration optimization failed',
      testFailed: 'Test failed',
      testError: 'Error occurred during test',
      loadTemplatesFailed: 'Failed to load templates',
      initFailed: 'Initialization failed: {error}',
      loadModelsFailed: 'Failed to load model list',
      initModelSelectFailed: 'Failed to initialize model selection',
      initTemplateSelectFailed: 'Failed to initialize template selection',
      loadHistoryFailed: 'Failed to load history',
      clearHistoryFailed: 'Failed to clear history',
      historyChainDeleteFailed: 'Failed to delete history record',
      selectTemplateFailed: 'Failed to select template: {error}',
      noOptimizeTemplate: 'Please select an optimization template first',
      noIterateTemplate: 'Please select an iteration template first',
      incompleteTestInfo: 'Please fill in complete test information',
      noDefaultTemplate: 'Failed to load default template',
      optimizeProcessFailed: 'Error in optimization process',
      testProcessError: 'Error occurred during test process',
      initTemplateFailed: 'Failed to initialize template selection'
    },
    success: {
      optimizeSuccess: 'Optimization successful',
      iterateSuccess: 'Iteration optimization successful',
      modelSelected: 'Model selected: {name}',
      templateSelected: '{type} template selected: {name}',
      historyClear: 'History cleared',
      historyChainDeleted: 'History record deleted'
    },
    warn: {
      loadOptimizeTemplateFailed: 'Failed to load saved optimization template',
      loadIterateTemplateFailed: 'Failed to load saved iteration template'
    },
    info: {
      modelUpdated: 'Model updated',
      templateSelected: 'Template selected'
    }
  },
  log: {
    info: {
      initBaseServicesStart: 'Starting to initialize base services...',
      templateList: 'Template list',
      createPromptService: 'Creating prompt service...',
      initComplete: 'Initialization complete',
      templateSelected: 'Template selected'
    },
    error: {
      initBaseServicesFailed: 'Failed to initialize base services'
    }
  },
  dataManager: {
    title: 'Data Manager',
    export: {
      title: 'Export Data',
      description: 'Export all history records, model configurations, custom templates and user settings (including theme, language, model selections, etc.)',
      button: 'Export Data',
      success: 'Data exported successfully',
      failed: 'Failed to export data'
    },
    import: {
      title: 'Import Data',
      description: 'Import previously exported data file (will overwrite existing data and user settings)',
      selectFile: 'Click to select file or drag file here',
      changeFile: 'Change File',
      button: 'Import Data',
      success: 'Data imported successfully',
      failed: 'Failed to import data',
      successWithRefresh: 'Data imported successfully, page will refresh to update data'
    },
    warning: '⚠️ Importing data will overwrite existing history records, model configurations, custom templates and all user settings (including theme, language preferences, etc.). Please ensure you have backed up important data.'
  },
  params: {
    "temperature": {
      "label": "Temperature",
      "description": "Controls randomness: Lower values (e.g., 0.2) make the output more focused and deterministic, while higher values (e.g., 0.8) make it more random."
    },
    "top_p": {
      "label": "Top P",
      "description": "Nucleus sampling. Considers tokens with top P probability mass. E.g., 0.1 means only tokens comprising the top 10% probability mass are considered."
    },
    "max_tokens": {
      "label": "Max Tokens (OpenAI-like)",
      "description": "Maximum number of tokens to generate in the completion. Applies to OpenAI and compatible models."
    },
    "presence_penalty": {
      "label": "Presence Penalty",
      "description": "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics."
    },
    "frequency_penalty": {
      "label": "Frequency Penalty",
      "description": "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim."
    },
    "timeout": {
      "label": "Timeout (ms)",
      "description_openai": "Request timeout in milliseconds for the OpenAI client connection."
    },
    "maxOutputTokens": {
      "label": "Max Output Tokens (Gemini)",
      "description": "Maximum number of tokens the model can output in a single response. Applies to Gemini models."
    },
    "top_k": {
      "label": "Top K",
      "description": "Filters the next token choices to the K most likely tokens. Helps to reduce nonsensical token generation."
    },
    "candidateCount": {
      "label": "Candidate Count (Gemini)",
      "description": "Number of generated responses to return. Must be between 1 and 8. Applies to Gemini models."
    },
    "stopSequences": {
      "label": "Stop Sequences (Gemini)",
      "description": "A list of sequences where the API will stop generating further tokens. Enter as comma-separated strings (e.g., 'END,STOP'). Applies to Gemini models."
    },
    "tokens": {
      "unit": "tokens"
    }
  }
}; 