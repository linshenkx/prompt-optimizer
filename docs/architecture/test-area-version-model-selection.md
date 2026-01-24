# Test Area Version/Model Selection (basic-user first)

## 1. Background

In the current `/basic/user` workspace, the right-side test area implicitly tests:

- "original" = `session.prompt` (v0)
- "optimized" = `session.optimizedPrompt` (whatever is currently in the optimized editor)
- model = `session.selectedTestModelKey` (single shared model)

This creates hard coupling between test inputs and the editor textareas. Users want to compare arbitrary versions (v0..vn) and also compare the same version under different models.

## 2. Scope

Phase 1 (this doc): implement only for `/basic/user`.

Out of scope for phase 1:

- `/basic/system`, `/pro/*`, `/image/*` rollout
- draft/unsaved text selection
- one-click "latest two versions" shortcut (can be added later)

## 3. Requirements

Functional:

1. Each test result panel has independent selectors:
   - prompt version: v0..vn plus `latest`
   - model key
2. Default selection is v0 vs latest(vn).
3. Compare mode runs both tests in parallel.
4. Version chain is session-scoped and isolated per sub-mode.

Non-functional:

- Backward compatible with existing persisted sessions.
- Missing/invalid version selection must gracefully fall back.
- No new "draft" state.

## 4. Current Implementation Touchpoints

- Basic-user workspace: `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue`
- Basic test logic: `packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts#handleTest`
- Session store: `packages/ui/src/stores/session/useBasicUserSession.ts`
- Test UI components:
  - `packages/ui/src/components/TestAreaPanel.vue`
  - `packages/ui/src/components/TestResultSection.vue`
  - `packages/ui/src/components/TestControlBar.vue`
- History chain types: `packages/core/src/services/history/types.ts`

## 5. Data Model

### 5.1 Persisted selector value

Use a JSON-serializable union value:

```ts
// 0 represents v0.
// number >= 1 represents v1..vn.
// 'latest' follows the max version in the chain.
export type TestPanelVersionValue = 0 | number | 'latest'
```

### 5.2 Per-panel config

```ts
export interface TestPanelConfig {
  version: TestPanelVersionValue
  modelKey: string
}

export interface BasicUserTestPanelsConfig {
  original: TestPanelConfig
  optimized: TestPanelConfig
}
```

### 5.3 Session store changes (basic-user)

Add to `BasicUserSessionState`:

```ts
testPanels?: BasicUserTestPanelsConfig
```

Add update helpers (exact names can vary):

- `updateTestPanelVersion(panel: 'original'|'optimized', v: TestPanelVersionValue)`
- `updateTestPanelModel(panel: 'original'|'optimized', modelKey: string)`

Persist these inside the existing preference key `session/v1/basic-user`.

### 5.4 Migration / Defaults

When restoring session state:

- If `testPanels` is missing (legacy session):
  - `original.version = 0`
  - `optimized.version = 'latest'`
  - `original.modelKey = parsed.selectedTestModelKey || fallbackModelKey`
  - `optimized.modelKey = parsed.selectedTestModelKey || fallbackModelKey`

If any selected model key is not in enabled models, apply the existing fallback strategy (first enabled model).

## 6. Version Resolver

At test time (not at render time), resolve selection into actual prompt text.

Inputs:

- `v0Prompt: string` (from `session.prompt`)
- `chainVersions: PromptRecord[]` (from `logic.currentVersions`)
- `selected: TestPanelVersionValue`

Algorithm:

1. If `selected === 0`: return `v0Prompt`.
2. Let `latestRecord = max(chainVersions, by record.version)`.
3. If `selected === 'latest'`:
   - return `latestRecord.optimizedPrompt` if present
   - else return `v0Prompt`
4. If `selected` is a number >= 1:
   - find record with `record.version === selected`
   - if found return its `optimizedPrompt`
   - else fall back to latest (step 3)

Note: history chain versions start at 1, so v0 is always external.

## 7. UI Design (basic-user)

### 7.1 Control placement

To avoid ambiguity, place selectors in each result card header:

- Original result header: version select + model select
- Optimized result header: version select + model select

The main TestControlBar retains:

- compare mode toggle
- start test button

### 7.2 Component changes

`TestResultSection.vue`:

- Add optional header slots:
  - `original-header-extra`
  - `optimized-header-extra`
  - `single-header-extra` (optional)

Render them next to the title (and before/after evaluation entry).

`TestAreaPanel.vue`:

- Pass through these slots from `TestAreaPanel` to `TestResultSection`.

`BasicUserWorkspace.vue`:

- Build version options list:
  - always include `v0`
  - include `latest` if chain exists (still allowed if empty; it falls back)
  - include `v1..vn` derived from `logic.currentVersions`
- Bind `v-model` of each select to session store `testPanels` state.
- Remove the single model select slot usage for basic-user; instead provide per-panel model selects via the new header slots.

### 7.3 Titles

Keep existing i18n titles but append selection info for clarity, e.g.

- `原始提示词结果 (v0)`
- `优化后提示词结果 (latest=v6)`

This can be implemented by computing `originalResultTitle` and `optimizedResultTitle` from the selected values.

## 8. Test Execution (basic-user)

Update the test handler for `/basic/user` so that it no longer depends on editor textareas.

Compare mode ON:

- Resolve both prompt texts (left/right) using the resolver.
- Execute both tests in parallel:
  - left uses `testPanels.original.modelKey`
  - right uses `testPanels.optimized.modelKey`
- Stream results into the existing `testResults` shape:
  - `originalResult/originalReasoning`
  - `optimizedResult/optimizedReasoning`

Compare mode OFF:

- Only run the "optimized" panel test.

## 9. Evaluation Alignment

Current evaluation logic assumes:

- originalPrompt/optimizedPrompt are the prompts being evaluated
- originalResult/optimizedResult are the corresponding outputs

After this change, the evaluation handler in `BasicUserWorkspace.vue` must be bound to:

- `originalPrompt = resolvedPrompt(original panel)`
- `optimizedPrompt = resolvedPrompt(optimized panel)`

So that "compare evaluation" reflects the actual selected versions.

## 10. Edge Cases

1. No history chain yet (only v0):
   - `latest` resolves to v0.
2. Selected fixed version does not exist anymore:
   - fall back to latest.
3. Model key invalid/unavailable:
   - fall back to first enabled model.
4. User selects the same version and same model on both sides:
   - allowed; results should be identical unless provider variance.

## 11. Implementation Plan (basic-user)

1. Extend `useBasicUserSession` with `testPanels` persisted state and migration defaults.
2. Add header slots to `TestResultSection` and pass-through in `TestAreaPanel`.
3. Implement selectors in `BasicUserWorkspace` and bind to session store.
4. Update test execution to resolve prompts by selection and run in parallel.
5. Bind evaluation handler prompts to resolved prompts.
6. Update unit/integration/e2e tests for basic-user as needed.
