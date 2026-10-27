<template>
  <div class="html-preview">
    <div class="html-preview-toolbar">
      <NText depth="3" class="html-preview-hint">{{ t('common.htmlPreviewHint') }}</NText>
      <NButton size="small" quaternary @click="revision++" data-testid="html-preview-reload">
        {{ t('common.htmlPreviewReload') }}
      </NButton>
    </div>
    <iframe
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
import { computed, ref } from 'vue'
import { NButton, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { buildHtmlPreviewDocument } from '../utils/html-preview'

const props = defineProps<{ html: string }>()
const { t } = useI18n()
const revision = ref(0)
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
