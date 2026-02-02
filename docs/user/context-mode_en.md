# Context Mode Guide

This document explains how to use **Context Mode** in Prompt Optimizer: what it is, when to use it, and common pitfalls.

In the UI, Context Mode is the top-level **Function Mode: Context**. It provides two sub-modes:

- **Multi-message**: message-level optimization in a conversation (multi-turn)
- **Variable**: single user prompt optimization with variables & tools

## 1. What problem does Context Mode solve?

When “single prompt optimization” feels unstable, it often lacks real context: prior constraints, examples, available tools, or variable values.

Context Mode helps by sending your configured **messages / variables / tools** together as the optimization context, so the output better matches the real execution environment.

## 2. Choose the right sub-mode: Multi-message vs Variable

Use this table as a quick decision:

| Your goal | Recommended sub-mode |
| --- | --- |
| You are doing role-play or multi-turn chat, and want to optimize one specific system/user message while keeping style consistent with the conversation | Multi-message |
| You have one user prompt, but many reusable parameters (name/date/spec/output format) and want to manage them via {{var}} for reuse & testing | Variable |
| You want to configure tools (Function Calling) and verify tool behavior during testing | Variable |

Both sub-modes support the test area (multi-column comparison) on the right.

## 3. Multi-message quick start

Best for: optimizing a **single** system/user message inside a conversation (not generating a reply).

### Step 0: Enter Multi-message

1. Select **Function Mode: Context**
2. Select sub-mode **Multi-message**

### Step 1: Build the conversation context

Add/edit conversation messages on the left:

- system/user/assistant/tool can all exist as context
- but the usual optimization targets are system or user messages

### Step 2: Select the message to optimize

You must select a system/user message; otherwise the Optimize button is disabled.

### Step 3: Pick model & template

Start with the built-in recommended template:

- **General Message Optimization (Recommended)**

This template enforces a few critical rules:

- Optimization is NOT replying
- Keep the original role (system stays system, user stays user)
- Preserve all `{{var}}` placeholders as-is

### Step 4: Understand V0/V1

Multi-message optimization uses a per-message version chain:

- **V0**: original content (for rollback)
- **V1**: optimized content (usually applied back to the conversation by default)

If the optimization gets worse, switch versions (e.g. back to V0) instead of manual copy/paste rollback.

### Step 5: Validate with the test area

Treat testing as acceptance:

1. Fill variable values (if your messages contain `{{var}}`)
2. Run tests (use multi-column variants to compare)
3. Check format, tone, constraints, and tool behavior

## 4. Variable quick start

Best for: optimizing **one user prompt** with reusable variables and optional tools.

### Step 0: Enter Variable mode

1. Select **Function Mode: Context**
2. Select sub-mode **Variable**

### Step 1: Write prompts with {{var}}

Example:

```text
Create a plan for {{product_name}}.
Output format: {{output_format}}.
Constraints: budget {{budget}}, deadline {{deadline}}.
```

Tip: typing `{{}}` often triggers variable auto-completion.

### Step 2: Provide variable values

If you still see `{{var}}` in preview/test outputs, that variable has no value. Set it first, then re-run preview or test.

### Step 3 (Optional): Configure tools (Function Calling)

If your prompt is meant to run with tools:

1. Define tools in Tool Manager (name/description/parameters)
2. Validate tool calling behavior in the test area

### Step 4: Optimize with a suitable template

Variable-mode templates usually focus on rewriting the user prompt to be clear, executable, and verifiable, while preserving all `{{var}}` placeholders.

Recommended starting template:

- **Contextual User Prompt Basic Refinement**

## 5. Common pitfalls

- “It replies instead of optimizing”: check your template instructions; the recommended multi-message template is explicitly *optimization-only*.
- “Optimize button disabled”: in Multi-message mode, you likely didn't select a target message or didn't choose model/template.
- “The message content changed after optimize”: expected behavior; use version switching to revert to V0.
- “I still see {{var}} in preview/output”: that variable has no value yet. Set the variable value, then re-run preview/test.

---

If you are preparing a reply for Issue #240, you can link this doc (`docs/user/context-mode_en.md`) and quote the decision table in Section 2. That usually helps users pick the correct sub-mode quickly.
