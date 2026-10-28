<template>
  <template v-if="node.kind === 'element'">
    <div v-if="hasChildren" class="xml-details">
      <NButton
        text
        class="xml-summary"
        :style="lineStyle"
        :aria-expanded="isExpanded"
        @click="toggleExpanded"
      >
        <template #icon>
          <NIcon class="xml-summary-icon" :class="{ 'xml-summary-icon--expanded': isExpanded }" :size="16">
            <ChevronRight />
          </NIcon>
        </template>
        <span class="xml-punct">&lt;</span>
        <span class="xml-tag">{{ node.name }}</span>
        <template v-for="attribute in node.attributes" :key="`${node.name || 'node'}:${attribute.name}`">
          <span class="xml-attr-space"> </span>
          <span class="xml-attr-name">{{ attribute.name }}</span>
          <span class="xml-punct">=</span>
          <span class="xml-attr-value">"{{ attribute.value }}"</span>
        </template>
        <span class="xml-punct">&gt;</span>
      </NButton>

      <template v-if="isExpanded">
        <XmlTreeNode
          v-for="(child, childIndex) in node.children"
          :key="buildChildKey(child, childIndex)"
          :node="child"
          :depth="depth + 1"
          :default-expanded-depth="defaultExpandedDepth"
        />

        <div class="xml-line xml-closing" :style="lineStyle">
          <span class="xml-punct">&lt;/</span>
          <span class="xml-tag">{{ node.name }}</span>
          <span class="xml-punct">&gt;</span>
        </div>
      </template>
    </div>

    <div v-else class="xml-line" :style="lineStyle">
      <span class="xml-punct">&lt;</span>
      <span class="xml-tag">{{ node.name }}</span>
      <template v-for="attribute in node.attributes" :key="`${node.name || 'node'}:${attribute.name}`">
        <span class="xml-attr-space"> </span>
        <span class="xml-attr-name">{{ attribute.name }}</span>
        <span class="xml-punct">=</span>
        <span class="xml-attr-value">"{{ attribute.value }}"</span>
      </template>
      <span class="xml-punct"> /&gt;</span>
    </div>
  </template>

  <div v-else-if="node.kind === 'text'" class="xml-line xml-text-node" :style="lineStyle">
    {{ node.value }}
  </div>

  <div v-else-if="node.kind === 'comment'" class="xml-line xml-comment" :style="lineStyle">
    &lt;!-- {{ node.value }} --&gt;
  </div>

  <div v-else-if="node.kind === 'cdata'" class="xml-line xml-cdata" :style="lineStyle">
    &lt;![CDATA[{{ node.value }}]]&gt;
  </div>

  <div v-else-if="node.kind === 'processing'" class="xml-line xml-processing" :style="lineStyle">
    &lt;?{{ node.name }} {{ node.value }}?&gt;
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { ChevronRight } from '@lucide/vue'
import type { XmlNodeModel } from '../../types/xml-renderer'

defineOptions({
  name: 'XmlTreeNode',
})

const props = withDefaults(
  defineProps<{
    node: XmlNodeModel
    depth: number
    defaultExpandedDepth?: number
  }>(),
  {
    defaultExpandedDepth: 1,
  },
)

const hasChildren = computed(
  () => props.node.kind === 'element' && Array.isArray(props.node.children) && props.node.children.length > 0,
)

const isOpenByDefault = computed(() => props.depth < props.defaultExpandedDepth)
const isExpanded = ref(isOpenByDefault.value)

const lineStyle = computed(() => ({
  paddingLeft: `${props.depth * 16}px`,
}))

const buildChildKey = (child: XmlNodeModel, index: number): string => {
  if (child.kind === 'element' && child.name) {
    return `${child.kind}:${child.name}:${index}`
  }
  if (child.kind === 'processing' && child.name) {
    return `${child.kind}:${child.name}:${index}`
  }
  return `${child.kind}:${index}`
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<style scoped>
.xml-details {
  margin: 0;
  padding: 0;
}

.xml-summary,
.xml-line {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

.xml-summary {
  cursor: pointer;
  user-select: none;
  width: 100%;
  justify-content: flex-start;
}

.xml-summary:hover {
  background-color: var(--n-hover-color);
}

.xml-summary :deep(.n-button__content) {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  min-width: 0;
}

.xml-summary-icon {
  color: var(--n-text-color-3);
  transition: transform 0.15s ease;
}

.xml-summary-icon--expanded {
  transform: rotate(90deg);
}

.xml-punct {
  color: var(--n-text-color-3);
}

.xml-tag {
  color: var(--n-primary-color);
  font-weight: 600;
}

.xml-attr-name {
  color: var(--n-info-color);
}

.xml-attr-value {
  color: var(--n-warning-color);
}

.xml-text-node {
  color: var(--n-text-color);
}

.xml-comment {
  color: var(--n-text-color-3);
  font-style: italic;
}

.xml-cdata,
.xml-processing {
  color: var(--n-text-color-2);
}
</style>
