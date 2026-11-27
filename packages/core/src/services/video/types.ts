export const VIDEO_CAPABILITY_MODES = ['text2video', 'frames', 'references'] as const
export type VideoCapabilityMode = typeof VIDEO_CAPABILITY_MODES[number]
export const VIDEO_ROLES = ['reference_image', 'first_frame', 'last_frame'] as const
export type VideoReferenceRole = typeof VIDEO_ROLES[number]
export const MAX_STORED_VIDEO_REFERENCES = 9
export const VIDEO_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired'] as const
export type VideoTaskStatus = typeof VIDEO_STATUSES[number]

export interface VideoCapabilities {
  text2video: boolean
  firstFrame: boolean
  firstLastFrame: boolean
  maxReferenceImages: number
  supportsCancel: boolean
}
export type VideoParamValue = string | number | boolean
export type VideoParams = Record<string, VideoParamValue>
export type VideoParamDefinition = { key: string; labelKey: string } & (
  | { kind: 'enum'; options: readonly (string | number)[]; defaultValue: string | number }
  | { kind: 'int-range'; min: number; max: number; step: number; defaultValue: number }
  | { kind: 'boolean'; defaultValue: boolean }
)
export interface VideoInputContext {
  mode: VideoCapabilityMode
  images: readonly { role: VideoReferenceRole }[]
}
export interface VideoPricingContext extends VideoInputContext { baseURL: string }
export interface VideoCostEstimate {
  amount: number
  currency: 'CNY' | 'USD'
  basis: string
  estimated?: boolean
}
export interface VideoUsage {
  outputTokens?: number
  totalTokens?: number
  outputSeconds?: number
}
export const VIDEO_PROVIDER_IDS = ['ark', 'byteplus', 'minimax', 'minimax-intl'] as const
export type VideoProviderId = typeof VIDEO_PROVIDER_IDS[number]
export interface VideoModelSpec {
  id: string
  providerId: VideoProviderId
  name: string
  descriptionKey?: string
  legacy?: boolean
  capabilities: VideoCapabilities
  params: readonly VideoParamDefinition[]
  resolveParams?(draft: VideoParams, context: VideoInputContext): readonly VideoParamDefinition[]
  pricing: {
    estimate(params: VideoParams, context: VideoPricingContext): VideoCostEstimate | null
    actual?(usage: VideoUsage, params: VideoParams, context: VideoPricingContext): VideoCostEstimate | null
  }
}
export interface VideoReference { role: VideoReferenceRole; url: string }
export interface VideoGenerationInput {
  model: string
  modelId?: string
  configModelId?: string
  providerId?: VideoProviderId
  capabilityMode?: VideoCapabilityMode
  prompt: string
  params: VideoParams
  references: VideoReference[]
  configId?: string
  baseURL?: string
}
export interface VideoTaskResult {
  id: string
  status: VideoTaskStatus
  videoUrl?: string
  expiresAt?: number
  usage?: VideoUsage
  error?: string
}
export type VideoRunIdentity = { providerId: VideoProviderId; modelId: string; configModelId?: string; model?: string }
