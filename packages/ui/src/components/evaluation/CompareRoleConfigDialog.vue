<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="t('evaluation.compareConfig.dialogTitle')"
    style="width: min(96vw, 1160px);"
    :mask-closable="true"
  >
    <template #header-extra>
      <CompareHelpButton />
    </template>

    <NFlex vertical :size="12">
      <NAlert
        v-if="topStatusAlert"
        :type="topStatusAlert.type"
        :show-icon="false"
      >
        {{ topStatusAlert.message }}
      </NAlert>

      <NCard
        size="small"
        embedded
        class="compare-role-config__summary-card"
      >
        <NFlex vertical :size="8">
          <NFlex
            justify="space-between"
            align="center"
            :wrap="true"
            :size="8"
            class="compare-role-config__summary-header"
          >
            <NText strong>{{ t('evaluation.compareConfig.summaryTitle') }}</NText>
            <NTag
              size="small"
              :type="previewMode === 'structured' ? 'success' : 'warning'"
              :bordered="false"
            >
              {{ previewModeLabel }}
            </NTag>
          </NFlex>

          <div class="compare-role-config__summary-strip">
            <NTag
              size="small"
              type="success"
              :bordered="false"
              class="compare-role-config__summary-tag compare-role-config__summary-tag--target"
            >
              {{ t('evaluation.compareConfig.currentTargetLabel') }}: {{ currentTargetDisplay }}
            </NTag>

            <NTag
              v-for="pair in enabledPairPreviewEntries"
              :key="pair.key"
              size="small"
              type="success"
              :bordered="false"
              class="compare-role-config__summary-tag"
            >
              {{ pair.label }}
            </NTag>
          </div>

        </NFlex>
      </NCard>

      <NText strong>{{ t('evaluation.compareConfig.slotSectionTitle') }}</NText>

      <div class="compare-role-config__card-grid">
        <NCard
          v-for="entry in localEntries"
          :key="entry.id"
          size="small"
          embedded
          class="compare-role-config__slot-card"
        >
          <NFlex vertical :size="8">
            <div class="compare-role-config__slot-header">
              <div class="compare-role-config__slot-title-group">
                <div class="compare-role-config__slot-title">
                  <NTag size="small" :bordered="false">
                    {{ entry.label }}
                  </NTag>
                  <NText strong>{{ getSlotTitle(entry) }}</NText>
                </div>

                <div class="compare-role-config__slot-meta">
                  <NTag
                    v-if="entry.modelKey"
                    size="small"
                    type="default"
                    :bordered="false"
                  >
                    {{ modelLabel(entry.modelKey) }}
                  </NTag>
                </div>
              </div>

              <NTag
                v-if="getHeaderStatus(entry)"
                size="small"
                :type="getHeaderStatus(entry)!.type"
                :bordered="false"
              >
                {{ getHeaderStatus(entry)!.label }}
              </NTag>
            </div>

            <div
              :class="[
                'compare-role-config__slot-summary',
                `compare-role-config__slot-summary--${getDisplayRole(entry) || 'default'}`,
              ]"
            >
              <div class="compare-role-config__slot-summary-tags">
                <NTag
                  size="small"
                  :type="getRoleTagType(getDisplayRole(entry))"
                  :bordered="false"
                  class="compare-role-config__slot-role-pill"
                >
                  {{
                    getDisplayRole(entry)
                      ? roleLabel(getDisplayRole(entry)!)
                      : t('evaluation.compareConfig.unassignedTag')
                  }}
                </NTag>
                <NTag
                  v-if="shouldShowSuggestedRoleTag(entry)"
                  size="small"
                  type="default"
                  :bordered="false"
                  class="compare-role-config__slot-role-pill"
                >
                  {{ t('evaluation.compareConfig.suggestedRoleTag', { role: roleLabel(getSuggestedRole(entry.id)!) }) }}
                </NTag>
              </div>
              <NText depth="3" class="compare-role-config__slot-hint">
                {{ getPrimaryHint(entry) }}
              </NText>
            </div>

            <NAlert
              v-if="isWorkspaceChangedPending(entry)"
              type="warning"
              :show-icon="false"
              class="compare-role-config__slot-alert"
            >
              {{ t('evaluation.compareConfig.workspaceChangedInline') }}
            </NAlert>

            <div class="compare-role-config__role-picker">
              <div class="compare-role-config__role-segment">
                <NButton
                  v-for="role in primaryRoles"
                  :key="`${entry.id}-${role}`"
                  size="small"
                  :type="isRoleActive(entry, role) ? 'primary' : undefined"
                  quaternary
                  class="compare-role-config__role-segment-button"
                  :data-testid="`compare-role-button-${entry.id}-${role}`"
                  @click="selectRole(entry.id, role)"
                >
                  {{ roleLabel(role) }}
                </NButton>
              </div>

              <div
                v-if="entry.selectedRole"
                class="compare-role-config__role-picker-actions"
              >
                <NButton
                  text
                  size="small"
                  class="compare-role-config__restore-button"
                  :data-testid="`compare-role-restore-${entry.id}`"
                  @click="resetRole(entry.id)"
                >
                  {{ t('evaluation.compareConfig.restoreSuggested') }}
                </NButton>
              </div>
            </div>
          </NFlex>
        </NCard>
      </div>

      <NFlex
        v-if="hasManualOverrides"
        justify="flex-start"
        :wrap="true"
        :size="8"
      >
        <NButton quaternary @click="clearRoles">
          {{ t('evaluation.compareConfig.clearManual') }}
        </NButton>
      </NFlex>

      <NCard
        v-if="showAdvancedSection"
        size="small"
        embedded
        class="compare-role-config__advanced-card"
      >
        <NFlex vertical :size="12">
          <div class="compare-role-config__section-copy">
            <NText strong>{{ t('evaluation.compareConfig.advancedSectionTitle') }}</NText>
            <NText depth="3">{{ t('evaluation.compareConfig.advancedSectionSummary') }}</NText>
          </div>

          <div
            v-if="previewReasonMessages.length"
            class="compare-role-config__advanced-block"
          >
            <NText depth="3">{{ t('evaluation.compareConfig.previewReasonsLabel') }}</NText>
            <div
              v-for="reason in previewReasonMessages"
              :key="reason"
              class="compare-role-config__advanced-item"
            >
              <NText>{{ reason }}</NText>
            </div>
          </div>

          <div
            v-if="blockingConflictMessages.length"
            class="compare-role-config__advanced-block"
          >
            <NText depth="3">{{ t('evaluation.compareConfig.advancedConflictTitle') }}</NText>
            <div
              v-for="message in blockingConflictMessages"
              :key="message"
              class="compare-role-config__advanced-item"
            >
              <NText type="error">{{ message }}</NText>
            </div>
          </div>
        </NFlex>
      </NCard>

      <NFlex justify="end" :size="8">
        <NButton @click="handleCancel">
          {{ t('common.cancel') }}
        </NButton>
        <NButton
          type="primary"
          :disabled="confirmDisabled"
          data-testid="compare-role-config-confirm"
          @click="handleConfirm"
        >
          {{ confirmDisabled ? t('evaluation.compareConfig.confirmDisabled') : t('common.confirm') }}
        </NButton>
      </NFlex>
    </NFlex>
  </NModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NAlert,
  NButton,
  NCard,
  NFlex,
  NModal,
  NTag,
  NText,
} from 'naive-ui'
import { decodeTextModelSelection, type EvaluationSnapshot, type StructuredCompareRole } from '@prompt-optimizer/core'
import type { PersistedCompareSnapshotRoles } from '../../types/evaluation'
import {
  analyzeStructuredComparePlan,
  inferCompareSnapshotRoles,
  type StructuredCompareBlockingReason,
  type StructuredCompareWarningReason,
} from '../../composables/prompt/compareEvaluation'
import CompareHelpButton from './CompareHelpButton.vue'
import {
  PRIMARY_COMPARE_ROLES,
  applyCompareManualRoleSelection,
  buildComparePairPreviewEntries,
  buildCompareRoleSuggestionReason,
  getCompareModeLabel,
  getCompareRoleLabel,
  getCompareRoleTagType,
} from './compare-ui'

interface CompareRoleDialogEntry {
  id: string
  label: string
  promptRef: EvaluationSnapshot['promptRef']
  promptRefLabel: string
  promptText?: string
  modelKey?: string
  versionLabel?: string
  inferredRole?: StructuredCompareRole
  manualRole?: StructuredCompareRole
  staleManualRole?: StructuredCompareRole
  workspaceChangedManualRole?: StructuredCompareRole
}

interface LocalEntry extends CompareRoleDialogEntry {
  selectedRole?: StructuredCompareRole
}

const props = defineProps<{
  modelValue: boolean
  entries: CompareRoleDialogEntry[]
  manualRoles: PersistedCompareSnapshotRoles
  requireTargetSelection?: boolean
  modelLabels?: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [roles: PersistedCompareSnapshotRoles]
}>()

const { t } = useI18n()
const modelLabel = (key: string) => {
  if (props.modelLabels?.[key]) return props.modelLabels[key]
  const selection = decodeTextModelSelection(key)
  return selection
    ? `${props.modelLabels?.[selection.configId] || selection.configId} · ${selection.modelId}`
    : key
}

const show = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const primaryRoles = PRIMARY_COMPARE_ROLES
const primaryRoleSet = new Set<StructuredCompareRole>(primaryRoles)

const snapshotInputs = computed(() =>
  props.entries.map((entry) => ({
    id: entry.id,
    promptRef: entry.promptRef,
    promptText: entry.promptText,
    modelKey: entry.modelKey,
  }))
)

const createLocalEntries = (): LocalEntry[] =>
  props.entries.map((entry) => ({
    ...entry,
    selectedRole: normalizeManualRole(props.manualRoles[entry.id]),
  }))

const localEntries = ref<LocalEntry[]>(createLocalEntries())

watch(
  () => [props.modelValue, props.entries, props.manualRoles] as const,
  () => {
    if (props.modelValue) {
      localEntries.value = createLocalEntries()
    }
  },
  { deep: true },
)

const localManualRoles = computed<PersistedCompareSnapshotRoles>(() =>
  Object.fromEntries(
    localEntries.value
      .filter((entry) => !!entry.selectedRole)
      .map((entry) => [entry.id, entry.selectedRole as StructuredCompareRole]),
  )
)

const hasManualOverrides = computed(() =>
  localEntries.value.some((entry) => !!entry.selectedRole)
)

const inferRoles = (manualRoles: PersistedCompareSnapshotRoles) =>
  inferCompareSnapshotRoles(snapshotInputs.value, manualRoles)

const localEffectiveRoles = computed<PersistedCompareSnapshotRoles>(() =>
  inferRoles(localManualRoles.value)
)

const localPlanAnalysis = computed(() =>
  analyzeStructuredComparePlan(localEffectiveRoles.value as Record<string, StructuredCompareRole>)
)

const workspaceEntryCount = computed(
  () => props.entries.filter((entry) => entry.promptRef.kind === 'workspace').length,
)

const needsExplicitTargetSelection = computed(() => {
  if (Object.values(localEffectiveRoles.value).includes('target')) {
    return false
  }

  if (props.requireTargetSelection) return true
  return workspaceEntryCount.value > 1
})

const workspaceChangedManualRoleCount = computed(
  () => localEntries.value.filter((entry) => isWorkspaceChangedPending(entry)).length,
)

const previewMode = computed(() => localPlanAnalysis.value.mode)
const previewModeLabel = computed(() => getCompareModeLabel(t, previewMode.value))
const showAdvancedSection = computed(() =>
  previewReasonMessages.value.length > 0 || blockingConflictMessages.value.length > 0
)

const currentTargetEntry = computed(() =>
  localEntries.value.find((entry) => localEffectiveRoles.value[entry.id] === 'target')
)

const currentTargetDisplay = computed(() =>
  currentTargetEntry.value
    ? formatEntryDisplay(currentTargetEntry.value)
    : t('evaluation.compareConfig.currentTargetMissing')
)

const enabledPairPreviewEntries = computed(() =>
  buildComparePairPreviewEntries(t, localPlanAnalysis.value.executablePairs)
    .filter((entry) => entry.key !== 'referenceBaseline')
    .filter((entry) => entry.enabled)
)

const unresolvedEntries = computed(() =>
  localEntries.value.filter((entry) => {
    const role = localEffectiveRoles.value[entry.id]
    return !role || role === 'auxiliary'
  })
)

const unresolvedEntryLabels = computed(() =>
  unresolvedEntries.value.map((entry) => entry.label).join('、')
)

const blockingConflictMessages = computed(() =>
  localPlanAnalysis.value.blockingReasons
    .filter((reason) => reason.startsWith('duplicate'))
    .map((reason) => getReasonLabel(reason as StructuredCompareBlockingReason))
)

const previewReasonMessages = computed(() => {
  const messages: string[] = []

  localPlanAnalysis.value.blockingReasons
    .filter((reason) => !reason.startsWith('duplicate'))
    .filter((reason) => {
      if (reason === 'hasAuxiliarySnapshot' && unresolvedEntries.value.length > 0) {
        return false
      }
      if (reason === 'missingTarget' && needsExplicitTargetSelection.value) {
        return false
      }
      return true
    })
    .forEach((reason) => {
      messages.push(getReasonLabel(reason))
    })

  localPlanAnalysis.value.warningReasons.forEach((reason) => {
    messages.push(getWarningLabel(reason))
  })

  return Array.from(new Set(messages))
})

const topStatusAlert = computed(() => {
  if (blockingConflictMessages.value.length) {
    return {
      type: 'error' as const,
      message: t('evaluation.compareConfig.blockingSummary'),
    }
  }

  if (needsExplicitTargetSelection.value) {
    return {
      type: 'warning' as const,
      message: t('evaluation.compareConfig.requireTarget'),
    }
  }

  if (previewMode.value === 'generic' && unresolvedEntries.value.length > 0) {
    return {
      type: 'warning' as const,
      message: t('evaluation.compareConfig.unresolvedFallbackSummary', {
        entries: unresolvedEntryLabels.value,
      }),
    }
  }

  if (workspaceChangedManualRoleCount.value > 0) {
    return {
      type: 'warning' as const,
      message: t('evaluation.compareConfig.workspaceChangedSummary', {
        count: workspaceChangedManualRoleCount.value,
      }),
    }
  }

  if (previewMode.value === 'generic') {
    return {
      type: 'warning' as const,
      message: t('evaluation.compareConfig.genericFallbackSummary'),
    }
  }

  return null
})

const confirmDisabled = computed(() =>
  blockingConflictMessages.value.length > 0 || needsExplicitTargetSelection.value
)

function roleLabel(role: StructuredCompareRole): string {
  return getCompareRoleLabel(t, role)
}

function normalizeManualRole(
  role?: StructuredCompareRole
): StructuredCompareRole | undefined {
  return role && primaryRoleSet.has(role) ? role : undefined
}

function getRoleTagType(
  role?: StructuredCompareRole
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  return getCompareRoleTagType(role)
}

function isWorkspaceChangedPending(entry: LocalEntry): boolean {
  return !!entry.workspaceChangedManualRole && entry.selectedRole === entry.workspaceChangedManualRole
}

function getReasonLabel(reason: StructuredCompareBlockingReason): string {
  return t(`evaluation.compareConfig.reasonValues.${reason}`)
}

function getWarningLabel(reason: StructuredCompareWarningReason): string {
  return t(`evaluation.compareConfig.reasonValues.${reason}`)
}

function formatEntryDisplay(entry: LocalEntry): string {
  const version = entry.versionLabel || t('evaluation.compareConfig.noVersionLabel')
  return `${entry.label} · ${version}`
}

function getSlotTitle(entry: LocalEntry): string {
  if (
    entry.promptRef.dynamicAlias === 'previous' &&
    entry.promptRef.kind === 'version' &&
    typeof entry.promptRef.version === 'number'
  ) {
    return `v${entry.promptRef.version}`
  }

  return entry.promptRefLabel
}

function getDisplayRole(entry: LocalEntry): StructuredCompareRole | undefined {
  const role = localEffectiveRoles.value[entry.id]
  if (!role || role === 'auxiliary') {
    return undefined
  }
  return role
}

function getSuggestedRole(entryId: string): StructuredCompareRole | undefined {
  const manualWithoutEntry = Object.fromEntries(
    Object.entries(localManualRoles.value).filter(([id]) => id !== entryId),
  )

  return inferRoles(manualWithoutEntry)[entryId]
}

function getSuggestedRoleMap(entryId: string): PersistedCompareSnapshotRoles {
  const manualWithoutEntry = Object.fromEntries(
    Object.entries(localManualRoles.value).filter(([id]) => id !== entryId),
  )

  return inferRoles(manualWithoutEntry)
}

function getSuggestedReason(entry: LocalEntry): string {
  const suggestedRoleMap = getSuggestedRoleMap(entry.id)

  return buildCompareRoleSuggestionReason(t, {
    candidate: {
      id: entry.id,
      promptRef: entry.promptRef,
      promptText: entry.promptText,
      modelKey: entry.modelKey,
    },
    suggestedRole: suggestedRoleMap[entry.id],
    candidates: snapshotInputs.value,
    snapshotRoles: suggestedRoleMap,
  })
}

function getAssignedHint(entry: LocalEntry): string {
  const displayRole = getDisplayRole(entry)

  if (entry.promptRef.dynamicAlias === 'previous' && displayRole === 'baseline') {
    return t('evaluation.compareConfig.assignedHints.baselineDynamic')
  }

  if (entry.promptRef.dynamicAlias === 'previous' && displayRole === 'replica') {
    return t('evaluation.compareConfig.assignedHints.replicaFromPrevious')
  }

  return ''
}

function shouldShowSuggestedRoleTag(entry: LocalEntry): boolean {
  const suggestedRole = getSuggestedRole(entry.id)
  const displayRole = getDisplayRole(entry)
  return (
    !!entry.selectedRole &&
    !!suggestedRole &&
    primaryRoleSet.has(suggestedRole) &&
    suggestedRole !== displayRole
  )
}

function getPrimaryHint(entry: LocalEntry): string {
  if (!getDisplayRole(entry)) {
    return t('evaluation.compareConfig.unresolvedHint')
  }
  return getAssignedHint(entry) || getSuggestedReason(entry)
}

function getHeaderStatus(entry: LocalEntry):
  | { label: string; type: 'warning' | 'default' }
  | null {
  if (isWorkspaceChangedPending(entry)) {
    return {
      label: t('evaluation.compareConfig.workspaceChangedTag'),
      type: 'warning',
    }
  }

  if (entry.selectedRole) {
    return {
      label: t('evaluation.compareConfig.manualAssigned'),
      type: 'default',
    }
  }

  return null
}

function replaceSelectedRoles(nextSelectedRoles: PersistedCompareSnapshotRoles) {
  localEntries.value = localEntries.value.map((entry) => ({
    ...entry,
    selectedRole: nextSelectedRoles[entry.id] || undefined,
  }))
}

function selectRole(entryId: string, role: StructuredCompareRole) {
  const nextSelectedRoles = applyCompareManualRoleSelection(localManualRoles.value, {
    entryId,
    nextRole: role,
    suggestedRole: getSuggestedRole(entryId),
  })

  replaceSelectedRoles(nextSelectedRoles)
}

function resetRole(entryId: string) {
  const nextSelectedRoles = { ...localManualRoles.value }
  delete nextSelectedRoles[entryId]
  replaceSelectedRoles(nextSelectedRoles)
}

function clearRoles() {
  replaceSelectedRoles({})
}

function isRoleActive(entry: LocalEntry, role: StructuredCompareRole): boolean {
  return getDisplayRole(entry) === role
}

function handleCancel() {
  show.value = false
}

function handleConfirm() {
  if (confirmDisabled.value) {
    return
  }

  emit('confirm', localManualRoles.value)
}
</script>

<style scoped>
.compare-role-config__summary-card,
.compare-role-config__advanced-card,
.compare-role-config__slot-card {
  border-radius: 14px;
}

.compare-role-config__summary-card :deep(.n-card__content),
.compare-role-config__advanced-card :deep(.n-card__content),
.compare-role-config__slot-card :deep(.n-card__content) {
  padding: 12px !important;
}

.compare-role-config__summary-card,
.compare-role-config__slot-card {
  border: 1px solid var(--n-border-color);
  box-shadow: var(--n-box-shadow-1);
}

.compare-role-config__section-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.compare-role-config__summary-strip,
.compare-role-config__pair-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.compare-role-config__summary-header {
  padding-bottom: 2px;
}

.compare-role-config__summary-tag {
  border-radius: 999px;
}

.compare-role-config__summary-tag--target {
  font-weight: 600;
}

.compare-role-config__card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.compare-role-config__slot-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.compare-role-config__slot-title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.compare-role-config__slot-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.compare-role-config__slot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.compare-role-config__slot-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color-embedded);
}

.compare-role-config__slot-summary--target {
  border-left: 3px solid var(--n-success-color);
}

.compare-role-config__slot-summary--baseline {
  border-left: 3px solid var(--n-warning-color);
}

.compare-role-config__slot-summary--reference {
  border-left: 3px solid var(--n-info-color);
}

.compare-role-config__slot-summary--referenceBaseline,
.compare-role-config__slot-summary--replica {
  border-left: 3px solid var(--n-primary-color);
}

.compare-role-config__slot-summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.compare-role-config__slot-role-pill {
  align-self: start;
}

.compare-role-config__slot-hint {
  line-height: 1.45;
  min-width: 0;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.compare-role-config__slot-alert {
  border-radius: 10px;
}

.compare-role-config__role-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-role-config__role-segment {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 3px;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-color-embedded);
}

.compare-role-config__role-segment-button {
  min-width: 0;
}

.compare-role-config__role-segment :deep(.n-button) {
  border-radius: 10px;
}

.compare-role-config__role-picker-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.compare-role-config__restore-button {
  padding: 0;
  width: fit-content;
  white-space: nowrap;
}

.compare-role-config__advanced-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-role-config__advanced-item {
  line-height: 1.55;
}

@media (max-width: 860px) {
  .compare-role-config__role-segment {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .compare-role-config__card-grid,
  .compare-role-config__role-segment {
    grid-template-columns: 1fr;
  }
}
</style>
