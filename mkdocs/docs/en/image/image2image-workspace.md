# Image-to-Image Workspace

Route: `/#/image/image2image`

Use this workspace when you already have an input image and want to continue editing from it.

Before starting, prepare an input image, a text model, and an image model that supports image-to-image generation; see [Model Management](../basic/models.md#model-types). For example, upload a person photo and ask to preserve the pose while changing the style to watercolor. Run the model on the right to see the actual image.

## First-time rule of thumb

If both are true, this is usually the right page:

1. your final output is an image, not text
2. you already have one input image as the starting point

## Typical use cases

- testing prompt versions on the same base image
- comparing image models against the same base image
- style transfer, repainting, or direction-change validation

If you only have text and no input image, use [Text-to-Image Workspace](text2image-workspace.md).

## If you only want the fastest start

1. upload one input image
2. write the image-to-image prompt on the left
3. run one left-side analysis or optimization
4. keep one image model fixed on the right
5. compare `original / workspace / vN` through real images

## What the left side edits

The left side edits the **image-to-image prompt itself**.

The left side uses a text model, not an image model.

## What the right side tests

The right side tests:

- one prompt version
- the same input image
- one image model
- the real generated image

## Recommended workflow

1. upload one input image
2. write the original prompt
3. optimize or analyze it once on the left
4. keep one image model fixed and compare `original / workspace / vN`
5. select the better prompt version
6. then keep that version fixed and compare image models

## Related pages

- [Text-to-Image Workspace](text2image-workspace.md)
- [Model Management](../basic/models.md)
- [Model Testing Strategy](../user/model-testing-strategy.md)
