# Quick Start: Improve Your First Prompt

This guide starts with model setup and ends with an improved prompt you can copy. You need one working text model for the first run.

!!! warning "Before you begin"
    Prompt Optimizer does not include a ready-to-use online model. Bring an API key from your model provider, or use a local model that is already running. A chat subscription and API access may be managed separately by the provider. See [Model Management](../basic/models.md) for the full setup.

## 1. Connect a text model

1. Open the [online optimizer](https://prompt.always200.com/#/basic/user) or the desktop app.
2. Click **Model Manager** at the top. Stay on **Text Models** and click **Add**.
3. Enter a display name, choose a provider for which you have an API key, enter the key, and select a model your account can use. For a built-in official provider, keep the automatically filled API URL at first.
4. Click **Test Connection**. When it succeeds, click **Create** and make sure the model is enabled.

If you do not have an API key yet, read [Model Management: Before you start](../basic/models.md#before-you-start). For connection errors, see [Connection Issues](../help/connection-issues.md).

![Text model list in Model Management](../assets/images/product/2026-11/model-manager.jpg)

*Captured in an isolated demo environment on the November 2026 development build. Configure your own working connection; a preset name does not grant API access.*

## 2. Enter a task prompt {#enter-prompt}

At the top, open **Basic → User Prompt Optimization**. In **Original Prompt** on the left, enter:

> Write an email asking coworkers to submit this week's progress by Friday at 5 PM. Be polite, stay under 100 words, and do not invent background details.

Choose your new model in **Optimization Model**. Leave the optimization template on its default setting for now.

![User prompt workspace with input and model controls](../assets/images/product/2026-11/basic-workspace.jpg)

*Optimize the task on the left, then compare the original and revised prompts using the same model on the right.*

## 3. Improve and copy the prompt

Click **Optimize** on the left. When generation ends, read the revised prompt in **Optimization Workspace**, then use its copy button. You can send that revised prompt to the model you actually plan to use.

The screenshot shows a real optimization and test run. Check dates, times, length, and tone before copying, and remove invented facts. One run does not guarantee an improvement every time.

The output here is an **improved task instruction**, not the finished email. To see an email generated from that instruction inside Prompt Optimizer, run a test on the right.

If **Optimize** is unavailable, check that the original prompt has text and that an enabled **Optimization Model** is selected. If a request fails, return to Model Manager and test the connection again; see [Troubleshooting](../help/troubleshooting.md).

## What next?

- To see whether the rewrite helped, use [Testing & Evaluation](testing-evaluation.md) to test the original and revised prompts with the same model.
- To compare models or settings directly, see [Arena](../advanced/arena.md) and [Model Selection & Parameters](../basic/model-parameters.md).
- To keep the prompt, use [Favorites & Import](../basic/favorites.md).
- To work on reusable rules, variable templates, or images, see [Choose Workspace](choose-workspace.md).

Your first optimization is complete at this point. Image features need additional model setup; see [Model Management](../basic/models.md#model-types).
