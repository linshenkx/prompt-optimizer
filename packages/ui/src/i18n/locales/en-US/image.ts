const messages = {
  "imageMode": {
    "text2image": "Text-to-Image",
    "image2image": "Image-to-Image",
    "multiimage": "Multi-Image",
    "text2imageDescription": "Generate images from text descriptions",
    "image2imageDescription": "Modify based on existing images",
    "multiimageDescription": "Generate from multiple input images and a prompt",
    "uploadRequired": "Image-to-Image mode requires uploading a reference image first"
  },
  "imageWorkspace": {
    "usage": {
      "tokens": "Token usage",
      "promptTokens": "Prompt tokens",
      "imageTokens": "Image tokens",
      "totalTokens": "All tokens",
      "input": "Input",
      "output": "Output",
      "image": "Image",
      "aspect": "Aspect",
      "tier": "Pricing Tier",
      "thinkingTokens": "Thinking tokens",
      "inference": "Inference"
    },
    "input": {
      "originalPrompt": "Original Prompt",
      "originalPromptPlaceholder": "Enter the image generation prompt to optimize",
      "multiImagePromptPlaceholder": "Use Image 1 / Image 2 / Image 3 to describe image relationships and the generation goal",
      "image": "Image",
      "imageAlt": "Image {index}",
      "imageLabel": "Image {index}",
      "removeImageAriaLabel": "Remove image {index}",
      "reorderImageAriaLabel": "Drag to reorder image {index}",
      "multiImageHint": "Drag cards to control the semantic order of Image 1 / Image 2 / Image 3",
      "multiImageMinHint": "Add one more image to start multi-image generation",
      "multiImageReadyHint": "Upload at least two images before starting multi-image generation",
      "selectImage": "Select",
      "optimizeTemplate": "Optimization Template",
      "templatePlaceholder": "Please select template",
      "textModel": "Text Model",
      "modelPlaceholder": "Select model",
      "optimizing": "Optimizing...",
      "optimizePrompt": "Optimize Prompt",
      "extractFromImage": "Reference Image",
      "extracting": "Extracting",
      "extractCompleted": "Image extraction completed",
      "extractCompletedWithVariables": "Image extraction completed and initialized {count} local variables",
      "extractFailed": "Image extraction failed"
    },
    "referenceImage": {
      "replicateAction": "Replicate",
      "replicateActionDescription": "Ignore the current prompt and infer a reusable prompt from the reference image",
      "styleLearnAction": "Style Learn",
      "styleLearnActionDescription": "Keep the current subject and learn the style, composition, and color language from the image",
      "styleLearnDisabledHint": "Enter what you want to generate first",
      "processingStatus": "Processing",
      "readyStatus": "Ready",
      "errorStatus": "Failed",
      "resultTitle": "Reference Result",
      "thumbnailAlt": "Reference thumbnail",
      "generatedPrompt": "Generated Prompt",
      "variablePreview": "Extracted Variables",
      "noVariables": "No variables have been extracted yet",
      "applyToPrompt": "Apply To Current Prompt",
      "applySuccess": "Inserted into the current prompt"
    },
    "generation": {
      "imageModel": "Image Model",
      "imageModelPlaceholder": "Please select image model",
      "compareMode": "Compare Mode",
      "generating": "Generating...",
      "generateImage": "Generate Image",
      "processing": "Processing",
      "validationFailed": "The selected config/model does not support this operation",
      "generateFailed": "Image generation failed",
      "missingRequiredFields": "Please select an image model and enter a valid prompt",
      "missingVariables": "Missing or empty variables: {vars}",
      "forbiddenTemplateSyntax": "Unescaped Mustache syntax (e.g. triple braces or ampersand tags) is not supported. Please use normal variable placeholders.",
      "inputImageRequired": "Please upload an input image (required for image-to-image)",
      "multiImageUnsupported": "This model does not support multi-image input. Please switch to a multi-image capable image model.",
      "generationCompleted": "Image generation completed"
    },
    "results": {
      "originalPromptResult": "Original Prompt",
      "optimizedPromptResult": "Optimized Prompt",
      "testResult": "Test Result",
      "download": "Download",
      "downloadFailed": "Download failed",
      "copyBase64": "Copy Base64",
      "copyText": "Copy Text",
      "copySuccess": "Copied successfully",
      "copyError": "Copy failed",
      "textOutput": "Text output",
      "noOriginalResult": "No original result",
      "noOptimizedResult": "No optimized result",
      "noGenerationResult": "No generation result"
    },
    "upload": {
      "title": "Upload Reference Image",
      "dragText": "Click or drag to upload image",
      "fileRequirements": "Supports PNG/JPEG up to 50MB; large images are prepared automatically",
      "uploadFailed": "Upload failed",
      "uploadSuccess": "Upload success",
      "preparedSuccess": "Image prepared for model compatibility: {before} → {after}",
      "preparedBatchSuccess": "Prepared {count} images for model compatibility",
      "processingFailed": "Image preparation failed. Please try a smaller image.",
      "confirmTitle": "Confirm image processing",
      "confirmDescription": "To meet model input limits, {count} image(s) will be resized or re-encoded. The resulting file size may increase slightly.",
      "confirmItem": "{name}: {beforeSize}, {beforeDimensions} → {afterSize}, {afterDimensions}",
      "confirmAction": "Process and continue",
      "fileTypeNotSupported": "Only PNG/JPEG is supported",
      "fileTooLarge": "The selected image cannot exceed 50MB",
      "readFailed": "Failed to read file, please try again"
    }
  },
  "image": {
    "capability": {
      "text2image": "Text-to-Image",
      "image2image": "Image-to-Image",
      "multiImage": "Multi-image",
      "highResolution": "High Resolution"
    },
    "step": {
      "basic": "Basic Information",
      "provider": "Provider Selection",
      "connection": "Connection Configuration",
      "model": "Model Selection",
      "parameters": "Parameter Settings"
    },
    "config": {
      "basic": {
        "title": "Basic Configuration"
      },
      "name": {
        "label": "Configuration Name",
        "placeholder": "Please enter configuration name"
      },
      "displayName": {
        "label": "Display Name",
        "placeholder": "Please enter display name"
      },
      "enabled": {
        "label": "Enable Status"
      },
      "enabledStatus": {
        "label": "Enable Status"
      },
      "updateSuccess": "Configuration updated",
      "createSuccess": "Configuration created",
      "saveFailed": "Failed to save configuration",
      "loadFailed": "Failed to load configurations"
    },
    "provider": {
      "title": "Provider Selection",
      "section": "Provider Configuration",
      "label": "Image Provider",
      "placeholder": "Please select provider",
      "loadFailed": "Failed to load providers"
    },
    "connection": {
      "title": "Connection Configuration",
      "test": "Test Connection",
      "testing": "Testing connection...",
      "testSuccess": "Function test successful",
      "testFailed": "Connection test failed",
      "testError": "Connection test error",
      "functionTestTextToImage": "Text-to-Image test",
      "functionTestImageToImage": "Image-to-Image test",
      "testImagePreview": "Test Image Preview",
      "downloadSuccess": "Image downloaded successfully",
      "downloadFailed": "Image download failed",
      "apiKey": {
        "label": "API Key",
        "description": "Authentication key",
        "placeholder": "Enter API Key"
      },
      "baseURL": {
        "label": "API Base URL",
        "description": "Base URL of the service endpoint",
        "placeholder": "https://api.example.com/v1"
      },
      "accountId": {
        "label": "Account ID",
        "description": "Cloudflare account ID",
        "placeholder": "Enter Cloudflare Account ID"
      },
      "organization": {
        "label": "Organization (optional)",
        "description": "OpenAI organization ID if applicable",
        "placeholder": "org_xxx"
      },
      "validation": {
        "missing": "Missing required fields: {fields}",
        "invalidType": "{field} should be {expected}, got {actual}"
      }
    },
    "model": {
      "section": "Model Configuration",
      "label": "Model",
      "placeholder": "Please select model",
      "loading": "Loading models...",
      "refreshTooltip": "Refresh model list",
      "refreshDisabledTooltip": {
        "dynamicNotSupported": "Current provider does not support dynamic model loading",
        "connectionRequired": "Valid connection configuration required to refresh models"
      },
      "refreshSuccess": "Model list refreshed",
      "refreshError": "Failed to refresh model list",
      "selectRequired": "Please select a model to test",
      "count": "{count} models",
      "capabilities": "Capabilities",
      "empty": "No image model configurations",
      "addFirst": "Add First Image Model",
      "staticLoaded": "Static models loaded",
      "noStaticModels": "No static models",
      "staticLoadFailed": "Failed to load static models",
      "dynamicLoaded": "Dynamic models loaded",
      "dynamicFailed": "Failed to load dynamic models, fell back to static list",
      "connectionRequired": "Please fill and validate connection first",
      "refreshFailed": "Failed to refresh models",
      "quickSwitch": {
        "title": "Switch current image model",
        "placeholder": "Select image model",
        "modelTagTitle": "Click to switch the model for this image configuration",
        "fetchFailed": "Failed to fetch online image models: {error}. You can still choose a local default model.",
        "updateSuccess": "Switched to {model}",
        "updateFailed": "Failed to switch image model: {error}"
      }
    },
    "parameters": {
      "noParameters": "No configurable parameters for this model",
      "advancedConfig": "Advanced Parameter Configuration",
      "advancedConfigDescription": "Optional, used to override default model parameters"
    },
    "params": {
      "size": {
        "label": "Image Size",
        "description": "Generated image resolution/size, e.g., 1024x1024"
      },
      "aspect_ratio": {
        "label": "Aspect Ratio",
        "description": "Generated image aspect ratio"
      },
      "resolution": {
        "label": "Resolution",
        "description": "Generated image resolution tier"
      },
      "quality": {
        "label": "Image Quality",
        "description": "Generated image quality level: auto (automatic), high (high quality), medium (medium), low (low quality)"
      },
      "background": {
        "label": "Background Transparency",
        "description": "Set image background: auto (automatic), transparent (transparent), opaque (opaque)"
      },
      "negativePrompt": {
        "label": "Negative Prompt",
        "description": "Specify content you don't want to appear in the generated image"
      },
      "promptExtend": {
        "label": "Prompt Extension",
        "description": "When enabled, the model will automatically expand and optimize the prompt for better results"
      },
      "watermark": {
        "label": "Watermark",
        "description": "Whether to add a watermark on the generated image"
      },
      "seed": {
        "label": "Random Seed",
        "description": "Random seed for reproducible results, same seed generates similar images"
      },
      "count": {
        "label": "Generation Count",
        "description": "Number of images to generate at once"
      },
      "style": {
        "label": "Image Style",
        "description": "Artistic style for the generated image"
      }
    }
  },
  "toolCall": {
    "title": "Tool Calls",
    "count": "{count} calls",
    "arguments": "Arguments",
    "result": "Result",
    "error": "Error",
    "status": {
      "pending": "Pending",
      "success": "Success",
      "error": "Failed"
    }
  },
  "updater": {
    "title": "App Updates",
    "checkForUpdates": "Check for updates",
    "currentVersion": "Current Version",
    "versionLoadFailed": "Failed to load version",
    "downloadFailed": "Download Failed",
    "dismiss": "Dismiss",
    "noStableVersionAvailable": "No stable version available",
    "noPrereleaseVersionAvailable": "No prerelease version available",
    "failedToGetStableInfo": "Failed to get stable version update info",
    "failedToGetPrereleaseInfo": "Failed to get prerelease version update info",
    "alreadyLatestStable": "Already using the latest stable version ({version})",
    "alreadyLatestPrerelease": "Already using the latest prerelease version ({version})",
    "stableDownloadFailed": "Stable version download failed: {error}",
    "prereleaseDownloadFailed": "Prerelease version download failed: {error}",
    "unknownError": "Unknown error",
    "stable": "Stable",
    "prerelease": "Prerelease",
    "downloadFailedGeneric": "{type} download failed: {error}",
    "warning": "Warning",
    "info": "Information",
    "versionIgnored": "Version {version} is ignored",
    "checkFailed": "Check Failed",
    "ignored": "Ignored",
    "unignore": "Unignore",
    "latestVersion": "Latest Version",
    "noPrereleaseAvailable": "No prerelease available",
    "latestIsStable": "Latest version is stable",
    "latestStableVersion": "Latest Stable Version",
    "latestPrereleaseVersion": "Latest Prerelease Version",
    "viewStable": "View Stable",
    "viewPrerelease": "View Prerelease",
    "allowPrerelease": "Receive prerelease updates",
    "noUpdatesAvailable": "You are using the latest version",
    "checkNow": "Check for Updates",
    "checking": "Checking for updates...",
    "checkingForUpdates": "Checking for updates...",
    "newVersionAvailable": "New version available",
    "viewDetails": "View Details",
    "downloadUpdate": "Download Update",
    "download": "Download",
    "updateAvailable": "Update Available",
    "hasUpdate": "Update Available",
    "details": "Details",
    "ignore": "Ignore",
    "ignoreVersion": "Ignore This Version",
    "downloading": "Downloading update...",
    "downloadingShort": "Downloading...",
    "downloadComplete": "Download Complete",
    "clickInstallToRestart": "Click the button below to install and restart the application",
    "installAndRestart": "Install and Restart",
    "updateError": "Update failed",
    "downloadError": "Download failed",
    "installError": "Installation failed",
    "upToDate": "Up to Date",
    "devEnvironment": "Development Environment: Update checking is disabled",
    "clickToCheck": "Click to check for updates",
    "viewOnGitHub": "View on GitHub",
    "manualUpdateTitle": "macOS currently requires a manual update",
    "manualUpdateDescription": "The current macOS build is not signed with an Apple Developer ID, so it cannot be installed through the in-app updater. Open the release page, download the DMG for this Mac, quit the app, then drag it into Applications and choose Replace. If macOS blocks the first launch, allow it in System Settings → Privacy & Security.",
    "updatePolicyUnavailableTitle": "A manual update is currently required",
    "updatePolicyUnavailableDescription": "The app could not confirm whether this build supports in-app installation. To avoid a failed update, open the release page and install the package manually.",
    "openReleasePage": "Open GitHub Release",
    "openReleaseFailed": "Could not open the release page. Please try again later.",
    "releasePageUnavailable": "The release page address is unavailable. Check for updates again and retry.",
    "noReleasesFound": "No releases found. This project may not have published any versions yet.",
    "noStableReleasesFound": "No stable releases found. Only prerelease versions may be available."
  }
} as const;

export default messages;
