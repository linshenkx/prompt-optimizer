import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { NTree, NTreeSelect } from 'naive-ui'
import CategoryManager from '../../../src/components/CategoryManager.vue'
import { FavoriteManager } from '../../../../core/src/services/favorite/manager'
import { MemoryStorageProvider } from '../../../../core/src/services/storage/memoryStorageProvider'
import { FavoriteManagerElectronProxy } from '../../../../core/src/services/favorite/electron-proxy'
import { createDesktopServiceBridge } from '../../../../core/tests/utils/desktop-service-bridge'

// Error translation loads the application's provider registry, which is unrelated
// to category persistence. Keep the real form, selector and storage implementation.
vi.mock('../../../src/utils/error', () => ({
  getI18nErrorMessage: (_error: unknown, fallback: string) => fallback,
}))

let wrapper: VueWrapper
let storage: MemoryStorageProvider
let manager: FavoriteManager
let parentId: string
let childId: string

describe.each(['web', 'desktop'] as const)('category parent selection (%s)', (platform) => {
beforeEach(async () => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  storage = new MemoryStorageProvider()
  manager = new FavoriteManager(storage)
  parentId = await manager.addCategory({ name: 'Parent', sortOrder: 1 })
  childId = await manager.addCategory({ name: 'Child', parentId, sortOrder: 2 })
  if (platform === 'desktop') {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: createDesktopServiceBridge({ favoriteManager: manager }),
    })
  }
  const favoriteManager = platform === 'desktop' ? new FavoriteManagerElectronProxy() : manager
  wrapper = mount(CategoryManager, {
    attachTo: document.body,
    global: { provide: { services: shallowRef({ favoriteManager }) } },
  })
  await flushPromises()
})

afterEach(() => {
  wrapper?.unmount()
  Reflect.deleteProperty(window, 'electronAPI')
  document.body.innerHTML = ''
})

async function clickButton(text: string) {
  const button = wrapper.findAll('button').find(button => button.text() === text)
  expect(button, `button ${text}`).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}

async function openAction(name: string, action: string) {
  await clickButton('Expand All')
  const button = wrapper.findAll('button').find(button => button.attributes('aria-label')?.endsWith(`: ${name}`))
  expect(button).toBeDefined()
  await button!.trigger('mouseenter')
  await new Promise(resolve => setTimeout(resolve, 200))
  await flushPromises()
  const option = wrapper.findAll('.n-dropdown-option-body').find(option => option.text() === action)
  expect(option).toBeDefined()
  await option!.trigger('click')
  await flushPromises()
}

async function clearParent() {
  const selector = wrapper.getComponent(NTreeSelect)
  expect(selector.props('value')).toBe(parentId)
  await selector.get('.n-base-selection').trigger('mouseenter')
  await flushPromises()
  await selector.get('.n-base-clear__clear').trigger('click')
  await flushPromises()
  // Naive invokes its onUpdate:value prop; observe the resulting real v-model.
  expect(selector.props('value')).toBeNull()
}

async function expectRootRoundTrip(id: string) {
  const saved = (await manager.getCategories()).find(category => category.id === id)
  expect(saved).toBeDefined()
  expect.soft(saved!.parentId).toBeUndefined()
  const roots = wrapper.getComponent(NTree).props('data')!
  expect.soft(roots.map(category => category.key)).toContain(id)
  expect(roots.find(category => category.key === parentId)?.children?.map(category => category.key)).not.toContain(id)
  const reopened = new FavoriteManager(storage)
  expect((await reopened.getCategories()).find(category => category.id === id)).toMatchObject({ id })
  expect.soft((await reopened.getCategories()).find(category => category.id === id)?.parentId).toBeUndefined()
  const exported = await reopened.exportFavorites()
  const restored = new FavoriteManager(new MemoryStorageProvider())
  await expect(restored.importFavorites(exported, { matchBy: 'id', mergeStrategy: 'overwrite' })).resolves.toMatchObject({ errors: [] })
  expect((await restored.getCategories()).find(category => category.id === id)).toMatchObject({ id })
  expect((await restored.getCategories()).find(category => category.id === id)?.parentId).toBeUndefined()
  expect(wrapper.emitted('category-updated')).toHaveLength(1)
  expect(window.$message!.error).not.toHaveBeenCalled()
}

describe('category parent selection', () => {
  it('moves an edited child to the root when the real selector is cleared', async () => {
    await openAction('Child', 'Edit')
    await clearParent()
    await clickButton('Save')
    await expectRootRoundTrip(childId)
  })

  it('adds a root category after clearing the preselected parent', async () => {
    await openAction('Parent', 'Add Subcategory')
    await wrapper.get('input[placeholder="Enter category name"]').setValue('New root')
    await clearParent()
    await clickButton('Save')
    const added = (await manager.getCategories()).find(category => category.name === 'New root')
    expect(added).toBeDefined()
    await expectRootRoundTrip(added!.id)
  })

  it('adds an untouched root category', async () => {
    await clickButton('Add Root Category')
    await wrapper.get('input[placeholder="Enter category name"]').setValue('Untouched root')
    await clickButton('Save')
    const added = (await manager.getCategories()).find(category => category.name === 'Untouched root')
    expect(added).toBeDefined()
    await expectRootRoundTrip(added!.id)
  })

  it('preserves an unchanged valid parent when saving', async () => {
    await openAction('Child', 'Edit')
    await clickButton('Save')
    expect((await manager.getCategories()).find(category => category.id === childId)?.parentId).toBe(parentId)
    expect(wrapper.emitted('category-updated')).toHaveLength(1)
  })

  it('keeps the selected parent when adding a subcategory', async () => {
    await openAction('Parent', 'Add Subcategory')
    await wrapper.get('input[placeholder="Enter category name"]').setValue('New child')
    await clickButton('Save')
    const added = (await manager.getCategories()).find(category => category.name === 'New child')
    expect(added).toMatchObject({ parentId })
    const roots = wrapper.getComponent(NTree).props('data')!
    expect(roots.find(category => category.key === parentId)?.children?.map(category => category.key)).toContain(added!.id)
  })

  it('validates the required category name before saving', async () => {
    const before = await manager.getCategories()
    await clickButton('Add Root Category')
    await clickButton('Save')
    expect(await manager.getCategories()).toEqual(before)
    expect(wrapper.emitted('category-updated')).toBeUndefined()
    expect(wrapper.text()).toContain('Please enter category name')
  })

  it('still rejects an imported null parent instead of weakening core validation', async () => {
    const backup = JSON.parse(await manager.exportFavorites())
    backup.categories.find((category: { id: string }) => category.id === childId).parentId = null
    const restored = new FavoriteManager(new MemoryStorageProvider())
    await expect(restored.importFavorites(JSON.stringify(backup))).rejects.toThrow('Invalid imported category')
  })

  it('does not persist clearing a parent when editing is cancelled', async () => {
    await openAction('Child', 'Edit')
    await clearParent()
    await clickButton('Cancel')
    expect((await manager.getCategories()).find(category => category.id === childId)?.parentId).toBe(parentId)
    expect(wrapper.emitted('category-updated')).toBeUndefined()
  })
})
})
