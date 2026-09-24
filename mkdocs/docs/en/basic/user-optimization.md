# User Prompt Workspace

Route: `/#/basic/user`

Use this workspace to improve how one concrete task is phrased.

If you are mainly writing role rules or global boundaries, [System Prompt Workspace](system-optimization.md) is usually a better fit.

Before starting, [connect one text model](models.md#first-text-model). A successful left-side optimization produces a prompt you can copy. To see the content it generates, run a test on the right. First-time users can follow [Quick Start](../user/quick-start.md).

## First-time rule of thumb

If both are true, this is usually the right page:

1. you are editing one direct task prompt sent to the model
2. the right side usually does not need extra test text

## Typical use cases

- writing, rewriting, summarizing, translating
- generating structured content
- improving task goals, constraints, and output format
- polishing one direct task prompt

## If you only want the fastest start

1. enter one user prompt on the left
2. run one left-side optimization
3. run testing directly on the right
4. then use Result Evaluation or Compare Evaluation

## What the left side edits

The left side edits the **user prompt itself**.

You can think of the page like this:

- upper-left: original user prompt
- lower-left: current workspace draft and saved versions

## What the right side tests

The right side tests:

- one prompt version itself
- the real output produced from that prompt

That is why this workspace usually does **not** need extra test text on the right.

## Analysis vs evaluation in this page

- left-side **Analysis**: inspects the prompt itself
- right-side **Result Evaluation**: judges one output
- right-side **Compare Evaluation**: compares multiple outputs

## Recommended workflow

1. enter the original user prompt
2. optimize it once on the left
3. use left-side analysis if you want prompt-only feedback first
4. choose `original / workspace / vN` on the right
5. run testing
6. start with **Result Evaluation**
7. then use **Compare Evaluation** when you have multiple columns
8. apply valuable suggestions back to the left workspace

## Common confusions

- There is no separate right-side test text in this workspace because the tested object is the user prompt itself.
- Evaluation suggestions try to apply to the current editable workspace, not to one historical version branch.

## A minimal example

Original prompt:

```text
Write a poem.
```

If you also ask for autumn longing in seven-character regulated verse, one revised version could be:

```text
Write a seven-character regulated verse about autumn longing.
Requirements:
1. Write eight lines, seven characters per line.
2. Express longing through imagery instead of direct slogans.
3. Keep the tone restrained and delicate.
4. Output only the poem, with no extra explanation.
```

Then the right side can directly compare:

- whether the original prompt is too broad
- whether the workspace version satisfies constraints more reliably
- whether different models interpret the same prompt consistently

## Related pages

- [System Prompt Workspace](system-optimization.md)
- [Testing & Evaluation](../user/testing-evaluation.md)
- [Templates](templates.md)
- [User Prompt Examples & Best Practices](../examples/user-prompt-examples.md)
