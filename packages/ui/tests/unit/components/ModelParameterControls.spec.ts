import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { NDropdown, NInput, NInputNumber, NMessageProvider, NModal, NSelect } from 'naive-ui'
import { createImageAdapterRegistry, createTextAdapterRegistry, decodeImageModelSelection, decodeTextModelSelection, encodeImageModelSelection, encodeTextModelSelection, type ImageModelConfig, type TextModelConfig } from '@prompt-optimizer/core'
import { h, ref } from 'vue'
import ModelParameterControls from '../../../src/components/ModelParameterControls.vue'
import ModelAdvancedSection from '../../../src/components/ModelAdvancedSection.vue'
import TextModelSelector from '../../../src/components/TextModelSelector.vue'
import ImageModelSelector from '../../../src/components/ImageModelSelector.vue'
import ModelSelector from '../../../src/components/ModelSelector.vue'
import ModelParameterEditor from '../../../src/components/ModelParameterEditor.vue'

const editor = (wrapper: ReturnType<typeof mount>) => wrapper.findAllComponents(ModelParameterControls).find(component => component.props('presentation') === 'editor')!
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = '' })

describe('workspace model parameter controls', () => {
  it('keeps a pinned image model and its schema after the saved configuration changes models', async () => {
    const registry = createImageAdapterRegistry()
    const adapter = registry.getAdapter('openai')
    const original = adapter.buildDefaultModel('gpt-image-2.6-flare')
    const resolvedOriginal = adapter.getModels().find(model => model.id === original.id) || original
    const replacement = adapter.buildDefaultModel('gpt-image-2.5-flare')
    const config: ImageModelConfig = { id: 'image', name: 'Image', enabled: true, providerId: 'openai',
      modelId: original.id, model: original, provider: adapter.getProvider(), paramOverrides: { output_format: 'png' } }
    const key = encodeImageModelSelection(config.id, original.id, { output_format: 'gif' })
    const wrapper = mount(ImageModelSelector, { props: { parameters: true, modelValue: key,
      options: [{ value: config.id, primary: config.name, raw: config }] },
      global: { provide: { services: ref({ imageAdapterRegistry: registry }) } } })
    wrappers.push(wrapper)
    await wrapper.setProps({ options: [{ value: config.id, primary: config.name,
      raw: { ...config, modelId: replacement.id, model: replacement } }] })
    expect(wrapper.get('.text-model-selector').text()).toContain(resolvedOriginal.name)
    expect(wrapper.getComponent(ModelSelector).props('modelValue')).toBe(encodeImageModelSelection(config.id, original.id))
    expect(wrapper.findComponent(ModelParameterControls).props('definitions')).toEqual(resolvedOriginal.parameterDefinitions)
    const choices = wrapper.getComponent(ModelSelector).props('groups')[0].choices
    expect(choices).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: config.id, label: replacement.name }),
      expect.objectContaining({ value: encodeImageModelSelection(config.id, original.id), label: resolvedOriginal.name }),
    ]))
    wrapper.getComponent(ModelSelector).vm.$emit('update:modelValue', config.id)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([config.id])
    await wrapper.get('.text-model-selector').trigger('click')
    await flushPromises()
    editor(wrapper).vm.$emit('update:modelValue', {})
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([encodeImageModelSelection(config.id, original.id)])
    expect(config.modelId).toBe(original.id)
  })

  it('exposes inherited custom JSON and changes only the parameter selected for override', async () => {
    const inherited = { temperature: 0.7, response_format: { type: 'json_schema', schema: {
      properties: { password: { type: 'string' }, optional: { default: null } },
    } } }
    const local = ref<Record<string, unknown>>({ seed: 42 })
    const root = mount(NMessageProvider, { slots: { default: () => h(ModelAdvancedSection, { embedded: true,
      mode: 'text', providerType: 'custom', inherited, paramOverrides: local.value,
      'onUpdate:paramOverrides': (value: Record<string, unknown>) => { local.value = value },
      parameterDefinitions: [{ name: 'temperature', type: 'number' }] }) } })
    wrappers.push(root)
    const wrapper = root.getComponent(ModelAdvancedSection)
    expect(wrapper.emitted('update:paramOverrides')).toBeUndefined()
    const entry = wrapper.get('[data-testid="inherited-param-response_format"]')
    expect(entry.text()).toContain('response_format')
    expect(entry.text()).toContain('json_schema')
    await entry.get('button').trigger('click')
    expect(wrapper.emitted('update:paramOverrides')?.at(-1)).toEqual([{ seed: 42, response_format: inherited.response_format }])
    expect(inherited.temperature).toBe(0.7)
    expect(wrapper.getComponent(ModelParameterEditor).props('paramOverrides')).toEqual({ seed: 42, response_format: inherited.response_format })
    expect(wrapper.find('[data-testid="inherited-param-response_format"]').exists()).toBe(false)
    await wrapper.getComponent(ModelParameterEditor).get('button[aria-label="Use inherited value response_format"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:paramOverrides')?.at(-1)).toEqual([{ seed: 42 }])
    expect(wrapper.find('[data-testid="inherited-param-response_format"]').exists()).toBe(true)
  })

  it('allows the raw thinking fields to be adjusted and inherited independently in other parameters', async () => {
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'independent', providerId: 'custom',
      definitions: [{ name: 'enable_thinking', type: 'boolean' },
        { name: 'reasoning_effort', type: 'string', allowedValues: ['low', 'high'] }],
      inherited: { enable_thinking: true, reasoning_effort: 'low' },
      modelValue: { enable_thinking: false, reasoning_effort: 'high', temperature: 0.3 } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    await wrapper.get('[data-testid="local-parameters-more"]').trigger('click')
    const advanced = wrapper.getComponent(ModelAdvancedSection)
    expect(advanced.props('parameterDefinitions').map((definition: any) => definition.name)).toEqual(['enable_thinking', 'reasoning_effort'])
    expect(advanced.props('inherited')).toEqual({ enable_thinking: true, reasoning_effort: 'low' })
    expect(advanced.props('paramOverrides')).toEqual({ enable_thinking: false, reasoning_effort: 'high', temperature: 0.3 })
    advanced.vm.$emit('update:param-overrides', { reasoning_effort: 'high', temperature: 0.3 })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ reasoning_effort: 'high', temperature: 0.3 }])
  })

  it('edits custom JSON inline when embedded in the model menu', async () => {
    const root = mount(NMessageProvider, { slots: { default: () => h(ModelAdvancedSection, { embedded: true, mode: 'text', providerType: 'custom' }) } })
    wrappers.push(root)
    const wrapper = root.getComponent(ModelAdvancedSection)
    wrapper.getComponent(NDropdown).vm.$emit('select', '__custom__')
    await flushPromises()
    expect(wrapper.findComponent(NModal).exists()).toBe(false)
    const form = wrapper.get('[data-testid="embedded-custom-parameter"]')
    const inputs = form.findAllComponents(NInput)
    inputs[0].vm.$emit('update:value', 'response_format')
    inputs[1].vm.$emit('update:value', '{"type":"json_object"}')
    await form.get('[data-testid="custom-parameter-add"]').trigger('click')
    expect(wrapper.emitted('update:paramOverrides')?.at(-1)).toEqual([{ response_format: { type: 'json_object' } }])
    expect(wrapper.find('[data-testid="embedded-custom-parameter"]').exists()).toBe(false)
  })

  it('keeps animation options absent until configured and restores inheritance without inserting defaults', async () => {
    const model = createImageAdapterRegistry().getAdapter('openai').buildDefaultModel('gpt-image-2.6-flare')
    const wrapper = mount(ModelParameterControls, { props: { mode: 'image', modelKey: 'image', providerId: 'openai',
      definitions: model.parameterDefinitions, inherited: { output_format: 'png', size: 'auto' }, modelValue: {} },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.findAllComponents(NSelect)).toHaveLength(2)
    await wrapper.find('[data-testid="local-parameters-more"]').trigger('click')
    await flushPromises()
    wrapper.findAllComponents(NSelect)[0].vm.$emit('update:value', '__value__:gif')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ output_format: 'gif' }])
    await wrapper.setProps({ modelValue: { output_format: 'gif', frame_count: 6 } })
    await flushPromises()
    const advanced = wrapper.findComponent(ModelAdvancedSection)
    expect(advanced.props('parameterDefinitions').map((definition: any) => definition.name)).toContain('frame_count')
    expect(advanced.props('parameterDefinitions').map((definition: any) => definition.name)).not.toContain('output_format')
    advanced.vm.$emit('update:param-overrides', { frame_count: 8 })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ output_format: 'gif', frame_count: 8 }])
    wrapper.findAllComponents(NSelect)[0].vm.$emit('update:value', '__inherit__')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ frame_count: 6 }])
  })

  it('selects a supported effort directly and enables thinking in the same change', async () => {
    const definitions = createTextAdapterRegistry().getAdapter('deepseek').buildDefaultModel('deepseek-v4-flash').parameterDefinitions
    const wrapper = mount(ModelParameterControls, { attachTo: document.body, props: { mode: 'text', modelKey: 'text', providerId: 'deepseek',
      definitions, inherited: { thinking_type: 'disabled' } }, global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    await wrapper.get('[data-testid="local-reasoning-select"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAllComponents(NSelect)).toHaveLength(1)
    expect(document.querySelector('.local-model-parameters__panel')).toBeNull()
    const dropdown = wrapper.getComponent(NSelect)
    expect(dropdown.props('options').map((option: any) => option.value)).toEqual(['__inherit__', '__off__', 'high', 'max'])
    dropdown.vm.$emit('update:value', 'max')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ thinking_type: 'enabled', reasoning_effort: 'max' }])
    await wrapper.setProps({ modelValue: { thinking_type: 'enabled', reasoning_effort: 'max' } })
    dropdown.vm.$emit('update:value', '__off__')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ thinking_type: 'disabled', reasoning_effort: 'max' }])
  })

  it.each(['reasoning_effort', 'thinkingLevel', 'effort'])('uses the model-defined levels for %s without changing other parameters', async name => {
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'model', providerId: 'custom',
      definitions: [{ name, type: 'string', allowedValues: ['low', 'high'] }], modelValue: { temperature: 0.3 } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    const dropdown = wrapper.getComponent(NSelect)
    expect(dropdown.props('options').map((option: any) => option.value)).toEqual(['__inherit__', 'low', 'high'])
    dropdown.vm.$emit('update:value', 'high')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ temperature: 0.3, [name]: 'high' }])
  })

  it('shows the inherited reasoning value and restores it without clearing other local parameters', () => {
    const definitions = createTextAdapterRegistry().getAdapter('deepseek').buildDefaultModel('deepseek-v4-flash').parameterDefinitions
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'model', providerId: 'deepseek', definitions,
      inherited: { thinking_type: 'enabled', reasoning_effort: 'high' },
      modelValue: { temperature: 0.3, thinking_type: 'enabled', reasoning_effort: 'max' } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    expect(wrapper.getComponent(NSelect).props('value')).toBe('max')
    expect(wrapper.getComponent(NSelect).props('options')[0].label).toBe('Default (High)')
    wrapper.getComponent(NSelect).vm.$emit('update:value', '__inherit__')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ temperature: 0.3 }])
  })

  it.each(['thinking_budget_tokens', 'thinkingBudget', 'thinking_budget'])('prioritizes %s over temperature and edits its native budget without inventing effort levels', async name => {
    const inherited = { temperature: 0.7, [name]: 4096 }
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'budget-model', providerId: 'custom',
      definitions: [{ name: 'temperature', type: 'number', minValue: 0, maxValue: 2 },
        { name, type: 'integer', minValue: 1024, maxValue: 8192, step: 512 }], inherited, modelValue: { seed: 42 } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    expect(wrapper.find('[data-testid="local-reasoning-select"]').exists()).toBe(false)
    expect(wrapper.getComponent(NInputNumber).props('value')).toBe(4096)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('[data-testid="local-parameters-more"]').trigger('click')
    await flushPromises()
    const inputs = wrapper.findAllComponents(NInputNumber)
    expect(inputs).toHaveLength(1)
    expect(inputs[0].props()).toMatchObject({ value: 4096, min: 1024, max: 8192, step: 512 })
    inputs[0].vm.$emit('update:value', 2048)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ seed: 42, [name]: 2048 }])
    await wrapper.setProps({ modelValue: { seed: 42, [name]: 2048 } })
    inputs[0].vm.$emit('update:value', null)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ seed: 42 }])
    expect(wrapper.getComponent(ModelAdvancedSection).props('parameterDefinitions').map((definition: any) => definition.name)).toContain('temperature')
    expect(inherited).toEqual({ temperature: 0.7, [name]: 4096 })
  })

  it.each([
    { name: 'enable_thinking', type: 'boolean' as const, on: true, off: false },
    { name: 'thinking_type', type: 'string' as const, allowedValues: ['disabled', 'enabled'], on: 'enabled', off: 'disabled' },
  ])('offers only on/off and inheritance when $name has no effort levels', ({ name, type, allowedValues, on, off }) => {
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'toggle-only', providerId: 'custom',
      definitions: [{ name, type, allowedValues }], inherited: { [name]: on }, modelValue: { temperature: 0.3 } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    const dropdown = wrapper.getComponent(NSelect)
    expect(dropdown.props('options').map((option: any) => option.value)).toEqual(['__inherit__', '__off__', '__on__'])
    dropdown.vm.$emit('update:value', '__off__')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ temperature: 0.3, [name]: off }])
    dropdown.vm.$emit('update:value', '__inherit__')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ temperature: 0.3 }])
  })

  it('uses existing non-reasoning enum choices and restores only that parameter to inheritance', async () => {
    const custom = { response_format: { type: 'json_schema', schema: { required: ['answer'] } } }
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'custom', providerId: 'custom',
      definitions: [{ name: 'response_mode', type: 'string', allowedValues: ['strict', 'creative'],
        allowedValueLabelKeys: ['common.enabled', 'common.disabled'] }],
      inherited: { response_mode: 'strict' }, modelValue: { temperature: 0.3, ...custom } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('[data-testid="local-param-response_mode"]').exists()).toBe(true)
    const dropdown = wrapper.getComponent(NSelect)
    const options = dropdown.props('options') as Array<{ value: string; label: string }>
    expect(options.map(option => option.value)).toEqual(['__inherit__', '__value__:strict', '__value__:creative'])
    expect(options[1].label).toBe('Enabled')
    dropdown.vm.$emit('update:value', '__value__:creative')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ temperature: 0.3, ...custom, response_mode: 'creative' }])
    await wrapper.setProps({ modelValue: { temperature: 0.3, ...custom, response_mode: 'creative' } })
    dropdown.vm.$emit('update:value', '__inherit__')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ temperature: 0.3, ...custom }])
    await wrapper.get('[data-testid="local-parameters-more"]').trigger('click')
    await flushPromises()
    const editor = wrapper.getComponent(ModelAdvancedSection)
    expect(editor.props('parameterDefinitions')).toEqual([])
    expect(editor.props('paramOverrides')).toEqual({ temperature: 0.3, ...custom })
    editor.vm.$emit('update:param-overrides', { temperature: 0.4, ...custom })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ response_mode: 'creative', temperature: 0.4, ...custom }])
  })

  it('keeps arbitrary boolean parameters boolean and preserves unrelated settings', () => {
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'boolean', providerId: 'custom',
      definitions: [{ name: 'stream_output', type: 'boolean' }], inherited: { stream_output: true },
      modelValue: { max_tokens: 4096, custom: { enabled: false } } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    const dropdown = wrapper.getComponent(NSelect)
    expect(dropdown.props('options').map((option: any) => option.value)).toEqual(['__inherit__', '__value__:true', '__value__:false'])
    dropdown.vm.$emit('update:value', '__value__:false')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ max_tokens: 4096, custom: { enabled: false }, stream_output: false }])
  })

  it.each([
    { name: 'format', type: 'string' as const, allowedValues: ['__inherit__', '__advanced__'], choice: '__inherit__', expected: '__inherit__' },
    { name: 'top_k', type: 'integer' as const, allowedValues: ['1', '8'], choice: '8', expected: 8 },
  ])('preserves the value and type of $name without confusing it with menu actions', ({ name, type, allowedValues, choice, expected }) => {
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: name, providerId: 'custom',
      definitions: [{ name, type, allowedValues }], modelValue: { extension: { enabled: false } } },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    wrapper.getComponent(NSelect).vm.$emit('update:value', '__value__:' + choice)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ extension: { enabled: false }, [name]: expected }])
  })

  it('edits numeric settings with their existing bounds and keeps inherited values out of local overrides', async () => {
    const inherited = { temperature: 0.7, max_tokens: 4096 }
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'numbers', providerId: 'custom',
      definitions: [{ name: 'temperature', type: 'number', min: 0, max: 2, step: 0.05 },
        { name: 'max_tokens', type: 'integer', minValue: 1, maxValue: 8192 }], inherited,
      modelValue: { custom: { enabled: false } } }, global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    expect(wrapper.getComponent(NInputNumber).props('value')).toBe(0.7)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('[data-testid="local-parameters-more"]').trigger('click')
    await flushPromises()
    const inputs = wrapper.findAllComponents(NInputNumber)
    expect(inputs).toHaveLength(1)
    expect(inputs[0].props()).toMatchObject({ value: 0.7, min: 0, max: 2, step: 0.05 })
    expect(wrapper.getComponent(ModelAdvancedSection).props('parameterDefinitions')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'max_tokens', minValue: 1, maxValue: 8192 })]))
    inputs[0].vm.$emit('update:value', 0)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ custom: { enabled: false }, temperature: 0 }])
    await wrapper.setProps({ modelValue: { custom: { enabled: false }, temperature: 0 } })
    inputs[0].vm.$emit('update:value', null)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ custom: { enabled: false } }])
    expect(inherited).toEqual({ temperature: 0.7, max_tokens: 4096 })
  })

  it('edits plain text while leaving arrays and custom JSON in the existing editor', async () => {
    const custom = { extension: { options: ['a', 'b'], enabled: false }, stop: ['END'] }
    const wrapper = mount(ModelParameterControls, { props: { mode: 'text', modelKey: 'text-values', providerId: 'custom',
      definitions: [{ name: 'prefix', type: 'string', sendEmptyString: true },
        { name: 'stop', type: 'string', tags: ['string-array'] }], inherited: { prefix: 'Configured prefix' }, modelValue: custom },
      global: { stubs: { ModelAdvancedSection: true } } })
    wrappers.push(wrapper)
    await wrapper.get('[data-testid="local-parameters-more"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAllComponents(NInputNumber)).toHaveLength(0)
    const input = wrapper.getComponent(NInput)
    input.vm.$emit('update:value', 'Keep spacing ')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ ...custom, prefix: 'Keep spacing ' }])
    input.vm.$emit('update:value', '')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ ...custom, prefix: '' }])
    input.vm.$emit('update:value', '__inherit__')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ ...custom, prefix: '__inherit__' }])
    const editor = wrapper.getComponent(ModelAdvancedSection)
    expect(editor.props('parameterDefinitions').map((definition: any) => definition.name)).toEqual(['stop'])
    expect(editor.props('paramOverrides')).toEqual(custom)
    await wrapper.setProps({ modelValue: { ...custom, prefix: 'Local prefix' } })
    editor.vm.$emit('update:param-overrides', { extension: { options: ['c'], enabled: true }, stop: ['DONE'] })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ prefix: 'Local prefix', extension: { options: ['c'], enabled: true }, stop: ['DONE'] }])
  })

  it('restores independent text selections from persisted values and changes only the selected column', async () => {
    const registry = createTextAdapterRegistry()
    const adapter = registry.getAdapter('openai')
    const model = adapter.getModels()[0]
    const config: TextModelConfig = { id: 'connection', name: 'Connection', enabled: true, providerMeta: adapter.getProvider(), modelMeta: model,
      connectionConfig: { apiKey: 'private-key' }, paramOverrides: { reasoning_effort: 'none' } }
    const options = [{ value: config.id, primary: config.name, secondary: 'OpenAI', raw: config }]
    const a = mount(TextModelSelector, { props: { parameters: true, options,
      modelValue: encodeTextModelSelection(config.id, model.id, { reasoning_effort: 'high' }) },
      global: { provide: { services: ref({ textAdapterRegistry: registry, llmService: { fetchModelList: async () => [] } }) } } })
    const b = mount(TextModelSelector, { props: { parameters: true, options, modelValue: config.id },
      global: { provide: { services: ref({ textAdapterRegistry: registry, llmService: { fetchModelList: async () => [] } }) } } })
    wrappers.push(a, b)
    expect(a.findComponent(ModelParameterControls).props('modelValue')).toEqual({ reasoning_effort: 'high' })
    expect(b.findComponent(ModelParameterControls).props('modelValue')).toEqual({})
    await a.get('.text-model-selector').trigger('click')
    await b.get('.text-model-selector').trigger('click')
    await flushPromises()
    editor(a).getComponent(NSelect).vm.$emit('update:value', 'low')
    const selection = a.emitted('update:modelValue')?.at(-1)?.[0] as string
    expect(decodeTextModelSelection(selection)?.paramOverrides).toEqual({ reasoning_effort: 'low' })
    expect(b.emitted('update:modelValue')).toBeUndefined()
    editor(b).getComponent(NSelect).vm.$emit('update:value', 'high')
    const otherSelection = b.emitted('update:modelValue')?.at(-1)?.[0] as string
    await a.setProps({ modelValue: selection })
    await b.setProps({ modelValue: otherSelection })
    expect(a.get('.text-model-selector').text()).toContain('Thinking · Low')
    expect(b.get('.text-model-selector').text()).toContain('Thinking · High')
    expect(decodeTextModelSelection(selection)?.modelId).toBe(decodeTextModelSelection(otherSelection)?.modelId)
    editor(a).getComponent(NSelect).vm.$emit('update:value', '__inherit__')
    expect(a.emitted('update:modelValue')?.at(-1)).toEqual([config.id])
    expect(b.findComponent(ModelParameterControls).props('modelValue')).toEqual({ reasoning_effort: 'high' })
    expect(config.paramOverrides).toEqual({ reasoning_effort: 'none' })
    expect(selection).not.toContain('private-key')
  })

  it('restores image controls and returns a plain configuration selection on reset', async () => {
    const adapter = createImageAdapterRegistry().getAdapter('openai')
    const model = adapter.buildDefaultModel('gpt-image-2.6-flare')
    const config: ImageModelConfig = { id: 'image', name: 'Image', enabled: true, providerId: 'openai', modelId: model.id,
      provider: adapter.getProvider(), model, paramOverrides: { output_format: 'png' } }
    const key = encodeImageModelSelection(config.id, model.id, { output_format: 'gif' })
    const wrapper = mount(ImageModelSelector, { props: { parameters: true, modelValue: key,
      options: [{ value: config.id, primary: config.name, raw: config }] } })
    wrappers.push(wrapper)
    expect(wrapper.text()).toContain(model.name)
    expect(wrapper.findComponent(ModelParameterControls).props('modelValue')).toEqual({ output_format: 'gif' })
    await wrapper.get('.text-model-selector').trigger('click')
    await flushPromises()
    editor(wrapper).vm.$emit('update:modelValue', { output_format: 'png', size: '1024x1024' })
    const changed = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string
    expect(decodeImageModelSelection(changed)?.paramOverrides).toEqual({ output_format: 'png', size: '1024x1024' })
    editor(wrapper).vm.$emit('update:modelValue', {})
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['image'])
  })
})
