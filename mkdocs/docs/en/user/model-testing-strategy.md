# Model Testing Strategy

This page does not explain provider fields. It answers two questions:

1. which model should you use on the left side
2. how should you compare versions and models on the right side

## First-time users: follow this order

1. Pick one stable optimization model for the left side
2. Pick the real target model you actually care about on the right side
3. Compare prompt versions first, then compare model differences

## Remember these 4 lines

1. The left-side model is for analysis, optimization, and iteration. It does not prove real output quality.
2. The right-side model is for real execution. It is the source of test evidence.
3. If you want to compare prompt versions, keep model and input fixed.
4. If you want to compare models, keep prompt and input fixed.

## How to choose the left-side optimization model

The left-side model is responsible for:

- analyzing prompt structure
- generating improved drafts
- continuing iterations
- evaluation uses the model selected by the workspace's evaluation settings; basic workspaces prefer the selected right-side test model

Prioritize:

- the model you know best
- a model that is stable at reasoning and rewriting
- a cost and speed level you can afford

It does not have to match your production model exactly.

## How to choose the right-side test model

The right-side model is responsible for:

- real prompt execution
- producing results
- supplying evidence for Result Evaluation and Compare Evaluation

If you already know your target model, use it on the right side first.

## If you only want the shortest advice

1. Use one stable text model on the left
2. Use the model you truly care about on the right
3. Compare versions before you compare models

## In text workspaces: compare versions or compare models first?

If you want to know whether a prompt change actually helped, compare **versions** first:

- keep the right-side input fixed
- keep the test model fixed
- compare `original / workspace / vN`

If you want to know whether the same prompt is stable across models, compare **models**:

- keep the same prompt fixed
- keep the same test input fixed
- switch right-side models

The least helpful starting point is changing both at once:

- prompt version
- test model

If both change together, it becomes hard to tell what actually caused the change.

## Variable and context workspaces need extra care

### Variable Workspace

When comparing prompt versions, keep the variable values the same.

### Context Workspace

When comparing one target message version, keep the full conversation context stable.

## Image workspaces are naturally dual-model

Image workspaces differ from text workspaces because the left and right sides already use different model types.

### Left side

The left side still uses a **text model** for:

- analyzing image prompts
- optimizing image prompts
- continuing iterations

### Right side

The right side uses an **image model** for:

- generating the actual image
- comparing prompt versions through real images
- comparing style differences across image models

## A better testing order for image workspaces

### Text-to-image

1. keep one image model fixed and compare `original / workspace / vN`
2. find the more reliable prompt version
3. then keep that version fixed and compare different image models

### Image-to-image

Keep the same input image whenever possible. If the input image changes, your comparison baseline changes too.

### Multi-image

In addition to keeping the prompt and model fixed, try to keep these stable too:

- the input image set
- the input image order
- the prompt references to each image

If you change the order of `image 1 / image 2 / image 3` without updating the prompt, your comparison becomes unreliable very quickly.

Before comparing versions, a safer sequence is:

1. confirm the order with drag-and-drop
2. remove mistaken images with the top-right `X`
3. then compare `original / workspace / vN`

## Browser vs desktop

If you mainly connect to public HTTPS APIs, the browser version is usually enough.

If you mainly connect to local or internal services that are affected by browser restrictions, the desktop app is usually more reliable.

## The simplest starting strategy

### Text workspaces

- left side: one familiar optimization model
- right side: one target model you actually care about
- compare versions first, then models

### Image workspaces

- left side: one stable text model
- right side: start with one main image model
- compare prompt versions first, then image models

## Related pages

- [Quick Start](quick-start.md)
- [Testing & Evaluation](testing-evaluation.md)
- [Model Management](../basic/models.md)
- [Text-to-Image Workspace](../image/text2image-workspace.md)
- [Image-to-Image Workspace](../image/image2image-workspace.md)
- [Multi-Image Workspace](../image/multiimage-workspace.md)
