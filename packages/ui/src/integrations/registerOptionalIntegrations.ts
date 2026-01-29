import type { OptionalIntegration, OptionalIntegrationsContext } from './types'

function isEnvEnabled(value: unknown): boolean {
  return value === '1' || value === 'true'
}

function getEnvValue(flag: string): unknown {
  // import.meta.env is Vite-provided and has an index signature.
  return (import.meta.env as unknown as Record<string, unknown>)[flag]
}

/**
 * Register optional integrations in a single place.
 *
 * Design goal:
 * - Keep feature-specific logic out of `PromptOptimizerApp.vue`.
 * - Load integrations lazily (dynamic import) and only when enabled.
 */
// Discover integration modules automatically.
//
// Contract:
// - Place modules under `src/integrations/`.
// - Name them `*.integration.ts`.
// - Export `integration: OptionalIntegration`.
const discoveredIntegrations = import.meta.glob('./*.integration.ts', {
  eager: true,
  import: 'integration',
}) as Record<string, OptionalIntegration>

export async function registerOptionalIntegrations(
  ctx: OptionalIntegrationsContext
): Promise<void> {
  const integrations = Object.values(discoveredIntegrations)
  const enabled = integrations.filter((i) => isEnvEnabled(getEnvValue(i.envFlag)))

  // Optional integrations should never break the main app.
  const results = await Promise.allSettled(enabled.map(async (i) => i.register(ctx)))
  results.forEach((res, idx) => {
    if (res.status === 'rejected') {
      const id = enabled[idx]?.id ?? 'unknown'
      console.error(`[OptionalIntegrations] Failed to register: ${id}`, res.reason)
    }
  })
}
