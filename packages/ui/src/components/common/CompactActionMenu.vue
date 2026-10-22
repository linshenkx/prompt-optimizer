<template>
  <NPopover v-if="compact" trigger="click" placement="bottom-end">
    <template #trigger>
      <NButton quaternary size="small" class="compact-action-menu-trigger" :aria-label="t('workspace.promptTools')">
        {{ t('workspace.promptTools') }}
        <NIcon size="14"><ChevronDown /></NIcon>
      </NButton>
    </template>
    <div class="compact-action-menu-content"><slot /></div>
  </NPopover>
  <slot v-else />
</template>
<script setup lang="ts">
import { NButton, NIcon, NPopover } from 'naive-ui'
import { ChevronDown } from '@vicons/tabler'
import { useI18n } from 'vue-i18n'
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const { t } = useI18n()
</script>
<style scoped>
.compact-action-menu-trigger { min-height: 36px; padding: 0 8px; }
.compact-action-menu-content { display: flex; flex-direction: column; gap: 10px; max-width: min(300px, 80vw); }
</style>
