# Desktop App

The desktop app is the best fit for long-term Prompt Optimizer usage, especially when you need local models, custom gateways, or internal enterprise APIs.

## Why We Recommend The Desktop App First

- No browser CORS or mixed-content restrictions
- Easier access to `http://localhost`, LAN services, and internal APIs
- Shares the main workspace capabilities with the web app
- Keeps data inside the local application directory for easier backup
- Built-in update checks are available in release builds, although actual update availability still depends on platform and distribution channel

## Downloads

GitHub Releases: <https://github.com/linshenkx/prompt-optimizer/releases>

The current desktop product name is **`PromptOptimizer`**. Build artifacts follow this naming pattern:

```text
PromptOptimizer-<version>-<os>-<arch>.<ext>
```

Common examples:

- Windows installer: `PromptOptimizer-<version>-win-x64.exe`
- Windows archive: `PromptOptimizer-<version>-win-x64.zip`
- macOS disk image: `PromptOptimizer-<version>-mac-arm64.dmg`
- Linux AppImage: `PromptOptimizer-<version>-linux-x64.AppImage`

## Installation

### Windows

1. Download the `.exe` installer.
2. Double-click to install.
3. If SmartScreen appears, choose "More info" and continue.

### macOS

1. Download the `.dmg`.
2. Drag the app into `Applications`.
3. If the first launch is blocked, allow it in "System Settings -> Privacy & Security".

### Linux

1. Download the `.AppImage` or `.zip`.
2. If you use the AppImage build, run:

```bash
chmod +x PromptOptimizer-<version>-linux-x64.AppImage
```

3. Then launch the file.

## Recommended First-Time Setup

1. Open the app.
2. Go to **Model Management**.
3. Configure your primary text models.
4. If you use Ollama, prefer the built-in `Ollama` provider directly.
5. If you use LM Studio, an enterprise gateway, or another OpenAI-compatible endpoint, use `Custom`.
6. If you plan to use image modes, configure the relevant image models as well.
7. Enter the workspace that matches your task.

### Example: Connect A Local Model

#### Ollama

```text
Provider: Ollama
Base URL: http://localhost:11434/v1
Model: qwen2.5:7b
API Key: usually can be left empty
```

#### Rapid-MLX

For Apple Silicon, choose the built-in **Rapid-MLX** provider and start `rapid-mlx serve qwen3.5-4b-4bit --port 8000`. Use `http://localhost:8000/v1`, fetch models, and select `qwen3.5-4b-4bit`. Leave API Key blank unless the server uses `--api-key`. The web version requires adding `--cors-origins <the page origin>` to the serve command (scheme, host and port, without a path); cross-origin browser access is disabled by default. The desktop app needs no CORS option.

#### LM Studio

```text
Provider: Custom
Base URL: http://localhost:1234/v1
Model: the model name currently exposed by LM Studio
API Key: any non-empty string
```

#### When To Still Use Custom

`Custom` is usually a better fit when your service is one of the following:

- LM Studio
- vLLM / OneAPI / a self-hosted gateway
- An OpenAI-compatible endpoint inside an enterprise network
- A setup where you need a special Base URL or extra request parameters

For `localhost`, private-network, and LAN OpenAI-compatible endpoints, the desktop app can route requests directly where appropriate. This avoids common proxy or browser-network misrouting issues while still allowing public HTTPS providers to use the normal network path.

## Data And Logs

The desktop app uses the standard OS application-data directory, and the folder name follows the product name `PromptOptimizer`.

Common locations:

```text
Windows: %APPDATA%\PromptOptimizer\
macOS: ~/Library/Application Support/PromptOptimizer/
Linux: ~/.config/PromptOptimizer/
```

If you mainly need logs, they are typically under:

```text
%APPDATA%\PromptOptimizer\logs\
```

## When You Probably Do Not Need The Desktop App

If you only need:

- occasional access
- public HTTPS model APIs
- quick temporary usage across devices

then the hosted site or a self-deployed web app is usually enough.

## FAQ

### Does the desktop app match the Chinese documentation feature set?

Yes. The current desktop app reuses the core application workspaces and most of the same features. The Chinese documentation reflects the current implementation.

### Is the desktop app always faster than the web app?

Not always, but it is usually more stable when you depend on local models, custom endpoints, or more complex network environments.

### Can desktop app data be migrated?

Yes. Prefer using **Data Management** inside the app for export and import instead of editing files directly inside the application directory.
