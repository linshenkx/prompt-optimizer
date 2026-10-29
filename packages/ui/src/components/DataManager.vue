<template>
  <NConfigProvider abstract :theme-overrides="managerThemeOverrides">
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
      <div
        ref="scrollShell"
        class="data-manager-scroll-shell task-stack"
        data-testid="data-manager-overview"
      >
        <DeviceOverview />
        <LocalFilesPanel />
        <CloudBackupsPanel />
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
  </NConfigProvider>
</template>
<script setup lang="ts">
import { computed, provide, reactive, toRefs } from 'vue'
import {
  NButton, NText, NProgress, NInput, NQrCode, NConfigProvider,
  type GlobalThemeOverrides,
} from 'naive-ui'
import { useNaiveTheme } from '../composables/ui/useNaiveTheme'
import NModal from './common/AdaptiveModal.vue'
import DeviceOverview from './data-manager/DeviceOverview.vue'
import LocalFilesPanel from './data-manager/LocalFilesPanel.vue'
import CloudBackupsPanel from './data-manager/CloudBackupsPanel.vue'
import {
  useDataManager,
  type DataManagerProps,
  type DataManagerEmits,
} from './data-manager/useDataManager'
import { dataManagerKey } from './data-manager/context'
import './data-manager/data-manager.css'
const props = defineProps<DataManagerProps>()
const { isCurrentThemeDark } = useNaiveTheme()
// The slate dark accent needs light button labels, including hover and keyboard focus.
// Keep this correction inside data management rather than changing the app's palette.
const managerThemeOverrides = computed<GlobalThemeOverrides>(() =>
  isCurrentThemeDark.value
    ? {
        Button: {
          textColorPrimary: '#fff',
          textColorHoverPrimary: '#fff',
          textColorPressedPrimary: '#fff',
          textColorFocusPrimary: '#fff',
          textColorHover: '#e5e7eb',
          textColorPressed: '#e5e7eb',
          textColorFocus: '#e5e7eb',
          textColorGhostHover: '#e5e7eb',
          textColorGhostPressed: '#e5e7eb',
          textColorTextHover: '#e5e7eb',
          textColorTextPressed: '#e5e7eb',
          borderHover: '1px solid #e5e7eb',
          borderFocus: '1px solid #e5e7eb',
        },
      }
    : {},
)
const emit = defineEmits<DataManagerEmits>()
const controller = reactive(useDataManager(props, emit))
provide(dataManagerKey, controller)
const {
  t,
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
</script>
