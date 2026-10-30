<template>
  <AdaptiveModal :show="show" :title="title" data-testid="test-source-preview"
    presentation="dialog" style="width: min(760px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); overflow: auto;"
    @update:show="$emit('update:show', $event)">
    <div class="test-source-reading">
      <OutputDisplay :content="content" mode="readonly" :enable-diff="false" :enable-edit="false"
        :enable-favorite="false" :enable-fullscreen="false" fit-content />
    </div>
    <template #footer>
      <NFlex justify="end">
        <NButton @click="$emit('update:show', false)">{{ t('common.close') }}</NButton>
        <NButton v-if="editable" type="primary" @click="$emit('edit')">{{ t('workspace.goToEdit') }}</NButton>
      </NFlex>
    </template>
  </AdaptiveModal>
</template>
<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import AdaptiveModal from './AdaptiveModal.vue'
import OutputDisplay from '../OutputDisplay.vue'
defineProps<{ show: boolean; title: string; content: string; editable: boolean }>()
defineEmits<{ 'update:show': [value: boolean]; edit: [] }>()
const { t } = useI18n()
</script>

<style scoped>
.test-source-reading { min-width: 0; max-height: 60dvh; overflow: auto; }
</style>
