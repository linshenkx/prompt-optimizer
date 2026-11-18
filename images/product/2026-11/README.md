# Product screenshots — November 2026

These screenshots capture the real application. The repository READMEs reference the original files in this directory. The website and MkDocs use copies synchronized by `node scripts/sync-product-screenshots.mjs`. Run the same command with `--check` to verify those copies.

- Captured: 2026-11-16–18, light theme, Chinese and English UI.
- Product source: development branch at `cbba5f959f26a4e7846e5458664564b265def8b3` (package version 2.15.2), including independent model parameters.
- Environment: local preview origins with demonstration data, isolated from existing user sessions. The two Arena languages use separate origins to keep their sessions independent. The local gateway supplies the example models; no production credentials or private session data are shown.
- Examples use real model responses. Outputs can vary between runs.
- The red-team, variable, and Arena workspace screenshots are 2047×1018. The Arena capture includes the top navigation, shared prompt, and all three result panels. Parameter controls use 1280×720. The basic quick-start example, model manager, and model form use 1440×1000.
- Independent controls are development-build features. Available fields and values follow existing provider/model definitions; server support and released platform versions may differ.

| Filename prefix | What it shows | Example setup |
| --- | --- | --- |
| `basic-workspace` | Prompt optimization and original/revised tests | A polite email requesting weekly progress by Friday 17:00; `antigravity/gemini-3.8-flash` for optimization and both tests |
| `system-workspace` | A one-line red-team role expanded into a structured review | The original feature-heavy product proposal is reviewed with the original role prompt and one fresh optimization. Chinese and English are run independently; optimization with `codex/gpt-6.1-sol`, both tests with `codex/gpt-6-luna`, inherited defaults |
| `variable-workspace` | Accepting a viable marketplace offer | The original seven-variable request covers item, asking price, buyer offer, facts, acceptable terms, tone, and needs. CNY 1380 including shipping meets the terms. Optimization with `codex/gpt-6.1-sol` using Basic Refinement; both tests with `codex/gpt-6-luna`, inherited defaults |
| `variable-workspace-low-offer` | Countering a low offer with the same template | Only the buyer offer changes to CNY 1100 including shipping. The other six variables, both prompt versions, and models stay fixed. Each language is optimized and tested independently |
| `arena-comparison` | Three models answering the same drawing task | `codex/gpt-6.2-astra`, `codex/gpt-6.2-sol`, and `deepseek/deepseek-flash` draw a mechanical whale above clouds, with a greenhouse, airship, and coastal city. Each uses its inherited defaults |
| `model-parameters` | Expanded model dropdown and native reasoning options | The selected model's available options, opened without changing the settings used for the displayed results |
| `model-manager` | Current connection-management interface | Demo connection alongside unconfigured presets |
| `model-form` | The current provider setup form | DeepSeek selected, no key entered, draft discarded |

`-zh-CN` and `-en` identify the language of both the interface and the example prompt. Each language is run independently, including Arena, rather than relabeling a response from the other language. Drawings are rendered from each model's actual HTML. Result panels may be scrolled to the illustration so introductory prose does not obscure the comparison.

Chinese Arena task:

> 请用单个完整 HTML 文件（内嵌 SVG）绘制一艘漂浮在云海上的机械鲸鱼：鲸鱼背上有玻璃温室花园，旁边有小飞艇，远处有海边城市。构图、配色和画风自行设计，主体清晰、机械细节丰富。画面比例 4:3，HTML/CSS/SVG 全部内联，不使用外部资源，总长不超过 8000 字符。画面中的文字使用中文。只输出完整 HTML，不要 Markdown 代码块。

English Arena task:

> Create one complete HTML file with inline SVG showing a mechanical whale floating above a sea of clouds, carrying a glass greenhouse garden, with a small airship nearby and a coastal city in the distance. Choose your own composition, palette and visual style. Make the subject clear and include mechanical detail. Use a 4:3 canvas, inline HTML/CSS/SVG, no external resources, and at most 8000 characters. Any visible text in the scene must be in English. Return only the complete HTML, without Markdown fences.

To refresh: use an isolated demo environment, capture both interface languages, replace only these canonical files, synchronize the copies, and rebuild the site and documentation. Review the generated pages before publishing.
