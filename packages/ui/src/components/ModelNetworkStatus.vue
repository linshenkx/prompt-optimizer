<template>
  <NSpace v-if="available" align="center" :size="8" data-testid="model-network-status">
    <NText v-if="lastTest" depth="3" style="font-size: 12px" role="status">
      {{ t('networkSettings.lastTest', { route: routeLabel }) }}
    </NText>
    <NButton v-if="lastTest" text size="tiny" @click="openSettings">{{ t('networkSettings.title') }}</NButton>
  </NSpace>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NText } from 'naive-ui'
import type { ModelNetworkTest } from '../types/model-network'

const { t } = useI18n()
const available = typeof window !== 'undefined' && !!window.electronAPI?.network
const lastTest = ref<ModelNetworkTest | null>(null)
const routeLabel = computed(() => {
  const modes = [...new Set(lastTest.value?.routes.map(route => route.mode) || [])]
  return modes.length ? modes.map(mode => t(`networkSettings.routes.${mode}`)).join(' / ')
    : t('networkSettings.routes.none')
})
const onTest = (result: ModelNetworkTest) => { lastTest.value = result }
const openSettings = () => window.dispatchEvent(new CustomEvent('model-network:open-settings'))
onMounted(() => {
  if (!available) return
  window.electronAPI?.on('model-network-test', onTest)
  void window.electronAPI?.network.getSettings().then(state => {
    if (!lastTest.value) lastTest.value = state.lastConnection
  }).catch(() => {})
})
onUnmounted(() => {
  if (available) window.electronAPI?.off('model-network-test', onTest)
})
</script>
