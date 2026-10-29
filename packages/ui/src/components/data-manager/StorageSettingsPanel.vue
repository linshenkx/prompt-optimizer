<template>
  <section
    class="task-stack"
    data-testid="data-storage-panel"
    :aria-label="t('dataManager.tasks.manageConnection')"
    tabindex="-1"
  >
    <article class="remote-config-panel">
      <div
        v-if="remoteSettings.provider.kind !== 'google-drive'"
        class="remote-connection-card"
        :class="`remote-connection-card--${currentRemoteConnection.status}`"
      >
        <div class="remote-connection-main">
          <div class="remote-provider-summary-copy">
            <NText strong>{{ currentRemoteConnectionTitle }}</NText>
            <NText v-if="remoteListState !== 'error'" depth="3" class="remote-field-help">
              {{ currentRemoteConnectionMessage }}
            </NText>
            <NText v-if="currentRemoteConnection.lastCheckedAt" depth="3" class="remote-field-help">
              {{
                $t('dataManager.remote.lastCheckedAt', {
                  time: new Date(currentRemoteConnection.lastCheckedAt).toLocaleString(),
                })
              }}
            </NText>
          </div>
          <NTag size="small" :type="currentRemoteConnectionTagType">
            {{ currentRemoteConnectionLabel }}
          </NTag>
        </div>

      </div>

      <template v-if="remoteSettings.provider.kind === 'google-drive'">
        <div class="remote-action-row remote-action-row--auth">
          <NButton
            secondary
            :type="isGoogleDriveAuthorized ? 'success' : 'default'"
            :loading="isAuthorizingRemote"
            data-testid="remote-google-authorize"
            :disabled="isRemoteConnectionLocked"
            @click="handleRemoteAuthorize"
          >
            {{ googleDriveAuthorizationLabel }}
          </NButton>
        </div>
        <div class="remote-field">
          <NText depth="3" class="remote-field-help">
            {{
              $t('dataManager.remote.googleDrivePath', {
                path: `/${GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME}`,
              })
            }}
          </NText>
        </div>
      </template>

      <template v-else-if="remoteSettings.provider.kind === 'cloudflare-r2'">
        <div class="remote-provider-form">
          <div
            v-for="field in ['accountId', 'bucket', 'accessKeyId', 'secretAccessKey'] as const"
            :key="field"
            class="remote-field"
          >
            <NText>{{
              t(
                'dataManager.remote.' +
                  {
                    accountId: 'accountId',
                    bucket: 'bucket',
                    accessKeyId: 'accessKey',
                    secretAccessKey: 'secretKey',
                  }[field],
              )
            }}</NText>
            <NInput
              v-model:value="remoteSettings.provider[field]"
              :aria-label="
                t(
                  'dataManager.remote.' +
                    {
                      accountId: 'accountId',
                      bucket: 'bucket',
                      accessKeyId: 'accessKey',
                      secretAccessKey: 'secretKey',
                    }[field],
                )
              "
              :disabled="isRemoteConnectionLocked"
              :type="field === 'secretAccessKey' ? 'password' : 'text'"
              show-password-on="click"
              @update:value="markRemoteSettingsDirty"
            />
          </div>
          <NText depth="3">{{
            t('dataManager.remote.cloudflareObjectPrefix', {
              prefix: '/' + CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX,
            })
          }}</NText>
        </div>
        <NCollapse
          ><NCollapseItem :title="t('dataManager.remote.showSetupGuide')" name="r2-help">
            <div class="task-stack">
              <NText>{{ t('dataManager.remote.cloudflareSteps.account.description') }}</NText>
              <NButton secondary @click="openCloudflareR2Link('dashboard')">{{
                t('dataManager.remote.cloudflareSteps.account.action')
              }}</NButton>
              <NText>{{ t('dataManager.remote.cloudflareSteps.bucket.description') }}</NText>
              <NButton secondary @click="openCloudflareR2Link('buckets')">{{
                t('dataManager.remote.cloudflareSteps.bucket.action')
              }}</NButton>
              <NButton secondary @click="copyCloudflareR2CorsConfig">{{
                t('dataManager.remote.cloudflareSteps.bucket.corsAction')
              }}</NButton>
              <NText>{{ t('dataManager.remote.cloudflareSteps.credentials.description') }}</NText>
              <NButton secondary @click="openCloudflareR2Link('apiTokens')">{{
                t('dataManager.remote.cloudflareSteps.credentials.tokenAction')
              }}</NButton>
              <NButton secondary @click="openCloudflareR2Link('docs')">{{
                t('dataManager.remote.cloudflareSteps.credentials.docsAction')
              }}</NButton>
            </div>
          </NCollapseItem></NCollapse
        >
      </template>
      <template v-else-if="remoteSettings.provider.kind === 's3-compatible'">
        <div class="remote-provider-form">
          <div class="remote-two-column">
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.endpoint')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.endpoint')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.endpoint"
                placeholder="https://..."
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.bucket')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.bucket')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.bucket"
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.region')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.region')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.region"
                placeholder="auto"
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.prefix')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.prefix')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.prefix"
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.accessKey')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.accessKey')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.accessKeyId"
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.secretKey')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.secretKey')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.secretAccessKey"
                type="password"
                show-password-on="click"
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
          </div>
          <NCheckbox
            :disabled="isRemoteConnectionLocked"
            v-model:checked="remoteSettings.provider.forcePathStyle"
            @update:checked="markRemoteSettingsDirty"
          >
            {{ $t('dataManager.remote.forcePathStyle') }}
          </NCheckbox>
          <NText depth="3" class="remote-field-help">
            {{
              isDesktopRuntime
                ? $t('dataManager.remote.s3DesktopHelp')
                : $t('dataManager.remote.s3WebHelp')
            }}
          </NText>
        </div>
      </template>

      <template v-else>
        <div class="remote-provider-form">
          <div class="remote-field">
            <NText depth="3" class="remote-field-label">{{
              $t('dataManager.remote.endpoint')
            }}</NText>
            <NInput
              :aria-label="t('dataManager.remote.endpoint')"
              :disabled="isRemoteConnectionLocked"
              v-model:value="remoteSettings.provider.endpoint"
              placeholder="https://..."
              clearable
              @update:value="markRemoteSettingsDirty"
            />
          </div>
          <div class="remote-two-column">
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.username')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.username')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.username"
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">{{
                $t('dataManager.remote.password')
              }}</NText>
              <NInput
                :aria-label="t('dataManager.remote.password')"
                :disabled="isRemoteConnectionLocked"
                v-model:value="remoteSettings.provider.password"
                type="password"
                show-password-on="click"
                clearable
                @update:value="markRemoteSettingsDirty"
              />
            </div>
          </div>
          <div class="remote-field">
            <NText depth="3" class="remote-field-label">{{
              $t('dataManager.remote.directory')
            }}</NText>
            <NInput
              :aria-label="t('dataManager.remote.directory')"
              :disabled="isRemoteConnectionLocked"
              v-model:value="remoteSettings.provider.directory"
              clearable
              @update:value="markRemoteSettingsDirty"
            />
          </div>
          <NText depth="3" class="remote-field-help">
            {{
              isDesktopRuntime
                ? $t('dataManager.remote.webdavDesktopHelp')
                : $t('dataManager.remote.webdavWebHelp')
            }}
          </NText>
        </div>
      </template>
      <div
        v-if="remoteSettings.provider.kind !== 'google-drive'"
        class="remote-action-row remote-action-row--compact remote-connection-actions"
      >
        <NButton
          type="primary"
          :loading="isLoadingRemoteList"
          :disabled="
            !isCurrentRemoteProviderConfigured ||
            isRemoteDataOperationActive ||
            isAuthorizingRemote
          "
          @click="handleRemoteSaveAndConnect"
        >
          {{ $t('dataManager.remote.saveAndConnect') }}
        </NButton>
      </div>
    </article>

    <NText
      v-if="showRemoteListStatus"
      data-testid="remote-settings-status"
      role="status"
      :type="remoteListState === 'error' ? 'error' : 'default'"
      >{{ remoteListMessage }}</NText
    >
    <div
      v-if="isCurrentRemoteProviderConfigured"
      class="cloud-maintenance task-stack"
      data-testid="remote-maintenance"
    >
      <NText strong>{{ t('dataManager.tasks.cloudMaintenance') }}</NText
      ><NText depth="3">{{ t('dataManager.tasks.cleanupHelp', { provider: currentProviderName }) }}</NText>
      <NButton
        secondary
        :loading="isCleaningRemoteAssets"
        :disabled="isRemoteDataOperationActive"
        @click="handleRemoteCleanup"
        >{{ t('dataManager.remote.cleanupAssets') }}</NButton
      >
    </div>
  </section>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useDataManagerContext } from './context'
import { NText, NButton, NCheckbox, NInput, NTag, NCollapse, NCollapseItem } from 'naive-ui'
const {
  t,
  remoteListMessage,
  showRemoteListStatus,
  remoteListState,
  isDesktopRuntime,
  remoteSettings,
  isAuthorizingRemote,
  isGoogleDriveAuthorized,
  isLoadingRemoteList,
  isCleaningRemoteAssets,
  isRemoteDataOperationActive,
  isRemoteConnectionLocked,
  googleDriveAuthorizationLabel,
  currentRemoteConnection,
  isCurrentRemoteProviderConfigured,
  currentRemoteConnectionLabel,
  currentRemoteConnectionTitle,
  currentRemoteConnectionMessage,
  currentRemoteConnectionTagType,
  markRemoteSettingsDirty,
  openCloudflareR2Link,
  copyCloudflareR2CorsConfig,
  handleRemoteAuthorize,
  handleRemoteSaveAndConnect,
  handleRemoteCleanup,
  currentProviderName,
  CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX,
  GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME,
} = toRefs(useDataManagerContext())
</script>
