<template>
  <div class="html-preview">
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
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildHtmlPreviewDocument, HTML_PREVIEW_HOST_KEY } from '../utils/html-preview'

const props = defineProps<{ html: string }>()
const { t } = useI18n()
const hostUrl = inject(HTML_PREVIEW_HOST_KEY, null)
const frame = ref<HTMLIFrameElement>()
const document = computed(() => hostUrl ? undefined : buildHtmlPreviewDocument(props.html))
let loaded = false

function publishHtml() {
  if (!hostUrl || !loaded) return
  // The declared sandbox has an opaque origin, so targetOrigin must be '*'.
  // Send only HTML to this frame; no incoming messages or privileged bridge.
  frame.value?.contentWindow?.postMessage({ type: 'prompt-optimizer:render-html', html: props.html }, '*')
}

function onLoad() {
  loaded = true
  publishHtml()
}

watch(() => props.html, publishHtml)
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
.output-display--flow .html-preview { height: min(70vh, 640px); }
</style>
