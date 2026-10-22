<template>
  <div class="mobile-template-editor" data-testid="mobile-template-editor">
    <template v-if="readonly">
      <div v-if="form.isAdvanced" class="mobile-template-messages">
        <section v-for="(message, index) in form.messages" :key="index" class="mobile-template-message">
          <span class="mobile-template-role">{{ roleLabel(message.role) }}</span>
          <pre>{{ message.content }}</pre>
        </section>
      </div>
      <pre v-else class="mobile-template-body">{{ form.content }}</pre>
      <details v-if="form.description" class="mobile-template-options">
        <summary>{{ t('common.description') }}</summary>
        <p>{{ form.description }}</p>
      </details>
    </template>

    <template v-else>
      <label class="mobile-template-field">
        <span>{{ t('template.name') }}</span>
        <NInput :value="form.name" :disabled="saving" :placeholder="t('template.namePlaceholder')" :aria-label="t('templateManager.nameAriaLabel')" @update:value="patch({ name: $event })" />
      </label>
      <details class="mobile-template-options">
        <summary>{{ t('templateManager.templateFormat') }} · {{ form.isAdvanced ? t('templateManager.advancedTemplate') : t('templateManager.simpleTemplate') }}</summary>
        <div class="mobile-template-format">
          <NButton :disabled="saving" :type="!form.isAdvanced ? 'primary' : 'default'" @click="patch({ isAdvanced: false })">{{ t('templateManager.simpleTemplate') }}</NButton>
          <NButton :disabled="saving" :type="form.isAdvanced ? 'primary' : 'default'" @click="patch({ isAdvanced: true })">{{ t('templateManager.advancedTemplate') }}</NButton>
        </div>
        <p>{{ form.isAdvanced ? t('templateManager.advancedTemplateHint') : t('templateManager.simpleTemplateHint') }}</p>
      </details>
      <label v-if="!form.isAdvanced" class="mobile-template-field">
        <span>{{ t('template.content') }}</span>
        <NInput :value="form.content" type="textarea" :disabled="saving" :autosize="{ minRows: 10, maxRows: 18 }" :placeholder="t('template.contentPlaceholder')" :aria-label="t('templateManager.contentAriaLabel')" @update:value="patch({ content: $event })" />
      </label>
      <div v-else class="mobile-template-messages">
        <section v-for="(message, index) in form.messages" :key="index" class="mobile-template-message">
          <div class="mobile-template-message-heading">
            <NSelect :value="message.role" :disabled="saving" :options="roleOptions" :aria-label="t('templateManager.messageTemplates')" @update:value="updateMessage(index, { role: $event })" />
            <NDropdown trigger="click" :options="messageActions(index)" @select="key => onMessageAction(key, index)">
              <NButton quaternary :disabled="saving" :aria-label="t('common.actions')">···</NButton>
            </NDropdown>
          </div>
          <NInput :value="message.content" type="textarea" :disabled="saving" :autosize="{ minRows: 6, maxRows: 16 }" :placeholder="t('templateManager.messageContentPlaceholder')" :aria-label="`${roleLabel(message.role)} · ${t('template.content')}`" @update:value="updateMessage(index, { content: $event })" />
        </section>
        <NButton dashed block :disabled="saving" @click="$emit('add-message')">{{ t('templateManager.addMessage') }}</NButton>
      </div>
      <details class="mobile-template-options">
        <summary>{{ t('common.description') }}</summary>
        <NInput :value="form.description" type="textarea" :disabled="saving" :autosize="{ minRows: 2, maxRows: 5 }" :placeholder="t('template.descriptionPlaceholder')" :aria-label="t('templateManager.descriptionAriaLabel')" @update:value="patch({ description: $event })" />
      </details>
    </template>

    <details v-if="form.isAdvanced && preview.length" class="mobile-template-options">
      <summary>{{ t('templateManager.preview') }}</summary>
      <div v-for="(message, index) in preview" :key="index" class="mobile-template-message">
        <span class="mobile-template-role">{{ roleLabel(message.role) }}</span>
        <pre>{{ message.content }}</pre>
      </div>
    </details>
    <NButton text class="mobile-template-help" @click="$emit('syntax')">{{ t('templateManager.syntaxGuide') }}</NButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NDropdown, NInput, NSelect } from 'naive-ui'
import type { MessageTemplate } from '@prompt-optimizer/core'

interface TemplateDraft {
  name: string
  content: string
  description: string
  isAdvanced: boolean
  messages: MessageTemplate[]
}
const props = defineProps<{
  form: TemplateDraft
  readonly: boolean
  saving: boolean
  preview: Array<{ role: string; content: string }>
}>()
const emit = defineEmits<{
  'update:form': [form: TemplateDraft]
  'add-message': []
  'remove-message': [index: number]
  'move-message': [index: number, direction: number]
  syntax: []
}>()
const { t } = useI18n()
const roleOptions = computed(() => [
  { value: 'system', label: t('templateManager.roleSystem') },
  { value: 'user', label: t('templateManager.roleUser') },
  { value: 'assistant', label: t('templateManager.roleAssistant') },
])
const roleLabel = (role: string) => roleOptions.value.find(option => option.value === role)?.label ?? role
const patch = (changes: Partial<TemplateDraft>) => emit('update:form', { ...props.form, ...changes })
const updateMessage = (index: number, changes: Partial<MessageTemplate>) => patch({
  messages: props.form.messages.map((message, i) => i === index ? { ...message, ...changes } : message),
})
const messageActions = (index: number) => [
  { key: 'up', label: t('templateManager.moveUp'), disabled: index === 0 },
  { key: 'down', label: t('templateManager.moveDown'), disabled: index === props.form.messages.length - 1 },
  { key: 'delete', label: t('templateManager.removeMessage') },
]
const onMessageAction = (key: string | number, index: number) => {
  if (key === 'up') emit('move-message', index, -1)
  else if (key === 'down') emit('move-message', index, 1)
  else if (key === 'delete') emit('remove-message', index)
}
</script>

<style scoped>
.mobile-template-editor, .mobile-template-messages {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.mobile-template-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
}
.mobile-template-editor pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: 14px;
  line-height: 1.65;
  margin: 0;
}
.mobile-template-message {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.mobile-template-role {
  font-size: 12px;
  font-weight: 600;
  color: var(--compact-muted);
}
.mobile-template-message-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}
.mobile-template-options {
  font-size: 12px;
  color: var(--compact-muted);
  border-bottom: 1px solid var(--compact-border);
  padding-bottom: 10px;
}
.mobile-template-options summary {
  cursor: pointer;
  min-height: 28px;
  line-height: 28px;
}
.mobile-template-options p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.mobile-template-options[open] > :not(summary) {
  margin-top: 8px;
}
.mobile-template-format {
  display: flex;
  gap: 8px;
}
.mobile-template-help {
  align-self: flex-start;
  font-size: 12px;
}
</style>
