<template>
  <nav v-show="!keyboardOpen" class="compact-region-switch" :aria-label="t('workspace.regions')">
    <button type="button" data-testid="workspace-region-optimize"
      :aria-pressed="modelValue === 'optimize'" @click="$emit('update:modelValue', 'optimize')">
      <NIcon size="21"><Edit /></NIcon>
      <span>{{ t('workspace.optimize') }}</span><span v-if="optimizing" class="compact-region-running" :aria-label="t('workspace.generating')" role="status" />
    </button>
    <button type="button" data-testid="workspace-region-test"
      :aria-pressed="modelValue === 'test'" @click="$emit('update:modelValue', 'test')">
      <NIcon size="21"><PlayerPlay /></NIcon>
      <span>{{ t('workspace.test') }}</span><span v-if="testing" class="compact-region-running" :aria-label="t('workspace.running')" role="status" />
    </button>
  </nav>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { Edit, PlayerPlay } from '@vicons/tabler'
import { useI18n } from 'vue-i18n'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'

defineProps<{ modelValue: 'optimize' | 'test'; optimizing: boolean; testing: boolean }>()
defineEmits<{ 'update:modelValue': [value: 'optimize' | 'test'] }>()
const { t } = useI18n()
const { keyboardOpen } = useWorkspaceLayout()
</script>
