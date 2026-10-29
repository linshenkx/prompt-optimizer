<template>
  <div class="connection-summary" data-testid="connection-summary">
    <NText
      v-if="showRemoteListStatus && !showConnectionSettings"
      role="status"
      :data-testid="statusTestId"
      :type="remoteListState === 'error' ? 'error' : 'default'"
      >{{ remoteListMessage }}</NText
    >
    <NButton
      v-if="
        remoteSettings.provider.kind === 'google-drive' &&
        !isGoogleDriveAuthorized &&
        !showConnectionSettings
      "
      type="primary"
      data-testid="connect-cloud-account"
      :loading="isAuthorizingRemote"
      :disabled="isRemoteConnectionLocked"
      @click="handleRemoteAuthorize"
      >{{ googleDriveAuthorizationLabel }}</NButton
    >
    <NButton
      v-if="
        remoteSettings.provider.kind !== 'google-drive' ||
        isGoogleDriveAuthorized ||
        showConnectionSettings
      "
      class="connection-settings-toggle"
      data-testid="manage-cloud-connection"
      quaternary
      :aria-expanded="showConnectionSettings"
      :disabled="isRemoteConnectionLocked"
      @click="showConnectionSettings ? closeConnectionSettings() : openConnectionSettings()"
    >
      <template #icon><Settings2 :size="16" aria-hidden="true" /></template>
      {{ t('dataManager.tasks.manageConnection') }}
    </NButton>
  </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { Settings2 } from '@lucide/vue'
import { useDataManagerContext } from './context'
import { NText, NButton } from 'naive-ui'
defineProps<{ statusTestId: string }>()
const {
  t,
  remoteSettings,
  isGoogleDriveAuthorized,
  isAuthorizingRemote,
  isRemoteConnectionLocked,
  remoteListState,
  googleDriveAuthorizationLabel,
  remoteListMessage,
  showRemoteListStatus,
  showConnectionSettings,
  closeConnectionSettings,
  handleRemoteAuthorize,
  openConnectionSettings,
} = toRefs(useDataManagerContext())
</script>
