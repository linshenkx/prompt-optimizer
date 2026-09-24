# Common Questions

## Why do I need to configure a model?

Prompt Optimizer provides the interface for improving and testing prompts. An AI request is handled by the model provider you connect. Follow [Quick Start](../user/quick-start.md) to set up a text model, and use [Model Management](../basic/models.md) for the individual fields.

## Is a chat subscription enough?

Chat subscriptions and API access may be managed separately. Check your provider's API console for a key, model access, quota, and charges.

## Where are my prompts and settings stored?

The online version keeps app data in the current browser. The desktop app stores it on your device. Model requests go to the provider you selected. Export a backup from [Data Management](../basic/data.md) before clearing site data or moving devices, and inspect backups for sensitive keys before sharing them.

## Can the online version call Ollama or LM Studio on my computer?

Browser requests to a local HTTP service may be blocked by browser security rules or CORS. The [desktop app](../deployment/desktop.md) is usually easier for local models. See [Connection Issues](connection-issues.md).

## Why does the User Prompt workspace have no separate test message?

It executes the user prompt itself. The System Prompt workspace needs a separate user question to test its rules. See [Choose Workspace](../user/choose-workspace.md).

## Where can I report a problem?

See [Technical Support](support.md). Include the app version, workspace, provider and model name, steps to reproduce, and the actual error. Never post an API key.
