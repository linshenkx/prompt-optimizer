import {
  promptExampleFromTestRun,
  type PromptSession,
  type PromptTestRun,
} from '@prompt-optimizer/core'

import { isValidVariableName } from '../types/variable'
import {
  favoriteReproducibilityExampleFromPromptExample,
  type FavoriteReproducibilityDraft,
  type FavoriteReproducibilityExample,
  type FavoriteReproducibilityVariable,
} from './favorite-reproducibility'

export type TestResultExampleEntry = {
  variantId: string
  promptText?: string
  example: FavoriteReproducibilityExample
}

export const findTestRunForVariant = (
  session: PromptSession,
  variantId: string,
): PromptTestRun | null => {
  for (const runSet of session.testRuns) {
    const found = runSet.runs.find((run) =>
      run.metadata?.legacyVariantId === variantId ||
      run.id.endsWith(`:test:${variantId}`),
    )
    if (found) return found
  }
  return null
}

export const resolveExampleBasedOnVersionId = (
  session: PromptSession,
  run: PromptTestRun,
): string => {
  if (run.revision.kind === 'record') {
    return run.revision.recordId
  }

  if (run.revision.kind === 'root') {
    return session.optimization.root.id
  }

  if (run.revision.kind === 'asset-version') {
    return run.revision.versionId
  }

  return `${session.id}:draft`
}

/**
 * 将指定测试列的结果转换为收藏示例；没有成功结果的列会被跳过，返回顺序与 variantIds 一致。
 */
export const buildTestResultExampleEntries = (
  session: PromptSession,
  variantIds: readonly string[],
): TestResultExampleEntry[] => {
  const entries: TestResultExampleEntry[] = []

  for (const variantId of new Set(variantIds)) {
    const run = findTestRunForVariant(session, variantId)
    if (!run) continue

    const example = promptExampleFromTestRun(run, {
      basedOnVersionId: resolveExampleBasedOnVersionId(session, run),
    })
    const favoriteExample = example
      ? favoriteReproducibilityExampleFromPromptExample(example)
      : null
    if (favoriteExample) {
      const promptText = run.metadata?.promptText
      entries.push({
        variantId,
        ...(typeof promptText === 'string' && promptText.trim() ? { promptText } : {}),
        example: favoriteExample,
      })
    }
  }

  return entries
}

/**
 * 合并多个示例的参数名为变量草稿（按首次出现顺序去重）。
 */
export const buildTestResultVariableDraft = (
  examples: readonly FavoriteReproducibilityExample[],
): FavoriteReproducibilityVariable[] => {
  const names = new Set<string>()
  for (const example of examples) {
    for (const name of Object.keys(example.parameters || {})) {
      if (isValidVariableName(name)) names.add(name)
    }
  }

  return [...names].map((name) => ({
    name,
    required: false,
    options: [],
    source: 'test-run',
  }))
}

export const buildTestResultExampleDraft = (
  entries: readonly TestResultExampleEntry[],
): FavoriteReproducibilityDraft => {
  const examples = entries.map((entry) => entry.example)
  return {
    variables: buildTestResultVariableDraft(examples),
    examples,
  }
}
