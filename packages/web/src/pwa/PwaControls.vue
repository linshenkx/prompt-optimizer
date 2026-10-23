<template>
  <div v-if="updating" class="pwa-update-shield" aria-hidden="true" />
  <aside v-if="showUpdate && !keyboardVisible" class="pwa-notice" aria-live="polite" data-testid="pwa-update">
    <div class="pwa-notice__content">
      <strong>{{ text.update }}</strong>
      <p v-if="outcomeMessage">{{ outcomeMessage }}</p>
    </div>
    <button class="pwa-notice__primary" :disabled="updating" @click="applyUpdate">
      {{ updating ? text.applying : text.apply }}
    </button>
    <button class="pwa-notice__dismiss" :disabled="updating" :aria-label="text.later" @click="dismissUpdate">×</button>
  </aside>
  <aside v-else-if="showOffline && !keyboardVisible" class="pwa-notice pwa-notice--quiet" role="status" data-testid="pwa-offline">
    <span>{{ offlineReady ? text.offline : text.offlineUnavailable }}</span>
    <button class="pwa-notice__dismiss" :aria-label="text.close" @click="dismissOffline">×</button>
  </aside>
  <aside v-else-if="installAvailable && !keyboardVisible" class="pwa-notice pwa-notice--install" data-testid="pwa-install">
    <img :src="`${baseUrl}pwa/icon-192.png`" alt="" width="28" height="28" />
    <button class="pwa-notice__install" :title="text.installTitle" @click="handleInstall">{{ text.install }}</button>
    <button class="pwa-notice__dismiss" :aria-label="text.later" @click="dismissInstall">×</button>
  </aside>
  <dialog ref="instructions" class="pwa-instructions" :aria-label="text.iosTitle" @click="closeBackdrop">
    <h2>{{ text.iosTitle }}</h2>
    <p>{{ text.iosBody }}</p>
    <button class="pwa-notice__primary" @click="instructions?.close()">{{ text.close }}</button>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { i18n } from '@prompt-optimizer/ui'
import { usePwa } from './usePwa'
import { pwaMessages } from './messages'
import type { PrepareForUpdate } from './update'

const props = defineProps<{ prepareForUpdate: PrepareForUpdate }>()
const emit = defineEmits<{ 'update-lock': [locked: boolean] }>()
const text = computed(() => pwaMessages(String(i18n.global.locale.value)))
const baseUrl = import.meta.env.BASE_URL
const instructions = ref<HTMLDialogElement | null>(null)
const {
  installAvailable, showUpdate, showOffline, offlineReady, updating, updateOutcome, ios, keyboardVisible,
  install, applyUpdate, dismissInstall, dismissUpdate, dismissOffline,
} = usePwa(() => props.prepareForUpdate())
watch(updating, locked => emit('update-lock', locked), { flush: 'sync' })
const outcomeMessage = computed(() => {
  const outcome = updateOutcome.value
  return outcome && outcome !== 'ready' ? text.value[outcome] : ''
})
const handleInstall = async () => {
  if (ios.value) instructions.value?.showModal()
  else await install()
}
const closeBackdrop = (event: MouseEvent) => {
  const dialog = instructions.value
  if (!dialog || event.target !== dialog) return
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
    dialog.close()
  }
}
</script>

<style scoped>
.pwa-update-shield { position: fixed; inset: 0; z-index: 899; touch-action: none; cursor: wait; background: #14152112; }
.pwa-notice {
  position: fixed;
  z-index: 900;
  inset-inline-end: max(12px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(420px, calc(100vw - 24px));
  padding: 10px 8px 10px 12px;
  border: 1px solid #dedee7;
  border-radius: 14px;
  background: #fff;
  color: #252937;
  box-shadow: 0 4px 24px #1415211f;
  font: 13px/1.5 system-ui, sans-serif;
}
.pwa-notice__content { min-width: 0; }
.pwa-notice strong { font-weight: 600; }
.pwa-notice p { margin: 4px 0 0; font-size: 12px; }
.pwa-notice button { font: inherit; cursor: pointer; }
.pwa-notice button:disabled { cursor: wait; opacity: .65; }
.pwa-notice__primary {
  flex-shrink: 0;
  padding: 7px 11px;
  border: 0;
  border-radius: 9px;
  background: #454c5c;
  color: #fff;
  font: inherit;
  cursor: pointer;
}
.pwa-notice__dismiss { flex-shrink: 0; width: 32px; height: 32px; border: 0; background: transparent; color: inherit; font-size: 21px !important; }
.pwa-notice--quiet { padding-block: 4px; }
.pwa-notice--install { padding-block: 6px; gap: 8px; }
.pwa-notice--install img { border-radius: 7px; }
.pwa-notice__install { padding: 5px 0; border: 0; background: transparent; color: inherit; }
.pwa-instructions { width: min(340px, calc(100vw - 48px)); box-sizing: border-box; border: 1px solid #dedee7; border-radius: 18px; padding: 22px; color: #252937; background: #fff; font: 14px/1.7 system-ui, sans-serif; }
.pwa-instructions h2 { margin: 0; font-size: 18px; }
.pwa-instructions::backdrop { background: #17192770; }
:global(.dark) .pwa-notice, :global(.dark) .pwa-instructions { color: #ececf1; background: #252631; border-color: #4b4d5b; }
@media (max-width: 767px) {
  .pwa-notice { bottom: calc(76px + env(safe-area-inset-bottom)); }
}
@media (min-width: 768px) {
  /* Desktop users retain their existing layout; installation remains in the browser UI. */
  .pwa-notice--install { display: none; }
}
</style>
