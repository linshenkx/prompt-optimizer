# Smart Variable Fill

Smart Variable Fill uses AI to automatically generate reasonable values for empty variables, suitable for quickly testing and validating variable-based prompts.

## When to Use

- Prompt has multiple variables, but you only want to fill core variables
- Want to quickly test prompt results without manually filling all variables
- Unsure what value a variable should have

## How to Use

### Batch Fill

1. Fill core variables in the variable panel (e.g., "Product Name")
2. Click the **Smart Fill Variable Values** button at the top of the variable panel
3. AI automatically generates values for all empty variables
4. Preview the generated results
5. Confirm application

### Single Variable Fill

1. Find the target variable in the variable panel
2. Click the variable row's dropdown menu
3. Select **Smart Fill** option
4. AI generates a value for only this variable
5. Preview and confirm

## How It Works

### Variable Identification

- **Only fills empty variables**: Already filled variables won't be overwritten
- **Filled variables serve as context**: AI references filled variables to generate coordinated values

### AI Derivation Logic

AI derives variable values based on:

- Prompt's theme and style
- Variable's semantic role in the prompt
- Scene composition implied by filled variables
- Mutual coordination between generated values

### Preview Dialog

After generation, a preview dialog appears showing:

- Generated value for each variable
- Generation reason
- Confidence level
- Editable generated results
- Option to select which variables to apply

## Prerequisites

- Evaluation model must be configured (set in Model Management)
- Prompt cannot be empty

## Use Cases

### Quick Testing

```
Prompt: Write an article about {{topic}}, targeting {{audience}}, in {{style}} style

Manually fill: topic = Artificial Intelligence
Smart fill: audience = Tech enthusiasts, style = Professional but easy to understand
```

### Scene Building

```
Prompt: Write launch copy for {{product}}, targeting {{user_group}}, emphasizing {{core_selling_point}}

Manually fill: product = GlobalCloud XiaoC
Smart fill: user_group = AI developers and prompt engineers, core_selling_point = One-click prompt optimization
```

## Common Questions

### Why weren't any values generated?

- Check if an evaluation model is configured
- Confirm the prompt is not empty
- Check if all variables are already filled (in batch mode)

### How to improve generation quality

- Be specific when filling core variables
- Variable names should be semantic (e.g., "product_name" not "variable1")
- The prompt itself should clearly describe the variable's purpose

### What if generated values are inappropriate?

- Edit generated results in the preview dialog
- Uncheck variables you don't want to apply
- Regenerate if needed; each run may produce different results

## Related Pages

- [Variable Workspace](../advanced/variables.md)
- [Model Management](../basic/models.md)
- [Prompt Garden](../basic/prompt-garden.md)
