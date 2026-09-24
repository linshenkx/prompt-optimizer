# Variable Workspace

Route: `/#/pro/variable`

Use this workspace when one prompt structure stays the same but its parameters change across runs.

Before starting, prepare a [text model](../basic/models.md#first-text-model), a prompt with `{{variables}}`, and one set of test values. The left side revises the template; the right side fills in values and produces an actual output.

## First-time rule of thumb

If both are true, this is usually the right page:

1. your prompt structure is stable, but the values change repeatedly
2. the right side needs one set of variable values before testing

## Typical use cases

- one prompt structure reused with different inputs
- turning one prompt into a reusable template
- comparing `original / workspace / vN` with the same variable values

Typical template style:

```text
Write a poem about {{topic}} in {{style}}.
```

## If you only want the fastest start

1. write a template prompt with `{{variables}}` on the left
2. run one left-side optimization
3. fill one set of variable values on the right
4. run testing, then evaluation

## What the left side edits

The left side edits the **template prompt itself**.

You can think of the page like this:

- upper-left: original template prompt
- lower-left: current workspace draft and saved versions

## What the right side tests

The right side tests:

- one template version
- one set of variable values
- the real output

Variable values are part of the **right-side test input**.

## Does left-side analysis read right-side variable values?

No.

Left-side analysis still focuses on the template itself, not on the current values used for one test run.

## Recommended workflow

1. write the template prompt on the left
2. optimize it once on the left
3. use left-side analysis if you want prompt-only feedback first
4. fill shared variable values on the right
5. compare `original / workspace / vN`
6. start with **Result Evaluation**
7. then use **Compare Evaluation** for multiple columns
8. apply valuable suggestions back to the left workspace

## How to think about variable sources

You can keep it simple and think in three layers:

- **global variables**: values you reuse across workspaces
- **context variables**: values that belong to one conversation setup
- **temporary variables**: values entered only for the current workspace or test run

For daily use, two rules matter most:

- a temporary variable overrides a global variable with the same name
- protected built-in variables are not meant to be replaced by ordinary variables

## A minimal example

Template prompt:

```text
You are a {{style}} poet. Write a poem about {{topic}}.
```

Right-side variables:

```text
style=Chinese classical
topic=programmer overtime
```

With that setup, you can compare:

- which prompt version stays more stable under the same variable values
- whether the same template behaves very differently across models

## Related pages

- [Context Workspace](context.md)
- [Testing & Evaluation](../user/testing-evaluation.md)
- [Data Management](../basic/data.md)
