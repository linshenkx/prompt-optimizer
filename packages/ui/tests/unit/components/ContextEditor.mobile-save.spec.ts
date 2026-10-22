import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import ContextEditor from '../../../src/components/context-mode/ContextEditor.vue'

const layout = vi.hoisted(() => ({ compact: true }))
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: computed(() => layout.compact) }),
}))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../../src/composables/performance/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({ recordUpdate: vi.fn() }),
}))
vi.mock('../../../src/composables/variable/useTemporaryVariables', () => ({
  useTemporaryVariables: () => ({ listVariables: () => ({}), temporaryVariables: ref({}) }),
}))
vi.mock('../../../src/composables/variable/useAggregatedVariables', () => ({
  useAggregatedVariables: () => ({ allVariables: ref({}), variablesBySource: ref({ predefined: {}, global: {}, temporary: {} }) }),
}))

let wrapper: ReturnType<typeof shallowMount> | undefined
afterEach(() => { wrapper?.unmount(); vi.useRealTimers() })

async function mountEditor(compact = true) {
  layout.compact = compact
  vi.useFakeTimers()
  wrapper = shallowMount(ContextEditor, {
    props: {
      visible: true,
      state: { messages: [{ role: 'system', content: 'System' }, { role: 'user', content: 'Original' }], variables: {}, tools: [], showVariablePreview: true, showToolManager: false, mode: 'edit' },
      scanVariables: () => [], replaceVariables: (text: string) => text,
      isPredefinedVariable: () => false,
      variableManager: { customVariables: ref({}), allVariables: ref({}), getVariable: () => undefined } as any,
    },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        AdaptiveModal: { template: '<div><slot /><slot name="action" /></div>' },
        Button: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
        VariableAwareInput: { name: 'VariableAwareInput', props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
      },
    },
  })
  // The parent opens its persistent editor by replacing the state prop.
  await wrapper.setProps({ state: { ...wrapper.props('state'), messages: [{ role: 'system', content: 'System' }, { role: 'user', content: 'Original' }] } })
  return wrapper
}

function save(editor: Awaited<ReturnType<typeof mountEditor>>) {
  const button = editor.findAll('button').find(item => /保存|Save|common.save/.test(item.text()))
  expect(button).toBeDefined()
  return button!.trigger('click')
}

describe('ContextEditor compact save', () => {
  it('saves the final pasted message without waiting for the debounce', async () => {
    const editor = await mountEditor()
    await editor.findAll('textarea')[1].setValue('酒店在龙翔桥附近，上午十点出发。')
    await save(editor)
    expect((editor.emitted('save')![0][0] as any).messages[1].content).toBe('酒店在龙翔桥附近，上午十点出发。')
  })

  it('keeps rapid edits to different messages before saving', async () => {
    const editor = await mountEditor()
    await editor.findAll('textarea')[0].setValue('Updated system')
    await editor.findAll('textarea')[1].setValue('Updated user')
    await save(editor)
    expect((editor.emitted('save')![0][0] as any).messages.map((item: any) => item.content)).toEqual(['Updated system', 'Updated user'])
  })

  it('keeps the existing deferred desktop update path', async () => {
    const editor = await mountEditor(false)
    await editor.findAll('textarea')[1].setValue('Desktop edit')
    expect(editor.emitted('contextChange')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(350)
    await save(editor)
    expect((editor.emitted('save')![0][0] as any).messages[1].content).toBe('Desktop edit')
  })
})
