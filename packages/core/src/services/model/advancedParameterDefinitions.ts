// packages/core/src/services/model/advancedParameterDefinitions.ts

export interface AdvancedParameterDefinition {
  id: string; // Unique ID across all definitions, e.g., "openai_temperature"
  name: string; // Actual parameter name used by the SDK, e.g., "temperature"
  
  labelKey: string; // i18n key for UI label, e.g., "params.temperature.label"
  descriptionKey: string; // i18n key for UI description, e.g., "params.temperature.description"
  
  type: 'number' | 'string' | 'boolean' | 'integer';
  
  defaultValue?: any;
  
  minValue?: number;
  maxValue?: number;
  step?: number;
  
  unit?: string; // e.g., "ms"
  unitKey?: string; // i18n key for the unit, e.g., "params.tokens.unit"
  
  appliesToProviders: string[]; // e.g., ["openai", "deepseek"] or ["gemini"]
  
  // Optional: For string types with predefined choices
  // allowedValues?: string[]; 
  // allowedValuesLabelsKey?: string; // i18n key for labels of allowedValues (if they differ from values)
}

export const advancedParameterDefinitions: AdvancedParameterDefinition[] = [
  // Common Parameters (can be mapped or used if name matches)
  {
    id: "common_temperature",
    name: "temperature",
    labelKey: "params.temperature.label",
    descriptionKey: "params.temperature.description",
    type: "number",
    defaultValue: 0.7,
    minValue: 0.0,
    maxValue: 2.0, // Max for OpenAI; Gemini is often 0-1. UI might need to adjust range based on provider.
    step: 0.1,
    appliesToProviders: ["openai", "gemini", "deepseek", "custom", "zhipu", "siliconflow"] 
  },
  {
    id: "common_top_p",
    name: "top_p", // OpenAI, Zhipu, SiliconFlow use top_p
    labelKey: "params.top_p.label",
    descriptionKey: "params.top_p.description",
    type: "number",
    defaultValue: 1.0,
    minValue: 0.0,
    maxValue: 1.0,
    step: 0.01,
    appliesToProviders: ["openai", "deepseek", "custom", "zhipu", "siliconflow"]
  },
  // OpenAI / OpenAI-Compatible Specific
  {
    id: "openai_max_tokens",
    name: "max_tokens",
    labelKey: "params.max_tokens.label",
    descriptionKey: "params.max_tokens.description",
    type: "integer",
    defaultValue: 4096,
    minValue: 1,
    step: 1,
    unitKey: "params.tokens.unit",
    appliesToProviders: ["openai", "deepseek", "custom", "zhipu", "siliconflow"]
  },
  {
    id: "openai_presence_penalty",
    name: "presence_penalty",
    labelKey: "params.presence_penalty.label",
    descriptionKey: "params.presence_penalty.description",
    type: "number",
    defaultValue: 0,
    minValue: -2.0,
    maxValue: 2.0,
    step: 0.1,
    appliesToProviders: ["openai", "deepseek", "custom", "zhipu", "siliconflow"]
  },
  {
    id: "openai_frequency_penalty",
    name: "frequency_penalty",
    labelKey: "params.frequency_penalty.label",
    descriptionKey: "params.frequency_penalty.description",
    type: "number",
    defaultValue: 0,
    minValue: -2.0,
    maxValue: 2.0,
    step: 0.1,
    appliesToProviders: ["openai", "deepseek", "custom", "zhipu", "siliconflow"]
  },
  {
    id: "openai_timeout", // This is a client configuration for OpenAI
    name: "timeout", 
    labelKey: "params.timeout.label",
    descriptionKey: "params.timeout.description_openai", // Specific description
    type: "integer",
    defaultValue: 60000,
    minValue: 1000,
    step: 1000,
    unit: "ms",
    appliesToProviders: ["openai", "deepseek", "custom", "zhipu", "siliconflow"] 
  },
  // Gemini Specific
  {
    id: "gemini_maxOutputTokens",
    name: "maxOutputTokens",
    labelKey: "params.maxOutputTokens.label",
    descriptionKey: "params.maxOutputTokens.description",
    type: "integer",
    defaultValue: 4096, 
    minValue: 1,
    step: 1,
    unitKey: "params.tokens.unit",
    appliesToProviders: ["gemini"]
  },
  {
    id: "gemini_topP", // Gemini uses "topP" (capital P)
    name: "topP",
    labelKey: "params.top_p.label", // Can share label if meaning is identical
    descriptionKey: "params.top_p.description", // Can share description
    type: "number",
    defaultValue: 1.0, // Or Gemini's typical default if different
    minValue: 0.0,
    maxValue: 1.0,
    step: 0.01,
    appliesToProviders: ["gemini"]
  },
  {
    id: "gemini_topK",
    name: "topK",
    labelKey: "params.top_k.label",
    descriptionKey: "params.top_k.description",
    type: "integer",
    defaultValue: 1, // Gemini default, but often user wants to adjust
    minValue: 1,
    step: 1,
    appliesToProviders: ["gemini"]
  },
  {
    id: "gemini_candidateCount",
    name: "candidateCount",
    labelKey: "params.candidateCount.label",
    descriptionKey: "params.candidateCount.description",
    type: "integer",
    defaultValue: 1, 
    minValue: 1,
    maxValue: 8, // Check Gemini docs for actual max
    step: 1,
    appliesToProviders: ["gemini"]
  },
  {
    id: "gemini_stopSequences",
    name: "stopSequences", // Array of strings
    labelKey: "params.stopSequences.label",
    descriptionKey: "params.stopSequences.description",
    type: "string", // UI will need to handle input as comma-separated strings -> array
    defaultValue: [], // Should be an array
    appliesToProviders: ["gemini"]
  },
  // Add more definitions as needed for other parameters and providers.
  // For example, Zhipu specific parameters, Groq, Anthropic etc.
];

// It might be useful to also export a map for easier lookup by id or name
// export const advancedParameterDefinitionsMapById: Record<string, AdvancedParameterDefinition> = 
//   advancedParameterDefinitions.reduce((acc, def) => {
//     acc[def.id] = def;
//     return acc;
//   }, {} as Record<string, AdvancedParameterDefinition>);

// export const advancedParameterDefinitionsMapByName: Record<string, AdvancedParameterDefinition> = 
//   advancedParameterDefinitions.reduce((acc, def) => {
//     acc[def.name] = def; // Note: 'name' might not be unique across all providers if we don't make it so
//     return acc;
//   }, {} as Record<string, AdvancedParameterDefinition>);

// Consider provider-specific name uniqueness if using name as a map key.
// For UI filtering, iterating the array and filtering by appliesToProviders is often sufficient.
