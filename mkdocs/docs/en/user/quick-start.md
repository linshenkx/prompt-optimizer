# Quick Start

This page has one job: help you complete one real workflow with the shortest possible path.

!!! warning
    GlobalCloud XiaoC does not include a ready-to-use model by default. Before your first run, configure at least one text model in **Model Management**, or analysis, optimization, testing, and evaluation will not work.

## First-time users: only do these 4 steps

1. Configure one text model in **Model Management**
2. Open the workspace that matches your input structure
3. Run one **Optimize** or **Analyze** action on the left
4. Run **Test / Result Evaluation / Compare Evaluation** on the right

If you are not sure where to go next:

- model setup: see [Model Management](../basic/models.md)
- workspace choice: see [Choose Workspace](choose-workspace.md)
- analysis vs evaluation: see [Testing & Evaluation](testing-evaluation.md)

## Step 1: configure the minimum model setup

- text workspaces: at least 1 text model
- image workspaces: at least 1 text model + 1 image model
- multi-image generation: also make sure the right-side image model supports multiple input images and prepare at least two images

For most first-time users, the simplest path is:

1. configure one text model
2. run left-side analysis or optimization
3. run right-side testing
4. run one evaluation

Once that works, add a second text model only if you actually want side-by-side comparison.

See [Model Management](../basic/models.md) and [Model Testing Strategy](model-testing-strategy.md) for more detail.

## Step 2: choose the right workspace

| Workspace | What you optimize | Main right-side input |
| --- | --- | --- |
| [System Prompt Workspace](../basic/system-optimization.md) | roles, rules, boundaries, output policy | one test message |
| [User Prompt Workspace](../basic/user-optimization.md) | one direct task prompt | usually no extra input |
| [Variable Workspace](../advanced/variables.md) | a reusable prompt template | one set of variable values |
| [Context Workspace](../advanced/context.md) | one target message inside a conversation | full conversation + shared variables + optional tools |
| [Text-to-Image Workspace](../image/text2image-workspace.md) | image prompt | image model |
| [Image-to-Image Workspace](../image/image2image-workspace.md) | image-to-image prompt | input image + image model |
| [Multi-Image Workspace](../image/multiimage-workspace.md) | multi-image relationship prompt | at least two input images + image model |

## Step 3: understand left vs right

This is the most important product boundary in the app:

- **left side** edits prompts
- **right side** runs real outputs
- **right-side evaluation** judges real execution evidence

For the full boundary, see [Testing & Evaluation](testing-evaluation.md).

## Step 4: run one minimum workflow

In any text workspace, you can start with this sequence:

1. enter the original content on the left
2. click **Optimize** or **Analyze** on the left
3. move the result into the lower workspace area
4. choose `original / workspace / vN` on the right
5. run one or more tests
6. start with **Result Evaluation**
7. then use **Compare Evaluation** if you have multiple columns
8. apply valuable suggestions back to the left workspace

## If model connection fails, then check deployment and connection environment

| Your situation | Recommended path | Why |
| --- | --- | --- |
| public HTTPS API only | Web / hosted version | simplest setup |
| Ollama, LM Studio, local network, internal API | Desktop app | avoids common browser CORS and mixed-content limits |
| self-hosted page plus MCP | Docker | packages the web UI and MCP together |

!!! warning
    The web version is not a built-in proxy layer. The browser still sends requests directly to the model service you configure.

## Three small examples

### Example A: System Prompt Workspace

Left side:

```text
You are a technical support assistant. Answer user questions clearly.
```

Right-side test message:

```text
My app crashes on Windows at launch. What should I check first?
```

### Example B: User Prompt Workspace

Left side:

```text
Write a poem about autumn.
```

No extra test text is needed on the right in this workspace. The user prompt itself is the tested object.

### Example C: Text-to-Image Workspace

Left side:

```text
An orange cat standing on a neon street in the rain, cinematic mood, rich detail, low saturation.
```

Then:

1. choose a text model for left-side prompt work
2. choose an image model on the right
3. compare prompt versions through real generated images

### Example D: Multi-Image Workspace

Open `/#/image/multiimage`.

Upload at least two images, for example:

- image 1: the character reference
- image 2: the outfit or style reference

Left side:

```text
Use image 1 as the main character identity. Preserve the outfit style and material feel from image 2. Generate one cohesive new image instead of mechanically stitching the references together.
```

Then:

1. drag the cards to confirm the meaning of `image 1 / image 2`
2. remove the wrong image with the top-right `X`
3. click **Optimize** on the left
4. choose multi-image-capable image models on the right
5. keep one model fixed and compare `original / workspace / vN`
6. then keep the prompt version fixed and compare image models

## Common mistakes

### “Web deployment” means there is a proxy layer

No. The browser still connects directly to your configured model service.

### Why can’t I connect to my local model?

The most common reason is browser-side CORS or mixed-content restrictions. In those cases, the desktop app is usually a better fit.

### Will clearing browser data erase my setup?

Yes. Browser-side data is stored locally in the browser. Export from data management before clearing it.
