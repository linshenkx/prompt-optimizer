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
    remove: 'Remove',
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
    number: 'Number',
    integer: 'Integer',
    optional: 'Optional',
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

    // New: Optimization Mode Related
    optimizationMode: 'Optimization Mode',
    systemPrompt: 'System Prompt Optimization',
    userPrompt: 'User Prompt Optimization',
    systemPromptInput: 'System Prompt',
    userPromptInput: 'User Prompt',
    systemPromptPlaceholder: 'Enter the system prompt to optimize...',
    userPromptPlaceholder: 'Enter the user prompt to optimize...',
    systemPromptHelp: 'System Prompt Optimization Mode: Optimize system prompts that define AI assistant role, behavior and response style',
    userPromptHelp: 'User Prompt Optimization Mode: Optimize user prompts to improve AI interaction effectiveness and accuracy'
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

    // Advanced Parameters
    advancedParameters: {
      title: 'Advanced Parameters',
      noParamsConfigured: 'No advanced parameters configured',
      customParam: 'Custom',
      add: 'Add Parameter',
      select: 'Select a parameter',
      selectTitle: 'Add Advanced Parameter',
      custom: 'Custom Parameter',
      customKeyPlaceholder: 'Enter parameter name',
      customValuePlaceholder: 'Enter parameter value',
      stopSequencesPlaceholder: 'Enter stop sequences (comma-separated)',
      unitLabel: 'Unit',
      currentProvider: 'Current Provider',
      customProvider: 'Custom',
      availableParams: 'available parameters',
      noAvailableParams: 'no available parameters',
      validation: {
        dangerousParam: 'This parameter is considered dangerous and is not allowed',
        invalidNumber: 'Must be a valid number',
        belowMin: 'Value cannot be less than {min}',
        aboveMax: 'Value cannot be greater than {max}',
        mustBeInteger: 'Must be an integer'
      }
    },

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
    optimizeTemplates: 'System Prompt Optimization Templates',
    iterateTemplates: 'Iteration Optimization Templates',
    optimizeTemplateList: 'System Prompt Optimization Template List',
    iterateTemplateList: 'Iteration Optimization Template List',
    userOptimizeTemplates: 'User Prompt Optimization Templates',
    userOptimizeTemplateList: 'User Prompt Optimization Template List',
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
    migrate: 'Upgrade',
    help: 'Help',

    // Template Format
    templateFormat: 'Template Format',
    simpleTemplate: 'Simple Template',
    advancedTemplate: 'Advanced Template',
    simpleTemplateHint: 'No template technology used, template content directly serves as system prompt, user input as user message',
    advancedTemplateHint: 'Supports multi-message structure and advanced template syntax, available variables: originalPrompt, lastOptimizedPrompt, iterateInput',

    // Message Templates
    messageTemplates: 'Message Templates',
    addMessage: 'Add Message',
    removeMessage: 'Remove Message',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    messageContentPlaceholder: 'Enter message content, supports variables like originalPrompt',

    // Roles
    roleSystem: 'System',
    roleUser: 'User',
    roleAssistant: 'Assistant',

    // Preview
    preview: 'Preview',

    // Migration
    convertToAdvanced: 'Convert to Advanced Format',
    migrationDescription: 'Convert simple template to advanced message format for more flexible control.',
    originalTemplate: 'Original Template',
    convertedTemplate: 'Converted Template',
    applyMigration: 'Apply Conversion',
    migrationSuccess: 'Template converted successfully',
    migrationFailed: 'Template conversion failed',

    // Syntax Guide
    syntaxGuide: 'Syntax Guide',

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

    // Validation Errors
    noMessagesError: 'Advanced template requires at least one message',
    emptyMessageError: 'Message content cannot be empty',
    emptyContentError: 'Template content cannot be empty',

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
    userPromptTest: 'User Prompt Test',
    error: {
      failed: 'Test Failed',
      noModel: 'Please select a test model first',
      noTestContent: 'Please enter test content'
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
    builtinLanguage: 'Built-in Template Language',
    switchBuiltinLanguage: 'Switch built-in template language',
    languageChanged: 'Built-in template language switched to {language}',
    languageChangeError: 'Failed to switch built-in template language',
    languageInitError: 'Failed to initialize built-in template language',
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
    diff: {
      compare: 'Compare with Previous',
      exit: 'Exit Compare',
      enable: 'Enable text comparison',
      disable: 'Disable text comparison'
    },
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
      iterateFailed: 'Iteration failed',
      compareFailed: 'Comparison analysis failed',
      noVersionsToCompare: 'Not enough versions to compare',
      noPreviousVersion: 'No previous version available for comparison',
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
      noOptimizeModel: 'Please select an optimization model first',
      noIterateTemplate: 'Please select an iteration template first',
      incompleteTestInfo: 'Please fill in complete test information',
      noDefaultTemplate: 'Failed to load default template',
      optimizeProcessFailed: 'Error in optimization process',
      testProcessError: 'Error occurred during test process',
      initTemplateFailed: 'Failed to initialize template selection'
    },
    success: {
      optimizeSuccess: 'Optimization successful',
      iterateComplete: 'Iteration optimization completed',
      iterateSuccess: 'Iteration optimization successful',
      modelSelected: 'Model selected: {name}',
      templateSelected: '{type} template selected: {name}',
      historyClear: 'History cleared',
      historyChainDeleted: 'History record deleted',
      exitCompare: 'Exited compare mode',
      compareEnabled: 'Compare mode enabled'
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
    warning: 'Importing data will overwrite existing history records, model configurations, custom templates and all user settings (including theme, language preferences, etc.). Please ensure you have backed up important data.'
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
      "label": "Max Tokens",
      "description": "Maximum number of tokens to generate in the completion."
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
      "label": "Max Output Tokens",
      "description": "Maximum number of tokens the model can output in a single response."
    },
    "top_k": {
      "label": "Top K",
      "description": "Filters the next token choices to the K most likely tokens. Helps to reduce nonsensical token generation."
    },
    "candidateCount": {
      "label": "Candidate Count",
      "description": "Number of generated responses to return. Must be between 1 and 8."
    },
    "stopSequences": {
      "label": "Stop Sequences",
      "description": "Custom strings that will stop output generation if encountered. Specify multiple sequences separated by commas."
    },
    "tokens": {
      "unit": "tokens"
    }
  }
}; 