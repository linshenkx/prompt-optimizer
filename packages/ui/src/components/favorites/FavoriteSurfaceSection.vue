<template>
  <NCard
    size="small"
    :title="title"
    :segmented="segmented"
    :content-style="collapsible && collapsed ? { padding: 0 } : undefined"
    class="favorite-surface-section"
    :class="[
      `favorite-surface-section--${variant}`,
      {
        'favorite-surface-section--changed': changed,
        'favorite-surface-section--flush': flush,
      },
    ]"
  >
    <template v-if="$slots.headerExtra || collapsible" #header-extra>
      <div class="favorite-surface-section__extra" :class="{ 'favorite-surface-section__extra--collapsible': collapsible }">
        <slot name="headerExtra" />
        <NButton v-if="collapsible" text size="small" :aria-expanded="!collapsed" :aria-label="title"
          @click="collapsed = !collapsed">
          <NIcon><ChevronDown v-if="collapsed" /><ChevronUp v-else /></NIcon>
        </NButton>
      </div>
    </template>

    <div :style="{ display: collapsible && collapsed ? 'none' : 'contents' }"><slot /></div>
  </NCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NCard, NIcon } from 'naive-ui'
import { ChevronDown, ChevronUp } from '@vicons/tabler'

const props = withDefaults(defineProps<{
  title?: string
  changed?: boolean
  variant?: 'default' | 'identity' | 'media' | 'content'
  flush?: boolean
  /** Presentation only: content stays mounted so folding preserves editor drafts. */
  collapsible?: boolean
}>(), {
  title: undefined,
  changed: false,
  variant: 'default',
  flush: false,
  collapsible: false,
})

const collapsed = ref(true)
const segmented = computed(() => (props.title ? { content: true } : false))
</script>

<style scoped>
.favorite-surface-section {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--n-border-color) 76%, transparent);
  border-radius: 8px;
  box-shadow: none;
}

.favorite-surface-section--identity {
  background: color-mix(in srgb, var(--n-color) 90%, var(--n-primary-color) 10%);
}

.favorite-surface-section--media {
  background: var(--n-color);
}

.favorite-surface-section--content {
  background: var(--n-color);
}

.favorite-surface-section--changed {
  border-color: color-mix(in srgb, var(--n-warning-color) 45%, var(--n-border-color));
  box-shadow: inset 3px 0 0 var(--n-warning-color);
}

.favorite-surface-section :deep(.n-card-header) {
  min-height: 44px;
  padding: 12px 16px 8px;
}

.favorite-surface-section :deep(.n-card__content) {
  padding: 14px 16px 16px;
}

.favorite-surface-section--flush :deep(.n-card__content) {
  padding: 0;
}
.favorite-surface-section__extra {
  display: contents;
}
.favorite-surface-section__extra--collapsible {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
