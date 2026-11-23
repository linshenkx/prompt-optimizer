<template>
  <div class="browser-bridge-entry">
    <NButton size="small" :type="state === 'connected' ? 'success' : 'default'" round
      data-testid="browser-bridge-entry" @click="show = true">{{ t('browserBridge.title') }}</NButton>
  </div>
  <NModal v-model:show="show" preset="card" :title="t('browserBridge.title')" class="browser-bridge-dialog"
    :style="{ width: 'min(520px, calc(100vw - 32px))' }" data-testid="browser-bridge-panel">
    <NSpace vertical :size="16">
      <NAlert :type="state === 'connected' ? 'success' : 'info'" :show-icon="false" data-testid="browser-bridge-state">
        {{ t(`browserBridge.${state}`) }}
      </NAlert>
      <p>{{ origin }}</p>
      <p>{{ t('browserBridge.context') }}</p>
      <template v-if="authorization">
        <NInput v-model:value="label" :maxlength="80" :placeholder="t('browserBridge.label')"
          :input-props="{ 'aria-label': t('browserBridge.label') }" data-testid="browser-bridge-label" />
        <p>{{ t(authorization.access === 'business' ? 'browserBridge.businessScope' : authorization.access === 'compare' ? 'browserBridge.compareScope' : 'browserBridge.readScope') }}</p>
        <NAlert v-if="authorization.access !== 'read'" type="warning" :show-icon="false">{{ t('browserBridge.charges') }}</NAlert>
        <NButton type="primary" :disabled="!label.trim() || state === 'connecting'" :loading="state === 'connecting'"
          data-testid="browser-bridge-authorize" @click="authorize">{{ t('browserBridge.authorize') }}</NButton>
      </template>
      <p v-else-if="state !== 'connected'">{{ t('browserBridge.instructions') }}</p>
      <NAlert v-if="failure" type="error" :show-icon="false" data-testid="browser-bridge-error">
        {{ t('browserBridge.failure') }} ({{ failure }})
      </NAlert>
      <NButton v-if="state === 'connected'" type="error" secondary data-testid="browser-bridge-revoke" @click="revoke">
        {{ t('browserBridge.revoke') }}
      </NButton>
    </NSpace>
  </NModal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { NAlert, NButton, NInput, NModal, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { BrowserBridgeHost } from '@prompt-optimizer/core'
import { browserLabel, connectBrowserPage, takeBrowserAuthorization } from '../../browser-bridge/client'

const props = defineProps<{ host: BrowserBridgeHost; productVersion: string }>()
const { t } = useI18n()
const authorization = ref(takeBrowserAuthorization())
const show = ref(Boolean(authorization.value))
const state = ref<'connecting' | 'connected' | 'disconnected'>('disconnected')
const failure = ref('')
const label = ref(browserLabel())
const origin = window.location.origin
let connection: ReturnType<typeof connectBrowserPage> | undefined
const capture = () => {
  const next = takeBrowserAuthorization()
  if (next) { authorization.value = next; show.value = true; failure.value = '' }
}
window.addEventListener('hashchange', capture)

function authorize() {
  if (!authorization.value || !label.value.trim()) return
  connection?.close()
  connection = connectBrowserPage(props.host, authorization.value, label.value.trim(), props.productVersion, (next, error) => {
    state.value = next
    failure.value = error ?? ''
    if (next === 'connected') authorization.value = undefined
  })
}
function revoke() { connection?.close(); authorization.value = undefined }
onBeforeUnmount(() => { connection?.close(); window.removeEventListener('hashchange', capture) })
</script>

<style scoped>
.browser-bridge-entry { position: fixed; bottom: 16px; left: 16px; z-index: 30; }
</style>
