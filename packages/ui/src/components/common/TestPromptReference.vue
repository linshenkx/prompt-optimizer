<template>
  <section class="test-prompt-reference" :class="{ 'test-prompt-reference--condensed': !expanded }" data-testid="test-prompt-reference">
    <div class="test-prompt-reference-heading">
      <span>{{ t(snapshot ? 'workspace.requestPrompt' : 'workspace.currentPromptReference') }}</span>
      <button v-if="content" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ t(expanded ? 'workspace.collapseContent' : 'workspace.expandContent') }}
      </button>
    </div>
    <pre :class="{ 'test-prompt-reference-excerpt': !expanded }">{{ (expanded ? content : content.replace(/\s+/g, ' ')) || t('workspace.emptyPromptReference') }}</pre>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const props = defineProps<{ content: string; snapshot?: boolean; variant?: string }>()
const { t } = useI18n()
const expandedByVariant = ref<Record<string, boolean>>({})
const expanded = computed({
  get: () => expandedByVariant.value[props.variant || 'default'] || false,
  set: value => { expandedByVariant.value[props.variant || 'default'] = value },
})
</script>
<style scoped>
.test-prompt-reference { padding: 6px 12px 10px; border: 1px solid var(--compact-border); border-radius: 10px; background: var(--compact-soft); }
.test-prompt-reference-heading { display: flex; justify-content: space-between; align-items: center; gap: 6px; color: var(--compact-muted); font-size: 12px; }
.test-prompt-reference button { min-height: 32px; padding: 0 4px; border: 0; color: inherit; font: inherit; background: transparent; cursor: pointer; }
.test-prompt-reference pre { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 13px; line-height: 1.65; color: var(--compact-ink); }
.test-prompt-reference-excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.test-prompt-reference--condensed { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; padding: 7px 10px; }
.test-prompt-reference--condensed .test-prompt-reference-heading { display: contents; }
.test-prompt-reference--condensed .test-prompt-reference-heading > span { grid-column: 1; font-size: 11px; line-height: 18px; color: var(--compact-muted); }
.test-prompt-reference--condensed button { grid-column: 2; grid-row: 1 / 3; align-self: center; font-size: 12px; color: var(--compact-muted); }
.test-prompt-reference--condensed pre { grid-column: 1; grid-row: 2; margin: 0; -webkit-line-clamp: 2; }
</style>
