<template>
  <div v-if="available.length" class="local-discovery" data-testid="local-service-discovery">
    <NText depth="3">{{ t('localDiscovery.found') }}</NText>
    <NButton v-for="service in available" :key="service.kind + service.baseURL" size="small" quaternary
      :disabled="disabled" :title="service.baseURL"
      :aria-label="t('localDiscovery.create', { name: service.name })"
      :data-testid="'local-service-create-' + service.kind" @click="emit('select', service)">
      <template #icon><LocalServiceIcon :kind="service.kind" /></template>
      {{ service.name }}<span v-if="service.kind === 'chrome-built-in' && service.availability !== 'available'">{{ t('localDiscovery.' + service.availability) }}</span>
    </NButton>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NText } from 'naive-ui'
import { discoverLocalServices, type TextModelConfig } from '@prompt-optimizer/core'
import { hasDiscoveredService, normalizeLocalServiceAddress, discoverChromeBuiltIn, type DiscoveredLocalService } from '../utils/local-model-discovery'
import LocalServiceIcon from './icons/LocalServiceIcon.vue'

const props = defineProps<{ active: boolean; models: TextModelConfig[]; disabled?: boolean }>()
const emit = defineEmits<{ select: [service: DiscoveredLocalService] }>()
const { t } = useI18n()
const results = ref<DiscoveredLocalService[]>([])
const available = computed(() => {
  if (!props.active) return []
  const seen = new Set<string>()
  return results.value.filter(service => {
    // Also hide results from an older desktop bridge while support is paused.
    if (service.kind === 'lmstudio' || service.kind === 'cc-switch') return false
    const address = service.kind === 'chrome-built-in' ? service.kind : normalizeLocalServiceAddress(service.baseURL)
    if (service.status !== 'ready' || !address || seen.has(address)
      || hasDiscoveredService(props.models, service)) return false
    seen.add(address)
    return true
  })
})
let controller: AbortController | undefined
let generation = 0

function cancel() {
  generation++
  controller?.abort()
  results.value = []
}

async function scan() {
  cancel()
  const current = generation
  controller = new AbortController()
  const append = (found: DiscoveredLocalService[]) => {
    if (current === generation) results.value.push(...found)
  }
  // A blocked HTTP probe must not delay or hide a browser capability hint.
  await Promise.allSettled([
    (async () => {
      const found = window.electronAPI?.localServices
        ? await window.electronAPI.localServices.discover({})
        : await discoverLocalServices({}, { signal: controller!.signal })
      append(found)
    })(),
    (async () => { const found = await discoverChromeBuiltIn(); if (found) append([found]) })(),
  ])
}

watch(() => props.active, active => { if (active) void scan(); else cancel() }, { immediate: true })
onBeforeUnmount(cancel)
</script>

<style scoped>
.local-discovery { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 12px; }
</style>
