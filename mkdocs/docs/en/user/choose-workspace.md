# Choose Workspace

For your first run, follow [Quick Start](quick-start.md) in **User Prompt Optimization**. Then choose a workspace for the task you actually want to do.

| I want to... | Workspace | What else I need |
| --- | --- | --- |
| Write an email, rewrite text, or produce a summary | [User Prompt](../basic/user-optimization.md) | One task instruction |
| Define a support assistant's role and lasting rules | [System Prompt](../basic/system-optimization.md) | A user question to test the rules |
| Reuse a prompt while changing topic, product, or tone | [Variable](../advanced/variables.md) | A `{{variable}}` template and test values |
| Improve one message inside a conversation | [Context](../advanced/context.md) | The conversation and the target message |
| Generate an image from text | [Text-to-Image](../image/text2image-workspace.md) | A text model and an image model |
| Generate from one input image | [Image-to-Image](../image/image2image-workspace.md) | An input image, a text model, and an image model |
| Generate from several input images | [Multi-Image](../image/multiimage-workspace.md) | At least two input images and an image model that supports them |

**User prompt or system prompt?** “Write an email” is a concrete task for the user prompt workspace. “You are a support assistant; ask for the order number and never invent a refund policy” is a rule to apply across tasks, so use the system prompt workspace.

**When should I use variables?** Use `{{topic}}` and `{{tone}}` when you will repeatedly change parts of the same prompt. For one task, start in the user prompt workspace.

**When should I use Context?** Use it when the answer depends on earlier turns and you want to edit a selected `system` or `user` message inside that conversation.

Each workspace still needs the right models. A text workspace needs at least one text model; image generation generally needs both a text model and an image model. See [Model Management](../basic/models.md#model-types) and [Troubleshooting](../help/troubleshooting.md).
