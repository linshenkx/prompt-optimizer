# System Prompt Workspace

Route: `/#/basic/system`

Use this workspace for long-lived constraints such as role design, behavior boundaries, and output policy.

If your main problem is how to phrase one concrete task, [User Prompt Workspace](user-optimization.md) is usually a better fit.

Before starting, [connect one text model](models.md#first-text-model) and prepare a user question that tests the rules. The left side produces a revised system prompt; running the question on the right shows the model's actual reply.

## First-time rule of thumb

If both are true, this is usually the right page:

1. you are editing long-lived role / rule / boundary content
2. the right side needs one test message before it can run

## Typical use cases

- define a stable model role
- enforce a reusable output structure
- define what the assistant must not do
- test whether the model keeps rules across different questions

## If you only want the fastest start

1. enter one system prompt on the left
2. run one left-side optimization
3. enter one test message on the right
4. run testing, then Result Evaluation

## What the left side edits

The left side edits the **system prompt itself**.

You can think of the page like this:

- upper-left: original system prompt
- lower-left: current workspace draft and saved versions

## What the right side tests

The right side tests:

- one system prompt version
- one fixed test message
- the real output

That is why the right-side test message is required in this workspace.

## Analysis vs evaluation in this page

- left-side **Analysis**: inspects the system prompt itself, not the test message
- right-side **Result Evaluation**: judges whether one real output reached the goal
- right-side **Compare Evaluation**: compares multiple real outputs

## Recommended workflow

1. enter the original system prompt
2. optimize it once on the left
3. use left-side analysis if you want prompt-only feedback first
4. enter one fixed test message on the right
5. compare `original / workspace / vN`
6. start with **Result Evaluation**
7. then run **Compare Evaluation** if you have multiple columns
8. apply valuable suggestions back to the left workspace

## Common confusions

- Left-side analysis does not read the test message. It analyzes the system prompt itself.
- The right-side test message is required because a system prompt usually cannot reveal its behavior on its own.

## A minimal example

System prompt:

```text
You are a customer support assistant.
```

Right-side test message:

```text
My order has not shipped for three days. Can I request a refund now?
```

With that setup, you can compare:

- whether the original version is too vague
- whether the workspace version follows boundaries more reliably
- whether different models misunderstand the same system prompt in different ways

## Related pages

- [User Prompt Workspace](user-optimization.md)
- [Testing & Evaluation](../user/testing-evaluation.md)
- [Templates](templates.md)
- [System Prompt Examples & Best Practices](../examples/system-prompt-examples.md)
