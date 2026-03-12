# Docker Basic Deployment

This guide shows how to run Prompt Optimizer with Docker and how to configure custom OpenAI-compatible models with runtime environment variables.

## Quick Start

```bash
docker run -d -p 8081:80 \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer:latest
```

Open the app at `http://localhost:8081`.

## Custom Model Environment Variables

Custom models support the following runtime variables:

```bash
VITE_CUSTOM_API_KEY_<suffix>=your-api-key
VITE_CUSTOM_API_BASE_URL_<suffix>=your-base-url
VITE_CUSTOM_API_MODEL_<suffix>=your-model-name
VITE_CUSTOM_API_PARAMS_<suffix>=json-object-string
```

Notes:

- `KEY`, `BASE_URL`, and `MODEL` are required
- `PARAMS` is optional and must be a JSON object string
- `PARAMS` is injected into the final OpenAI-compatible request body
- reserved keys `model`, `messages`, and `stream` are ignored automatically

## Example: Docker Run

```bash
docker run -d -p 8081:80 \
  -e VITE_CUSTOM_API_KEY_nvidia=nvapi-xxx \
  -e VITE_CUSTOM_API_BASE_URL_nvidia=https://integrate.api.nvidia.com/v1 \
  -e VITE_CUSTOM_API_MODEL_nvidia=qwen/qwen3.5-397b-a17b \
  -e 'VITE_CUSTOM_API_PARAMS_nvidia={"chat_template_kwargs":{"enable_thinking":true},"temperature":0.6,"top_p":0.95,"max_tokens":16384}' \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer:latest
```

This is useful for:

- standard OpenAI-compatible fields such as `temperature`, `top_p`, and `max_tokens`
- vendor-specific fields such as NVIDIA NIM's `chat_template_kwargs`
- stable Docker defaults that should survive browser cache resets

## Example: Docker Compose

```yaml
services:
  prompt-optimizer:
    image: linshen/prompt-optimizer:latest
    ports:
      - "8081:80"
    restart: unless-stopped
    environment:
      VITE_CUSTOM_API_KEY_nvidia: nvapi-xxx
      VITE_CUSTOM_API_BASE_URL_nvidia: https://integrate.api.nvidia.com/v1
      VITE_CUSTOM_API_MODEL_nvidia: qwen/qwen3.5-397b-a17b
      VITE_CUSTOM_API_PARAMS_nvidia: '{"chat_template_kwargs":{"enable_thinking":true},"temperature":0.6,"top_p":0.95,"max_tokens":16384}'
```

## Verification

1. Start the container.
2. Select the custom model in the UI.
3. Send a message.
4. Inspect the request payload in browser DevTools and confirm the extra fields are present.

## Troubleshooting

- If `PARAMS` is not valid JSON, the model still loads, but the extra parameters are ignored.
- If the custom model does not appear, make sure all required variables use the same suffix.
- For complex JSON values in shell commands or Compose files, wrap the entire string in single quotes.
