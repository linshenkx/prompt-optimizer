<template>
  <div class="html-preview">
    <iframe
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildHtmlPreviewDocument } from '../utils/html-preview'

const props = defineProps<{ html: string }>()
const { t } = useI18n()
const document = computed(() => buildHtmlPreviewDocument(props.html))
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
