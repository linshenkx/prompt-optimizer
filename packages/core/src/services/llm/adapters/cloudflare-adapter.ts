import OpenAI from 'openai';
import type { TextModel, TextModelConfig, TextProvider } from '../types';
import { APIError, RequestConfigError } from '../errors';
import { OpenAIAdapter } from './openai-adapter';

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

interface CloudflareModelSearchResult {
  name: string
  description?: string | null
  task?: {
    name?: string | null
  } | null
  properties?: Array<{
    property_id?: string
    value?: unknown
  }>
}

const CLOUDFLARE_STATIC_MODELS: ModelOverride[] = [
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    name: 'Qwen3 30B A3B FP8',
    description: 'Default recommended Cloudflare Workers AI text model with tool calling and reasoning output support',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 32768
    }
  }
];

export class CloudflareAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'cloudflare',
      name: 'Cloudflare',
      description: 'Cloudflare Workers AI text models with dynamic model discovery',
      corsRestricted: true,
      requiresApiKey: true,
      defaultBaseURL: 'https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
      connectionSchema: {
        required: ['apiKey', 'accountId'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          accountId: 'string',
          baseURL: 'string'
        }
      }
    };
  }

  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    const accountId = this.getAccountId(config);
    const baseURL = this.resolveCloudflareManagementBaseURL(config.connectionConfig.baseURL, accountId);
    const url = `${baseURL}/models/search?task=${encodeURIComponent('Text Generation')}&hide_experimental=true&per_page=100`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.connectionConfig.apiKey || ''}`
      }
    });

    if (!response.ok) {
      throw new APIError(`Cloudflare model search failed: ${await this.getErrorMessage(response)}`);
    }

    const data = await response.json();
    if (!data?.success || !Array.isArray(data?.result)) {
      throw new APIError('Cloudflare model search returned an unexpected response format');
    }

    const models = data.result
      .filter((model: CloudflareModelSearchResult) => {
        return model?.task?.name === 'Text Generation' && typeof model?.name === 'string' && !!model.name.trim();
      })
      .map((model: CloudflareModelSearchResult) => this.mapDynamicModel(model));

    return models.length > 0 ? models : this.getModels();
  }

  public getModels(): TextModel[] {
    return CLOUDFLARE_STATIC_MODELS.map((definition) => {
      const baseModel = this.buildDefaultModel(definition.id);

      return {
        ...baseModel,
        name: definition.name,
        description: definition.description,
        capabilities: {
          ...baseModel.capabilities,
          ...(definition.capabilities ?? {})
        },
        defaultParameterValues: definition.defaultParameterValues
          ? {
              ...(baseModel.defaultParameterValues ?? {}),
              ...definition.defaultParameterValues
            }
          : baseModel.defaultParameterValues
      };
    });
  }

  protected async createOpenAIInstance(config: TextModelConfig, isStream: boolean = false): Promise<OpenAI> {
    const accountId = this.getAccountId(config);

    const normalizedConfig: TextModelConfig = {
      ...config,
      connectionConfig: {
        ...config.connectionConfig,
        baseURL: this.resolveCloudflareApiBaseURL(config.connectionConfig.baseURL, accountId)
      }
    };

    return await super.createOpenAIInstance(normalizedConfig, isStream);
  }

  private getAccountId(config: TextModelConfig): string {
    const accountId = String(config.connectionConfig.accountId || '').trim();
    if (!accountId) {
      throw new RequestConfigError('Cloudflare requires accountId in connection config');
    }

    return accountId;
  }

  private resolveCloudflareApiBaseURL(rawBaseURL: string | undefined, accountId: string): string {
    const providerBaseURL = this.getProvider().defaultBaseURL;
    let baseURL = (rawBaseURL || providerBaseURL).trim();

    if (baseURL.endsWith('/chat/completions')) {
      baseURL = baseURL.slice(0, -'/chat/completions'.length);
    }

    const encodedAccountId = encodeURIComponent(accountId);
    const trimmed = baseURL.replace(/\/$/, '');

    if (trimmed.includes('{accountId}')) {
      return trimmed.replace('{accountId}', encodedAccountId);
    }

    if (/\/client\/v4\/accounts\/[^/]+\/ai\/v1$/.test(trimmed)) {
      return trimmed;
    }

    if (/\/client\/v4\/accounts\/[^/]+$/.test(trimmed)) {
      return `${trimmed}/ai/v1`;
    }

    if (/\/client\/v4$/.test(trimmed)) {
      return `${trimmed}/accounts/${encodedAccountId}/ai/v1`;
    }

    return trimmed;
  }

  private resolveCloudflareManagementBaseURL(rawBaseURL: string | undefined, accountId: string): string {
    const apiBaseURL = this.resolveCloudflareApiBaseURL(rawBaseURL, accountId);
    return apiBaseURL.replace(/\/ai\/v1$/, '/ai');
  }

  private mapDynamicModel(model: CloudflareModelSearchResult): TextModel {
    const modelId = model.name.trim();
    const baseModel = this.buildDefaultModel(modelId);
    const propertyMap = this.toPropertyMap(model.properties);
    const contextWindow = this.parseIntegerProperty(propertyMap.context_window);
    const supportsTools = this.parseBooleanProperty(propertyMap.function_calling);
    const supportsReasoning = this.parseBooleanProperty(propertyMap.reasoning);

    return {
      ...baseModel,
      name: this.toDisplayName(modelId),
      description: this.buildModelDescription(model, propertyMap),
      capabilities: {
        supportsTools,
        supportsReasoning,
        maxContextLength: contextWindow ?? baseModel.capabilities.maxContextLength
      }
    };
  }

  private toPropertyMap(properties: CloudflareModelSearchResult['properties']): Record<string, unknown> {
    const map: Record<string, unknown> = {};

    for (const property of properties || []) {
      if (property?.property_id) {
        map[property.property_id] = property.value;
      }
    }

    return map;
  }

  private parseIntegerProperty(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private parseBooleanProperty(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  }

  private toDisplayName(modelId: string): string {
    const rawName = modelId.split('/').pop() || modelId;
    const tokens = rawName.split(/[-_]/g).filter(Boolean);

    return tokens
      .map((token) => {
        const lower = token.toLowerCase();

        if (lower === 'gpt') return 'GPT';
        if (lower === 'oss') return 'OSS';
        if (lower === 'qwq') return 'QwQ';
        if (lower.startsWith('qwen')) return `Qwen${token.slice(4)}`;
        if (lower === 'llama') return 'Llama';
        if (lower === 'kimi') return 'Kimi';
        if (lower === 'gemma') return 'Gemma';
        if (/^\d+(\.\d+)?$/.test(token)) return token;
        if (/^\d+b$/i.test(token) || /^a\d+b$/i.test(token) || /^(fp|int)\d+$/i.test(token) || lower === 'awq') {
          return token.toUpperCase();
        }

        return token.charAt(0).toUpperCase() + token.slice(1);
      })
      .join(' ');
  }

  private buildModelDescription(model: CloudflareModelSearchResult, propertyMap: Record<string, unknown>): string {
    const parts: string[] = [];
    const description = typeof model.description === 'string' ? model.description.trim() : '';
    if (description) {
      parts.push(description);
    }

    const contextWindow = this.parseIntegerProperty(propertyMap.context_window);
    if (contextWindow) {
      parts.push(`Context: ${contextWindow.toLocaleString()} tokens`);
    }

    const priceSummary = this.buildPriceSummary(propertyMap.price);
    if (priceSummary) {
      parts.push(priceSummary);
    }

    return parts.join(' ');
  }

  private buildPriceSummary(value: unknown): string | undefined {
    if (!Array.isArray(value) || value.length === 0) return undefined;

    const fragments = value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const price = (item as { price?: unknown }).price;
        const unit = (item as { unit?: unknown }).unit;
        if (typeof price !== 'number' || typeof unit !== 'string') return null;
        return `$${price}/${unit}`;
      })
      .filter((item): item is string => !!item);

    return fragments.length > 0 ? `Pricing: ${fragments.join(', ')}` : undefined;
  }

  private async getErrorMessage(response: Response): Promise<string> {
    const fallbackMessage = `${response.status} ${response.statusText}`;

    try {
      const data = await response.json();
      return data?.errors?.[0]?.message || data?.messages?.[0]?.message || data?.message || fallbackMessage;
    } catch {
      try {
        const text = await response.text();
        return text || fallbackMessage;
      } catch {
        return fallbackMessage;
      }
    }
  }
}
