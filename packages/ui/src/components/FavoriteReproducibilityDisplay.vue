<template>
  <div class="favorite-reproducibility-display">
    <NEmpty
      v-if="!hasVisibleData"
      size="small"
      :description="t('favorites.manager.preview.reproducibility.empty')"
    />

    <NSpace v-else vertical :size="12">
      <NSpace :size="8" align="center" wrap>
        <NTag
          v-if="showVariables && reproducibility.variableCount > 0"
          size="small"
          type="info"
          :bordered="false"
        >
          {{ t('favorites.manager.preview.reproducibility.variableCount', { count: reproducibility.variableCount }) }}
        </NTag>
        <NTag
          v-if="showExamples && reproducibility.exampleCount > 0"
          size="small"
          type="success"
          :bordered="false"
        >
          {{ t('favorites.manager.preview.reproducibility.exampleCount', { count: reproducibility.exampleCount }) }}
        </NTag>
        <NTag
          v-if="showExamples && reproducibility.hasInputImages"
          size="small"
          type="warning"
          :bordered="false"
        >
          {{ t('favorites.manager.preview.reproducibility.hasInputImages') }}
        </NTag>
      </NSpace>

      <section v-if="showVariables && reproducibility.variables.length > 0" class="favorite-reproducibility-display__section">
        <NText v-if="showSectionHeadings" strong>{{ t('favorites.manager.preview.reproducibility.variables') }}</NText>
        <div class="favorite-reproducibility-display__table-scroll">
          <NTable size="small" striped :single-line="false">
            <thead>
              <tr>
                <th>{{ t('favorites.manager.preview.reproducibility.variableName') }}</th>
                <th>{{ t('favorites.manager.preview.reproducibility.variableDefault') }}</th>
                <th>{{ t('favorites.manager.preview.reproducibility.variableRequired') }}</th>
                <th>{{ t('favorites.manager.preview.reproducibility.variableDescription') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="variable in reproducibility.variables"
                :key="variable.name"
              >
                <td>{{ variable.name }}</td>
                <td>{{ variable.defaultValue || '-' }}</td>
                <td>
                  {{
                    variable.required
                      ? t('favorites.manager.preview.reproducibility.requiredYes')
                      : t('favorites.manager.preview.reproducibility.requiredNo')
                  }}
                </td>
                <td>{{ variable.description || '-' }}</td>
              </tr>
            </tbody>
          </NTable>
        </div>
      </section>

      <section v-if="showExamples && reproducibility.examples.length > 0" class="favorite-reproducibility-display__section">
        <NText v-if="showSectionHeadings" strong>{{ t('favorites.manager.preview.reproducibility.examples') }}</NText>
        <NSpace vertical :size="8">
          <NCard
            v-for="(example, index) in reproducibility.examples"
            :key="example.id || `example-${index}`"
            size="small"
            embedded
          >
            <NSpace vertical :size="8">
              <div class="favorite-reproducibility-display__example-header">
                <NText strong>
                  {{ t('favorites.manager.preview.reproducibility.exampleLabel', { index: index + 1 }) }}
                </NText>
                <NButton
                  v-if="showApplyExample"
                  size="small"
                  type="primary"
                  :data-testid="`favorite-repro-example-apply-${index}`"
                  @click="$emit('apply-example', { exampleId: example.id, exampleIndex: index })"
                >
                  <template #icon>
                    <NIcon :size="16">
                      <PlayerPlay />
                    </NIcon>
                  </template>
                  {{ t('favorites.manager.preview.reproducibility.applyExample') }}
                </NButton>
              </div>

              <div class="favorite-reproducibility-display__example-layout">
                <div class="favorite-reproducibility-display__example-output">
                  <NText v-if="example.text" class="favorite-reproducibility-display__example-text">
                    {{ example.text }}
                  </NText>
                  <NText v-if="example.description" depth="3" class="favorite-reproducibility-display__example-text">
                    {{ example.description }}
                  </NText>
                  <div
                    v-if="example.outputText"
                    class="favorite-reproducibility-display__output-text"
                  >
                    <NText strong>{{ t('favorites.manager.preview.reproducibility.outputText') }}</NText>
                    <NText>{{ example.outputText }}</NText>
                  </div>
                  <div
                    v-if="getExampleImageSources(index, 'images', example).length > 0"
                    class="favorite-reproducibility-display__image-block"
                  >
                    <NText strong>{{ t('favorites.manager.preview.reproducibility.images') }}</NText>
                    <AppPreviewImageGroup>
                      <div class="favorite-reproducibility-display__image-grid">
                        <AppPreviewImage
                          v-for="(source, imageIndex) in getExampleImageSources(index, 'images', example)"
                          :key="`example-${index}-image-${imageIndex}-${source.slice(0, 24)}`"
                          :src="source"
                          :alt="t('favorites.dialog.imageAlt', { index: imageIndex + 1 })"
                          object-fit="cover"
                          class="favorite-reproducibility-display__image"
                        />
                      </div>
                    </AppPreviewImageGroup>
                  </div>
                </div>

                <div class="favorite-reproducibility-display__example-context">
                  <div
                    v-if="getParameterEntries(example).length > 0"
                    class="favorite-reproducibility-display__parameter-list"
                  >
                    <NText strong>{{ t('favorites.manager.preview.reproducibility.parameters') }}</NText>
                    <div
                      v-for="[parameterKey, parameterValue] in getParameterEntries(example)"
                      :key="parameterKey"
                      class="favorite-reproducibility-display__parameter-row"
                    >
                      <NText class="favorite-reproducibility-display__parameter-key">
                        {{ parameterKey }}
                      </NText>
                      <NText class="favorite-reproducibility-display__parameter-value">
                        {{ parameterValue }}
                      </NText>
                    </div>
                  </div>
                  <div
                    v-if="example.messages && example.messages.length > 0"
                    class="favorite-reproducibility-display__context-block"
                  >
                    <NText strong>{{ t('favorites.manager.preview.reproducibility.messages') }}</NText>
                    <NText depth="3">{{ example.messages.length }}</NText>
                  </div>
                  <div
                    v-if="getExampleImageSources(index, 'inputImages', example).length > 0"
                    class="favorite-reproducibility-display__image-block"
                  >
                    <NText strong>{{ t('favorites.manager.preview.reproducibility.inputImages') }}</NText>
                    <AppPreviewImageGroup>
                      <div class="favorite-reproducibility-display__image-grid favorite-reproducibility-display__image-grid--compact">
                        <AppPreviewImage
                          v-for="(source, imageIndex) in getExampleImageSources(index, 'inputImages', example)"
                          :key="`example-${index}-input-image-${imageIndex}-${source.slice(0, 24)}`"
                          :src="source"
                          :alt="t('favorites.dialog.imageAlt', { index: imageIndex + 1 })"
                          object-fit="cover"
                          class="favorite-reproducibility-display__image"
                        />
                      </div>
                    </AppPreviewImageGroup>
                  </div>
                </div>
              </div>
            </NSpace>
          </NCard>
        </NSpace>
      </section>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NSpace,
  NTable,
  NTag,
  NText,
} from 'naive-ui'
import { Play as PlayerPlay } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  FavoriteReproducibility,
  FavoriteReproducibilityExample,
} from '../utils/favorite-reproducibility'
import AppPreviewImage from './media/AppPreviewImage.vue'
import AppPreviewImageGroup from './media/AppPreviewImageGroup.vue'

type FavoriteReproducibilityExamplePreviews = {
  images: Array<{ assetId: string; source: string }>
  inputImages: Array<{ assetId: string; source: string }>
}

const props = withDefaults(defineProps<{
  reproducibility: FavoriteReproducibility
  examplePreviews?: FavoriteReproducibilityExamplePreviews[]
  showApplyExample?: boolean
  showVariables?: boolean
  showExamples?: boolean
  showSectionHeadings?: boolean
}>(), {
  examplePreviews: undefined,
  showApplyExample: false,
  showVariables: true,
  showExamples: true,
  showSectionHeadings: true,
})

defineEmits<{
  'apply-example': [options: { exampleId?: string; exampleIndex: number }]
}>()

const { t } = useI18n()

const hasVisibleData = computed(() =>
  (props.showVariables && props.reproducibility.variables.length > 0) ||
  (props.showExamples && props.reproducibility.examples.length > 0),
)

const dedupeStrings = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const getExampleImageSources = (
  index: number,
  field: 'images' | 'inputImages',
  example: FavoriteReproducibilityExample,
) => {
  const resolvedSources = props.examplePreviews?.[index]?.[field] || []
  return dedupeStrings([
    ...(example[field] || []),
    ...resolvedSources.map((item) => item.source),
  ])
}

const getParameterEntries = (example: FavoriteReproducibilityExample) =>
  Object.entries(example.parameters || {})
</script>

<style scoped>
.favorite-reproducibility-display {
  min-width: 0;
}

.favorite-reproducibility-display__section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.favorite-reproducibility-display__table-scroll {
  max-width: 100%;
  overflow-x: auto;
}

.favorite-reproducibility-display__table-scroll :deep(table) {
  min-width: 560px;
}

.favorite-reproducibility-display__table-scroll :deep(th),
.favorite-reproducibility-display__table-scroll :deep(td) {
  min-width: 0;
  overflow-wrap: anywhere;
  vertical-align: top;
}

.favorite-reproducibility-display :deep(.n-card) {
  min-width: 0;
}

.favorite-reproducibility-display__example-header {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.favorite-reproducibility-display :deep(.n-text) {
  overflow-wrap: anywhere;
}

.favorite-reproducibility-display__example-header :deep(.n-text) {
  min-width: 0;
}

.favorite-reproducibility-display__example-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(240px, 0.85fr);
  gap: 12px;
  align-items: start;
}

.favorite-reproducibility-display__example-output,
.favorite-reproducibility-display__example-context,
.favorite-reproducibility-display__parameter-list,
.favorite-reproducibility-display__context-block,
.favorite-reproducibility-display__output-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.favorite-reproducibility-display__example-output {
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--n-border-color) 76%, transparent);
  border-radius: 8px;
  background: var(--n-color-embedded);
}

.favorite-reproducibility-display__example-context {
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}

.favorite-reproducibility-display__parameter-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(84px, 0.8fr) minmax(0, 1.2fr);
  gap: 6px;
  align-items: start;
}

.favorite-reproducibility-display__parameter-key,
.favorite-reproducibility-display__parameter-value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.favorite-reproducibility-display__parameter-key {
  padding: 4px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--n-color) 80%, var(--n-primary-color) 20%);
}

.favorite-reproducibility-display__image-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.favorite-reproducibility-display__image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}

.favorite-reproducibility-display__image-grid--compact {
  grid-template-columns: repeat(auto-fill, minmax(64px, 88px));
}

.favorite-reproducibility-display__image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  background: var(--n-color-embedded);
}

@media (max-width: 767px) {
  .favorite-reproducibility-display__example-layout {
    grid-template-columns: 1fr;
  }

  .favorite-reproducibility-display__parameter-row {
    grid-template-columns: 1fr;
  }
}
</style>
