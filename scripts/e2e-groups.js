const groups = {
  uiSmoke: [
    'tests/e2e/regression/model-configuration-smoke.spec.ts',
  ],
  // These regressions seed local sessions and exercise real UI/IndexedDB behavior.
  // They need neither provider credentials nor VCR recordings.
  workspaceRegression: [
    'tests/e2e/regression/settings-and-variable-extraction.spec.ts',
    'tests/e2e/session-persistence/workspace-source-preview.spec.ts',
    'tests/e2e/session-persistence/workspace-split-bindings.spec.ts',
    'tests/e2e/session-persistence/cross-window-conflict.spec.ts',
  ],
  gate: [
    'tests/e2e/workflows/p0-route-smoke.spec.ts',
    'tests/e2e/regression/root-route-bootstrap.spec.ts',
    'tests/e2e/optimize/basic-user.spec.ts',
    'tests/e2e/test/image-text2image-generate.spec.ts',
    // 单图生图与多图持久化目前仍依赖较脆弱的 provider/VCR 契约，
    // 先降级到 extended，避免把日常 gate 绑死在高维护成本用例上。
  ],
  extended: [
    'tests/e2e/analysis/basic-system.spec.ts',
    'tests/e2e/analysis/basic-user.spec.ts',
    'tests/e2e/analysis/image-text2image.spec.ts',
    'tests/e2e/analysis/image-image2image.spec.ts',
    'tests/e2e/analysis/pro-multi.spec.ts',
    'tests/e2e/analysis/pro-variable.spec.ts',
    'tests/e2e/optimize/basic-system.spec.ts',
    'tests/e2e/test/image-image2image-generate.spec.ts',
    'tests/e2e/session-persistence/image-multiimage-persistence.spec.ts',
    'tests/e2e/optimize/pro-multi.spec.ts',
    'tests/e2e/optimize/pro-variable.spec.ts',
    'tests/e2e/test/basic-system-compare-test.spec.ts',
    'tests/e2e/test/basic-user-test.spec.ts',
    'tests/e2e/test/pro-multi-test.spec.ts',
    'tests/e2e/test/pro-variable-test.spec.ts'
  ]
}

module.exports = {
  groups
}
