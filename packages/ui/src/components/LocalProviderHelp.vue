<template>
  <details v-if="helpKind" class="local-provider-help" :data-testid="`${helpKind}-connection-help`">
    <summary>{{ extraHelp ? t('modelManager.localProviderHelp.serviceTitle', { name: extraHelp.name }) : t(`modelManager.localProviderHelp.${helpKind}Title`) }}</summary>
    <div class="local-provider-help__body">
      <template v-if="helpKind === 'magpie'">
        <p>{{ t('modelManager.localProviderHelp.magpieIntro') }}</p>
        <NRadioGroup v-model:value="system" size="small" :name="'magpie-command-system'" :aria-label="t('modelManager.localProviderHelp.system')">
          <NRadioButton value="windows">Windows</NRadioButton>
          <NRadioButton value="macos">macOS</NRadioButton>
          <NRadioButton value="linux">Linux</NRadioButton>
        </NRadioGroup>
        <p>{{ t(`modelManager.localProviderHelp.${system === 'windows' ? 'powershell' : 'terminal'}`) }}</p>
        <pre data-testid="magpie-key-command"><code>{{ command }}</code></pre>
        <NButton size="tiny" secondary @click="copyCommand">{{ t('modelManager.localProviderHelp.copyCommand') }}</NButton>
        <p>{{ t('modelManager.localProviderHelp.magpieAfter') }}</p>
        <p>{{ t(`modelManager.localProviderHelp.${system === 'windows' ? 'windowsPath' : 'unixPath'}`) }}</p>
        <p>{{ t('modelManager.localProviderHelp.magpieCors') }}</p>
      </template>
      <template v-else-if="helpKind === 'ollama'">
        <p>{{ t('modelManager.localProviderHelp.ollamaAuth') }}</p>
        <p>{{ t('modelManager.localProviderHelp.ollamaCors') }}</p>
      </template>
      <template v-else-if="extraHelp">
        <p v-for="part in ['setup', 'auth', 'web']" :key="part">{{ t(`modelManager.localProviderHelp.services.${extraHelp.key}.${part}`) }}</p>
      </template>
      <p v-if="webOrigin">{{ t('modelManager.localProviderHelp.currentOrigin') }} <code>{{ webOrigin }}</code></p>
      <a :href="extraHelp?.docs ?? (helpKind === 'magpie' ? 'https://usemagpie.ai/docs/remote' : 'https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama')" target="_blank" rel="noopener noreferrer">
        {{ t('modelManager.localProviderHelp.docs') }}
      </a>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NRadioButton, NRadioGroup } from 'naive-ui'
import { getPlatform } from '../utils/platform'
import { useClipboard } from '../composables/ui/useClipboard'
import { useToast } from '../composables/ui/useToast'

const props = defineProps<{ providerId: string; serviceKind?: unknown }>()
const services = {
  cliproxyapi: { name: 'CLIProxyAPI', key: 'cliproxyapi', docs: 'https://help.router-for.me/configuration/options' },
  litellm: { name: 'LiteLLM', key: 'litellm', docs: 'https://docs.litellm.ai/docs/proxy/virtual_keys' },
  llamacpp: { name: 'llama.cpp', key: 'llamacpp', docs: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server#readme' },
} as const
const helpKind = computed(() => {
  if (props.providerId === 'magpie' || props.providerId === 'ollama') return props.providerId
  const kind = props.serviceKind
  if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(services, kind)) return ''
  if (props.providerId === 'openai-compatible') return kind
  return ''
})
const extraHelp = computed(() => Object.prototype.hasOwnProperty.call(services, helpKind.value) ? services[helpKind.value as keyof typeof services] : undefined)
const { t } = useI18n()
const platform = getPlatform()
const system = ref<'windows' | 'macos' | 'linux'>(platform.isWindows ? 'windows' : platform.isMac ? 'macos' : 'linux')
const command = computed(() => system.value === 'windows'
  ? String.raw`& "$env:LOCALAPPDATA\Programs\Magpie\magpie-cli.exe" gateway-key add "Prompt Optimizer"`
  : 'magpie gateway-key add "Prompt Optimizer"')
const webOrigin = /^https?:$/.test(window.location.protocol) ? window.location.origin : ''
const clipboard = useClipboard()
const toast = useToast()
async function copyCommand() {
  try {
    await clipboard.copyText(command.value)
    toast.success(t('common.copySuccess'))
  } catch {
    toast.error(t('modelManager.localProviderHelp.copyFailed'))
  }
}
</script>

<style scoped>
.local-provider-help { margin-top: 6px; font-size: 12px; }
summary { cursor: pointer; color: var(--n-text-color); width: fit-content; }
.local-provider-help__body { padding: 6px 0; line-height: 1.6; }
p { margin: 6px 0; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 8px; border-radius: 6px; background: rgba(128, 128, 128, .08); }
code { overflow-wrap: anywhere; }
a { color: inherit; text-decoration: underline; }
</style>
