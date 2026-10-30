import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

/** Magpie provider metadata; requests use the existing OpenAI-compatible transport. */
export class MagpieAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'magpie',
      name: 'Magpie',
      description: 'Local Magpie gateway (OpenAI-compatible API)',
      requiresApiKey: false,
      defaultBaseURL: 'http://127.0.0.1:3425/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: [],
        optional: ['baseURL', 'apiKey'],
        fieldTypes: { baseURL: 'string', apiKey: 'string' },
      },
    }
  }

  public getModels(): TextModel[] {
    // Catalogs belong to the user's gateway. Never offer OpenAI's static models.
    return []
  }
}
