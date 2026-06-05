# Prompt Garden

Prompt Garden is an optional prompt source for discovering importable prompts, examples, and media assets. Through import codes, you can quickly bring prompts from Garden into GlobalCloud XiaoC for use or collection.

Entry point: [https://garden.always200.com](https://garden.always200.com)

You can also use GlobalCloud XiaoC without Prompt Garden by writing prompts manually, using templates, or importing local content. Optimization, testing, evaluation, and favorites do not depend on one specific prompt source.

## Import Code Format

An import code is a string identifier with two forms:

### Basic Format

```
NB-001
```

Use the import code directly. The system will use default example parameters.

### With Example Selection

```
NB-001@ex-2
```

Append `@` and an example ID after the import code. The system will fill variables using the specified example's parameters.

## How to Use Import Codes

### Steps

1. Find the desired prompt on the Prompt Garden website
2. Copy its import code
3. Click the **Import** button in the top toolbar of GlobalCloud XiaoC
4. Paste the import code
5. Select target workspace (optional)
6. Confirm import

### Import Options

There are two modes when importing:

**Use Directly**

- Prompt writes to the current workspace
- Variables auto-fill with default values or example parameters
- The target workspace is cleared before writing Garden content, while model choices, templates, and layout preferences are kept
- Suitable for immediate testing and use

**Save to Favorites**

- Prompt, variables, and media resources save together as a favorite
- Source information automatically recorded (import code, source link)
- Suitable for building a personal prompt library

### Direct use vs favorite saving

Direct use is best when you want to test one Garden prompt immediately. If the import code includes `@example`, that example's values and parameters are applied to the workspace.

Save to Favorites is best when you want to keep the prompt as an asset. It preserves the prompt, variables, media, examples, and source binding so the item can be updated, backed up, and restored later.

## What Happens After Import

### Prompt Processing

- Text prompts write to the corresponding workspace
- Variables automatically identified and filled with default values
- If an example was selected, uses example parameters for filling

### Workspace Matching

The system automatically selects the appropriate workspace based on prompt type:

| Prompt Type | Target Workspace |
|-------------|-----------------|
| System prompt | System Prompt Workspace |
| User prompt | User Prompt Workspace |
| Multi-message context | Context Workspace |
| Variable template | Variable Workspace |
| Text-to-image prompt | Text-to-Image Workspace |
| Image-to-image prompt | Image-to-Image Workspace |

### Favorite Saving

If saving to favorites:

- Prompt content fully preserved
- Variable definitions and defaults retained
- Images and media resources saved together
- Import code and source link recorded
- Supports later restoration from favorites

Prompt-level favorites keep the source prompt and media, but do not treat one selected `@example` as the only reusable case. Use direct import when you specifically want to run one example's parameter set.

## Example Import Codes

Here are some available import code examples:

| Import Code | Description | Applicable Workspace |
|-------------|-------------|---------------------|
| NB-001 | Basic system prompt | System Prompt Workspace |
| NB-PRO-001 | Multi-message context | Context Workspace |
| NB-PVAR-001 | Variable template | Variable Workspace |
| NB-I2I-001 | Image-to-image prompt | Image-to-Image Workspace |

## Common Questions

### What if the import code is invalid?

- Check if the import code was copied completely
- Confirm that the content matching the import code is still valid
- Try refreshing the page and re-importing

### How to view import history

Imported content goes to the corresponding workspace's history. If saved to favorites, you can view it in the favorites manager.

### How to update after saving to favorites

If the content matching the import code has been updated, re-importing and saving to favorites will automatically update the existing favorite (deduplication based on import code).

### Difference from direct JSON import

- **Import code**: Fetches latest content from Prompt Garden, includes source information
- **JSON import**: Imports local file, does not include source information

## Related Pages

- [Favorites & Import](favorites.md)
- [Data Management](data.md)
- [Smart Variable Fill](../auxiliary/smart-fill.md)
