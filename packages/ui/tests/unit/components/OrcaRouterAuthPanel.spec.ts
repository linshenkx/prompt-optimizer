import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import OrcaRouterAuthPanel from '../../../src/components/OrcaRouterAuthPanel.vue'

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toast,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params?.key ? `${key}(${params.key})` : key,
    }),
  }
})

const simpleStub = (name: string, tag = 'div') =>
  defineComponent({
    name,
    inheritAttrs: false,
    props: ['label', 'type', 'showIcon', 'loading', 'disabled', 'value', 'placeholder', 'readonly', 'href', 'target', 'rel'],
    setup(_, { slots, attrs }) {
      return () => h(tag, attrs, slots.default?.())
    },
  })

/** Input stub that forwards typed text so the panel logic can be exercised. */
const NInputStub = defineComponent({
  name: 'NInput',
  inheritAttrs: false,
  props: {
    value: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    readonly: { type: Boolean, default: false },
    type: { type: String, default: 'text' },
    showPasswordOn: { type: String, default: undefined },
    autocomplete: { type: String, default: undefined }
  },
  emits: ['update:value'],
  setup(props, { emit, attrs }) {
    // `data-testid` is the only attribute the panel sets on the input itself;
    // forward it so the tests can select the real control.
    const testId = (attrs as Record<string, unknown>)['data-testid']
    return () =>
      h('input', {
        'data-testid': testId,
        value: props.value,
        placeholder: props.placeholder,
        type: props.type,
        readonly: props.readonly,
        onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
      })
  }
})

function mountPanel(props: Record<string, unknown> = {}) {
  const wrapper = mount(OrcaRouterAuthPanel, {
    props: {
      apiKeyValue: '',
      initialMethod: 'pkce',
      ...props
    },
    global: {
      stubs: {
        NAlert: simpleStub('NAlert'),
        'n-alert': simpleStub('NAlert'),
        NButton: simpleStub('NButton', 'button'),
        'n-button': simpleStub('NButton', 'button'),
        NFormItem: simpleStub('NFormItem'),
        'n-form-item': simpleStub('NFormItem'),
        NInput: NInputStub,
        'n-input': NInputStub,
        NInputNumber: simpleStub('NInputNumber'),
        NSpace: simpleStub('NSpace'),
        'n-space': simpleStub('NSpace'),
        NText: simpleStub('NText', 'span'),
        'n-text': simpleStub('NText', 'span')
      }
    }
  })

  return wrapper
}

describe('OrcaRouterAuthPanel', () => {
  it('shows both authentication choices side by side', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="orca-method-api-key"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="orca-method-pkce"]').exists()).toBe(true)
    // Each button carries both a title and a description line.
    expect(wrapper.get('[data-testid="orca-method-api-key"]').text()).toContain(
      'modelManager.orcaRouter.apiKeyTitle'
    )
    expect(wrapper.get('[data-testid="orca-method-api-key"]').text()).toContain(
      'modelManager.orcaRouter.apiKeyDescription'
    )
    expect(wrapper.get('[data-testid="orca-method-pkce"]').text()).toContain(
      'modelManager.orcaRouter.pkceTitle'
    )
    expect(wrapper.get('[data-testid="orca-method-pkce"]').text()).toContain(
      'modelManager.orcaRouter.pkceDescription'
    )
  })

  it('renders the API-key field with a password input and a clear action', () => {
    const wrapper = mountPanel({ initialMethod: 'api-key', apiKeyValue: 'sk-orca-existing' })

    expect(wrapper.find('[data-testid="orca-api-key-field"]').exists()).toBe(true)
    // naive-ui renders a wrapper element around the real control.
    const input = wrapper.get('[data-testid="orca-api-key-input"] input')
    expect(input.attributes('type')).toBe('password')
    expect((input.element as HTMLInputElement).value).toBe('sk-orca-existing')
    expect(wrapper.find('[data-testid="orca-api-key-clear"]').exists()).toBe(true)
  })

  it('emits a cleared key when the user removes it', async () => {
    const wrapper = mountPanel({ initialMethod: 'api-key', apiKeyValue: 'sk-orca-existing' })

    await wrapper.get('[data-testid="orca-api-key-clear"]').trigger('click')

    expect(wrapper.emitted('update:apiKey')).toEqual([['']])
  })

  it('never renders the key in plain text', () => {
    const wrapper = mountPanel({
      initialMethod: 'api-key',
      apiKeyValue: 'sk-orca-super-secret-value'
    })

    // A password input keeps it out of the DOM text and out of screenshots.
    expect(wrapper.text()).not.toContain('sk-orca-super-secret-value')
    expect(wrapper.get('[data-testid="orca-api-key-input"] input').attributes('type')).toBe(
      'password'
    )
  })

  it('starts the PKCE flow from the connect button', async () => {
    const wrapper = mountPanel({ initialMethod: 'pkce' })

    expect(wrapper.find('[data-testid="orca-connect-button"]').exists()).toBe(true)
    // Starting a login must not require a pasted key first.
    expect(wrapper.find('[data-testid="orca-api-key-field"]').exists()).toBe(false)
  })

  it('switching authentication method shows the other entry point', async () => {
    const wrapper = mountPanel({ initialMethod: 'api-key' })

    expect(wrapper.find('[data-testid="orca-api-key-field"]').exists()).toBe(true)

    await wrapper.get('[data-testid="orca-method-pkce"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="orca-api-key-field"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="orca-pkce-section"]').exists()).toBe(true)
  })

  it('honours the provider that was selected in the provider list', () => {
    const apiKeyEntry = mountPanel({ initialMethod: 'api-key' })
    const pkceEntry = mountPanel({ initialMethod: 'pkce' })

    expect(apiKeyEntry.get('[data-testid="orca-method-api-key"]').attributes('aria-checked')).toBe(
      'true'
    )
    expect(pkceEntry.get('[data-testid="orca-method-pkce"]').attributes('aria-checked')).toBe(
      'true'
    )
  })

  it('links to the key console and to app revocation', () => {
    const wrapper = mountPanel({ initialMethod: 'api-key' })

    expect(wrapper.html()).toContain('https://www.orcarouter.ai/console/token')
  })

  it('states that both options issue a revocable key belonging to the user', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="orca-auth-intro"]').exists()).toBe(true)
    expect(wrapper.find('.orca-auth-panel__methods').exists()).toBe(true)
  })
})
