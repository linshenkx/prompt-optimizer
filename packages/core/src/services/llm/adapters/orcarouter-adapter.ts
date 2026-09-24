/*
 * Prompt Optimizer - AI prompt optimization tool
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * OrcaRouter text provider adapter.
 *
 * OrcaRouter is an OpenAI-compatible gateway, so the request plumbing is the
 * repository's existing OpenAI adapter; this class only supplies provider
 * metadata and a capability-filtered model catalog.
 *
 * Two first-class entries share this base:
 *   - `orcarouter`       — "OrcaRouter - API"  (paste an existing key)
 *   - `orcarouter-oauth` — "OrcaRouter - Auth" (OAuth 2.0 + PKCE login)
 *
 * They differ only in how a credential is acquired. Inference base URL, model
 * namespace and catalog discovery are identical, and deliberately so: the
 * request path must not care which entry minted the key.
 */

import type { TextModel, TextProvider, TextModelConfig } from '../types'
import type { ModelDiscoveryOptions } from '../types'
import { OpenAIAdapter } from './openai-adapter'
import {
  ORCAROUTER_DEFAULT_API_BASE_URL,
  ORCAROUTER_DEFAULT_AUTH_BASE_URL,
  resolveOrcaRouterOrigins
} from '../../orcarouter/origins'
import {
  ORCAROUTER_VERIFIED_SEED,
  filterOrcaModelsForCapability,
  findOrcaSeedModel,
  fetchOrcaCatalog,
  getOrcaSeedCatalogModels,
  toOrcaTextModel,
  type OrcaCatalogCapability
} from '../../orcarouter/catalog'
import { APIError } from '../errors'

/** Provider ids for the two OrcaRouter authentication entries. */
export const ORCAROUTER_API_KEY_PROVIDER_ID = 'orcarouter'
export const ORCAROUTER_PKCE_PROVIDER_ID = 'orcarouter-oauth'

export const ORCAROUTER_KEY_CONSOLE_URL = 'https://www.orcarouter.ai/console/token'
export const ORCAROUTER_AUTHORIZED_APPS_URL = 'https://www.orcarouter.ai/console/authorized-apps'

function buildConnectionSchema() {
  return {
    required: ['apiKey'],
    optional: ['baseURL'],
    fieldTypes: {
      apiKey: 'string' as const,
      baseURL: 'string' as const
    }
  }
}

/**
 * Verified cold-start models. Used verbatim when live discovery is unavailable
 * and as the source of retained capability metadata (context window, input
 * modalities, reasoning-effort ladder) when it is.
 */
function buildSeedModels(providerId: string): TextModel[] {
  return getOrcaSeedCatalogModels().map((model) =>
    toOrcaTextModel(model, providerId, findOrcaSeedModel(model.id))
  )
}

export abstract class AbstractOrcaRouterAdapter extends OpenAIAdapter {
  /** Which entry point this adapter represents. */
  protected abstract getCredentialEntry(): 'api-key' | 'oauth-pkce'

  /**
   * The static list here is a bounded, verified *outage* fallback, not curated
   * content. The repository's default merge would otherwise append these stub
   * entries to every successful live catalog result, which would (a) present
   * models as available that the live catalog never advertised and (b) defeat
   * the per-entry-point capability filter for anything the seed declares but
   * the live record does not. So a successful discovery result stands alone.
   *
   * `getModels()` itself is unchanged: it is still the offline path used when
   * discovery fails, and the UI labels it as degraded.
   */
  public readonly dynamicModelsOverrideStatic = true

  public getModels(): TextModel[] {
    return buildSeedModels(this.getProvider().id)
  }

  /**
   * Discovery for one AI input entry point. `capability` decides the filter, so
   * a dropdown can never offer a model the entry point cannot use.
   */
  public async getModelsForCapability(
    config: TextModelConfig,
    requirements: ModelDiscoveryOptions
  ): Promise<TextModel[]> {
    const providerId = this.getProvider().id
    const capability: OrcaCatalogCapability =
      (requirements.capability as OrcaCatalogCapability) ?? 'chat'

    const snapshot = await fetchOrcaCatalog({
      authBaseUrl: ORCAROUTER_DEFAULT_AUTH_BASE_URL,
      apiBaseUrl: config.connectionConfig.baseURL || ORCAROUTER_DEFAULT_API_BASE_URL,
      apiKey: this.resolveApiKey(config),
      fetchImpl: this.getFetchImpl()
    })

    if (snapshot.source === 'seed') {
      // An outage must not be papered over. Returning the seed here would hand
      // the caller an unlabelled list that looks exactly like a live result, so
      // the fallback is signalled instead: the registry keeps `getModels()` as
      // the verified offline list, and every caller that catches this failure
      // shows the seed *together with* the degraded notice.
      throw new APIError(
        `OrcaRouter model catalog is unavailable (${snapshot.degradedReason ?? 'unknown reason'})`
      )
    }

    // Live discovery is authoritative; when it returns nothing usable for this
    // capability the caller gets an honest empty list rather than a seed mixed
    // into a live result.
    return filterOrcaModelsForCapability(snapshot.models, {
      capability,
      requiredInputModalities: requirements.requiredInputModalities
    }).map((model) => toOrcaTextModel(model, providerId, findOrcaSeedModel(model.id)))
  }

  public async getModelsAsync(
    config: TextModelConfig,
    requirements?: ModelDiscoveryOptions
  ): Promise<TextModel[]> {
    try {
      return await this.getModelsForCapability(config, requirements ?? { capability: 'chat' })
    } catch (error) {
      console.error('[OrcaRouterAdapter] Failed to fetch models:', error)
      throw new APIError(
        error instanceof Error ? error.message : 'Failed to fetch the OrcaRouter model catalog'
      )
    }
  }

  /**
   * The bearer key for catalog discovery. Discovery is preferred with the
   * user's key so the result reflects the models their workspace can call.
   */
  protected resolveApiKey(config: TextModelConfig): string {
    const raw = config.connectionConfig?.apiKey
    return typeof raw === 'string' ? raw.trim() : ''
  }

  protected getFetchImpl(): typeof fetch | undefined {
    return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined
  }

  /**
   * Never let a credential reach a log line. The base adapter logs errors with
   * the SDK payload, so the key is scrubbed from messages before they surface.
   */
  protected redactForLog(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(/sk-orca-[A-Za-z0-9._-]+/g, 'sk-orca-***')
    }
    return value
  }
}

/** "OrcaRouter - API": the user pastes an existing `sk-orca-…` key. */
export class OrcaRouterAdapter extends AbstractOrcaRouterAdapter {
  protected getCredentialEntry(): 'api-key' {
    return 'api-key'
  }

  public getProvider(): TextProvider {
    return {
      id: ORCAROUTER_API_KEY_PROVIDER_ID,
      name: 'OrcaRouter - API',
      description:
        'OrcaRouter OpenAI-compatible gateway (API key). Adaptive routing, automatic failover and agent-tool governance on one endpoint.',
      requiresApiKey: true,
      defaultBaseURL: ORCAROUTER_DEFAULT_API_BASE_URL,
      supportsDynamicModels: true,
      apiKeyUrl: ORCAROUTER_KEY_CONSOLE_URL,
      connectionSchema: buildConnectionSchema()
    }
  }
}

/** "OrcaRouter - Auth": OAuth 2.0 + PKCE login against the user's account. */
export class OrcaRouterOAuthAdapter extends AbstractOrcaRouterAdapter {
  protected getCredentialEntry(): 'oauth-pkce' {
    return 'oauth-pkce'
  }

  public getProvider(): TextProvider {
    return {
      id: ORCAROUTER_PKCE_PROVIDER_ID,
      name: 'OrcaRouter - Auth',
      description:
        'OrcaRouter OpenAI-compatible gateway (account login). Connects with OAuth 2.0 + PKCE and stores the issued key until you revoke it.',
      requiresApiKey: true,
      defaultBaseURL: ORCAROUTER_DEFAULT_API_BASE_URL,
      supportsDynamicModels: true,
      apiKeyUrl: ORCAROUTER_AUTHORIZED_APPS_URL,
      connectionSchema: buildConnectionSchema()
    }
  }
}

/** Seed metadata retained for the verified models, exposed for tests/docs. */
export const ORCAROUTER_SEED_MODEL_IDS = ORCAROUTER_VERIFIED_SEED.map((seed) => seed.id)

/** Resolve both OrcaRouter origins for callers that need them directly. */
export { resolveOrcaRouterOrigins }
