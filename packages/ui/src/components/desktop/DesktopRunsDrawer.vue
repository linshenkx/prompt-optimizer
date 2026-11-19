<template>
  <NDrawer :show="show" :width="720" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="t('nav.desktopRuns')" closable>
      <NSpace vertical>
        <NSpace>
          <NInput v-model:value="runId" :placeholder="t('desktopRuns.runId')" data-testid="desktop-run-id" />
          <NButton :loading="loading" data-testid="desktop-run-search" @click="openRun(runId)">{{ t('common.search') }}</NButton>
          <NButton :loading="loading" data-testid="desktop-runs-refresh" @click="refresh">{{ t('desktopRuns.refresh') }}</NButton>
        </NSpace>
        <NAlert v-if="error" type="error" :show-icon="false">{{ t('desktopRuns.error') }}</NAlert>
        <NEmpty v-if="!items.length && !loading" :description="t('desktopRuns.empty')" />
        <NButton v-for="item in items" :key="item.id" block data-testid="desktop-run-item" @click="openRun(item.id)">
          {{ t(`desktopRuns.kinds.${item.kind}`) }} · {{ new Date(item.createdAt).toLocaleString() }}
        </NButton>
        <NCard v-if="detail" :title="t(`desktopRuns.kinds.${detail.kind}`)" data-testid="desktop-run-detail">
          <NSpace vertical>
            <NText>{{ detail.id }} · {{ detail.status }}</NText>
            <NText strong>{{ t('desktopRuns.output') }}</NText>
            <pre class="desktop-run-output">{{ outputText }}</pre>
            <NAlert v-if="detail.error" type="warning">{{ detail.error.code }}</NAlert>
            <NCollapse>
              <NCollapseItem :title="t('desktopRuns.input')" name="input">
                <pre class="desktop-run-output">{{ JSON.stringify(detail.input, null, 2) }}</pre>
              </NCollapseItem>
            </NCollapse>
            <NPopconfirm @positive-click="removeRun">
              <template #trigger><NButton type="error">{{ t('common.delete') }}</NButton></template>
              {{ t('desktopRuns.deleteConfirm') }}
            </NPopconfirm>
          </NSpace>
        </NCard>
      </NSpace>
    </NDrawerContent>
  </NDrawer>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NCard, NCollapse, NCollapseItem, NDrawer, NDrawerContent, NEmpty, NInput, NPopconfirm, NSpace, NText } from 'naive-ui'
import type { DesktopRun } from '@prompt-optimizer/core'

const props = defineProps<{ show: boolean; viewer: NonNullable<NonNullable<Window['electronAPI']>['desktopRuns']> }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const { t } = useI18n()
const items = shallowRef<DesktopRun[]>([])
const detail = shallowRef<DesktopRun>()
const runId = ref('')
const loading = ref(false)
const error = ref(false)
let generation = 0
const outputText = computed(() => typeof detail.value?.output === 'string'
  ? detail.value.output : JSON.stringify(detail.value?.output ?? detail.value?.partial ?? '', null, 2))

async function refresh() {
  const current = ++generation
  loading.value = true
  error.value = false
  try {
    const result = await props.viewer.list()
    if (current === generation && props.show) items.value = result.slice().sort((left, right) => right.createdAt - left.createdAt)
  } catch { if (current === generation) error.value = true }
  finally { if (current === generation) loading.value = false }
}
async function openRun(id: string) {
  if (!id.trim()) return
  const current = ++generation
  error.value = false
  loading.value = true
  detail.value = undefined
  try {
    const result = await props.viewer.get(id.trim())
    if (current === generation && props.show) { detail.value = result; runId.value = result.id }
  } catch { if (current === generation) error.value = true }
  finally { if (current === generation) loading.value = false }
}
async function removeRun() {
  const target = detail.value
  if (!target) return
  const current = ++generation
  try {
    await props.viewer.delete(target.id, target.updatedAt)
    if (current === generation && props.show) { detail.value = undefined; await refresh() }
  } catch { if (current === generation) error.value = true }
}
watch(() => props.show, show => {
  generation++
  detail.value = undefined
  if (show) void refresh()
}, { immediate: true })
</script>

<style scoped>
.desktop-run-output { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 45vh; overflow-y: auto; }
</style>
