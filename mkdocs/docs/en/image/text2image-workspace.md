# Text-to-Image Workspace

Route: `/#/image/text2image`

Use this workspace when you want to generate images from text only, with no reference image.

Before starting, connect a [text model and an image model](../basic/models.md#model-types). For example, enter “An orange cat on a neon street in the rain, cinematic, muted colors.” The left side improves the image prompt; an image appears only after you run the model on the right.

## First-time rule of thumb

If both are true, this is usually the right page:

1. your final output is an image, not text
2. you only have a text prompt, with no input image

## Typical use cases

- poster, illustration, cover, or character-concept prompts
- comparing how `original / workspace / vN` changes image output
- comparing the same prompt on different image models

If you already have an input image, use [Image-to-Image Workspace](image2image-workspace.md).

## When the reference-image actions are useful

Even though the main mode here is “text only,” recent releases also connected **reference-image-assisted prompt work** into this workspace.

Near the left-side header, the current UI can expose two reference-image actions:

- **Replicate**: ignore the current prompt and infer a reusable prompt plus variables from the reference image
- **Style Learn**: keep your current subject goal, but learn style, composition, and color language from the image

These actions are especially useful when:

- you already have a finished or style reference image and want to turn it back into reusable prompt material
- you already know what subject you want, but want to borrow visual style without switching to image-to-image

## What must be configured before using them

Reference-image actions are not normal right-side generation. They depend on a separate **image recognition model**.

So if you want to use:

- reference-image replication
- style learning
- variable extraction from images

you need to configure an image-recognition-capable model separately in model management.

If that model is not configured, normal text-to-image generation can still work, but the reference-image actions will not be fully available.

## If you only want the fastest start

1. write the image prompt on the left
2. run one left-side analysis or optimization
3. keep one image model fixed on the right
4. compare `original / workspace / vN` through real images

## What the left side edits

The left side edits the **image prompt itself**.

The left side uses a text model, not an image model.

## What the right side tests

The right side tests:

- one prompt version
- one image model
- the real generated image

If you use the reference-image actions, you can think about the workflow as three different steps:

- **reference-image actions**: pull prompt clues from the image
- **left-side analysis / optimization**: rewrite those clues into a cleaner prompt
- **right-side testing / comparison**: check whether the real images now match the goal

## Recommended workflow

1. write the original image prompt
2. optimize or analyze it once on the left
3. keep one image model fixed and compare `original / workspace / vN`
4. select the better prompt version
5. then keep that version fixed and compare image models

If your starting point is a reference image, a better sequence is:

1. upload the reference image and choose **Replicate** or **Style Learn**
2. apply the generated prompt or extracted variables back into the current prompt
3. run one left-side analysis or optimization pass
4. then compare real image results on the right

## Related pages

- [Image-to-Image Workspace](image2image-workspace.md)
- [Model Management](../basic/models.md)
- [Model Testing Strategy](../user/model-testing-strategy.md)
