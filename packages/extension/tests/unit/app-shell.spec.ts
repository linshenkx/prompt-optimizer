import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@prompt-optimizer/ui', () => ({
  PromptOptimizerApp: defineComponent({
    name: 'PromptOptimizerApp',
    setup() {
      return () => h('main', { 'data-testid': 'prompt-optimizer-app' }, 'GlobalCloud XiaoC')
    },
  }),
}))

describe('extension app shell', () => {
  it('mounts the shared PromptOptimizerApp component', async () => {
    const { default: App } = await import('../../src/App.vue')
    const root = document.createElement('div')
    document.body.appendChild(root)

    const app = createApp(App)
    app.mount(root)

    expect(root.querySelector('[data-testid="prompt-optimizer-app"]')).not.toBeNull()

    app.unmount()
    root.remove()
  })
})
