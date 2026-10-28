<template>
  <header class="compact-navigation">
    <NButton quaternary class="compact-main-menu" :aria-label="t('workspace.menu')" data-testid="compact-global-menu"
      @click="menu = true"><template #icon><NIcon size="18"><Menu2 /></NIcon></template>{{ t('workspace.functions') }}</NButton>
    <button type="button" class="compact-mode-button" :aria-label="t('workspace.switchMode')"
      data-testid="compact-mode-select" @click="modes = true">
      <strong>{{ currentLabel }}</strong><NIcon size="14"><ChevronDown /></NIcon>
    </button>
    <div v-show="!isFavorites" id="compact-workspace-tools" />
    <NButton v-if="isFavorites" quaternary circle :aria-label="t('workspace.returnToWorkspace')"
      @click="goWorkspace"><template #icon><NIcon :size="16"><ArrowBackUp /></NIcon></template></NButton>
  </header>
  <AdaptiveModal v-model:show="menu" presentation="sheet" :auto-focus="false"
    :title="t('workspace.functions')" class="compact-menu-sheet" data-testid="compact-functions-panel">
    <button v-if="isFavorites" type="button" class="compact-menu-row" @click="goWorkspace">
      <NIcon :size="16"><ArrowBackUp /></NIcon><span>{{ t('workspace.returnToWorkspace') }}</span><NIcon :size="16"><ChevronRight /></NIcon>
    </button>
    <div class="compact-function-grid">
      <button v-for="item in entries" :key="item.action" type="button" class="compact-function-tile"
        :data-testid="`compact-menu-${item.action}`" @click="open(item.action)">
        <span aria-hidden="true" style="font-size: 20px; line-height: 1">{{ item.icon }}</span><span>{{ t(item.label) }}</span>
        <NBadge v-if="item.action === 'data' && backupReminderDue" dot />
      </button>
    </div>
    <div class="compact-menu-preferences">
      <div class="compact-menu-preference"><span class="compact-menu-preference-label">{{ t('workspace.theme') }}</span><ThemeToggleUI /></div>
      <div class="compact-menu-preference"><span class="compact-menu-preference-label">{{ t('workspace.language') }}</span><LanguageSwitchDropdown /></div>
    </div>
    <details class="compact-menu-help">
      <summary>{{ t('workspace.helpAbout') }}</summary>
      <button type="button" class="compact-menu-row" @click="open('docs')"><NIcon :size="16"><Book /></NIcon><span>{{ t('about.documentation') }}</span><NIcon :size="16"><ExternalLink /></NIcon></button>
      <button type="button" class="compact-menu-row" @click="open('website')"><NIcon :size="16"><World /></NIcon><span>{{ t('about.website') }}</span><NIcon :size="16"><ExternalLink /></NIcon></button>
      <button type="button" class="compact-menu-row" @click="open('github')"><NIcon><BrandGithub /></NIcon><span>GitHub</span><NIcon :size="16"><ExternalLink /></NIcon></button>
      <div class="compact-menu-version">{{ appVersion }}<UpdaterIcon /></div>
    </details>
  </AdaptiveModal>
  <AdaptiveModal v-model:show="modes" presentation="sheet" :auto-focus="false"
    :title="t('workspace.switchMode')" class="compact-mode-sheet" data-testid="compact-modes-panel">
    <section v-for="group in modeGroups" :key="group.id" class="compact-mode-group"
      :aria-labelledby="`compact-mode-group-${group.id}`">
      <h3 :id="`compact-mode-group-${group.id}`">{{ t(group.label) }}</h3>
      <div class="compact-mode-grid" :class="{ 'compact-mode-grid--three': group.items.length === 3 }">
        <button v-for="item in group.items" :key="item.path" type="button" class="compact-mode-choice"
          :data-testid="`compact-mode-${item.path.slice(1).replace('/', '-')}`"
          :aria-current="item.path === workspacePath ? 'page' : undefined" @click="selectMode(item.path)">
          <span>{{ t(item.label) }}</span><NIcon v-if="item.path === workspacePath" size="16"><Check /></NIcon>
        </button>
      </div>
    </section>
  </AdaptiveModal>
</template>

<script setup lang="ts">
import BrandGithub from '../icons/GitHubIcon.vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NBadge } from 'naive-ui'
import { Menu as Menu2, ChevronDown, ChevronRight, Undo2 as ArrowBackUp, Book, Globe as World, ExternalLink, Check } from '@lucide/vue'
import { router } from '../../router'
import { releaseCompactOverlayHistory } from '../../composables/ui/useCompactModalBack'
import AdaptiveModal from '../common/AdaptiveModal.vue'
import ThemeToggleUI from '../ThemeToggleUI.vue'
import LanguageSwitchDropdown from '../LanguageSwitchDropdown.vue'
import UpdaterIcon from '../UpdaterIcon.vue'

const props = defineProps<{ workspacePath: string; appVersion: string; backupReminderDue?: boolean }>()
const emit = defineEmits<{ action: [value: string] }>()
const { t } = useI18n()
const menu = ref(false)
const modes = ref(false)
const modeGroups = [
  { id: 'basic', label: 'nav.basicMode', items: [
    { path: '/basic/system', label: 'workspace.systemMode' },
    { path: '/basic/user', label: 'workspace.userMode' },
  ] },
  { id: 'pro', label: 'nav.contextMode', items: [
    { path: '/pro/variable', label: 'contextMode.optimizationMode.variable' },
    { path: '/pro/multi', label: 'contextMode.optimizationMode.message' },
  ] },
  { id: 'image', label: 'nav.imageMode', items: [
    { path: '/image/text2image', label: 'imageMode.text2image' },
    { path: '/image/image2image', label: 'imageMode.image2image' },
    { path: '/image/multiimage', label: 'imageMode.multiimage' },
  ] },
]
const labels: Record<string, string> = {
  '/basic/system': 'promptOptimizer.systemPrompt',
  '/basic/user': 'promptOptimizer.userPrompt',
  '/pro/multi': 'contextMode.optimizationMode.message',
  '/pro/variable': 'contextMode.optimizationMode.variable',
  '/image/text2image': 'imageMode.text2image',
  '/image/image2image': 'imageMode.image2image',
  '/image/multiimage': 'imageMode.multiimage',
}
const isFavorites = computed(() => router.currentRoute.value.path === '/favorites')
const currentLabel = computed(() => t(isFavorites.value ? 'nav.favorites' : labels[router.currentRoute.value.path] || labels[props.workspacePath] || 'workspace.title'))
const entries = [
  { action: 'favorites', label: 'nav.favorites', icon: '⭐' },
  { action: 'history', label: 'nav.history', icon: '📜' },
  { action: 'templates', label: 'nav.templates', icon: '📝' },
  { action: 'models', label: 'nav.modelManager', icon: '⚙️' },
  { action: 'variables', label: 'nav.variableManager', icon: '🔣' },
  { action: 'data', label: 'nav.dataManager', icon: '💾' },
]
const open = async (action: string) => {
  menu.value = false
  if (action === 'favorites') await releaseCompactOverlayHistory()
  emit('action', action)
}
const selectMode = async (path: string) => {
  modes.value = false
  await releaseCompactOverlayHistory()
  if (router.currentRoute.value.path !== path) await router.push(path)
}
const goWorkspace = async () => {
  menu.value = false
  modes.value = false
  await releaseCompactOverlayHistory()
  await router.push(props.workspacePath)
}
watch(() => router.currentRoute.value.fullPath, () => { modes.value = false; menu.value = false })
</script>
