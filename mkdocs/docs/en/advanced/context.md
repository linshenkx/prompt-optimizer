# Context Workspace

Route: `/#/pro/multi`

This workspace is for optimizing one target message inside a full conversation.

Before starting, [connect a text model](../basic/models.md#first-text-model), prepare the conversation, and select the `system` or `user` message to revise. The left side produces that message's revised draft; the right side runs it inside the full conversation.

## First-time rule of thumb

If both are true, this is usually the right page:

1. your input is already a full conversation, not a single prompt
2. the right side needs the full context, shared variables, or tools during testing

## Typical use cases

- conversations with `system / user / assistant` messages
- optimizing one selected `system` or `user` message in context
- workflows that also need shared variables or tool definitions

If you only need one independent prompt, a basic workspace or variable workspace is usually simpler.

## If you only want the fastest start

1. build the conversation first
2. select one target `system` or `user` message
3. run one left-side optimization or analysis
4. configure shared variables and optional tools on the right
5. run testing, then evaluation

## What the left side edits

The left side edits **the selected target message inside the conversation**.

## What the right side tests

The right side tests the **real execution of the full conversation**.

One column swaps only the selected target message between:

- workspace
- original
- `v1 / vN`

## Analysis vs evaluation in this page

- left-side **Analysis**: evaluates how the selected target message is written in context
- right-side **Result Evaluation**: judges one real conversation execution
- right-side **Compare Evaluation**: compares multiple real conversation outputs

## Variables and tools in this workspace

In context mode, variables and tools belong to the **right-side execution evidence**.

You can think about it like this:

- the left side decides how the target message should be written
- the right side shows what really happens after that message is placed back into the full conversation

## Recommended workflow

1. build the conversation
2. select the target `system` or `user` message
3. run left-side optimization or analysis
4. configure shared variables and optional tools
5. compare `workspace / original / vN`
6. start with **Result Evaluation**
7. then use **Compare Evaluation** when you have multiple columns
8. apply valuable suggestions back to the left workspace

## Common confusions

- The right side is not running a single prompt in isolation. It is running the full conversation, while swapping only the selected target message by column.
- Variable values belong to right-side test evidence. Left-side analysis still focuses on the target message itself.

## A minimal example

Conversation:

```text
system: You are a travel planning assistant.
user: Plan a three-day Kyoto trip for first-time visitors.
```

If you select the `system` message as the target, the left side edits only that system message.

The right side then tests the full conversation while switching that target message across:

- workspace
- original
- `v1 / vN`

## Related pages

- [Variable Workspace](variables.md)
- [Testing & Evaluation](../user/testing-evaluation.md)
- [Tool Calling](tools.md)
- [Quick Start](../user/quick-start.md)
