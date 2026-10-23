// Keep management controllers and their mobile presentations real while replacing
// Naive's portals/animation only. Browser tests cover the actual overlay geometry.
const stubs = {
  NModal: {
    props: ['show', 'title', 'compactClass'],
    emits: ['update:show'],
    template: '<section v-if="show" class="test-modal"><header><slot name="header">{{ title }}</slot><slot name="header-extra" /></header><slot /><footer><slot name="footer" /><slot name="action" /></footer></section>',
  },
  NButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
  },
  NInput: {
    props: ['value', 'type', 'disabled', 'readonly', 'size'],
    emits: ['update:value'],
    template: '<textarea v-if="type === \'textarea\'" :value="value" :disabled="disabled" :readonly="readonly" @input="$emit(\'update:value\', $event.target.value)" /><input v-else :value="value" :disabled="disabled" :readonly="readonly" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  NSelect: {
    props: ['value', 'options', 'disabled', 'size'],
    emits: ['update:value'],
    template: '<select :value="value" :disabled="disabled" @change="$emit(\'update:value\', $event.target.value || null)"><option value="" /><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
  },
  NDropdown: {
    props: ['options'],
    emits: ['select'],
    template: '<div class="test-dropdown"><slot /><button v-for="option in options" :key="option.key" :disabled="option.disabled" :data-action="option.key" @click="$emit(\'select\', option.key)">{{ option.label }}</button></div>',
  },
  NCard: { template: '<article><slot name="header" /><slot name="header-extra" /><slot /><slot name="footer" /></article>' },
  NSpace: { template: '<div><slot /></div>' },
  NScrollbar: { template: '<div class="test-scrollbar"><slot /></div>' },
  NText: { template: '<span><slot /></span>' },
  NTag: { template: '<span><slot /></span>' },
  NGrid: { template: '<div><slot /></div>' },
  NGridItem: { template: '<div><slot /></div>' },
  NEl: { template: '<div><slot /></div>' },
  NEmpty: { props: ['description'], template: '<p>{{ description }}</p>' },
  NCollapse: { template: '<div><slot /></div>' },
  NCollapseItem: { template: '<div><slot name="header" /><slot name="header-extra" /><slot /></div>' },
  NDivider: true,
  NH3: { template: '<h3><slot /></h3>' },
  NH4: { template: '<h4><slot /></h4>' },
  NCode: { props: ['code', 'language'], template: '<pre>{{ code }}</pre>' },
  SourceAssetBadge: true,
  MarkdownRenderer: true,
  BuiltinTemplateLanguageSwitch: true,
}

// Naive exports NButton/NSelect but its runtime component names are Button/Select.
export const mobileManagementStubs = {
  ...stubs,
  ...Object.fromEntries(Object.entries(stubs).filter(([name]) => /^N[A-Z]/.test(name)).map(([name, stub]) => [name.slice(1), stub])),
}
