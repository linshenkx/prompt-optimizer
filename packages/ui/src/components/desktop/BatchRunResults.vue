<template>
  <div class="batch-results">
    <section v-for="(item, index) in rows" :key="index" data-testid="batch-candidate">
      <h3>{{ item.model.name || item.candidate.modelKey }}</h3>
      <div>{{ item.model.modelId }} · {{ item.result.status || run.status }}</div>
      <div v-for="field in promptFields" :key="field">
        <template v-if="item.candidate[field]">
          <strong>{{ t('desktopRuns.' + field) }}</strong>
          <pre>{{ item.candidate[field] }}</pre>
        </template>
      </div>
      <details v-if="Object.keys(item.candidate.variables ?? {}).length">
        <summary>{{ t('contextMode.savedComparisons.variables') }}</summary>
        <pre>{{ JSON.stringify(item.candidate.variables, null, 2) }}</pre>
      </details>
      <strong>{{ t('desktopRuns.output') }}</strong>
      <pre>{{ item.result.output }}</pre>
      <details v-if="item.result.reasoning">
        <summary>{{ t('desktopRuns.reasoning') }}</summary>
        <pre>{{ item.result.reasoning }}</pre>
      </details>
      <div v-if="item.result.error">{{ item.result.error.code }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DesktopRun } from '@prompt-optimizer/core'

type Candidate = { userPrompt?: string; systemPrompt?: string; modelKey?: string; variables?: Record<string, string> }
type Model = { modelId?: string; name?: string }
type Result = { output?: string; reasoning?: string; status?: string; error?: { code: string } }
const props = defineProps<{ run: DesktopRun }>()
const { t } = useI18n()
const promptFields = ['systemPrompt', 'userPrompt'] as const
const rows = computed(() => {
  const input = props.run.input as { request?: { candidates?: Candidate[] }; executionModels?: Model[] } | null
  const results: Result[] = Array.isArray(props.run.output) ? props.run.output : []
  const candidates = input?.request?.candidates ?? []
  return Array.from({ length: Math.max(candidates.length, results.length) }, (_, index) => ({
    candidate: candidates[index] ?? {}, model: input?.executionModels?.[index] ?? {}, result: results[index] ?? {},
  }))
})
</script>

<style scoped>
.batch-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 245px), 1fr)); gap: 1rem; }
section { min-width: 0; border: 1px solid var(--n-border-color); border-radius: 6px; padding: 0.75rem; overflow-wrap: anywhere; }
h3 { margin: 0; }
strong { display: block; margin-top: 0.65rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 45vh; overflow: auto; }
</style>
