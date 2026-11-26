import { z } from 'zod'
import { DEFAULT_VIDEO_PARAMS, VIDEO_RATIOS, VIDEO_RESOLUTIONS, VIDEO_ROLES, VIDEO_STATUSES } from './seedance'

const params = z.object({ duration: z.number().int().min(4).max(15), ratio: z.enum(VIDEO_RATIOS), resolution: z.enum(VIDEO_RESOLUTIONS) })
const image = z.object({ _type: z.literal('image-ref'), id: z.string().min(1), name: z.string(), role: z.enum(VIDEO_ROLES) }).strict()
export type VideoImageRef = z.infer<typeof image>
const address = z.string().url().regex(/^https:\/\//i)
export const VIDEO_VARIANT_IDS = ['a', 'b', 'c', 'd'] as const
export type VideoVariantId = typeof VIDEO_VARIANT_IDS[number]
const column = z.object({ source: z.string(), configId: z.string(), selectedRunKey: z.string().optional() }).strict()
const columns = z.object({ a: column, b: column, c: column, d: column }).strict()
const defaultColumns = (configId: string): z.infer<typeof columns> => ({
  a: { source: 'original', configId }, b: { source: 'workspace', configId },
  c: { source: 'workspace', configId }, d: { source: 'workspace', configId },
})
const job = z.object({
  localId: z.string().min(1).optional(), variantId: z.enum(VIDEO_VARIANT_IDS).optional(),
  source: z.string().optional(), sourceVersion: z.number().int().nonnegative().optional(), modelName: z.string().optional(),
  cnyPerMillionTokens: z.number().nonnegative().nullable().optional(),
  id: z.string().regex(/^[\w.-]+$/).optional(), status: z.enum([...VIDEO_STATUSES, 'submitting', 'unknown', 'untracked'] as const),
  configId: z.string().min(1).optional(), baseURL: z.string().url().optional(),
  prompt: z.string(), submittedPrompt: z.string().optional(), model: z.string(), params, images: z.array(image).max(4), submittedAt: z.number(),
  videoUrl: address.optional(), coverUrl: address.optional(), expiresAt: z.number().optional(),
  tokens: z.number().optional(), totalTokens: z.number().int().nonnegative().optional(), error: z.string().optional(),
}).strict().refine(j => !!j.id || ['submitting','unknown','failed','untracked'].includes(j.status))
export type VideoRun = z.infer<typeof job>
// Older single-column runs used the workspace prompt and had no local submission ID.
export const videoRunKey = (run: VideoRun) =>
  run.localId ?? JSON.stringify([run.configId, run.id, run.submittedAt])
export const videoRunVariant = (run: VideoRun): VideoVariantId => run.variantId ?? 'b'

const snapshot = z.object({
  originalPrompt: z.string(), optimizedPrompt: z.string(), selectedTextModelKey: z.string().default(''),
  selectedVideoConfigId: z.string().default(''),
  columnCount: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  columns: columns.optional(),
  selectedTemplateId: z.string().nullable().default(null), selectedIterateTemplateId: z.string().nullable().default(null),
  currentChainId: z.string().nullable().default(null), lastActiveAt: z.number().default(0),
  mainSplitLeftPct: z.number().min(25).max(50).default(50),
  params: params.default(DEFAULT_VIDEO_PARAMS),
  draftParams: params.optional(),
  lastGeneratedPrompt: z.string().optional(), currentVersionId: z.string().nullable().optional(),
  // Older drafts stored the selected format and compiler output separately.
  style: z.enum(['auto','structured','compact']).optional(),
  images: z.array(image).max(4).default([]), runs: z.array(job).default([]),
  spec: z.unknown().optional(),
  compiledPrompt: z.string().default(''), evaluation: z.object({ prompt: z.string(), text: z.string() }).nullable().default(null),
}).strict().transform(({ style, spec: _spec, compiledPrompt, lastGeneratedPrompt, columns, selectedVideoConfigId, ...state }) => ({
  ...state, columns: columns ?? defaultColumns(selectedVideoConfigId),
  selectedTemplateId: state.selectedTemplateId ?? (style === 'compact' ? 'video-natural' : null),
  lastGeneratedPrompt: lastGeneratedPrompt ?? compiledPrompt,
}))
export type VideoCreateSessionState = z.infer<typeof snapshot>
export const createDefaultVideoCreateState = (): VideoCreateSessionState => snapshot.parse({
  originalPrompt: '', optimizedPrompt: '', currentVersionId: null, lastActiveAt: Date.now(),
})
export const readVideoSession = (raw: unknown) => snapshot.parse(raw)
export const isVideoSession = (raw: unknown) => snapshot.safeParse(raw).success
