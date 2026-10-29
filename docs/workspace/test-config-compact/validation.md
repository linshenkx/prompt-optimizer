# Compact test configuration: visual and interaction QA

Date: 2026-10-29

## Scope and visual truth

- Branch: `feature/test-config-compact`, based on main workspace `develop` at `ef65d6f4`.
- Implementation: `http://127.0.0.1:18181/#/basic/user`.
- Source visual truth: `C:/Users/15588/.codex/generated_images/01a17c96-325d-7413-a4cf-ba8df07059b7/exec-743e9e6f-6600-461e-8157-14daee5a823a.png`, right-hand concept. The user's subsequent smaller-font request overrides the concept's large text.
- Real before screenshot: `.codex-run/test-config/before.jpg`.
- Real after screenshot: `.codex-run/test-config/after.jpg`.
- Focused implementation screenshot: `.codex-run/test-config/after-config.jpg`.
- Responsive evidence: `.codex-run/test-config/after-1024.jpg`, `.codex-run/test-config/mobile-390.jpg`.

## Normalization and comparison evidence

The source is a 1543 x 1019 raster concept board, with two enlarged test-pane examples and annotations. It is not a screenshot or a pixel-scale specification. The real before and after captures are both 1280 x 720 pixels, with a 1280 x 720 CSS viewport; the browser reports devicePixelRatio 1.25, while its screenshot API normalizes these full captures to CSS-sized output. Both use the same light theme, 50/50 split, two columns, prompt, saved model configuration, and existing test responses. No response text was regenerated or substituted for comparison.

The source board and both real screenshots were supplied together in one visual comparison input. The real captures provide the valid geometry comparison; the board supplies hierarchy and grouping intent. The focused 602 x 180 capture confirms small icons and two-line controls, without claiming that the differently scaled concept board has identical pixel dimensions.

| Measurement at 1280 x 720 | Before | After |
| --- | ---: | ---: |
| Global toolbar height | 53.6 px | 54.2 px |
| Configuration card height | 117.6 px | 101.6 px |
| Results top | 291.2 px | 275.8 px |
| Toolbar top to results top | 195.2 px | 179.8 px |

The configuration card is 16 px shorter and the complete upper region is 15.4 px shorter. Layout width and result-column widths remain unchanged.

## Fidelity surfaces

- Typography: existing application font stack and rendering retained. Measured A/B and model captions 12 px, model names 13 px, configuration names 12 px. Result text remains unchanged. Long model/configuration names ellipsize instead of wrapping; full model identity is retained in the title and accessible label. Provider routing prefixes are omitted from the compact visible model name only.
- Spacing/layout: source selector and direct preview/run controls occupy the first row; model and saved configuration share a two-line selector below. Duplicate source tags and per-column role badges are removed. Roles are summarized once in the toolbar. Main layout, cards, column proportions and result actions remain in place.
- Colors/tokens: existing application theme and primary-button palette retained rather than introducing the concept's green accent. No new purple, gradients, large cards or decorative shadows. Error feedback uses the theme's error color.
- Assets: existing logo and the six original navigation icons retained, as previously requested. Generic controls use the project's Lucide icons. No illustrative/raster assets were added or approximated.
- Copy: the source selector distinguishes current editing and original input. A comparison baseline is called a baseline/control rather than falsely asserting it is the immediately previous version. The actual previous-version source remains available. The model-edit popover explicitly explains that editing a shared saved configuration affects all columns/workspaces using it. The comparison dialog shows configuration names rather than opaque IDs.

## Findings and iteration history

1. P2: At 1024 px, the role-summary trigger did not receive the intended flex behavior through the tooltip root. Its fixed natural width pushed the help control beyond the toolbar card. Fix: put the summary inside an explicit shrinking flex child. Post-fix measurement: toolbar right edge 1003.5 px; last help button right edge 986.7 px, with all persistent actions inside. Evidence: `after-1024.jpg`.
2. P2: The eye action originally only highlighted a source area, which was insufficient for the new preview affordance, especially for saved versions. Fix: reuse the existing resolved-source preview modal on desktop as well as mobile. Browser verified the original prompt text, close action and edit action.
3. P2: The comparison dialog initially still said “Optimization Target vs Previous Version” for an original-input baseline. Fix: align role/pair labels and related configuration explanations with the baseline/control concept in three locales; preserve the separate dynamic previous-version source. Browser verified “优化目标 vs 对照”.

Post-fix comparison found no remaining actionable P0/P1/P2 mismatch within the tested scope. The smaller text, original palette, real model identifiers and retained card boundaries are intentional adaptations of the source concept to the user's request and existing application.

## Validation and boundaries

- UI bundle and declaration/type build passed; final wrapper change rebuilt successfully.
- Changed component ESLint checks passed. Test files are excluded by the repository ESLint configuration and were verified by Vitest instead.
- Locale structural parity and diff whitespace checks passed.
- 38 distinct focused tests passed across TextModelQuickSwitch, SelectWithConfig viewport, CompareRoleConfigDialog, useCompareRoleConfig, useTestSourcePreview, and PromptPanelSourceFeedback. Two new tests cover shared configuration identity/scope in icon mode and disabled controls during testing.
- Browser: source choices visible (current, previous, original, v1); eye opens resolved original content; model-edit popover shows scope; comparison settings preserve editable roles and display names; cancellation preserves state. Desktop 1280 and 1024 checked; mobile 390 retains the existing dedicated layout and has no document overflow. Temporary viewport override and mobile section selection restored.
- Console checked: the configured gateway's online model-list request returns 404, with the existing local-model fallback message visible. No actual saved model was changed. This is an observed integration limitation, not a successful online-model fetch claim.
- No fresh paid model generation, full end-to-end inference, four-column wide-mode acceptance, or dark-theme visual acceptance was performed in this turn. The screenshots compare the same stored responses.

## Implementation checklist

- [x] Compact source/model controls with direct actions.
- [x] Role summary links to existing complete role settings.
- [x] Shared configuration edit scope remains explicit.
- [x] Config height does not exceed the measured original.
- [x] Responsive overflow finding fixed and remeasured.
- [x] Real before/after screenshots saved; preview running on 18181.
- [x] Work isolated from the main workspace's source changes; no commit or merge performed.

final result: passed

## Follow-up: quieter model presentation (2026-10-29)

The current app-managed worktree is now `C:/Users/15588/.codex/worktrees/test-config-compact/prompt-optimizer`, branch `feature/test-config-light`. The previous iteration's changes were carried over from the clean matching base in `D:/Dev/myProject/prompt-optimizer-test-config`; its original evidence remains under that directory. Port 18181 now serves this current worktree (PID 62012). Main workspace source was not changed.

This iteration's source target is the user's approved follow-up: remove the redundant model caption, retain 13/12 px type with lower visual weight, align with source text, and reveal the inset pencil on hover/focus. Actual before/after captures: `.codex-run/model-light/before.jpg`, `.codex-run/model-light/after.jpg`, and focused `.codex-run/model-light/after-config.jpg`. Both full captures use the same 1280 x 720 viewport and stored content.

Verified final browser measurements: source/model left edges both 688.8 px for A and 979.2 px for B; configuration card remains 101.6 px tall; no document overflow. Model color is approximately #555e6c; saved configuration name #6b7280. Default edit opacity is 0 on fine-pointer hover-capable devices, 1 on hover and keyboard focus. Tab reaches the real labeled edit button, without changing card height. Touch retains a visible edit action; reduced-motion preference disables the opacity transition. The open popover retains its edit affordance through aria-expanded.

A build taken while the component was being edited initially produced inconsistent scoped-style identifiers; a fresh completed bundle resolved it. Final screenshot was taken after the native browser had fully painted. The selected-label overlay also required an explicit 4 px inset to match source text; final coordinates above verify the correction.

Validation: core/UI builds and type generation passed, changed component lint passed, all four TextModelQuickSwitch tests passed, final bundle passed, whitespace check passed. No new inference request or saved model mutation performed. No commit or merge performed.

Follow-up final result: passed

## Follow-up: single-line configuration name (2026-10-29)

Continued in the same isolated `feature/test-config-light` worktree. The closed desktop test selector now displays only the saved configuration name at 13 px. Full model and provider information appears on hover or keyboard focus, and remains available in dropdown options. Opening the dropdown suppresses the tooltip; Escape dismisses details. The pencil retains its hover/focus behavior in a reserved 24 px slot, preventing text movement or arrow overlap.

At 1280 x 720 with the same stored content, the model row measures 28 px and the surrounding configuration card 87.6 px, down from 101.6 px. No document overflow. Browser checks confirmed hover details, keyboard-focus details, dropdown options, tooltip suppression while selecting, and keyboard access to the pencil (opacity 1). Temporary viewport emulation was cleared. Actual default screenshot: `.codex-run/model-light/single-line.png`.

Validation: UI bundle and type build passed; targeted component lint and whitespace check passed. No inference requests or saved-model changes. Existing 18181 preview serves this worktree. No commit or merge performed.

## Consolidation (2026-10-29)

Prepared this accepted iteration for integration into develop, retaining its separate data-management commit. Removed the unused two-line SelectWithConfig option/styles and the unused model-caption locale key. Preserved the existing root design-qa.md and moved this iteration's QA record here. All three testing locales have the same 476 keys. Targeted source lint and staged whitespace checks passed; the test spec is validated by Vitest because ESLint does not configure spec files. Earlier validation statements above describe their individual iterations.

