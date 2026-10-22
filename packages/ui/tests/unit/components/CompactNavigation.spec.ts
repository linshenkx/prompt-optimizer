import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const routing = vi.hoisted(() => ({
  currentRoute: { value: { path: '/image/text2image', fullPath: '/image/text2image' } },
  push: vi.fn(async () => {}),
}))
const release = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('../../../src/router', () => ({ router: routing }))
vi.mock('../../../src/composables/ui/useCompactModalBack', () => ({ releaseCompactOverlayHistory: release }))
vi.mock('naive-ui', () => ({
  NButton: { template: '<button><slot name="icon" /><slot /></button>' },
  NIcon: { template: '<span><slot /></span>' },
  NBadge: { template: '<span />' },
}))
vi.mock('../../../src/components/common/AdaptiveModal.vue', () => ({ default: {
  props: ['show', 'title', 'presentation'], emits: ['update:show'],
  template: '<div v-if="show" role="dialog"><button data-testid="close-panel" @click="$emit(\'update:show\', false)">Close</button><slot /></div>',
} }))
vi.mock('../../../src/components/ThemeToggleUI.vue', () => ({ default: { template: '<button>Theme</button>' } }))
vi.mock('../../../src/components/LanguageSwitchDropdown.vue', () => ({ default: { template: '<button>Language</button>' } }))
vi.mock('../../../src/components/UpdaterIcon.vue', () => ({ default: { template: '<span />' } }))

import CompactNavigation from '../../../src/components/app-layout/CompactNavigation.vue'
const createNavigation = () => mount(CompactNavigation, { props: { workspacePath: '/image/text2image', appVersion: 'test' } })

beforeEach(() => {
  vi.clearAllMocks()
  routing.currentRoute.value = { path: '/image/text2image', fullPath: '/image/text2image' }
})

describe('mobile navigation panels', () => {
  it('shows all seven specific modes together, with noninteractive group headings', async () => {
    const wrapper = createNavigation()
    try {
      await wrapper.get('[data-testid="compact-mode-select"]').trigger('click')
      expect(wrapper.findAll('.compact-mode-choice')).toHaveLength(7)
      expect(wrapper.findAll('.compact-mode-group > h3')).toHaveLength(3)
      await wrapper.get('#compact-mode-group-pro').trigger('click')
      expect(routing.push).not.toHaveBeenCalled()
      expect(wrapper.findAll('.compact-mode-choice')).toHaveLength(7)
      expect(wrapper.get('[aria-current="page"]').attributes('data-testid')).toBe('compact-mode-image-text2image')
    } finally { wrapper.unmount() }
  })

  it('navigates directly to the chosen submode after releasing overlay history', async () => {
    const wrapper = createNavigation()
    try {
      await wrapper.get('[data-testid="compact-mode-select"]').trigger('click')
      await wrapper.get('[data-testid="compact-mode-pro-multi"]').trigger('click')
      await flushPromises()
      expect(release).toHaveBeenCalledOnce()
      expect(routing.push).toHaveBeenCalledExactlyOnceWith('/pro/multi')
      expect(release.mock.invocationCallOrder[0]).toBeLessThan(routing.push.mock.invocationCallOrder[0])
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })

  it.each(['current', 'cancel'])('closes without routing when selecting %s', async (action) => {
    const wrapper = createNavigation()
    try {
      await wrapper.get('[data-testid="compact-mode-select"]').trigger('click')
      await wrapper.get(action === 'current' ? '[data-testid="compact-mode-image-text2image"]' : '[data-testid="close-panel"]').trigger('click')
      await flushPromises()
      expect(routing.push).not.toHaveBeenCalled()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('returns from favorites to the explicitly chosen workspace', async () => {
    routing.currentRoute.value = { path: '/favorites', fullPath: '/favorites' }
    const wrapper = createNavigation()
    try {
      await wrapper.get('[data-testid="compact-mode-select"]').trigger('click')
      await wrapper.get('[data-testid="compact-mode-image-text2image"]').trigger('click')
      await flushPromises()
      expect(routing.push).toHaveBeenCalledExactlyOnceWith('/image/text2image')
    } finally { wrapper.unmount() }
  })

  it('keeps the six management actions and collapses help by default', async () => {
    const wrapper = createNavigation()
    try {
      await wrapper.get('[data-testid="compact-global-menu"]').trigger('click')
      expect(wrapper.findAll('.compact-function-tile')).toHaveLength(6)
      expect(wrapper.get('.compact-menu-help').attributes('open')).toBeUndefined()
      await wrapper.get('[data-testid="compact-menu-models"]').trigger('click')
      expect(wrapper.emitted('action')).toEqual([['models']])
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })
})
