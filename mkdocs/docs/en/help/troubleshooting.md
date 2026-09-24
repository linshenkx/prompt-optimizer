# Troubleshooting

## Optimize or Analyze is unavailable

Check that **Original Prompt** contains text and that you selected an enabled **Optimization Model** on the left. If no model appears, [configure one text model](../basic/models.md#first-text-model). Context and image workspaces may also require a selected target message or input image.

## Test or evaluation is unavailable

Check the required input for your workspace: a System Prompt test needs a user message; variable templates need values; image generation needs an image model; Compare Evaluation needs multiple actual test results. See [Testing & Evaluation](../user/testing-evaluation.md).

## A model request fails

Use **Test Connection** in Model Manager, then check the key, model, quota, URL, and browser network restrictions in [Connection Issues](connection-issues.md). A successful connection test does not guarantee every later request will succeed.

## History or settings seem missing

Check whether you changed browsers, browser profiles, or devices, or cleared site data. Import an existing backup through [Data Management](../basic/data.md) if you have one. Inspect backup files for sensitive model keys before sharing them.

## The app opens to a blank page

Refresh once, try a current browser without blocking extensions, and check whether the problem also occurs in a fresh profile. If it persists, report the version, browser, route, and console error through [Technical Support](support.md).
