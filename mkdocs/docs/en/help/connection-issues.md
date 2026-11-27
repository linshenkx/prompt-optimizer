# Connection Issues

Start in **Model Manager** and click **Test Connection** for the model you are trying to use. Then match the error to the next check.

| What you see | Check first |
| --- | --- |
| `401`, invalid key, authentication failed | The key belongs to the selected provider, has no extra spaces, and the account can use its API |
| `404`, model not found | The model is available to your account and the API URL matches the provider |
| Quota or balance error | Your provider's usage limits and billing status |
| CORS or Network Error in a browser | Whether the provider allows direct browser calls; try the [desktop app](../deployment/desktop.md) for a local or private service |
| HTTPS site calling a local HTTP URL fails | Browser security may block that combination; use the desktop app for local models |
| Test Connection works, but Optimize fails | Check the model selected on the left and the detailed error from that later request |

For Ollama, start the local service and choose the built-in **Ollama** provider. Its usual URL is `http://localhost:11434/v1`; choose a model that is actually installed. For LM Studio or another compatible local server, choose **OpenAI Compatible (Custom)** and enter its real URL and model ID.

For Apple Silicon, choose the built-in **Rapid-MLX** provider and start `rapid-mlx serve qwen3.5-4b-4bit --port 8000`. Use `http://localhost:8000/v1`, fetch models, and select `qwen3.5-4b-4bit`. Leave API Key blank unless the server uses `--api-key`. The web version requires adding `--cors-origins <the page origin>` to the serve command (scheme, host and port, without a path); cross-origin browser access is disabled by default. The desktop app needs no CORS option.

See [Model Management](../basic/models.md) for setup. If the model connects but a button is unavailable, use [Troubleshooting](troubleshooting.md).
