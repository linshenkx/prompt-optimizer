# Docker Advanced Configuration

This page covers the advanced runtime configuration pattern for custom OpenAI-compatible models in Docker deployments.

## Extra Request Parameters for Custom Models

When a provider needs more than `apiKey`, `baseURL`, and `model`, use:

```bash
VITE_CUSTOM_API_PARAMS_<suffix>=json-object-string
```

Example:

```yaml
services:
  prompt-optimizer:
    image: linshen/prompt-optimizer:latest
    environment:
      VITE_CUSTOM_API_KEY_nvidia: nvapi-xxx
      VITE_CUSTOM_API_BASE_URL_nvidia: https://integrate.api.nvidia.com/v1
      VITE_CUSTOM_API_MODEL_nvidia: qwen/qwen3.5-397b-a17b
      VITE_CUSTOM_API_PARAMS_nvidia: '{"chat_template_kwargs":{"enable_thinking":true},"temperature":0.6,"top_p":0.95,"max_tokens":16384}'
```

## What It Supports

- standard request fields such as `temperature`, `top_p`, and `max_tokens`
- vendor-specific fields such as NVIDIA NIM's `chat_template_kwargs`
- stable runtime defaults supplied by Docker instead of manual UI input

## Constraints

- `PARAMS` must be a JSON object string
- reserved keys `model`, `messages`, and `stream` are ignored automatically
- `timeout` is allowed and can be used to override request timeout
- invalid JSON does not break the model configuration; only the extra params are ignored

## Verification

1. Start the container.
2. Pick the custom model in the UI.
3. Send a message.
4. Inspect the outgoing request body in browser DevTools.
