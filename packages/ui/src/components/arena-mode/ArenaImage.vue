<template>
  <AppPreviewImage v-if="src" :src="src" :alt="label" :width="width" />
  <NText v-else-if="missing" type="error">{{ t('arena.missingImage') }}</NText>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getPiniaServices } from '../../plugins/pinia'
import AppPreviewImage from '../media/AppPreviewImage.vue'
const props = withDefaults(defineProps<{ assetId: string; label: string; width?: number }>(), { width: 160 })
const { t } = useI18n()
const src = ref('')
const missing = ref(false)
watch(() => props.assetId, async (id, _, cleanup) => {
  let active = true
  cleanup(() => { active = false })
  src.value = ''; missing.value = false
  try {
    const image = await getPiniaServices()?.imageStorageService?.getImage(id)
    if (active) { src.value = image ? `data:${image.metadata.mimeType};base64,${image.data}` : ''; missing.value = !image }
  } catch { if (active) missing.value = true }
}, { immediate: true })
</script>
