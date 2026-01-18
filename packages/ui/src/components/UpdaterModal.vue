<template>
  <Modal 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #title>
      {{ t('updater.title') }}
    </template>

    <!-- 版本信息 -->
    <div class="mb-4 space-y-3">
      <!-- 当前版本 -->
      <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('updater.currentVersion') }}
        </div>
        <div v-if="state.currentVersion" class="font-medium text-gray-900 dark:text-white">
          v{{ state.currentVersion }}
        </div>
        <div v-else class="font-medium text-red-600 dark:text-red-400">
          {{ t('updater.versionLoadFailed') }}
        </div>
      </div>

      <!-- 正式版信息 -->
      <div v-if="state.stableVersion" class="relative p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-3">
        <!-- 更新标识 -->
        <div v-if="state.hasStableUpdate && !state.isStableVersionIgnored" class="absolute -top-2 -right-2 px-2 py-1 text-xs rounded-full bg-red-500 text-white">
          {{ t('updater.hasUpdate') }}
        </div>
        <!-- 忽略标识 -->
        <div v-if="state.isStableVersionIgnored" class="absolute -top-2 -right-2 px-2 py-1 text-xs rounded-full bg-gray-500 text-white">
          {{ t('updater.ignored') }}
        </div>

        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-green-600 dark:text-green-400">
                {{ t('updater.latestStableVersion') }}
              </span>
              <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                {{ t('updater.stable') }}
              </span>
            </div>
            <div class="font-medium text-green-900 dark:text-green-100">
              v{{ state.stableVersion }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="state.stableReleaseUrl"
              @click="openStableReleaseUrl"
              class="px-3 py-1 text-sm bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
            >
              {{ t('updater.details') }}
            </button>
            <button
              v-if="state.hasStableUpdate && !state.isStableVersionIgnored"
              @click="handleIgnoreStableUpdate"
              class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {{ t('updater.ignore') }}
            </button>
            <button
              v-if="state.isStableVersionIgnored"
              @click="handleUnignoreStableUpdate"
              class="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
            >
              {{ t('updater.unignore') }}
            </button>
            <button
              v-if="state.hasStableUpdate"
              @click="handleDownloadStable"
              :disabled="state.isDownloadingStable || state.isDownloading || state.isCheckingUpdate"
              :class="[
                'px-3 py-1 text-sm rounded-md transition-colors',
                (state.isDownloadingStable || state.isDownloading || state.isCheckingUpdate)
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              ]"
            >
              <span v-if="state.isDownloadingStable" class="flex items-center gap-1">
                <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('updater.downloadingShort') }}
              </span>
              <span v-else>{{ t('updater.download') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 预览版信息 - 有预览版时显示 -->
      <div v-if="state.prereleaseVersion" class="relative p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg mb-3">
        <!-- 更新标识 -->
        <div v-if="state.hasPrereleaseUpdate && !state.isPrereleaseVersionIgnored" class="absolute -top-2 -right-2 px-2 py-1 text-xs rounded-full bg-red-500 text-white">
          {{ t('updater.hasUpdate') }}
        </div>
        <!-- 忽略标识 -->
        <div v-if="state.isPrereleaseVersionIgnored" class="absolute -top-2 -right-2 px-2 py-1 text-xs rounded-full bg-gray-500 text-white">
          {{ t('updater.ignored') }}
        </div>

        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-orange-600 dark:text-orange-400">
                {{ t('updater.latestPrereleaseVersion') }}
              </span>
              <span class="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                {{ t('updater.prerelease') }}
              </span>
            </div>
            <div class="font-medium text-orange-900 dark:text-orange-100">
              v{{ state.prereleaseVersion }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="state.prereleaseReleaseUrl"
              @click="openPrereleaseReleaseUrl"
              class="px-3 py-1 text-sm bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200 rounded-md hover:bg-orange-200 dark:hover:bg-orange-700 transition-colors"
            >
              {{ t('updater.details') }}
            </button>
            <button
              v-if="state.hasPrereleaseUpdate && !state.isPrereleaseVersionIgnored"
              @click="handleIgnorePrereleaseUpdate"
              class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {{ t('updater.ignore') }}
            </button>
            <button
              v-if="state.isPrereleaseVersionIgnored"
              @click="handleUnignorePrereleaseUpdate"
              class="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
            >
              {{ t('updater.unignore') }}
            </button>
            <button
              v-if="state.hasPrereleaseUpdate"
              @click="handleDownloadPrerelease"
              :disabled="state.isDownloadingPrerelease || state.isDownloading || state.isCheckingUpdate"
              :class="[
                'px-3 py-1 text-sm rounded-md transition-colors',
                (state.isDownloadingPrerelease || state.isDownloading || state.isCheckingUpdate)
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              ]"
            >
              <span v-if="state.isDownloadingPrerelease" class="flex items-center gap-1">
                <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('updater.downloadingShort') }}
              </span>
              <span v-else>{{ t('updater.download') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 无预览版时的显示 - 仅在不是检查中且有正式版时显示 -->
      <div v-else-if="!state.isCheckingUpdate && state.stableVersion" class="relative p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('updater.latestPrereleaseVersion') }}
              </span>
              <span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                {{ t('updater.prerelease') }}
              </span>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('updater.noPrereleaseAvailable') }}
            </div>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('updater.latestIsStable') }}
          </div>
        </div>
      </div>
    </div>



    <!-- 开发环境提示 -->
    <div v-if="state.lastCheckResult === 'dev-disabled'" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3">
      <div class="text-blue-600 dark:text-blue-400 font-medium">
        {{ t('updater.devEnvironment') }}
      </div>
    </div>

    <!-- 检测错误信息 -->
    <div v-if="state.lastCheckMessage && state.lastCheckResult === 'error'"
         class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-3">
      <div class="flex items-start gap-2">
        <!-- 错误图标 -->
        <svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-red-600 dark:text-red-400">
            {{ t('updater.checkFailed') }}
          </div>
          <div class="text-sm mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-red-600 dark:text-red-400">
            {{ state.lastCheckMessage }}
          </div>
        </div>
      </div>
    </div>

    <!-- 下载消息提示 -->
    <div v-if="state.downloadMessage"
         :class="[
           'p-3 rounded-lg mb-3',
           state.downloadMessage.type === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
           state.downloadMessage.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
           'bg-blue-50 dark:bg-blue-900/20'
         ]">
      <div class="flex items-start gap-2">
        <!-- 错误图标 -->
        <svg v-if="state.downloadMessage.type === 'error'"
             class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <!-- 警告图标 -->
        <svg v-else-if="state.downloadMessage.type === 'warning'"
             class="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <!-- 信息图标 -->
        <svg v-else
             class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1 min-w-0">
          <div :class="[
                 'font-medium',
                 state.downloadMessage.type === 'error' ? 'text-red-600 dark:text-red-400' :
                 state.downloadMessage.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                 'text-blue-600 dark:text-blue-400'
               ]">
            {{ state.downloadMessage.type === 'error' ? t('updater.downloadFailed') :
               state.downloadMessage.type === 'warning' ? t('updater.warning') :
               t('updater.info') }}
          </div>
          <div :class="[
                 'text-sm mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words',
                 state.downloadMessage.type === 'error' ? 'text-red-600 dark:text-red-400' :
                 state.downloadMessage.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                 'text-blue-600 dark:text-blue-400'
               ]">
            {{ state.downloadMessage.content }}
          </div>
          <button
            @click="state.downloadMessage = null"
            :class="[
              'mt-2 text-xs hover:underline',
              state.downloadMessage.type === 'error' ? 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300' :
              state.downloadMessage.type === 'warning' ? 'text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300' :
              'text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
            ]"
          >
            {{ t('updater.dismiss') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 检查更新中 -->
    <div v-if="state.isCheckingUpdate" class="text-center py-4">
      <div class="flex items-center justify-center mb-2">
        <svg class="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div class="text-gray-600 dark:text-gray-400">
        {{ t('updater.checkingForUpdates') }}
      </div>
    </div>



    <!-- 下载中视图 -->
    <div v-if="state.isDownloading" class="space-y-4">
      <div class="text-center">
        <div class="text-gray-700 dark:text-gray-300 mb-2">
          {{ t('updater.downloading') }}
        </div>
        <div v-if="state.downloadProgress" class="space-y-2">
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${state.downloadProgress.percent}%` }"
            />
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ Math.round(state.downloadProgress.percent) }}% 
            ({{ formatBytes(state.downloadProgress.transferred) }} / {{ formatBytes(state.downloadProgress.total) }})
          </div>
        </div>
      </div>
    </div>

    <!-- 下载完成视图 -->
    <div v-if="state.isDownloaded" class="text-center space-y-4">
      <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <div class="text-green-600 dark:text-green-400 font-medium">
          {{ t('updater.downloadComplete') }}
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {{ t('updater.clickInstallToRestart') }}
        </div>
      </div>
      <button
        @click="handleInstallUpdate"
        class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
      >
        {{ t('updater.installAndRestart') }}
      </button>
    </div>

    <template #footer>
      <!-- 固定页脚：只有关闭和检查更新两个按钮 -->
      <div class="flex justify-between w-full">
        <NButton
          @click="$emit('update:modelValue', false)"
          type="default"
          size="medium"
        >
          {{ t('common.close') }}
        </NButton>
        <NButton
          @click="handleCheckUpdate"
          :disabled="state.isCheckingUpdate"
          :loading="state.isCheckingUpdate"
          type="primary"
          size="medium"
        >
          {{ state.isCheckingUpdate ? t('updater.checking') : t('updater.checkNow') }}
        </NButton>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton } from 'naive-ui'
import { isRunningInElectron } from '@prompt-optimizer/core'
import { useUpdater } from '../composables/system/useUpdater'
import Modal from './Modal.vue'

const { t } = useI18n()

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// 使用 useUpdater 管理所有更新逻辑
const {
  state,
  checkUpdate,
  installUpdate,
  ignoreUpdate,
  unignoreUpdate,
  downloadStableVersion,
  downloadPrereleaseVersion
} = useUpdater()

// 事件处理器
const handleCheckUpdate = async () => {
  await checkUpdate()
}


const handleInstallUpdate = async () => {
  await installUpdate()
}





const openStableReleaseUrl = async () => {
  if (!state.stableReleaseUrl || !isRunningInElectron() || !window.electronAPI?.shell) return

  try {
    await window.electronAPI.shell.openExternal(state.stableReleaseUrl)
  } catch (error) {
    console.error('[UpdaterModal] Open stable release URL error:', error)
  }
}

const openPrereleaseReleaseUrl = async () => {
  if (!state.prereleaseReleaseUrl || !isRunningInElectron() || !window.electronAPI?.shell) return

  try {
    await window.electronAPI.shell.openExternal(state.prereleaseReleaseUrl)
  } catch (error) {
    console.error('[UpdaterModal] Open prerelease release URL error:', error)
  }
}

const handleDownloadStable = async () => {
  await downloadStableVersion()
}

const handleDownloadPrerelease = async () => {
  await downloadPrereleaseVersion()
}

const handleIgnoreStableUpdate = async () => {
  if (state.stableVersion) {
    await ignoreUpdate(state.stableVersion, 'stable')
  }
}

const handleIgnorePrereleaseUpdate = async () => {
  if (state.prereleaseVersion) {
    await ignoreUpdate(state.prereleaseVersion, 'prerelease')
  }
}

const handleUnignoreStableUpdate = async () => {
  await unignoreUpdate('stable')
}

const handleUnignorePrereleaseUpdate = async () => {
  await unignoreUpdate('prerelease')
}





// 格式化字节数
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>
