const messages = {
  "modelManager": {
    "title": "Model Manager",
    "textModels": "Text Models",
    "imageModels": "Image Models",
    "functionModels": "Function Models",
    "modelList": "Model List",
    "testConnection": "Test Connection",
    "editModel": "Edit",
    "deleteModel": "Delete",
    "displayName": "Display Name",
    "enabled": "Enabled",
    "enabledStatus": "Enable Status",
    "modelKey": "Model Key",
    "apiUrl": "API URL",
    "apiUrlHint": "Example: https://api.example.com/v1; most providers use endpoints ending with /v1",
    "apiUrlHintAriaLabel": "Show API URL help",
    "defaultModel": "Default Model",
    "clickToFetchModels": "Click arrow to fetch model list",
    "apiKey": "API Key",
    "getApiKey": "Get API Key",
    "addModel": "Add",
    "addImageModel": "Add Image Model",
    "provider": {
      "section": "Provider Configuration",
      "label": "Provider",
      "placeholder": "Select Provider",
      "more": "More",
      "openaiCompatibleCustomLabel": "OpenAI Compatible (Custom)",
      "openaiHint": "This is the official OpenAI API. If you want a custom base URL, a third-party compatible service, or a local model, choose \"OpenAI Compatible (Custom)\" instead.",
      "customApiHint": "Use this for custom OpenAI-compatible endpoints. You can configure the base URL, use your own model name, and choose Chat Completions or Responses as the request style.",
      "dashscopeHint": "DashScope supports both OpenAI-compatible Chat Completions and Responses APIs. You can switch the request style here directly.",
      "xiaomiMimoHint": "Defaults to the Xiaomi MiMo Token Plan China endpoint: https://token-plan-cn.xiaomimimo.com/v1. You can change it to the Singapore endpoint https://token-plan-sgp.xiaomimimo.com/v1 or Amsterdam endpoint https://token-plan-ams.xiaomimimo.com/v1 shown in Subscription Management. Env presets use VITE_MIMO_TOKEN_PLAN_*.",
      "minimaxHint": "The default endpoint is the global MiniMax OpenAI-compatible API. Mainland China users should set API URL to https://api.minimaxi.com/v1. Do not use Anthropic-format MiniMax endpoints here.",
      "chromeBuiltInHint": "Use Chrome's local Gemini Nano model without a third-party API key. Chrome manages the model, and first use may require an explicit user download. Chrome currently officially supports English, Spanish, and Japanese output; this provider defaults to English for compatibility."
    },
    "chromeBuiltIn": {
      "downloadAction": "Download / prepare local model",
      "recheckAction": "Recheck",
      "preparing": "Preparing Chrome local model...",
      "ready": "Chrome local model is ready",
      "prepareFailed": "Failed to prepare Chrome local model: {error}",
      "statusWithError": "{status} ({error})",
      "title": {
        "checking": "Checking Chrome built-in AI",
        "available": "Chrome built-in AI is ready",
        "downloadable": "Chrome local model needs download",
        "downloading": "Chrome is downloading the local model",
        "unavailable": "This environment is not supported",
        "api-missing": "This browser does not expose Chrome Prompt API"
      },
      "status": {
        "checking": "Checking whether this browser exposes the Prompt API and whether the local model is ready.",
        "available": "Ready to use without an API URL or API key. Sessions default to English because Chrome currently officially supports English, Spanish, and Japanese output.",
        "downloadable": "Your Chrome supports this feature, but the local model is not downloaded yet. Chrome is only asked to download it after you click the button below.",
        "downloading": "Chrome is downloading the model. This may take a while; once it finishes, you can test or save this model.",
        "unavailable": "This browser, device, user profile, or managed policy may not support the feature. You can still configure another text model provider.",
        "api-missing": "Open the Web app in a Chrome version that supports the Prompt API. Other browsers safely degrade without runtime errors."
      }
    },
    "connection": {
      "accountId": "Account ID",
      "requestStyle": "Request Style",
      "requestStyleOptions": {
        "chatCompletions": "Chat Completions",
        "responses": "Responses"
      }
    },
    "customHeaders": {
      "label": "Custom Request Headers",
      "namePlaceholder": "Header name, e.g. x-auth-token",
      "valuePlaceholder": "Header value",
      "add": "Add Header",
      "validationError": "Invalid custom request headers: {details}",
      "validation": {
        "invalid-name": "Invalid header name",
        "forbidden-name": "This header is managed by the client or browser and cannot be overridden",
        "missing-value": "Header value is required",
        "invalid-value": "Header value must be text, number, or boolean"
      }
    },
    "model": {
      "section": "Model Configuration"
    },
    "advancedParameters": {
      "title": "Advanced Parameters",
      "noParamsConfigured": "No advanced parameters configured",
      "customParam": "Custom",
      "advancedTag": "Advanced",
      "add": "Add Parameter",
      "select": "Select a parameter",
      "selectTitle": "Add Advanced Parameter",
      "custom": "Custom Parameter",
      "customKeyPlaceholder": "Enter parameter name",
      "customValuePlaceholder": "Enter parameter value",
      "stopSequencesPlaceholder": "Enter stop sequences (comma-separated)",
      "unitLabel": "Unit",
      "currentProvider": "Current Provider",
      "customProvider": "Custom",
      "availableParams": "available parameters",
      "noAvailableParams": "no available parameters",
      "validation": {
        "unknownParam": "Parameter definition not found",
        "customKeyRequired": "Parameter name is required",
        "customValueRequired": "Parameter value is required",
        "duplicateParam": "Parameter already exists",
        "dangerousParam": "This parameter is considered dangerous and is not allowed",
        "invalidNumber": "Must be a valid number",
        "belowMin": "Value cannot be less than {min}",
        "aboveMax": "Value cannot be greater than {max}",
        "mustBeInteger": "Must be an integer"
      },
      "formatJson": "JSON",
      "formatString": "String",
      "parsedAsObject": "Parsed as Object ✓",
      "invalidJson": "Invalid JSON, will be sent as string"
    },
    "modelKeyPlaceholder": "Enter model key",
    "displayNamePlaceholder": "Enter display name",
    "apiUrlPlaceholder": "https://api.example.com/v1",
    "defaultModelPlaceholder": "Type or select a model name",
    "apiKeyPlaceholder": "Enter API key (optional)",
    "modelKeyRequired": "Model key is required",
    "modelKeyReserved": "Model key \"{id}\" conflicts with a built-in model. Please choose another key, or edit the built-in model configuration instead.",
    "modelKeyAlreadyExists": "Model key \"{id}\" already exists. Please choose another key.",
    "modelIdGenerateFailed": "Failed to generate a unique model id. Please try again.",
    "deleteConfirm": "Are you sure you want to delete this model? This action cannot be undone.",
    "testing": "Testing connection...",
    "testSuccess": "Connection successful for {provider}!",
    "testFailed": "Connection failed for {provider}: {error}",
    "updateSuccess": "Update successful",
    "updateFailed": "Update failed: {error}",
    "addSuccess": "Model added successfully",
    "addFailed": "Failed to add model: {error}",
    "createSuccess": "Model created successfully",
    "createFailed": "Failed to create model: {error}",
    "enableSuccess": "Model enabled",
    "enableFailed": "Failed to enable model: {error}",
    "disableSuccess": "Model disabled",
    "disableFailed": "Failed to disable model: {error}",
    "cloneModel": "Clone",
    "cloneSuccess": "Model cloned",
    "cloneFailed": "Failed to clone model",
    "deleteSuccess": "Model deleted",
    "deleteFailed": "Failed to delete model: {error}",
    "toggleFailed": "Toggle failed: {error}",
    "fetchModelsSuccess": "Successfully retrieved 1 model | Successfully retrieved {count} models",
    "loadingModels": "Loading model options...",
    "noModelsAvailable": "No models available",
    "selectModel": "Select a model",
    "fetchModelsFailed": "Failed to fetch models: {error}",
    "fetchModelsBlockedFallback": "Model list request was blocked by the provider: {error}. Fell back to {count} local/saved models. You can still type a model ID manually.",
    "fetchModelsBlockedFailed": "Model list request was blocked by the provider: {error}. Enter a model ID manually (chat may still work without the remote list).",
    "fetchModelsFallback": "Failed to fetch models: {error} (fell back to {count} default models)",
    "needApiKeyAndBaseUrl": "Please fill API key and base URL first",
    "needBaseUrl": "Please fill in API URL first",
    "corsRestrictedTag": "CORS Restricted",
    "corsRestrictedConfirm": "{provider} has browser CORS restrictions, connection test may fail in Web.\n\nThis does not mean your API Key is invalid, but browser security policy blocked the request.\nRecommend using Desktop App, or ensure this provider supports direct browser access.\n\nContinue testing?",
    "errors": {
      "crossOriginConnectionFailed": "Cross-origin connection failed. Please check network connection",
      "connectionFailed": "Connection failed. Please check API address and network connection",
      "missingV1Suffix": "API URL format error. OpenAI-compatible APIs should include \"/v1\" suffix",
      "invalidResponseFormat": "API response format incompatible. Please check if API service uses OpenAI-compatible format",
      "emptyModelList": "API returned empty model list. This service may have no available models",
      "apiError": "API error: {error}"
    },
    "capabilities": {
      "tools": "Tool Calling",
      "reasoning": "Reasoning",
      "vision": "Vision"
    },
    "disabled": "Disabled",
    "testConnectionAriaLabel": "Test connection to {name}",
    "editModelAriaLabel": "Edit model {name}",
    "enableModelAriaLabel": "Enable model {name}",
    "disableModelAriaLabel": "Disable model {name}",
    "deleteModelAriaLabel": "Delete model {name}",
    "displayNameAriaLabel": "Model display name",
    "apiUrlAriaLabel": "Model API URL",
    "defaultModelAriaLabel": "Default model name",
    "apiKeyAriaLabel": "API key",
    "cancelEditAriaLabel": "Cancel editing model",
    "saveEditAriaLabel": "Save model changes",
    "cancelAddAriaLabel": "Cancel adding model",
    "confirmAddAriaLabel": "Confirm add model"
  },
  "functionModel": {
    "evaluationModel": "Evaluation Model",
    "evaluationModelHint": "Used for intelligent evaluation and variable extraction, defaults to global optimization model",
    "imageRecognitionModel": "Image Recognition Model",
    "imageRecognitionModelHint": "Used to extract JSON prompts and variable defaults from images, and must be configured separately",
    "noImageRecognitionModel": "Please configure an image recognition model in Function Models first",
    "unsupportedImageRecognitionModel": "The current image recognition model does not support image extraction: {provider}"
  },
  "model": {
    "select": {
      "placeholder": "Please select a model",
      "configure": "Configure Model",
      "noModels": "No model",
      "noAvailableModels": "No available models"
    },
    "quickSwitch": {
      "title": "Switch current model",
      "placeholder": "Select a model",
      "modelTagTitle": "Click to switch the model for this configuration",
      "fetchFailed": "Failed to fetch online models: {error}. You can still choose a local default model.",
      "updateSuccess": "Switched to {model}",
      "updateFailed": "Failed to switch model: {error}"
    },
    "manager": {
      "displayName": "e.g., Custom Model",
      "apiUrl": "API URL",
      "defaultModel": "Default Model Name",
      "modelNamePlaceholder": "e.g., gpt-3.5-turbo"
    }
  },
  "params": {
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
    "thinkingBudget": {
      "label": "Thinking Budget",
      "description": "Maximum number of tokens allocated for the model's thinking process (Gemini 2.5+ only). Range: 1-8192 tokens."
    },
    "includeThoughts": {
      "label": "Include Thoughts",
      "description": "Whether to include the model's thinking process in the response (Gemini 2.5+ only). When enabled, you can see the model's reasoning steps."
    },
    "reasoning_effort": {
      "label": "Reasoning Effort",
      "description": "Controls the reasoning effort for models that support thinking mode."
    },
    "deepseek": {
      "thinking_type": {
        "label": "Thinking Mode",
        "description": "Controls DeepSeek thinking mode. Sent as thinking.type in the API request.",
        "disabled": "Disabled",
        "enabled": "Enabled"
      }
    },
    "tokens": {
      "unit": "tokens"
    },
    "size": {
      "label": "Image Size",
      "description": "Resolution/size of the generated image, e.g., 1024x1024"
    },
    "quality": {
      "label": "Image Quality",
      "description": "Quality level for generated image: auto (automatic), high (high quality), medium, low (low quality)"
    },
    "background": {
      "label": "Background Transparency",
      "description": "Set image background: auto (automatic), transparent, opaque"
    },
    "imageSize": {
      "label": "Image Size",
      "description": "Resolution/size of the generated image, e.g., 1024x1024"
    },
    "steps": {
      "label": "Steps",
      "description": "Diffusion/inference steps; more steps usually improve quality but take longer"
    },
    "guidance": {
      "label": "Guidance Scale",
      "description": "Strength to follow the prompt; higher values adhere more to the prompt"
    },
    "cfg": {
      "label": "CFG Scale",
      "description": "Classifier-Free Guidance scale for controlling prompt adherence (Qwen-Image only)"
    },
    "negativePrompt": {
      "label": "Negative Prompt",
      "description": "Content or styles you do not want in the image"
    },
    "responseFormat": {
      "label": "Response Format",
      "description": "Format of the returned image (URL or Base64)"
    },
    "outputFormat": {
      "label": "Output Format",
      "description": "File format for the generated image (such as PNG, JPEG, or WebP)"
    },
    "watermark": {
      "label": "Watermark",
      "description": "Whether to add a watermark to the generated image"
    },
    "sequentialGeneration": {
      "label": "Sequential Generation",
      "description": "Control sequential image generation mode (for supported models)"
    },
    "tools": {
      "label": "Tools",
      "description": "List of 5.0 series extension tools, one tool name per line"
    },
    "seed": {
      "label": "Seed",
      "description": "Random seed for controlling generation results, same seed produces same output"
    },
    "enable_thinking": {
      "label": "Enable Thinking",
      "description": "Enable thinking mode for complex reasoning tasks (supported models only)"
    },
    "thinking_budget": {
      "label": "Thinking Budget",
      "description": "Maximum tokens for thinking process, limits reasoning length"
    },
    "enable_search": {
      "label": "Enable Search",
      "description": "Enable internet search for real-time information (supported models only)"
    },
    "max_completion_tokens": {
      "label": "Max Completion Tokens",
      "description": "Maximum number of tokens to generate in the completion (recommended, replaces max_tokens). Range: 1-1,000,000."
    },
    "logprobs": {
      "label": "Log Probabilities",
      "description": "Whether to return log probabilities of output tokens in the response. When enabled, you can see the model's confidence for each token."
    },
    "top_logprobs": {
      "label": "Top Log Probabilities Count",
      "description": "Number of most likely tokens to return with log probabilities for each position. Range: 0-20. Requires logprobs to be enabled first."
    },
    "n": {
      "label": "Number of Completions",
      "description": "How many completion choices to generate for each input. Range: 1-128. Note: generating multiple results consumes more token quota."
    }
  }
} as const;

export default messages;
