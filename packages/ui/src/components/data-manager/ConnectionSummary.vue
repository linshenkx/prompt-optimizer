<template>
  <div class="task-card task-stack" data-testid="connection-summary">
    <div class="section-heading">
      <NText strong>{{ currentProviderName }}</NText
      ><NButton text :disabled="isRemoteConnectionLocked" @click="openConnectionSettings">{{
        t(
          isCurrentRemoteProviderConfigured
            ? 'dataManager.tasks.manageConnection'
            : 'dataManager.tasks.setupConnection',
        )
      }}</NButton>
    </div>
    <NText
      role="status"
      :data-testid="statusTestId"
      :type="remoteListState === 'error' ? 'error' : 'default'"
      >{{ remoteListMessage }}</NText
    >
    <NButton
      v-if="remoteSettings.provider.kind === 'google-drive' && !isGoogleDriveAuthorized"
      secondary
      :disabled="isRemoteConnectionLocked"
      @click="handleRemoteAuthorize"
      >{{ googleDriveAuthorizationLabel }}</NButton
    >
  </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useDataManagerContext } from './context'
import { NText, NButton } from 'naive-ui'
defineProps<{ statusTestId: string }>()
const {
  t,
  remoteSettings,
  isGoogleDriveAuthorized,
  isRemoteConnectionLocked,
  remoteListState,
  googleDriveAuthorizationLabel,
  remoteListMessage,
  isCurrentRemoteProviderConfigured,
  handleRemoteAuthorize,
  currentProviderName,
  openConnectionSettings,
} = toRefs(useDataManagerContext())
</script>
