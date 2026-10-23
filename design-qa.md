> **阶段历史记录汇编。** 现状与架构边界以 [移动端架构评估](docs/architecture/mobile-architecture-review.md) 为准。以下按日期保留各阶段验证结果；早期“通过”不代表当前全部移动端功能已完成体验验收。截图、日志和模拟夹具保存在本地证据目录（包括 Git 忽略目录），未随本页发布。

## 2026-10-22：按实机尺寸压缩配置并完成真实流程回归

移动端配置可展开，运行时收起；工具栏、结果表头、Markdown 间距和原文摘要已压缩。360×668 下系统双列首屏正文约 134px → 353px，多图优化正文起点约 616px → 245px。七个模式已实际优化并完成 A/B；Magpie Gemini 可读图预设与 GPT Image 均免填连接参数。手机全屏底部裁切也已修复，桌面分栏保持原样。34 项相关检查、类型检查和构建通过，服务已重启。重启回查另外记录了并行验收页间旧状态覆盖现象，按用户边界未扩改共享持久化层。详见 [本轮验收记录](docs/architecture/mobile-real-phone-density-acceptance.md)。

## 2026-10-21：实机尺寸审查与免配置生图

用户 1080×2344 实机截图按约 360×668 CSS 可视区复现。结果正文首屏只有约 134px 可见，优化稿大标题和重复工具条仍需后续调整；本轮未改 UI 布局。预览新增自动 Magpie GPT Image 配置，补齐精确网页来源及仅限生图的服务端网关密钥后，真实橘猫图片生成成功。详见 [审查与接入记录](docs/architecture/mobile-phone-real-size-audit.md)。

## 2026-10-21：测试结果同屏对比

七个移动工作区统一为两列结果；每组独立查看请求提示词、重试和放大。已检查 430×932 / 393×852 手机视口和 1440×1000 桌面回归。19 项相关检查通过。详见 [验收记录](docs/architecture/mobile-parallel-results.md)。本条取代早期结果标签切换设计，历史记录保留。

# 剩余五种模式真实验收完成 — 2026-10-21

基础系统、变量、多消息、图生图、多图生图均已通过本轮 Magpie 真实模型与移动流程检查。修复了手机多图上传卡片换行、会话编辑器快速保存漏输入；桌面规则保持不变。17 次成功业务调用、1 次上游 503 后重试，完整结果/刷新/图片下载及修复回归证据见 [五模式验收记录](docs/architecture/mobile-magpie-all-modes-acceptance.md)。默认端口 18181 已重启，最终手机预览 430×932。

以下记录保留各轮原始边界，不应将早期模拟响应与本次真实模型检查混为一谈。

---

# 本地 Magpie 真实模型补验 — 2026-10-21

已补充真实免费 DeepSeek 的基础用户优化、A/B 测试和文生图提示词优化，以及 Magpie Codex 图像通道的真实图片生成、预览和下载。配置、上游 503 / 504、重试及成功证据见 [Magpie 实测记录](docs/architecture/mobile-magpie-local-validation.md)。本轮还修正手机模型配置表单与自定义参数弹窗的标签挤压，桌面保持原排列。

此前柯基图片是仓库 fixture，其余模式先前通过的是布局与模拟交互检查。不能将下面的历史“主要交互通过”结论理解为七个模式都已通过真实模型或物理手机验收。

---

# 主流手机尺寸与完整流程复验 — 2026-10-21

**本轮结论：移动端布局与主要交互通过我的检查。** 这次以内容可读、操作连贯、提示词上下文保留为验收条件，不再用空页面或小屏截图代替完整体验。以下是该日期的阶段检查结果，保留为历史记录；不代表业务管理组件的完整手机体验验收。

## 环境与范围

- 在已有移动端工作树运行真实组件，入口为 `http://127.0.0.1:18181/`。桌面基础组件行为保持原样，本轮生产代码只调整 `compact-workspace.css` 中移动端限定的变量行和图片预览样式。
- 主要视口：393 × 852、430 × 932、412 × 915 CSS 像素，分别对应常见 iPhone 普通尺寸、大屏尺寸和 Android 尺寸；额外检查 393 × 659 的浏览器工具栏占位情形。尺寸参考 [Playwright 官方设备定义](https://raw.githubusercontent.com/microsoft/playwright/v1.58.2/packages/playwright-core/src/server/deviceDescriptorsSource.json) 的 iPhone 15、iPhone 15 Pro Max、Pixel 7。截图是浏览器内容区，不是带手机外壳的效果图。
- Ego Lite 优先使用既有 TaskSpace 12 / xyz Profile 8，但截图再次超时；依照已说明的回退方式，使用独立临时内置浏览器页、移动设备尺寸和触摸模拟完成验收。
- 流程测试使用真实工作区、状态管理和原有按钮事件，模型服务替换为隔离的本地响应；图像为仓库既有 1024 × 1024 柯基图片样本。没有提交付费请求，也没有覆盖用户保存的提示词。
- 这是 Chromium 手机尺寸模拟，尚未验证物理手机的软键盘、安全区和 Safari 渲染；不把本地响应作为模型效果验收。

## 亲自走过的流程

| 路径 | 结果与观察 |
| --- | --- |
| 基础用户，393 × 852 | 输入原文 → 优化到 V1 → 底部切换测试 → 测试全部 → B 结果 → 展开本次提示词 → 返回继续优化到 V2。原文与约 250 字工作稿能够同屏，优化到测试只切换一次主要区域；结果直接出现在配置下面。 |
| 基础系统，412 × 915 | 测试内容、A/B 配置、回答同页；执行测试全部后，实际提示词保留 system 和 user 两部分，短回答全文可见。 |
| 变量，412 × 915 | 通过原有弹窗增加到三个变量，修改 subject 并测试全部，实际提示词显示替换后的值。变量面板可收起，收起后回答全文同屏。 |
| 多消息，412 × 915，深色 | 优化所选消息到 V1、折叠会话管理器、测试全部、切换 B；实际提示词保留系统/用户消息及解析后的变量。 |
| 文生图，430 × 932 | 从原始提示词优化到 V1，再测试全部和切换 B；检查图片完整显示、放大预览以及返回结果页。 |
| 图生图、多图生图，412 × 915 | 检查已有输入图片与工作稿布局、执行测试全部、切换 B。输入缩略图和结果图均正常，图片下载入口可见。 |
| 四组测试，430 × 932 | 在更多设置中切换四组，A/B/C/D 配置、结果选择和短回答同屏，没有增加配置/结果子页面。 |
| 长回答，393 × 659 | 滚动 24 节回答到最后一行；末行 y=540.7–560.7，位于底部导航上方。实际指针点击 A→B→A 后，A 的滚动位置为 2417.6→0→2417.6。 |

浏览器自动化定位器点击 sticky 标签时会先自动滚动元素，曾使位置偏移约 232 px；改用屏幕上实际指针点击复验，位置完整恢复。这是本轮工具操作差异，不作为产品滚动缺陷或已修复项。

## 本轮发现并修正

1. **三个变量占用过高。** 原来变量名/操作占一行，变量值再占一行。移动端改为变量名、值、操作同排，保留原有全屏编辑和操作菜单。412 × 915 下，面板由 369.2 px 降至 257.6 px，释放 111.6 px 阅读空间；每行由约 86 px 降至约 49 px，页面无横向溢出。
2. **大屏图片仍受 340 px 上限限制。** 仅在移动端可用高度达到 800 px 时提高图片上限，仍保持完整比例。430 × 932 下，图片由 340 × 340 增大至 394 × 394，位置 y=365.3–759.3，完整图片、下载按钮和结果信息位于底部导航之前。较短视口继续采用原有边界。

## 桌面与检查

- 1280 × 900 复查：两栏宽度仍为 640 / 628 px、高 835.2 px；变量行仍为 flex，名称列仍为 220 px；图片没有移动端高度限制。灵感、复刻、风格学习和智能填充仍直接显示。
- 本轮四个相关测试文件共 **13 项通过**；UI 生产打包通过；`git diff --check` 通过。保留现有 Vite 未来配置加载器提示，不属于运行失败。
- 主检出目录保持干净。修改仍在既有移动端工作树，没有提交或推送。
- 已重新启动默认 **18181** 端口，HTTP 200。真实 `/#/basic/user` 页面加载完成，显示原有 Mobile Preview 配置，没有发起模型调用；重启后未发现新的浏览器 error 日志。

## 本轮截图证据

目录：`.codex-run/mobile-mainstream-20261021/`。以下均为实际组件在本轮运行时的截图，已打开检查；不是设计效果图。

- `04-user-optimized.png`、`06-user-result-b.png`：393 × 852 的基础优化/测试成品状态。
- `07-user-prompt-expanded.png`：完整实际提示词与回答连贯阅读。
- `09-image-result-430.png` → `14-image-result-after-430.png`：大屏图片调整前后；`10-image-preview-430.png` 为放大预览。
- `11-variables-before.png` → `12-variables-after.png`：三个变量调整前后；`13-variable-result-collapsed.png` 为收起后的实际测试结果。
- `15-long-answer-end-393x659.png`：工具栏占位情形下，长回答最后一行无遮挡。
- `16-system-result-412.png`、`18-multi-optimized-collapsed.png`、`19-multi-test-dark-412.png`：系统与多消息路径。
- `20-image2image-optimize-412.png` 至 `23-multiimage-result-412.png`：两种图片输入模式。
- `24-desktop-1280.png`、`25-four-groups-430.png`、`26-live-restarted-393.png`：桌面回归、四组测试、重启后的真实入口。
- 运行日志：`preview.log`、`preview.err.log`。`01-real-entry.png` 未生成，Ego 截图失败不计入通过证据。

---

# Mobile screenshot-layout follow-up — 2026-10-21

Status: scoped layout and interaction checks passed; user hands-on acceptance remains open.

The user's later screenshots exposed density problems missed by the earlier report. Its broad “no remaining actionable P0/P1/P2 findings” conclusion is superseded by this follow-up. The current boundary is **mobile presentation only**, with the existing desktop arrangement, controls, and business behavior retained.

## Screenshot findings and changes

- The empty variables card spent several rows on a title, disabled actions, and empty copy. An opt-in `compact` presentation now leaves one add-variable action; the existing dialog and nonempty variable editor remain available. All image and context workspaces pass the flag only on mobile. Desktop defaults to the full existing panel.
- Text-to-image helper actions wrapped the collapse button onto a row of its own. Mobile now groups inspiration, replicate, and style learning in an auxiliary-tools popover, reusing their existing components and handlers. Desktop still renders the direct actions.
- Test controls consumed a separate row between configuration and answers. Mobile run-current/run-all share the test-plan heading; group-count options remain in More. A/B/C/D are still the only answer switch.
- The prompt reference now uses a smaller label and a two-line excerpt, with a full-text expansion and independent per-group expansion state. Expanded references remain in normal scroll flow.
- Image-result favorite controls now sit over the image on mobile. The existing image preview is bounded to the viewport with `object-fit: contain`, allowing a complete result to be seen rather than a narrow strip. Download/copy actions retain their existing handlers.
- Image-mode editor gaps, selector typography, and original-editor minimum height were reduced only beneath the compact workspace root. No shared theme defaults were changed.

## Evidence and checks

- User source screenshots: `codex-clipboard-9ebdd7d0-ed77-4364-bab6-bad2a9085e10.png` (local evidence only) and `codex-clipboard-22cf6f59-48b5-4fdd-8901-307f3c63b9f7.png`, both 469 × 835 screenshot pixels. Their exact CSS viewport/scale was not established; they are layout references, not pixel-match baselines.
- Final phone captures: `.codex-run/mobile-polish/optimize-classic-375.png` and `test-classic-375.png`, at 375 × 667 CSS/image pixels. The original short prompt and entire sample working draft are visible in the optimize capture. The test image occupies y=343.85–563.69, before the bottom navigation, with no document horizontal overflow.
- These captures render real workspace components with isolated in-memory state. The clearly labeled 640 × 420 “LOCAL UI FIXTURE” image is a layout fixture, not a claimed model-generated result or the user's original artwork. Classic/light and dark appearances were checked without changing the user's theme.
- All seven workspaces were captured at mobile widths, including 390 × 844 for six companion modes. Source/model rows, bottom region navigation, and result areas remain within the viewport. Both context workspaces pass the compact flag through their test-panel wrappers; the variable workspace received an additional browser check of the smart-fill menu at 430 × 844 after that change.
- Mobile interactions: auxiliary tools reveal the original actions; the compact add-variable action opens the existing dialog; A/B switches the prompt reference; full-text expansion exposes the complete working draft; run-all completes through the existing image service handler with the recorded submitted prompt shown afterward. No paid request was made.
- At 375 × 667 dark, four groups fit as four source/model rows. The 24-section basic-user result was scrolled to its final line (y=547.90–567.90) with bottom navigation still visible. Evidence: `four-groups-dark-375.png` and `long-answer-end-dark-375.png`.
- Desktop before/after captures are `desktop-before.png` and `desktop-after-final.png`, both 1280 × 900. Both panes retain widths 640/628 and height 835.2; the variable card retains x=652, y=64.8, width=628, height=145. Desktop direct smart-fill and inspiration/reference buttons remain present, with no mobile auxiliary menu. Button/display-mode state differs between captures; this is a layout/default-behavior comparison, not a claim of pixel-identical screenshots.
- UI typecheck and targeted production-file ESLint passed. Four targeted test files contain 13 passing tests: shared layouts, variant run controls, prompt-reference expansion, and temporary variables. The first variables-test run used an incorrect English label; correcting the test selector and rerunning yielded all 8 tests in that file passing. Desktop-default and mobile add/fill/disabled behavior are covered.
- Locale parity, runtime-language check, and `git diff --check` passed. The main checkout remains clean; edits are confined to the existing mobile worktree.
- The preview was restarted on **127.0.0.1:18181**, and returned HTTP 200. Logs: `.codex-run/mobile-polish-restart-20261021-final.log` and `.err.log`. The existing Vite future-config-loader warning remains non-blocking.
- The real application entry `/#/image/text2image` was opened after restart at 390 × 844. It loaded the new auxiliary-tools control and original workspace components successfully; capture: `live-restarted-mobile.png`. Earlier fixture navigation logged a missing `predefinedVariables` prop and performance diagnostics in the isolated variable fixture; no production runtime-error claim is inferred from those fixture warnings.

## Remaining acceptance boundary

Browser checks establish the mobile layout and existing local interactions, not physical-phone keyboard/safe-area behavior or real model output quality. Ego's `xyz` task space was selected first, but screenshot capture timed out; visual verification used a separate temporary in-app-browser tab instead. The user's open editing tabs and saved prompts were not used as test fixtures.

---

# Historical co-visible workspace QA — 2026-10-21

stage result: passed within the checks listed below; not current overall mobile UX acceptance

This report covers the current implementation in the isolated mobile worktree. It supersedes the earlier inner-page tab design. The earlier prototype report is preserved below as history, not as evidence for this iteration.

## Findings

No remaining actionable P0/P1/P2 findings in the tested scope. The approved direction is two navigation levels (优化/测试 and answer A/B/C/D), with local folding and compact controls. Seven real workspace components now use that structure.

## Source, normalization and visible comparison

- Approved source: `exec-e8b9cf1d-6bc4-4b42-acb6-d960e099f5d1.png` (local evidence only) (the second design image, 1254 × 1254 board).
- Source artboards: left crop (31,62)-(620,1233), right crop (634,62)-(1223,1233), each 589 × 1171; normalized to 430 × 854. Canvas padding is removed; no fake device frame or status bar is app content.
- Implementation URL: `http://127.0.0.1:18181/#/basic/user`. Isolated fixture: `/.codex-run/density-fixture.html?mode=basic/user&width=430&height=844&short=1#/basic/user`.
- Main implementation captures: `.codex-run/density-basic-optimize-final.png` and `density-basic-test-final.png`, each 430 × 844 image pixels and CSS viewport. One output image pixel per CSS pixel; the 10 px normalized-source height difference is intentional viewport variation, not layout drift.
- Combined source/implementation comparison: `.codex-run/density-design-comparison.png` (1760 × 894). Opened and inspected together after the fixes. Final actual-screen pair: `.codex-run/density-result.png` (880 × 884).
- State: Chinese, light theme, basic user mode, headphone-support example, editable current draft; test B with its actual submitted prompt and locally simulated answer. Fixture has no saved version chain, so its draft header has no version selector; saved-version and dirty-draft behavior are covered separately.
- Additional final captures: `density-360-dark-four-final.png` (360 × 740, dark, four visible configuration rows), `density-desktop.png` (1280 × 900), `density-long-answer-final.png`, `density-comparison-mode.png`, `density-pro-multi-optimize-final.png`, `density-image-multiimage-test-final.png`, and `density-live-default-port.png` (real application entry, empty session).
- Focused checks: full-size individual captures were inspected for model/source controls, original/current text, diff baseline, and answer body. The combined image keeps these regions readable at native 430 px panel width; a further crop was unnecessary. Actual CJK font resolution was inspected with CDP, not inferred from a scaled thumbnail.

## Five fidelity surfaces

- Typography: 16 px editable prompt body with 1.7 line-height; 13 px compact selectors/reference text and smaller utility labels; existing UI heading hierarchy. CDP reports Microsoft YaHei UI for Chinese and Segoe UI for Latin. Naive UI autosize-mirror tokens match the visible textarea; the four-line requirements sample is not clipped (clientHeight and scrollHeight both 228).
- Spacing/layout: both prompt regions co-visible; model/template/optimize share one row. All enabled test configurations appear before the answer selector and visible prompt reference. No configuration/results page switch. Prompt and answer scrolling have a single region owner; reference and answer selector stick while reading, and an expanded long reference returns to normal flow. No horizontal overflow at 360/430 px.
- Colors/tokens: existing application theme is retained, including neutral primary buttons instead of mock purple. Compact paper/soft/ink/muted tokens support light/dark. Dark test heading contrast was corrected. Selection/focus states remain visible.
- Assets: existing product logo, original icon components, original management dialogs and renderers are retained. No screenshot is used as page content; no substitute drawn logo or device bezel. Image modes use local simulated image output only for UI verification.
- Copy/content: application labels/locales are reused. New labels distinguish 本次实际提示词 from 当前提示词参考 for legacy/unrun results; empty prompt guidance is source-neutral. The current draft, original prompt, full source, and rendered answer remain selectable/editable through their original components. No invented assessment score or mobile AI evaluation was added.

## Comparison history and fixes

1. P1: inner original/workspace and configuration/results tabs forced a sequence and hid essential context. Removed both inner page switches; `OptimizeWorkspaceLayout` and `TestWorkspaceLayout` keep content co-visible. Final basic screenshots and seven-mode fixture checks verify the new structure.
2. P2: full-page editor minimum heights and oversized controls pushed the answer/current draft below the fold. Removed fill-height assumptions, bounded input editors, condensed selector rows, and made original content locally collapsible. Final optimize/test/360 screenshots show the density change.
3. P1: stale results could be explained by edited current text rather than the submitted request. Capture optional request text at request start; persist it in four text session stores, use resolved text in image result metadata, and retain it across subsequent edits. Browser mutation-after-run checks and persistence tests verify this.
4. P2: visible textarea typography differed from its autosize mirror, clipping the final requirement. Synchronize Naive UI font/line-height tokens; final textarea dimensions and screenshot show every line.
5. P2: changing to diff through the compact menu did not emit the already-declared view-change event, hiding the comparison-baseline selector. Emit base/diff changes; verified real TextDiff and baseline selector in `density-comparison-mode.png`, with a menu event regression test.
6. P2: sticky prompt reference initially overlapped the group selector by 8 px. Match its top offset to the 60 px selector region. Long-answer test reaches the final line with bottom navigation visible; direct pointer taps restore the exact per-group scroll position (B 2321.6001 → A 0 → B 2321.6001).
7. P2: original content remained folded when “前往编辑” was selected. Expand the existing editor/conversation manager and scroll to the selected original/current section after nextTick. Verified in the real multi-message component; shared image/variable handlers follow the same path.
8. P2: multi-message NFlex inline display overrode the intended compact grid. Correct the compact override and minimum widths. Final screenshot and DOM measurement show columns 166/166/50 within 398 px, with all controls in one row.
9. P3: empty original source initially displayed the optimized-output placeholder. Replaced it with a source-neutral instruction in all three locales; real default-port page shows the corrected state.

## Interactions and checks

- All seven modes: optimize and test regions render, enabled groups are configured together, answer selection remains available. Basic system request includes system + user input; multi-message and variable modes display resolved variable text after a test; all image modes preserve the submitted resolved prompt.
- Basic user: run all simulated requests; edit source after running and verify the old request reference stays unchanged; stale indication appears. Long response readable through the final line. Fold/unfold source and prompt reference. Group selection preserves reading/expansion state.
- Existing versions: compact dropdown retains unsaved-edit confirmation; original comparison, copy, source/render, full-screen and source preview still use original components. Source preview can return directly to the correct editor.
- Responsive: 430 × 844 all modes; 360 × 740 dark with four configuration rows; desktop 1280 × 900 retains both panes. Fresh real default-port tab also checked at desktop and 430 px, including optimize/test switching; zero warning/error entries in that fresh tab.
- UI typecheck passed. Targeted ESLint passed for changed production components/composable/stores; test paths are excluded by existing lint configuration and were executed by Vitest instead.
- Vitest passed: shared layouts/reference/scroll/request-context (5 files, 10 tests); request-context plus basic/pro persistence (3 files, 22 tests; overlaps previous command); PromptPanelSourceFeedback (6 tests); OutputDisplayCore copy/open/menu (10 tests); context user tester and image generation (6 tests). Across those commands, 11 distinct files and 50 distinct tests passed.
- Initial test-only failures: persistence stub retained a reactive reference, version stub omitted forceRefreshContent, and the diff menu test supplied no comparison service. Fixed those harness omissions; reruns passed. No production error was suppressed to pass tests.
- Locale parity and runtime-Chinese checks passed. `git diff --check` passed. Main checkout remained clean; changes stay in the existing mobile worktree.

## Intentional reuse choices and remaining boundaries

The supplied image is the approved structural/density direction, not a request to replace the existing product theme or feature set. Existing Prompt Garden/header utilities, neutral theme, continue-optimization modal, and a display-mode menu are preserved. Saved versions use a dropdown; text comparison uses the existing renderer and baseline selector. No extra page is introduced for them.

The browser flows use isolated in-memory services and local simulated requests; no paid model request or modification of the user's current prompt was required. Physical phone keyboard/safe-area behavior, model output quality and user usability acceptance remain unverified. Minor future polish can tune utility-icon grouping after hands-on feedback; it does not require another navigation level.

## Implementation checklist

- [x] Replace inner page tabs with co-visible content in all seven workspaces.
- [x] Preserve editing, version protection, diff/source previews, full reading and per-group position.
- [x] Capture and persist actual prompt references.
- [x] Compare source and actual captures; correct all observed P0/P1/P2 issues.
- [x] Typecheck, targeted tests/lint, locale checks and live default-port verification.
- [x] Keep default preview running for user feedback.

---

# Historical prototype QA

# Two-region mobile prototype QA — 2026-10-20

Historical prototype record. The subsequent real implementation and its separate validation are documented in [mobile-basic-implementation.md](docs/architecture/mobile-basic-implementation.md). This prototype's pass status does not represent real-device acceptance.

stage result: passed within the checks listed below; not current overall mobile UX acceptance

## Current approved design and evidence

The user requested a clickable prototype of two regions, 优化 and 测试, based on the original Web components. This supersedes the independent editor/trial-modal prototype and the rejected three-region proposals. This is a local interaction prototype, not user acceptance of the design or a production mobile release.

- Source visual truth: `web-structure-review/01-original-web.png` (local evidence only) (1280 x 720 desktop Web).
- Implementation URL: http://127.0.0.1:18234/#/basic/system
- Final full-view evidence: two-region-prototype/05-final-optimize.png and 06-final-test.png under the same visualization root. Both saved native image files were reopened and inspected; their encoding is JPEG despite the capture filenames.
- Implementation images: 393 x 852 pixels. Requested CSS viewport 393 x 852; browser reports rounded width 394 CSS px. Small viewport: 360 x 640 CSS px and native image pixels, 04-small-test.png.
- State: Chinese, light theme, original input collapsed, current V2 selected from V1/V2/V3, local demo model A. Test groups A=v1 and B=v2 share the same input and model, with B selected.
- Full-view comparison: original Web left-side original input plus prompt workspace map to 优化; original right-side input/config/results map to 测试. The actual InputPanel, PromptPanel, TestInputSection, TestPanelVersionSelect, SelectWithConfig and OutputDisplay are rendered. Management components remain the existing forms.
- Density normalization: none. The original desktop screenshot is a structural/component reference, not a phone pixel-match target. The old generated reading mock is no longer the source of navigation or component structure.
- Focused comparison: version controls, actual output toolbar and per-group source/model controls are visible in the two full-size phone captures; no separate resized/cropped comparison was required.

## Findings and fixes in this iteration

1. Resolved P1: the rejected layout had a separate editor and subordinate trial modal. Both basic workspace pages now keep their original component instances and switch visibility between two persistent regions. The obsolete MobileBasicWorkspace source was archived in .codex-run/before-two-regions and removed from the active source tree.
2. Resolved P1 during implementation: the shared input's fragment root dropped its compact class, retaining cramped desktop controls. An explicit compact prop now applies the class to its real root. The existing model/template selects sit in two columns and the optimize button spans the row.
3. Resolved P1 during implementation: the header tool Teleport initially mounted before its target. Deferred mounting restores the original Prompt Garden, source binding and workspace tools. The final fresh browser tab has zero warning/error logs.
4. Resolved P2: existing OutputDisplayCore rendered both the text diff and rendered document in diff mode. Its source/render branch now follows the diff branch exclusively. Text comparison works through the real CompareService and TextDiff component.
5. Resolved P2: evaluation controls leaked through the user-mode result fallback. Both basic modes now omit those controls in the opt-in prototype; normal Web behavior is retained.
6. Resolved P2: demo output heading used A/B for a model suffix, confusing test-group labels. The heading now simply says 演示回答; the actual model remains in each group's selector.
7. Resolved P2: hiding the test region reported zero width and could downgrade a stored four-group layout. Prototype group count no longer depends on hidden panel width. Each region and test group keeps its mounted component state.

## Interaction verification

- System: switch freely between optimization and test; original input and test input expand/collapse; result render/source/diff; V2 to V3 iteration and V2 restoration using real version tags.
- System: submit an iteration then switch to test; completion leaves the test region selected. Test A/B and the source/model selections remain available after returning from optimization.
- User: choose and run original prompt A without a separate test-input field; return to optimization; no evaluation control in the final user test view.
- Run both system test groups using the same input/model; select B and retain its configuration/result across region changes.
- Open global menu and real model manager, close, return to the selected B group. Mode selector preserves original Web mode hierarchy.
- Small viewport: 360 x 640, document scrollWidth equals viewport width, both bottom region buttons stay inside the viewport. Long content remains scrollable.
- Fresh final tab 8: restored real stored session, switched V2, rendered result, switched test B and returned. Browser warning/error log array was empty after these actions.

## Checks

- UI typecheck: passed.
- Focused ESLint on changed shared components, both basic workspaces, new region switch/navigation and demo service: passed.
- Existing version/favorite utility regressions: 3 files, 32 tests passed.
- Opt-in prototype Web production build: passed (existing large chunk warning remains).
- git diff --check: passed. The main checkout was clean at that stage.

## Boundaries

Only the isolated worktree and local prototype are changed. Basic system/user modes are the current redesign scope; context/image still open their existing workspaces. Local demo output is explicitly synthetic. Actual LLM quality, physical phone keyboard/safe-area behavior, full localization, screen-reader acceptance and production performance are not established by these checks. The current prototype still uses the original components' nested scrolling and full-page iteration form; these are design choices for the user to assess, not claims of completed usability acceptance.
