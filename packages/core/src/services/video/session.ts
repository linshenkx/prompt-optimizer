import { z } from 'zod'
import { getVideoModelSpec, MINIMAX_INTL_VIDEO_BASE_URL, videoUsageCost } from '../video-model/catalog'
import { defaultVideoConfig, legacyVideoModelId } from '../video-model/manager'
import { inferVideoCapabilityMode } from './params'
import { MAX_STORED_VIDEO_REFERENCES, VIDEO_CAPABILITY_MODES, VIDEO_PROVIDER_IDS, VIDEO_ROLES, VIDEO_STATUSES } from './types'

const params = z.record(z.string(), z.union([z.number().finite(), z.string(), z.boolean()]))
const capabilityMode = z.enum(VIDEO_CAPABILITY_MODES)
const providerId = z.enum(VIDEO_PROVIDER_IDS)
const cost = z.object({
  amount: z.number().nonnegative(), currency: z.enum(['CNY', 'USD']), basis: z.string(), estimated: z.boolean().optional(),
})
const usage = z.object({
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  outputSeconds: z.number().nonnegative().optional(),
})
const storedImage = z.object({
  _type: z.literal('image-ref'), id: z.string().min(1), name: z.string(),
  role: z.enum([...VIDEO_ROLES, 'character', 'style']),
}).strict()
type StoredImage = z.infer<typeof storedImage>
export type VideoImageRef = Omit<StoredImage, 'role'> & { role: typeof VIDEO_ROLES[number] }
const imageMode = z.enum(['references', 'frames'])

function normalizeImage(image: StoredImage): VideoImageRef {
  const { role } = image
  return { ...image, role: role === 'character' || role === 'style' ? 'reference_image' : role }
}

function restoreDraftImages(images: StoredImage[]) {
  // Legacy drafts could mix modes and have multiple images assigned to a frame slot.
  // Keep the first valid pair of slots and recover the remaining images as ordinary references.
  const first = images.findIndex(image => image.role === 'first_frame')
  const last = first < 0 ? -1 : images.findIndex(image => image.role === 'last_frame')
  return images.map((image, index): VideoImageRef => ({
    ...image, role: index === first ? 'first_frame' : index === last ? 'last_frame' : 'reference_image',
  }))
}
const address = z.string().url().regex(/^https:\/\//i)
export const VIDEO_VARIANT_IDS = ['a', 'b', 'c', 'd'] as const
export type VideoVariantId = typeof VIDEO_VARIANT_IDS[number]
const column = z.object({
  source: z.string(), configId: z.string(), modelId: z.string().min(1).optional(), params: params.optional(),
  selectedRunKey: z.string().optional(), // Accepted when reading sessions saved with the old result picker.
}).strict().transform(({ selectedRunKey: _selectedRunKey, ...column }) => column)
const columns = z.object({ a: column, b: column, c: column, d: column }).strict()
const defaultColumns = (configId: string): z.infer<typeof columns> => ({
  a: { source: 'original', configId, params: undefined }, b: { source: 'workspace', configId, params: undefined },
  c: { source: 'workspace', configId, params: undefined }, d: { source: 'workspace', configId, params: undefined },
})
const job = z.object({
  localId: z.string().min(1).optional(), variantId: z.enum(VIDEO_VARIANT_IDS).optional(),
  source: z.string().optional(), sourceVersion: z.number().int().nonnegative().optional(), modelName: z.string().optional(),
  providerId: providerId.optional(), modelId: z.string().optional(), capabilityMode: capabilityMode.optional(),
  cost: cost.nullable().optional(), usage: usage.optional(),
  cnyPerMillionTokens: z.number().nonnegative().nullable().optional(),
  id: z.string().regex(/^[\w.-]+$/).optional(), status: z.enum([...VIDEO_STATUSES, 'submitting', 'unknown', 'untracked'] as const),
  configId: z.string().min(1).optional(), configModelId: z.string().min(1).optional(), baseURL: z.string().url().optional(),
  prompt: z.string(), submittedPrompt: z.string().optional(), model: z.string(), params, images: z.array(storedImage).max(MAX_STORED_VIDEO_REFERENCES), submittedAt: z.number(),
  videoUrl: address.optional(), coverUrl: address.optional(), expiresAt: z.number().optional(),
  tokens: z.number().int().nonnegative().optional(), totalTokens: z.number().int().nonnegative().optional(), error: z.string().optional(),
}).strict().refine(j => !!j.id || ['submitting','unknown','failed','untracked'].includes(j.status))
  .transform(run => {
    const { images, submittedPrompt, tokens, totalTokens, cnyPerMillionTokens, ...rest } = run
    // Runs that predate submittedPrompt used the numbered role suffix below.
    const notes = submittedPrompt === undefined ? images.flatMap(({ role }, index) =>
      role === 'character' || role === 'style' ? ['Image ' + (index + 1) + ': ' + role + ' reference.'] : []) : []
    const refs = images.map(normalizeImage)
    const mode = run.capabilityMode ?? inferVideoCapabilityMode(refs)
    const defaults = defaultVideoConfig()
    const baseURL = run.baseURL ?? (run.configId ? '' : defaults.baseURL)
    const modelId = run.modelId ?? legacyVideoModelId(run.model)
    const rawProvider = run.providerId ?? getVideoModelSpec(modelId)?.providerId ?? defaults.providerId
    const providerId = rawProvider === 'minimax' && baseURL.replace(/\/+$/, '') === MINIMAX_INTL_VIDEO_BASE_URL
      ? 'minimax-intl' : rawProvider
    const usage = run.usage ?? (tokens != null || totalTokens != null
      ? { ...(tokens != null && { outputTokens: tokens }), ...(totalTokens != null && { totalTokens }) } : undefined)
    const pricing = run.model === modelId ? getVideoModelSpec(modelId, providerId)?.pricing : undefined
    const ctx = { baseURL, mode, images: refs }
    const cost = run.cost !== undefined ? run.cost
      : cnyPerMillionTokens === null ? null
      : cnyPerMillionTokens != null && tokens != null
        ? { amount: videoUsageCost(tokens, cnyPerMillionTokens), currency: 'CNY' as const, basis: 'outputTokens' }
        : (usage && pricing?.actual?.(usage, run.params, ctx)) ?? pricing?.estimate(run.params, ctx) ?? null
    return { ...rest, ...(baseURL && { baseURL }), modelId, providerId, capabilityMode: mode, cost, images: refs,
      ...(usage && { usage }),
      ...(notes.length ? { submittedPrompt: run.prompt + '\n\n' + notes.join(' ') }
        : submittedPrompt === undefined ? {} : { submittedPrompt }) }
  })
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
  params: params.optional(),
  capabilityMode: capabilityMode.optional(), splitParams: z.array(z.string()).default([]),
  draftParams: params.optional(), // Accepted when reading older drafts.
  imageMode: imageMode.optional(),
  lastGeneratedPrompt: z.string().optional(), currentVersionId: z.string().nullable().optional(),
  // Older drafts stored the selected format and compiler output separately.
  style: z.enum(['auto','structured','compact']).optional(),
  images: z.array(storedImage).max(MAX_STORED_VIDEO_REFERENCES + 2).default([]), runs: z.array(job).default([]),
  spec: z.unknown().optional(),
  compiledPrompt: z.string().default(''), evaluation: z.object({ prompt: z.string(), text: z.string() }).nullable().default(null),
}).strict().transform(({ style, spec: _spec, compiledPrompt, lastGeneratedPrompt, columns, selectedVideoConfigId,
  draftParams: _draftParams, params, capabilityMode, imageMode, images, ...state }) => {
  const restoredImages = restoreDraftImages(images)
  const legacyActiveImages = imageMode === 'references'
    ? restoredImages.filter(image => image.role === 'reference_image') : restoredImages
  const selectedMode = capabilityMode ?? (imageMode === 'frames' ? imageMode : inferVideoCapabilityMode(legacyActiveImages))
  const restoredColumns = columns ?? defaultColumns(selectedVideoConfigId)
  const migrated = Object.fromEntries(VIDEO_VARIANT_IDS.map(id =>
    [id, { ...restoredColumns[id], params: { ...(restoredColumns[id].params ?? params ?? {}) } }]
  )) as Record<VideoVariantId, Omit<z.infer<typeof column>, 'params'> & { params: Record<string, string | number | boolean> }>
  return {
    ...state, columns: migrated,
    selectedTemplateId: state.selectedTemplateId ?? (style === 'compact' ? 'video-natural' : null),
    lastGeneratedPrompt: lastGeneratedPrompt ?? compiledPrompt,
    capabilityMode: selectedMode, images: restoredImages,
  }
}).refine(state => state.images.filter(image => image.role === 'reference_image').length <= MAX_STORED_VIDEO_REFERENCES)
export type VideoCreateSessionState = z.infer<typeof snapshot>
export const createDefaultVideoCreateState = (): VideoCreateSessionState => snapshot.parse({
  originalPrompt: '', optimizedPrompt: '', currentVersionId: null, lastActiveAt: Date.now(),
})
export const readVideoSession = (raw: unknown) => snapshot.parse(raw)
export const isVideoSession = (raw: unknown) => snapshot.safeParse(raw).success
