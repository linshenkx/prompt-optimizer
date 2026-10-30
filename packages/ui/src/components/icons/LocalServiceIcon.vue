<template>
  <OllamaBrandIcon v-if="kind === 'ollama'" />
  <MagpieBrandIcon v-else-if="kind === 'magpie'" />
  <LMStudioBrandIcon v-else-if="kind === 'lmstudio'" />
  <CCSwitchBrandIcon v-else-if="kind === 'cc-switch'" />
  <CLIProxyAPIIcon v-else-if="kind === 'cliproxyapi'" />
  <LiteLLMIcon v-else-if="kind === 'litellm'" />
  <LlamaCppIcon v-else-if="kind === 'llamacpp'" />
  <ChromeBrandIcon v-else aria-hidden="true" />
</template>

<script setup lang="ts">
import type { DiscoveredLocalService } from '../../utils/local-model-discovery'
import ChromeBrandIcon from './ChromeBrandIcon.vue'
import LMStudioBrandIcon from './LMStudioBrandIcon.vue'
import CCSwitchBrandIcon from './CCSwitchBrandIcon.vue'
import OllamaBrandIcon from './OllamaBrandIcon.vue'
import MagpieBrandIcon from './MagpieBrandIcon.vue'
import CLIProxyAPIIcon from './CLIProxyAPIIcon.vue'
import LiteLLMIcon from './LiteLLMIcon.vue'
import LlamaCppIcon from './LlamaCppIcon.vue'

defineProps<{ kind: DiscoveredLocalService['kind'] }>()
</script>
