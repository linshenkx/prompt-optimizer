# Multi-Image Workspace

Route: `/#/image/multiimage`

Use this workspace when you want to generate one new image from multiple input images plus a prompt.

Before starting, prepare at least two input images, a text model, and an image model that accepts multiple images; see [Model Management](../basic/models.md#model-types). For example, use image 1 for a person and image 2 for clothing, then describe each image's role. Check their order before running the model on the right.

## First-time rule of thumb

If both are true, this is usually the right page:

1. your final output is an image, not text
2. you need multiple input images to participate in the same generation

## Typical use cases

- combining character, outfit, and scene references into one generated result
- using multiple references to constrain composition, subject relationships, or style
- comparing prompt versions against the same ordered set of input images
- comparing image models against the same ordered set of input images

If you only have text, use [Text-to-Image Workspace](text2image-workspace.md). If you only have one input image, use [Image-to-Image Workspace](image2image-workspace.md).

## If you only want the fastest start

1. upload at least two input images
2. drag the cards to define the meaning of `image 1 / image 2 / image 3`
3. remove the wrong image with the top-right `X`
4. write the prompt so it explicitly refers to the ordered images
5. run one left-side analysis or optimization
6. keep one multi-image-capable model fixed on the right and compare `original / workspace / vN`

## What the left side edits

The left side edits the **multi-image prompt itself**.

You can think about the page like this:

- upper-left: the original multi-image prompt
- middle-left: the input image card area
- lower-left: the editable workspace and version chain
- left side uses a text model, not an image model

The goal of left-side analysis, optimization, and iteration is to make the relationship between the images clearer, not just to restate what each image looks like.

## What matters most in the input image area

This workspace is not just “image-to-image, but more files.”

The important extra rule is: **order carries meaning**.

In the current UI:

- you need at least two images before multi-image generation can start
- each image appears as a card
- the footer drag handle changes order
- the top-right `X` removes a mistaken image
- your prompt should usually refer to `image 1 / image 2 / image 3`

If you change the order, update the prompt references too.

## What the right side tests

The right side tests:

- one prompt version
- the same ordered set of input images
- one multi-image-capable image model
- the real generated image

So the most important baseline in this workspace is:

- keep the image set fixed
- keep the image order fixed
- then compare prompt versions or model differences

## Recommended workflow

1. upload at least two images
2. drag them into a clear semantic order
3. write the prompt using `image 1 / image 2 / image 3`
4. optimize or analyze it once on the left
5. keep one image model fixed and compare `original / workspace / vN`
6. select the more reliable prompt version
7. then keep that version fixed and compare image models

## Common mistakes

The biggest problem is usually not model quality. It is a broken comparison baseline.

If you change all of these at once:

- image order
- prompt version
- image model

you will have a hard time telling what actually caused the result change.

A more reliable method is:

- first keep the same ordered image set and compare prompt versions
- then keep that prompt version and image set fixed while comparing image models

## What the result area usually shows

The current result cards usually show:

- the generated image
- any extra text returned by the model
- output image size and MIME type
- token metadata
- inference timing

## Related pages

- [Text-to-Image Workspace](text2image-workspace.md)
- [Image-to-Image Workspace](image2image-workspace.md)
- [Model Management](../basic/models.md)
- [Model Testing Strategy](../user/model-testing-strategy.md)
- [Quick Start](../user/quick-start.md)
