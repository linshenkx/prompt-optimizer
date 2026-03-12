# Multiple Custom Models Configuration Guide

## Overview

Prompt Optimizer now supports configuring unlimited number of custom models, allowing you to use multiple local models or self-hosted API services simultaneously.

## Features

- ✅ Support unlimited number of custom models
- ✅ Automatic discovery and registration via environment variables
- ✅ Friendly model name display
- ✅ Fully backward compatible with existing configurations
- ✅ Support all deployment methods (Web, Desktop, Docker, MCP)

## Configuration Method

### Environment Variable Format

Use the following format to configure multiple custom models:

```bash
VITE_CUSTOM_API_KEY_<suffix>=your-api-key          # Required
VITE_CUSTOM_API_BASE_URL_<suffix>=your-base-url    # Required
VITE_CUSTOM_API_MODEL_<suffix>=your-model-name     # Required
VITE_CUSTOM_API_PARAMS_<suffix>=json-object-string # Optional extra request parameters
```

### Configuration Requirements

- **Suffix**: Only letters (a-z, A-Z), numbers (0-9), underscores (_), hyphens (-), maximum 50 characters
- **API_KEY**: Required for API authentication
- **BASE_URL**: Required, API service base URL
- **MODEL**: Required, specific model name
- **PARAMS**: Optional JSON object string injected into the final request body

### Configuration Examples

#### Example 1: Local Ollama Models

```bash
# Qwen 2.5 Model
VITE_CUSTOM_API_KEY_qwen25=ollama-dummy-key
VITE_CUSTOM_API_BASE_URL_qwen25=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen25=qwen2.5:7b

# Qwen 3 Model
VITE_CUSTOM_API_KEY_qwen3=ollama-dummy-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b
```

#### Example 2: Cloud API Services

```bash
# Claude API
VITE_CUSTOM_API_KEY_claude=sk-ant-your-claude-key
VITE_CUSTOM_API_BASE_URL_claude=https://api.anthropic.com/v1
VITE_CUSTOM_API_MODEL_claude=claude-3-sonnet-20240229
VITE_CUSTOM_API_PARAMS_claude={"temperature":0.3,"top_p":0.8}

# Custom OpenAI Compatible Service
VITE_CUSTOM_API_KEY_custom=your-custom-api-key
VITE_CUSTOM_API_BASE_URL_custom=https://api.example.com/v1
VITE_CUSTOM_API_MODEL_custom=custom-model-name
VITE_CUSTOM_API_PARAMS_custom={"temperature":0.7,"top_p":0.9,"max_tokens":4096}
```

#### Example 3: Mixed Configuration

```bash
# Local model
VITE_CUSTOM_API_KEY_local=dummy-key
VITE_CUSTOM_API_BASE_URL_local=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_local=llama2:7b

# Cloud service
VITE_CUSTOM_API_KEY_cloud=real-api-key
VITE_CUSTOM_API_BASE_URL_cloud=https://api.service.com/v1
VITE_CUSTOM_API_MODEL_cloud=gpt-4-turbo

# Development environment
VITE_CUSTOM_API_KEY_dev=dev-api-key
VITE_CUSTOM_API_BASE_URL_dev=https://dev-api.example.com/v1
VITE_CUSTOM_API_MODEL_dev=dev-model
VITE_CUSTOM_API_PARAMS_dev={"temperature":0.4}
```

### Extra Request Parameters

`VITE_CUSTOM_API_PARAMS_<suffix>` is useful when you need to:

- set standard OpenAI-compatible fields such as `temperature`, `top_p`, or `max_tokens`
- pass vendor-specific payload fields such as NVIDIA NIM's `chat_template_kwargs`
- define stable defaults in Docker runtime configuration instead of re-entering them in the UI

Example JSON payload:

```json
{
  "chat_template_kwargs": {
    "enable_thinking": true
  },
  "temperature": 0.6,
  "top_p": 0.95,
  "max_tokens": 16384
}
```

Notes:

- `PARAMS` must be a JSON object string
- `model`, `messages`, and `stream` are reserved and will be ignored automatically
- `timeout` is allowed and can be used to override request timeout behavior
- for complex Docker Compose values, wrap the entire JSON string in single quotes

## Deployment Methods

### Web Development Environment

Create `.env.local` file in project root:

```bash
# Basic models
VITE_OPENAI_API_KEY=your-openai-key
VITE_GEMINI_API_KEY=your-gemini-key

# Custom models
VITE_CUSTOM_API_KEY_ollama=dummy-key
VITE_CUSTOM_API_BASE_URL_ollama=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b
VITE_CUSTOM_API_PARAMS_ollama={"temperature":0.7}
```

### Docker Deployment

#### Method 1: Environment Variables

```bash
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e VITE_CUSTOM_API_KEY_ollama=dummy-key \
  -e VITE_CUSTOM_API_BASE_URL_ollama=http://host.docker.internal:11434/v1 \
  -e VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b \
  -e 'VITE_CUSTOM_API_PARAMS_ollama={"temperature":0.7}' \
  -e VITE_CUSTOM_API_KEY_claude=your-claude-key \
  -e VITE_CUSTOM_API_BASE_URL_claude=https://api.anthropic.com/v1 \
  -e VITE_CUSTOM_API_MODEL_claude=claude-3-sonnet \
  -e 'VITE_CUSTOM_API_PARAMS_claude={"temperature":0.3,"top_p":0.8}' \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

#### Method 2: Environment File

Create `.env` file:

```bash
VITE_OPENAI_API_KEY=your-openai-key
VITE_CUSTOM_API_KEY_ollama=dummy-key
VITE_CUSTOM_API_BASE_URL_ollama=http://host.docker.internal:11434/v1
VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b
VITE_CUSTOM_API_PARAMS_ollama={"temperature":0.7}
VITE_CUSTOM_API_KEY_qwen3=your-qwen3-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://host.docker.internal:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b
VITE_CUSTOM_API_PARAMS_qwen3={"temperature":0.6,"top_p":0.95}
```

Run with environment file:

```bash
docker run -d -p 8081:80 --env-file .env \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

#### Method 3: Docker Compose

Modify `docker-compose.yml` to add `env_file` configuration:

```yaml
services:
  prompt-optimizer:
    image: linshen/prompt-optimizer:latest
    env_file:
      - .env  # Read environment variables from .env file
    ports:
      - "8081:80"
    restart: unless-stopped
```

Then configure variables in `.env` file (same as Method 2).

### Desktop Application

Desktop version automatically reads environment variables from system or `.env.local` file.

### MCP Server

MCP server supports all custom model configurations and automatically maps environment variables.

## Model Name Display

The system automatically converts suffix names to friendly display names:

| Suffix | Display Name |
|--------|--------------|
| `qwen25` | Qwen25 |
| `claude_local` | Claude Local |
| `my_model_v2` | My Model V2 |
| `test123` | Test123 |

## Advanced Configuration

### Suffix Naming Best Practices

**Recommended**:
- `ollama` - Local Ollama service
- `claude` - Claude API
- `qwen25` - Qwen 2.5 model
- `local_llama` - Local Llama model
- `dev_model` - Development environment model

**Not Recommended**:
- `model.v1` - Contains dots
- `my model` - Contains spaces
- `test@api` - Contains special characters

### Configuration Validation

The system automatically validates configurations:

1. **Suffix Format Check**: Only allows valid characters
2. **Required Fields Check**: Ensures all three environment variables are present
3. **URL Format Check**: Validates BASE_URL format
4. **Conflict Detection**: Prevents conflicts with built-in model names
5. **PARAMS Shape Check**: Accepts only JSON objects for extra request parameters

### Error Handling

- **Incomplete Configuration**: Automatically ignored, doesn't affect other models
- **Invalid Suffix**: Configuration skipped with warning log
- **Duplicate Suffix**: Later configuration overwrites earlier one
- **Network Issues**: Individual model failures don't affect system stability
- **Invalid PARAMS JSON**: Extra parameters are ignored, but the model remains available

## Troubleshooting

### Common Issues

#### Q: Custom model not appearing in interface?

A: Check the following:
1. All three environment variables configured correctly
2. Suffix name follows naming rules
3. No conflicts with built-in model names
4. Application restarted after configuration changes

#### Q: Model connection test fails?

A: Verify:
1. BASE_URL is accessible
2. API_KEY is valid
3. MODEL name exists in the service
4. Network connectivity is normal

#### Q: How to check if configuration is loaded correctly?

A: Check browser console or application logs for:
```
[scanCustomModelEnvVars] Found X valid custom models: [model1, model2, ...]
[generateDynamicModels] Generated model: custom_modelname (Display Name)
```

If you configured `PARAMS`, inspect the outgoing request payload in browser DevTools to verify the extra fields are present.

### Performance Optimization

- **Configuration Caching**: Configurations are cached at startup, restart required for changes
- **Validation Optimization**: Single-point validation reduces redundant checks by 66%
- **Dynamic Loading**: Models are loaded on-demand to improve startup performance

## FAQ

### Q: How many custom models can be configured?

A: Theoretically unlimited, but recommend reasonable configuration based on actual needs to avoid UI clutter.

### Q: How to remove unwanted custom models?

A: Remove corresponding environment variables and restart the application.

### Q: Do custom models support all features?

A: Yes, custom models support all features including prompt optimization, comparison testing, etc.

### Q: How to configure models for different environments?

A: Use different suffixes for different environments:
```bash
# Production
VITE_CUSTOM_API_KEY_prod=prod-key
VITE_CUSTOM_API_BASE_URL_prod=https://prod-api.com/v1
VITE_CUSTOM_API_MODEL_prod=prod-model

# Development
VITE_CUSTOM_API_KEY_dev=dev-key
VITE_CUSTOM_API_BASE_URL_dev=https://dev-api.com/v1
VITE_CUSTOM_API_MODEL_dev=dev-model
```

## Technical Details

- Model key format: `custom_<suffix>`
- Configuration validation: Automatic checks for suffix format, API key, baseURL, etc.
- Error tolerance: Individual configuration errors don't affect other models
- Default values: Reasonable defaults ensure system stability

## Changelog

- **v1.2.6**: Code quality fixes and performance optimization
  - Fixed MCP Server case conversion bug for more accurate environment variable mapping
  - Optimized configuration validation logic with 66% performance improvement
  - Resolved ValidationResult interface conflicts, improved type safety
  - Implemented dynamic static model key retrieval with automatic synchronization
  - All fixes thoroughly tested to ensure cross-environment consistency

- **v1.4.0**: Added multiple custom models support
  - Fully backward compatible with existing configurations
  - Support all deployment methods
  - Added configuration validation and error handling
