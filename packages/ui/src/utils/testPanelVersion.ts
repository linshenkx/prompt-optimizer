import type { EvaluationPromptRef } from '@prompt-optimizer/core'
import type { SelectOption } from 'naive-ui'

export type DynamicTestPanelVersionValue = 'workspace' | 'previous' | 0 | number

export interface TestPanelVersionEntryLike {
  id?: string | null
  version?: number | null
  optimizedPrompt?: string | null
  originalPrompt?: string | null
  metadata?: { iterationBaseVersion?: number; [key: string]: unknown }
  previousId?: string | null
}

export interface TestPanelVersionLabels {
  workspace: string
  previous: string
  original: string
}

export type TestPanelVersionSourceTone = 'workspace' | 'previous' | 'original' | 'version'

export interface TestPanelVersionOption extends SelectOption {
  label: string
  fullLabel: string
  value: DynamicTestPanelVersionValue
  meta?: {
    resolutionReason?: PreviousResolutionReason
    resolvedVersion?: number
    isSameAsWorkspace?: boolean
  }
}

export interface ResolveTestPanelVersionSelectionParams {
  selection: DynamicTestPanelVersionValue
  versions: TestPanelVersionEntryLike[] | null | undefined
  currentVersionId?: string | null | undefined
  workspacePrompt?: string | null | undefined
  originalPrompt?: string | null | undefined
}

export interface ResolvedTestPanelVersionSelection {
  selection: DynamicTestPanelVersionValue
  text: string
  resolvedVersion: number
  promptKind: EvaluationPromptRef['kind']
  dynamicAlias?: 'previous'
  isSameAsWorkspace: boolean
  resolutionReason?: PreviousResolutionReason
}

export type PreviousResolutionReason =
  | 'currentBase'
  | 'earlierSaved'
  | 'originalFallback'

interface ResolvedPreviousVersionEntry {
  text: string
  resolvedVersion: number
  promptKind: 'original' | 'version'
  resolutionReason: PreviousResolutionReason
}

const normalizePromptText = (value: string | null | undefined): string =>
  (value || '').trim()

const getSortedSavedVersionEntries = (
  versions: TestPanelVersionEntryLike[] | null | undefined,
): TestPanelVersionEntryLike[] =>
  (versions || [])
    .filter((entry) =>
      typeof entry?.version === 'number' &&
      Number.isFinite(entry.version) &&
      entry.version >= 1
    )
    .slice()
    .sort((left, right) => (left.version as number) - (right.version as number))

const findCurrentBaseEntry = (
  versions: TestPanelVersionEntryLike[] | null | undefined,
  currentVersionId: string | null | undefined,
  workspacePrompt: string | null | undefined,
): TestPanelVersionEntryLike | null => {
  const normalizedCurrentVersionId = (currentVersionId || '').trim()
  const versionEntries = versions || []

  if (normalizedCurrentVersionId) {
    const matchedById = versionEntries.find(
      (entry) => (entry.id || '').trim() === normalizedCurrentVersionId,
    )
    if (matchedById) {
      return matchedById
    }
  }

  const normalizedWorkspacePrompt = normalizePromptText(workspacePrompt)
  if (!normalizedWorkspacePrompt) {
    return null
  }

  const savedVersionEntries = getSortedSavedVersionEntries(versionEntries)
  for (let index = savedVersionEntries.length - 1; index >= 0; index -= 1) {
    const candidate = savedVersionEntries[index]
    if (normalizePromptText(candidate.optimizedPrompt) === normalizedWorkspacePrompt) {
      return candidate
    }
  }

  return null
}

const findPreviousSavedEntry = (
  currentEntry: TestPanelVersionEntryLike | null,
  versions: TestPanelVersionEntryLike[] | null | undefined,
): TestPanelVersionEntryLike | null => {
  if (!currentEntry || currentEntry.metadata?.iterationBaseVersion === 0) return null

  const currentVersion = typeof currentEntry.version === 'number'
    ? currentEntry.version
    : null
  if (currentVersion == null || currentVersion <= 1) {
    return null
  }

  const sortedEntries = getSortedSavedVersionEntries(versions)
  const previousId = (currentEntry.previousId || '').trim()

  if (previousId) {
    const matchedById = sortedEntries.find((entry) => (entry.id || '').trim() === previousId)
    if (matchedById) {
      return matchedById
    }
  }

  for (let index = sortedEntries.length - 1; index >= 0; index -= 1) {
    const candidate = sortedEntries[index]
    if ((candidate.version as number) < currentVersion) {
      return candidate
    }
  }

  return null
}

const resolvePreviousVersionEntry = (
  params: Omit<ResolveTestPanelVersionSelectionParams, 'selection'>,
): ResolvedPreviousVersionEntry => {
  const currentBaseEntry = findCurrentBaseEntry(
    params.versions,
    params.currentVersionId,
    params.workspacePrompt,
  )
  const originalPrompt = normalizePromptText(params.originalPrompt)
  const workspacePrompt = normalizePromptText(params.workspacePrompt)

  const currentBaseText = currentBaseEntry
    ? normalizePromptText(currentBaseEntry.optimizedPrompt || currentBaseEntry.originalPrompt)
    : originalPrompt
  const currentBaseVersion = typeof currentBaseEntry?.version === 'number'
    ? currentBaseEntry.version
    : 0
  const workspaceDirtyAgainstBase = workspacePrompt !== currentBaseText

  if (workspaceDirtyAgainstBase) {
    if (currentBaseVersion >= 1) {
      return {
        text: currentBaseText,
        resolvedVersion: currentBaseVersion,
        promptKind: 'version',
        resolutionReason: 'currentBase',
      }
    }

    return {
      text: originalPrompt,
      resolvedVersion: 0,
      promptKind: 'original',
      resolutionReason: 'currentBase',
    }
  }

  const previousSavedEntry = findPreviousSavedEntry(currentBaseEntry, params.versions)
  if (previousSavedEntry) {
    return {
      text: normalizePromptText(previousSavedEntry.optimizedPrompt || previousSavedEntry.originalPrompt),
      resolvedVersion: previousSavedEntry.version as number,
      promptKind: 'version',
      resolutionReason: 'earlierSaved',
    }
  }

  return {
    text: originalPrompt,
    resolvedVersion: 0,
    promptKind: 'original',
    resolutionReason: 'originalFallback',
  }
}

export const getSortedSavedVersionNumbers = (
  versions: TestPanelVersionEntryLike[] | null | undefined,
): number[] =>
  getSortedSavedVersionEntries(versions)
    .map((entry) => entry.version as number)
    .slice()
    .sort((left, right) => left - right)

export const getSelectablePreviousSavedVersionNumber = (
  versions: TestPanelVersionEntryLike[] | null | undefined,
): number | null => {
  const sortedVersions = getSortedSavedVersionNumbers(versions)
  return sortedVersions.length >= 2 ? sortedVersions[sortedVersions.length - 2] : null
}

export const resolvePreviousSavedVersionNumber = (
  versions: TestPanelVersionEntryLike[] | null | undefined,
  context?: Omit<ResolveTestPanelVersionSelectionParams, 'selection' | 'versions'>,
): number | null => {
  if (!context) {
    const sortedVersions = getSortedSavedVersionNumbers(versions)
    if (sortedVersions.length >= 2) {
      return sortedVersions[sortedVersions.length - 2]
    }
    if (sortedVersions.length === 1) {
      return 0
    }
    return 0
  }

  const resolved = resolvePreviousVersionEntry({
    versions,
    currentVersionId: context.currentVersionId,
    workspacePrompt: context.workspacePrompt,
    originalPrompt: context.originalPrompt,
  })

  return resolved.resolvedVersion
}

export const resolveTestPanelVersionSelection = (
  params: ResolveTestPanelVersionSelectionParams,
): ResolvedTestPanelVersionSelection => {
  if (params.selection === 'workspace') {
    return {
      selection: params.selection,
      text: normalizePromptText(params.workspacePrompt),
      resolvedVersion: -1,
      promptKind: 'workspace',
      isSameAsWorkspace: true,
    }
  }

  if (params.selection === 'previous') {
    const resolvedPrevious = resolvePreviousVersionEntry(params)
    const normalizedWorkspacePrompt = normalizePromptText(params.workspacePrompt)
    return {
      selection: params.selection,
      text: resolvedPrevious.text,
      resolvedVersion: resolvedPrevious.resolvedVersion,
      promptKind: resolvedPrevious.promptKind,
      dynamicAlias: 'previous',
      isSameAsWorkspace: normalizePromptText(resolvedPrevious.text) === normalizedWorkspacePrompt,
      resolutionReason: resolvedPrevious.resolutionReason,
    }
  }

  if (params.selection === 0) {
    const text = normalizePromptText(params.originalPrompt)
    const normalizedWorkspacePrompt = normalizePromptText(params.workspacePrompt)
    return {
      selection: params.selection,
      text,
      resolvedVersion: 0,
      promptKind: 'original',
      isSameAsWorkspace: text === normalizedWorkspacePrompt,
    }
  }

  const normalizedWorkspacePrompt = normalizePromptText(params.workspacePrompt)
  const target = (params.versions || []).find((entry) => entry.version === params.selection)
  const text = normalizePromptText(target?.optimizedPrompt || target?.originalPrompt)

  return {
    selection: params.selection,
    text,
    resolvedVersion: typeof params.selection === 'number' ? params.selection : -1,
    promptKind: typeof params.selection === 'number' && params.selection >= 1 ? 'version' : 'custom',
    isSameAsWorkspace: text === normalizedWorkspacePrompt,
  }
}

export const coerceTestPanelVersionValue = (
  value: unknown,
): DynamicTestPanelVersionValue | null => {
  if (value === 'workspace' || value === 'latest') return 'workspace'
  if (value === 'previous') return 'previous'
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  return null
}

export const formatPreviousVersionLabel = (
  resolvedVersion: number | null | undefined,
  labels: Pick<TestPanelVersionLabels, 'previous' | 'original'>,
): string => {
  if (resolvedVersion === 0) {
    return `${labels.previous} (${labels.original})`
  }
  if (typeof resolvedVersion === 'number' && resolvedVersion >= 1) {
    return `${labels.previous} (v${resolvedVersion})`
  }
  return labels.previous
}

export const formatTestPanelVersionSelectionLabel = (
  selection: DynamicTestPanelVersionValue,
  resolvedVersion: number,
  labels: TestPanelVersionLabels,
): string => {
  if (selection === 'workspace') return labels.workspace
  if (selection === 'previous') {
    return formatPreviousVersionLabel(resolvedVersion >= 0 ? resolvedVersion : null, labels)
  }
  if (resolvedVersion === 0) return labels.original
  return `v${resolvedVersion}`
}

export const getTestPanelVersionSourceTone = (
  selection: DynamicTestPanelVersionValue,
  resolvedVersion: number,
): TestPanelVersionSourceTone => {
  if (selection === 'workspace') return 'workspace'
  if (selection === 'previous') return 'previous'
  if (resolvedVersion === 0) return 'original'
  return 'version'
}

export const formatTestPanelVariantSourceLabel = (
  variantLabel: string,
  selection: DynamicTestPanelVersionValue,
  resolvedVersion: number,
  labels: TestPanelVersionLabels,
): string => `${variantLabel} · ${formatTestPanelVersionSelectionLabel(selection, resolvedVersion, labels)}`

export const buildTestPanelVersionOptions = (
  versions: TestPanelVersionEntryLike[] | null | undefined,
  labels: TestPanelVersionLabels,
  context?: Omit<ResolveTestPanelVersionSelectionParams, 'selection' | 'versions'>,
): TestPanelVersionOption[] => {
  const sortedVersions = getSortedSavedVersionNumbers(versions)
  const previousVersion = resolvePreviousSavedVersionNumber(versions, context)
  const previousResolved = context
    ? resolveTestPanelVersionSelection({
        selection: 'previous',
        versions,
        currentVersionId: context.currentVersionId,
        workspacePrompt: context.workspacePrompt,
        originalPrompt: context.originalPrompt,
      })
    : null

  return [
    {
      label: labels.workspace,
      fullLabel: labels.workspace,
      value: 'workspace',
    },
    {
      label: labels.previous,
      fullLabel: formatPreviousVersionLabel(previousVersion, labels),
      value: 'previous' as const,
      ...(previousResolved
        ? {
            meta: {
              resolutionReason: previousResolved.resolutionReason,
              resolvedVersion: previousResolved.resolvedVersion,
              isSameAsWorkspace: previousResolved.isSameAsWorkspace,
            },
          }
        : {}),
    },
    {
      label: labels.original,
      fullLabel: labels.original,
      value: 0,
    },
    ...sortedVersions.map((version) => ({
      label: `v${version}`,
      fullLabel: `v${version}`,
      value: version,
    })),
  ]
}

export const buildTestPanelVersionPromptRef = (
  resolved: ResolvedTestPanelVersionSelection,
  labels: TestPanelVersionLabels,
): EvaluationPromptRef => {
  const label = formatTestPanelVersionSelectionLabel(
    resolved.selection,
    resolved.resolvedVersion,
    labels,
  )

  if (resolved.promptKind === 'workspace') {
    return {
      kind: 'workspace',
      label: labels.workspace,
    }
  }

  if (resolved.promptKind === 'original') {
    return {
      kind: 'original',
      label,
      ...(resolved.dynamicAlias ? { dynamicAlias: resolved.dynamicAlias } : {}),
    }
  }

  if (resolved.promptKind === 'version') {
    return {
      kind: 'version',
      version: resolved.resolvedVersion >= 1 ? resolved.resolvedVersion : 0,
      label,
      ...(resolved.dynamicAlias ? { dynamicAlias: resolved.dynamicAlias } : {}),
    }
  }

  return {
    kind: 'custom',
    label,
  }
}
