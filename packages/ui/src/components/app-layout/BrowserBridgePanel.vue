<template>
  <NButton v-if="state === 'connected'" class="browser-bridge-entry" size="small" round
    data-testid="browser-bridge-revoke" @click="disconnect">
    {{ t('browserBridge.connected') }} · {{ t('browserBridge.revoke') }}
  </NButton>
  <NModal :show="show" preset="card" :title="pending ? t('browserBridge.title') : t('browserBridge.connection')"
    :style="{ width: 'min(440px, calc(100vw - 32px))' }" data-testid="browser-bridge-panel" @update:show="dismiss">
    <NSpace vertical :size="16">
      <strong class="browser-bridge-origin">{{ origin }}</strong>
      <template v-if="scope && !failure">
        <p>{{ t(scopeDescriptions[scope]) }}</p>
        <p>{{ t('browserBridge.lifetime') }}</p>
      </template>
      <span v-if="pending?.registeredLabel">{{ pending.registeredLabel }}</span>
      <details v-else-if="pending">
        <summary data-testid="browser-bridge-label-toggle">{{ t('browserBridge.label') }}</summary>
        <NInput v-model:value="label" class="browser-bridge-label" :maxlength="80" :placeholder="defaultLabel"
          :input-props="{ 'aria-label': t('browserBridge.label') }" data-testid="browser-bridge-label" />
      </details>
      <NAlert v-if="failure" type="error" :show-icon="false" data-testid="browser-bridge-error">
        {{ t('browserBridge.failure') }} ({{ failure }})
      </NAlert>
      <NSpace justify="end">
        <template v-if="pending || state === 'connecting'">
          <NButton data-testid="browser-bridge-cancel" @click="dismiss">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="state === 'connecting'" data-testid="browser-bridge-authorize" @click="authorize">
            {{ t('browserBridge.authorize') }}
          </NButton>
        </template>
        <NButton v-else @click="dismiss">{{ t('common.close') }}</NButton>
      </NSpace>
    </NSpace>
  </NModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { NAlert, NButton, NInput, NModal, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { BrowserBridgeHost } from '@prompt-optimizer/core'
import { takeBrowserAuthorization, type PageAuthorization } from '../../browser-bridge/authorization-link'
import { browserLabel, connectBrowserPage } from '../../browser-bridge/client'

const props = defineProps<{ host: BrowserBridgeHost; productVersion: string }>()
const { t } = useI18n()
const scopeDescriptions = {
  business: 'browserBridge.businessScope',
  compare: 'browserBridge.compareScope',
  read: 'browserBridge.readScope',
} as const
const pending = ref(takeBrowserAuthorization())
const show = ref(Boolean(pending.value))
const state = ref<'connecting' | 'connected' | 'disconnected'>('disconnected')
const activeScope = ref<PageAuthorization['access']>()
const scope = computed(() => pending.value?.access ?? activeScope.value)
const failure = ref('')
const defaultLabel = browserLabel()
const label = ref(defaultLabel)
const origin = window.location.origin
let connection: ReturnType<typeof connectBrowserPage> | undefined

function capture() {
  const next = takeBrowserAuthorization()
  if (!next) return
  if (state.value === 'connecting') connection?.close()
  pending.value = next
  failure.value = ''
  show.value = true
}

function dismiss() {
  pending.value = undefined
  if (state.value === 'connecting') connection?.close()
  failure.value = ''
  show.value = false
}

function authorize() {
  const request = pending.value
  if (!request) return
  connection?.close()
  pending.value = undefined
  activeScope.value = request.access
  const sourceLabel = request.registeredLabel || label.value.trim() || defaultLabel
  connection = connectBrowserPage(props.host, request, sourceLabel, props.productVersion, (next, error) => {
    state.value = next
    if (next === 'connected') show.value = false
    if (next === 'disconnected') activeScope.value = undefined
    if (error) {
      failure.value = error
      show.value = true
    }
  })
}

function disconnect() {
  connection?.close()
  dismiss()
}

window.addEventListener('hashchange', capture)
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', capture)
  connection?.close()
})
</script>

<style scoped>
.browser-bridge-entry { position: fixed; bottom: 16px; left: 16px; z-index: 30; }
.browser-bridge-origin { overflow-wrap: anywhere; }
.browser-bridge-label { margin-top: 8px; }
summary { cursor: pointer; }
p { margin: 0; }
</style>
