<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('dataManager.title')"
    :style="dataManagerModalStyle"
    class="data-manager-modal"
    compact-class="data-manager--compact"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value: boolean) => !value && close()"
  >
    <div
      role="tablist"
      :aria-label="t('dataManager.title')"
      class="data-task-tabs"
      @keydown="handleTabKeydown"
    >
      <NButton
        v-for="task in taskTabs"
        :id="'data-tab-' + task"
        :key="task"
        role="tab"
        :aria-controls="'data-panel-' + task"
        :aria-selected="activeTab === task"
        :tabindex="activeTab === task ? 0 : -1"
        :type="activeTab === task ? 'primary' : 'default'"
        :quaternary="activeTab !== task"
        :data-testid="'data-tab-' + task"
        @click="activeTab = task"
        >{{ t('dataManager.tasks.' + task) }}</NButton
      >
    </div>
    <div
      v-if="remoteProgress.active || isExporting || isImporting"
      class="task-global-progress"
      role="status"
      aria-live="polite"
    >
      <NProgress
        v-if="remoteProgress.active"
        type="line"
        :percentage="remoteProgress.percent"
        :show-indicator="false"
      />
      <NText>{{
        remoteProgress.active
          ? remoteProgress.message
          : t(isExporting ? 'common.exporting' : 'common.importing')
      }}</NText>
    </div>
    <div ref="scrollShell" class="data-manager-scroll-shell">
      <div
        v-for="task in taskTabs"
        v-show="activeTab === task"
        :id="'data-panel-' + task"
        :key="task"
        role="tabpanel"
        :aria-labelledby="'data-tab-' + task"
        :tabindex="0"
      >
        <BackupPanel v-if="task === 'backup'" /><RestorePanel
          v-else-if="task === 'restore'"
        /><StorageSettingsPanel v-else />
      </div>
    </div>
  </NModal>
  <NModal
    :show="showRemoteImportCode"
    class="data-manager-code-modal"
    preset="card"
    :title="t('dataManager.remote.importCode.exportTitle')"
    :style="{ width: 'calc(100vw - 32px)', maxWidth: '480px' }"
    @update:show="
      (value: boolean) => {
        showRemoteImportCode = value
        if (!value) exportedRemoteImportCode = ''
      }
    "
  >
    <div class="remote-import-code-panel">
      <NText depth="3">{{ t('dataManager.remote.importCode.secretNotice') }}</NText>
      <NInput
        :value="exportedRemoteImportCode"
        type="textarea"
        readonly
        :autosize="{ minRows: 3, maxRows: 5 }"
        data-testid="remote-import-code-output"
      />
      <NButton secondary data-testid="remote-import-code-copy" @click="copyRemoteImportCode">
        {{ t('dataManager.remote.importCode.copy') }}
      </NButton>
      <NText>{{ t('dataManager.remote.importCode.webAddress') }}</NText>
      <NInput
        v-model:value="remoteImportWebAddress"
        placeholder="https://…"
        data-testid="remote-import-code-web-address"
      />
      <NText depth="3">{{ t('dataManager.remote.importCode.webAddressHelp') }}</NText>
      <div
        v-if="remoteImportQrUrl"
        class="remote-import-code-qr"
        data-testid="remote-import-code-qr"
      >
        <NQrCode
          :value="remoteImportQrUrl"
          :size="256"
          :padding="16"
          type="svg"
          error-correction-level="M"
        />
      </div>
      <NText v-else depth="3">{{ t('dataManager.remote.importCode.qrUnavailable') }}</NText>
    </div>
  </NModal>
</template>
<script setup lang="ts">
import { provide, reactive, toRefs, nextTick } from 'vue'
import { NButton, NText, NProgress, NInput, NQrCode } from 'naive-ui'
import NModal from './common/AdaptiveModal.vue'
import BackupPanel from './data-manager/BackupPanel.vue'
import RestorePanel from './data-manager/RestorePanel.vue'
import StorageSettingsPanel from './data-manager/StorageSettingsPanel.vue'
import {
  useDataManager,
  type DataManagerProps,
  type DataManagerEmits,
} from './data-manager/useDataManager'
import { dataManagerKey } from './data-manager/context'
import './data-manager/data-manager.css'
const props = defineProps<DataManagerProps>()
const emit = defineEmits<DataManagerEmits>()
const controller = reactive(useDataManager(props, emit))
provide(dataManagerKey, controller)
const {
  t,
  activeTab,
  scrollShell,
  dataManagerModalStyle,
  isExporting,
  isImporting,
  showRemoteImportCode,
  exportedRemoteImportCode,
  remoteImportWebAddress,
  remoteImportQrUrl,
  remoteProgress,
  copyRemoteImportCode,
  close,
} = toRefs(controller)
const taskTabs = ['backup', 'restore', 'settings'] as const
const handleTabKeydown = (event: KeyboardEvent) => {
  const index = taskTabs.indexOf(activeTab.value)
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % 3
      : event.key === 'ArrowLeft'
        ? (index + 2) % 3
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? 2
            : -1
  if (next < 0) return
  event.preventDefault()
  const tabList = event.currentTarget as HTMLElement | null
  activeTab.value = taskTabs[next]!
  void nextTick(() => tabList?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
}
</script>
