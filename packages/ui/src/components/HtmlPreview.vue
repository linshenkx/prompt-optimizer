<template>
  <div class="html-preview">
    <NAlert v-if="runtimeError" type="error" :title="t('common.previewFailed')" class="html-preview-error" role="alert">
      {{ runtimeError }}
    </NAlert>
    <iframe
      ref="frame"
      :src="hostUrl || undefined"
      :srcdoc="document"
      :title="t('common.htmlPreview')"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
      class="html-preview-frame"
      data-testid="html-preview-frame"
      @load="onLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NAlert } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'
import { buildHtmlPreviewContent, buildHtmlPreviewDocument, HTML_PREVIEW_ERROR_TYPE, HTML_PREVIEW_HOST_KEY } from '../utils/html-preview'

const props = defineProps<{ html: string }>()
const { t } = useI18n()
const hostUrl = inject(HTML_PREVIEW_HOST_KEY, null)
const frame = ref<HTMLIFrameElement>()
const previewId = ref(uuidv4())
const runtimeError = ref('')
const document = computed(() => hostUrl ? undefined : buildHtmlPreviewDocument(props.html, previewId.value))
let loaded = false

function publishHtml() {
  if (!hostUrl || !loaded) return
  // The declared sandbox has an opaque origin, so targetOrigin must be '*'.
  frame.value?.contentWindow?.postMessage({ type: 'prompt-optimizer:render-html', html: buildHtmlPreviewContent(props.html, previewId.value), id: previewId.value }, '*')
}

function onLoad() {
  loaded = true
  publishHtml()
}

function receiveError(event: MessageEvent) {
  const data = event.data
  if (event.source !== frame.value?.contentWindow || data?.type !== HTML_PREVIEW_ERROR_TYPE
    || data.id !== previewId.value || typeof data.message !== 'string' || data.message.length > 2000) return
  runtimeError.value = data.message
}

onMounted(() => window.addEventListener('message', receiveError))
onBeforeUnmount(() => window.removeEventListener('message', receiveError))
watch(() => props.html, () => {
  previewId.value = uuidv4()
  runtimeError.value = ''
  publishHtml()
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
.html-preview-frame {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 280px;
  border: 0;
  background: white;
}
.html-preview-error { flex: 0 0 auto; max-height: 160px; overflow: auto; overflow-wrap: anywhere; }
</style>
