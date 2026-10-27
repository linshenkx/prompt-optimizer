<template>
  <div class="html-preview">
    <div class="html-preview-toolbar">
      <NText depth="3" class="html-preview-hint">{{ t('common.htmlPreviewHint') }}</NText>
      <NButton size="small" quaternary @click="start" data-testid="html-preview-reload">
        {{ t('common.htmlPreviewReload') }}
      </NButton>
    </div>
    <NText v-if="!running" depth="3" class="html-preview-paused" data-testid="html-preview-paused" role="status">
      {{ t('common.htmlPreviewPaused') }}
    </NText>
    <iframe
      v-if="running"
      :key="revision"
      :srcdoc="document"
      :title="t('common.htmlPreview')"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
      class="html-preview-frame"
      data-testid="html-preview-frame"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { NButton, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { buildHtmlPreviewDocument } from '../utils/html-preview'
import { activeHtmlPreview } from '../utils/html-preview-runtime'

const props = defineProps<{ html: string }>()
const { t } = useI18n()
const revision = ref(0)
const previewId = Symbol('html-preview')
const running = computed(() => activeHtmlPreview.value === previewId)
const document = computed(() => buildHtmlPreviewDocument(props.html))
const stop = () => { if (running.value) activeHtmlPreview.value = undefined }
const start = () => {
  if (globalThis.document.visibilityState === 'hidden') return
  revision.value++
  activeHtmlPreview.value = previewId
}
const onVisibility = () => { if (globalThis.document.visibilityState === 'hidden') stop() }
watch(() => props.html, stop)
onMounted(() => {
  globalThis.document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', stop)
  start()
})
onBeforeUnmount(() => {
  stop()
  globalThis.document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', stop)
})
</script>

<style scoped>
.html-preview {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 320px;
  height: 100%;
}
.html-preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  flex: 0 0 auto;
}
.html-preview-hint { flex: 1 1 180px; font-size: 12px; }
.html-preview-paused { margin: auto; padding: 16px; text-align: center; }
.html-preview-toolbar :deep(.n-button) { margin-left: auto; }
.html-preview-frame {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 280px;
  border: 0;
  background: white;
}
.output-display--flow .html-preview { height: min(70vh, 640px); }
</style>
