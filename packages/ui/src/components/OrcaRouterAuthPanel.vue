<template>
  <div class="orca-auth-panel" data-testid="orca-auth-panel">
    <NText depth="3" class="orca-auth-panel__intro" data-testid="orca-auth-intro">
      {{ t('modelManager.orcaRouter.intro') }}
    </NText>

    <!--
      Both entry points are shown at once, side by side. They serve different
      users and have different failure modes, so neither is hidden behind the
      other and neither replaces the other.
    -->
    <div class="orca-auth-panel__methods" role="radiogroup" :aria-label="t('modelManager.orcaRouter.methodLabel')">
      <button
        type="button"
        role="radio"
        class="orca-auth-panel__method"
        :class="{ 'orca-auth-panel__method--selected': method === 'api-key' }"
        :aria-checked="method === 'api-key'"
        data-testid="orca-method-api-key"
        @click="selectMethod('api-key')"
      >
        <span class="orca-auth-panel__method-title">{{ t('modelManager.orcaRouter.apiKeyTitle') }}</span>
        <span class="orca-auth-panel__method-desc">{{ t('modelManager.orcaRouter.apiKeyDescription') }}</span>
      </button>

      <button
        type="button"
        role="radio"
        class="orca-auth-panel__method"
        :class="{ 'orca-auth-panel__method--selected': method === 'pkce' }"
        :aria-checked="method === 'pkce'"
        data-testid="orca-method-pkce"
        @click="selectMethod('pkce')"
      >
        <span class="orca-auth-panel__method-title">{{ t('modelManager.orcaRouter.pkceTitle') }}</span>
        <span class="orca-auth-panel__method-desc">{{ t('modelManager.orcaRouter.pkceDescription') }}</span>
      </button>
    </div>

    <!-- API key entry -->
    <NFormItem
      v-if="method === 'api-key'"
      :label="t('modelManager.apiKey')"
      data-testid="orca-api-key-field"
    >
      <NSpace align="center" :size="8" style="width: 100%;">
        <NInput
          :value="apiKeyValue"
          type="password"
          show-password-on="click"
          :placeholder="t('modelManager.orcaRouter.apiKeyPlaceholder')"
          :autocomplete="'new-password'"
          style="flex: 1; min-width: 240px;"
          data-testid="orca-api-key-input"
          @update:value="emit('update:apiKey', $event)"
        />
        <NButton
          v-if="apiKeyValue"
          quaternary
          size="small"
          data-testid="orca-api-key-clear"
          @click="emit('update:apiKey', '')"
        >
          {{ t('common.remove') }}
        </NButton>
        <NButton
          tag="a"
          text
          size="small"
          type="primary"
          :href="ORCAROUTER_KEY_CONSOLE_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('modelManager.getApiKey') }}
        </NButton>
      </NSpace>
    </NFormItem>

    <!-- Account login -->
    <div v-else class="orca-auth-panel__pkce" data-testid="orca-pkce-section">
      <NSpace align="center" :size="8" wrap>
        <NButton
          type="primary"
          secondary
          :loading="busy && phase === 'authorizing'"
          :disabled="busy"
          data-testid="orca-connect-button"
          @click="handleConnect"
        >
          {{ t('modelManager.orcaRouter.connectAction') }}
        </NButton>
        <NButton
          v-if="busy"
          quaternary
          size="small"
          data-testid="orca-cancel-button"
          @click="handleCancel"
        >
          {{ t('common.cancel') }}
        </NButton>
        <NButton
          v-if="maskedKey"
          quaternary
          size="small"
          data-testid="orca-signout-button"
          @click="handleCancel"
        >
          {{ t('modelManager.orcaRouter.disconnectAction') }}
        </NButton>
      </NSpace>

      <NText v-if="hint" depth="3" class="orca-auth-panel__hint" data-testid="orca-login-hint">
        {{ hint }}
      </NText>

      <NAlert v-if="error" type="error" :show-icon="true" class="orca-auth-panel__error" data-testid="orca-login-error">
        {{ error }}
      </NAlert>

      <!-- Fallback for browsers that do not open automatically. -->
      <div v-if="hasAuthorizeUrl" class="orca-auth-panel__url" data-testid="orca-authorize-url">
        <NText depth="3" class="orca-auth-panel__url-label">
          {{ t('modelManager.orcaRouter.authorizeUrlHint') }}
        </NText>
        <NInput
          :value="authorizeUrl"
          readonly
          size="small"
          data-testid="orca-authorize-url-input"
        />
      </div>

      <NFormItem
        v-if="hasAuthorizeUrl"
        :label="t('modelManager.orcaRouter.codeLabel')"
        data-testid="orca-code-field"
      >
        <NSpace align="center" :size="8" style="width: 100%;">
          <NInput
            v-model:value="code"
            :placeholder="t('modelManager.orcaRouter.codePlaceholder')"
            :disabled="busy && phase === 'exchanging'"
            style="flex: 1; min-width: 200px;"
            data-testid="orca-code-input"
            @keyup.enter="handleSubmitCode"
          />
          <NButton
            type="primary"
            :loading="phase === 'exchanging'"
            :disabled="!code.trim()"
            data-testid="orca-code-submit"
            @click="handleSubmitCode"
          >
            {{ t('modelManager.orcaRouter.codeSubmit') }}
          </NButton>
        </NSpace>
      </NFormItem>

      <NText v-if="maskedKey" depth="3" class="orca-auth-panel__connected" data-testid="orca-connected-key">
        {{ t('modelManager.orcaRouter.connectedAs', { key: maskedKey }) }}
      </NText>

      <NText depth="3" class="orca-auth-panel__revoke">
        <a :href="ORCAROUTER_AUTHORIZED_APPS_URL" target="_blank" rel="noopener noreferrer">
          {{ t('modelManager.orcaRouter.revokeHint') }}
        </a>
      </NText>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NFormItem, NInput, NSpace, NText } from 'naive-ui'
import {
  ORCAROUTER_AUTHORIZED_APPS_URL,
  ORCAROUTER_KEY_CONSOLE_URL
} from '@prompt-optimizer/core'
import { useOrcaRouterConnect } from '../composables/model/useOrcaRouterConnect'

type OrcaAuthMethod = 'api-key' | 'pkce'

const props = withDefaults(
  defineProps<{
    apiKeyValue?: string
    /** Preselected entry point, so the provider the user picked is honoured. */
    initialMethod?: OrcaAuthMethod
  }>(),
  {
    apiKeyValue: '',
    initialMethod: 'pkce'
  }
)

const emit = defineEmits<{
  'update:apiKey': [value: string]
  connected: [apiKey: string]
}>()

const { t } = useI18n()

const method = ref<OrcaAuthMethod>(props.initialMethod)
const code = ref('')

const connect = useOrcaRouterConnect({
  persist: (credential) => {
    // The issued key becomes an ordinary connectionConfig.apiKey, so provider
    // requests, model discovery and every AI entry point are source-agnostic.
    emit('update:apiKey', credential.apiKey)
    emit('connected', credential.apiKey)
  }
})

const {
  phase,
  busy,
  hint,
  error,
  authorizeUrl,
  hasAuthorizeUrl,
  start,
  submitCode,
  cancel,
  maskedKey
} = connect

watch(
  () => props.initialMethod,
  (next) => {
    if (!busy.value) method.value = next
  }
)

const selectMethod = (next: OrcaAuthMethod) => {
  if (busy.value || next === method.value) return
  // Switching authentication method releases the login state completely.
  cancel()
  code.value = ''
  method.value = next
}

const handleConnect = async () => {
  await start()
}

const handleSubmitCode = async () => {
  if (!code.value.trim()) return
  const ok = await submitCode(code.value.trim())
  if (ok) {
    // The verifier has served its purpose; the code is single-use.
    code.value = ''
  }
}

const handleCancel = () => {
  cancel()
  code.value = ''
}

defineExpose({
  /** Exposed for the GUI evidence automation. */
  phase,
  busy,
  maskedKey,
  hasAuthorizeUrl
})
</script>

<style scoped>
.orca-auth-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.orca-auth-panel__intro {
  display: block;
  line-height: 1.5;
}

.orca-auth-panel__methods {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.orca-auth-panel__method {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.35));
  border-radius: 6px;
  background: var(--n-color, transparent);
  text-align: left;
  cursor: pointer;
}

.orca-auth-panel__method--selected {
  border-color: var(--primary-color, #18a058);
  box-shadow: inset 0 0 0 1px var(--primary-color, #18a058);
}

.orca-auth-panel__method-title {
  font-weight: 600;
}

.orca-auth-panel__method-desc {
  font-size: 12px;
  opacity: 0.75;
  line-height: 1.4;
}

.orca-auth-panel__pkce {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.orca-auth-panel__hint,
.orca-auth-panel__connected,
.orca-auth-panel__revoke {
  display: block;
  line-height: 1.5;
}

.orca-auth-panel__url {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.orca-auth-panel__url-label {
  line-height: 1.4;
}

@media (max-width: 640px) {
  .orca-auth-panel__methods {
    grid-template-columns: 1fr;
  }
}
</style>
