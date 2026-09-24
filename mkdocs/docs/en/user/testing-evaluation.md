# Testing & Evaluation

For a first run, finish [Quick Start](quick-start.md). To check whether a rewrite helped, run the original and improved prompts with the **same model** on the right, then compare their actual outputs. One text model is enough for that comparison.

This page explains one thing:

**what the left side edits, and what the right side proves.**

Once that boundary is clear, the buttons become much easier to understand.

## First-time users: remember these 4 lines

- **Left side** edits prompts
- **Right side** runs real outputs
- **Result Evaluation** checks whether one output is good enough
- **Compare Evaluation** checks which output is better and why

## Start with this action table

| Action | Where it happens | Main focus | Does it modify the left workspace? |
| --- | --- | --- | --- |
| Analysis | Left side | prompt structure, clarity, constraints | can suggest edits for the workspace |
| Optimize / Iterate | Left side | rewrite or improve the prompt directly | yes |
| Test | Right side | real execution output | no |
| Result Evaluation | one right-side column | whether this one execution reached the goal | can suggest edits for the workspace |
| Compare Evaluation | multiple right-side columns | differences across real outputs | can suggest edits for the workspace |

## If you only want the shortest explanation, read these 3 lines

1. **Analysis** does not use right-side test input. It inspects the prompt itself.
2. **Result Evaluation** judges one real execution.
3. **Compare Evaluation** compares multiple real executions.

## Analysis vs evaluation

### Left-side analysis

Left-side analysis asks: “Is this prompt written clearly enough?”

It focuses on:

- whether the goal is clear
- whether constraints are complete
- whether the wording is stable enough for the model to follow
- whether the structure is suitable for further optimization

### Right-side evaluation

Right-side evaluation asks: “How good was this real execution?”

It focuses on:

- whether the input and output match
- whether the output completed the task
- which constraints were satisfied or violated
- what the current workspace prompt still lacks

## What left-side analysis does not read

To avoid semantic confusion, left-side analysis does not treat right-side test input as evidence.

That means:

- in **System Prompt Workspace**, left-side analysis does not read the right-side test message
- in **Variable Workspace**, left-side analysis does not read the current variable values
- in **Context Workspace**, left-side analysis does not use one previous right-side execution as a premise

If you want to judge whether a prompt actually worked on a real result, use right-side evaluation.

## What the right side is testing in each workspace

| Workspace | Main right-side test input | Most important evidence during evaluation |
| --- | --- | --- |
| System Prompt Workspace | one test message | system prompt + test message + output |
| User Prompt Workspace | usually no extra input | executed prompt + output |
| Variable Workspace | shared variable form | executed prompt + variable values + output |
| Context Workspace | full conversation + shared variables + optional tools | full execution snapshot + output |
| Text-to-Image Workspace | image model | prompt version + image model + real generated image |
| Image-to-Image Workspace | input image + image model | input image + prompt version + real generated image |
| Multi-Image Workspace | ordered input images + image model | image set / image order + prompt version + real generated image |

## Result Evaluation vs Compare Evaluation

Use **Result Evaluation** when you want to judge one column on its own.

Typical questions:

- Did this column drift?
- Why did it add extra explanation?
- Why did it miss the format?
- Does this one version already have obvious prompt issues?

Use **Compare Evaluation** when you already have two or more columns and want to compare the differences.

Typical questions:

- original vs workspace
- workspace vs `v2`
- same prompt on different models
- different saved versions on the same model
- different image-prompt versions against the same image baseline
- different image models against the same image prompt version

## What Compare Evaluation is actually comparing

Compare Evaluation compares **real output evidence**, not version labels.

- **Same model, different prompt versions**: did the prompt change actually change the result?
- **Same prompt, different models**: which model interprets the prompt more reliably?
- **Workspace draft vs saved versions**: is the current draft actually worth saving?

For image workspaces, remember one extra rule:

- **image compare evaluation compares the real generated outputs, not the prompt's self-description**

So if you change the input image, or change the order of multi-image inputs, and then run compare evaluation, the conclusion can become misleading very quickly.

## What “workspace” means

The `Workspace` option on the right means the **current editable content on the left**.

It is not the same as “latest saved version”.

Think of it like this:

- original: your initial input
- `v1 / v2 / v3`: saved versions
- workspace: what you are editing right now, even if it is not saved yet

## What Focus Brief is for

Evaluation dialogs can include an optional **Focus Brief**.

If you provide something like:

- “Do not add explanation”
- “The tone is too strong”
- “Why is model A much worse than model B?”
- “Tool arguments keep missing required fields”

the evaluation will prioritize that concern instead of returning a generic summary.

## What happens after you apply evaluation suggestions

Evaluation suggestions are not bound to one version branch.

The rule is:

- try to apply them to the **current left workspace**
- if the workspace has changed too much, the old evaluation becomes stale
- stale does not mean deleted; it means “this conclusion belongs to older content”

## Recommended first workflow

1. Build one testable workspace draft on the left
2. Run `2-4` real columns on the right
3. Start with Result Evaluation to catch obvious single-column issues
4. Then run Compare Evaluation to summarize version or model differences
5. Apply the valuable suggestions back to the left workspace
6. Save a new version only when the changes are worth keeping

When you use `Run All`, available result columns are started in parallel where possible. This makes comparison setup faster, but the evaluation rule stays the same: compare outputs that share the same prompt/model baseline unless you intentionally want to test that variable.

## Common mistakes

- **Mistake 1: left-side analysis should read right-side test input**  
  No. Analysis focuses on the prompt itself.
- **Mistake 2: right-side evaluation always knows one historical branch**  
  No. The current design is about improving the current editable workspace, not maintaining strict branch binding.
- **Mistake 3: Compare Evaluation only compares A/B labels**  
  No. It compares difference patterns across real outputs.

## Related pages

- [Quick Start](quick-start.md)
- [Choose Workspace](choose-workspace.md)
- [System Prompt Workspace](../basic/system-optimization.md)
- [User Prompt Workspace](../basic/user-optimization.md)
- [Variable Workspace](../advanced/variables.md)
- [Context Workspace](../advanced/context.md)
