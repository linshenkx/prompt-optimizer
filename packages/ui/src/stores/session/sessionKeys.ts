import type { LegacySessionSubModeKey } from '@prompt-optimizer/core'

export type SubModeKey = LegacySessionSubModeKey

export const SESSION_SUB_MODE_KEYS = [
  'arena',
  'basic-system',
  'basic-user',
  'pro-multi',
  'pro-variable',
  'image-text2image',
  'image-image2image',
  'image-multiimage',
] as const satisfies readonly SubModeKey[]

export const SESSION_STORAGE_KEYS: Record<SubModeKey, string> = {
  arena: 'session/v1/arena',
  'basic-system': 'session/v1/basic-system',
  'basic-user': 'session/v1/basic-user',
  'pro-multi': 'session/v1/pro-multi',
  'pro-variable': 'session/v1/pro-variable',
  'image-text2image': 'session/v1/image-text2image',
  'image-image2image': 'session/v1/image-image2image',
  'image-multiimage': 'session/v1/image-multiimage',
}
