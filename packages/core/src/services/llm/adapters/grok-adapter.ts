import type {
  TextModel,
  TextModelConfig,
  TextProvider,
  ParameterDefinition
} from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

const GROK_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'grok-4.5',
    name: 'Grok 4.5',
    description: 'xAI Grok 4.5 reasoning model via OpenAI-compatible Chat Completions API',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 500000
    },
    defaultParameterValues: {
      reasoning_effort: 'high'
    }
  }
]

type GrokReasoningEffort = 'low' | 'medium' | 'high'

export class GrokAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'grok',
      name: 'Grok',
      description: 'xAI Grok models via OpenAI-compatible API',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.x.ai/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://console.x.ai/team/default/api-keys',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string'
        }
      }
    }
  }

  public getModels(): TextModel[] {
    return GROK_STATIC_MODELS.map((definition) => {
      const baseModel = this.buildDefaultModel(definition.id)

      return {
        ...baseModel,
        name: definition.name,
        description: definition.description,
        capabilities: {
          ...baseModel.capabilities,
          ...(definition.capabilities ?? {})
        },
        defaultParameterValues: {
          ...(baseModel.defaultParameterValues ?? {}),
          ...(definition.defaultParameterValues ?? {})
        }
      }
    })
  }

  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    const baseURL = this.normalizeBaseUrl(
      config.connectionConfig.baseURL || this.getProvider().defaultBaseURL
    )
    const apiKey = config.connectionConfig.apiKey

    try {
      const response = await fetch(`${baseURL}/language-models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        }
      })

      if (!response.ok) {
        console.warn(`Grok language models API error: ${response.status}`)
        return this.getModels()
      }

      const data = await response.json()
      const rawModels = Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data?.data)
          ? data.data
          : []

      const models = rawModels
        .map((model: any) => {
          const id = typeof model === 'string' ? model : model?.id
          return typeof id === 'string' && id.trim() ? this.buildDefaultModel(id) : null
        })
        .filter((model: TextModel | null): model is TextModel => !!model)
        .sort((a: TextModel, b: TextModel) => a.id.localeCompare(b.id))

      return models.length > 0 ? models : this.getModels()
    } catch (error) {
      console.warn('Failed to fetch Grok language models:', error)
      return this.getModels()
    }
  }

  protected getRequestStyle(): 'chat_completions' {
    return 'chat_completions'
  }

  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return [
      {
        name: 'reasoning_effort',
        labelKey: 'params.reasoning_effort.label',
        descriptionKey: 'params.reasoning_effort.description',
        description: 'Reasoning effort for Grok 4.5.',
        type: 'string',
        defaultValue: 'high',
        default: 'high',
        allowedValues: ['low', 'medium', 'high']
      },
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        description: 'Sampling temperature (0-2).',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 2,
        min: 0,
        max: 2,
        step: 0.1
      },
      {
        name: 'top_p',
        labelKey: 'params.top_p.label',
        descriptionKey: 'params.top_p.description',
        description: 'Nucleus sampling parameter (0-1).',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 1,
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'max_completion_tokens',
        labelKey: 'params.max_completion_tokens.label',
        descriptionKey: 'params.max_completion_tokens.description',
        description: 'Maximum tokens in completion.',
        type: 'integer',
        minValue: 1,
        maxValue: 1000000,
        min: 1,
        max: 1000000,
        step: 1,
        unitKey: 'params.tokens.unit'
      },
      {
        name: 'timeout',
        labelKey: 'params.timeout.label',
        descriptionKey: 'params.timeout.description_openai',
        description: 'Client timeout in milliseconds.',
        type: 'integer',
        defaultValue: 60000,
        default: 60000,
        minValue: 1000,
        maxValue: 600000,
        min: 1000,
        max: 600000,
        step: 1000,
        unit: 'ms'
      }
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      reasoning_effort: 'high'
    }
  }

  private normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }

  public buildDefaultModel(modelId: string): TextModel {
    const model = super.buildDefaultModel(modelId)
    const effort = this.normalizeReasoningEffort(model.defaultParameterValues?.reasoning_effort)

    return {
      ...model,
      defaultParameterValues: {
        ...(model.defaultParameterValues || {}),
        reasoning_effort: effort ?? 'high'
      }
    }
  }

  private normalizeReasoningEffort(value: unknown): GrokReasoningEffort | undefined {
    return value === 'low' || value === 'medium' || value === 'high'
      ? value
      : undefined
  }
}
