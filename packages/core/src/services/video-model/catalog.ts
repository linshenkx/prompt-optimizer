import type { VideoCapabilities, VideoCostEstimate, VideoModelSpec, VideoParamDefinition, VideoParams, VideoProviderId } from '../video/types'

export const SEEDANCE_MODEL = 'doubao-seedance-2-0-fast-260128'
export const SEEDANCE_FLAGSHIP = 'doubao-seedance-2-5-260628'
export const BYTEPLUS_SEEDANCE_FLAGSHIP = 'dreamina-seedance-2-5-260628'
export const BYTEPLUS_SEEDANCE_FAST = 'dreamina-seedance-2-0-fast-260128'
export const MINIMAX_H3 = 'MiniMax-H3'
export const MINIMAX_H3_HIGHSPEED = 'MiniMax-H3-Highspeed'
export const MINIMAX_H3_LITE = 'MiniMax-H3-Lite'
export const MINIMAX_H3_MODELS: readonly string[] = [MINIMAX_H3_LITE, MINIMAX_H3_HIGHSPEED, MINIMAX_H3]
export const ARK_VIDEO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
export const BYTEPLUS_VIDEO_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3'
export const MINIMAX_CN_VIDEO_BASE_URL = 'https://api.minimax.cn'
export const MINIMAX_INTL_VIDEO_BASE_URL = 'https://api.minimax.io'

export interface VideoProviderSpec {
  id: VideoProviderId
  labelKey: string
  defaultBaseURL: string
  currency: VideoCostEstimate['currency']
  apiKeyUrl: string
  envKeys: readonly string[]
  defaultModelId: string
}
export const VIDEO_PROVIDERS: Readonly<Record<VideoProviderId, VideoProviderSpec>> = {
  ark: {
    id: 'ark', labelKey: 'video.providers.ark', defaultBaseURL: ARK_VIDEO_BASE_URL, currency: 'CNY',
    apiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    envKeys: ['VITE_SEEDANCE_API_KEY', 'ARK_API_KEY', 'VITE_ARK_API_KEY', 'VITE_SEEDREAM_API_KEY'],
    defaultModelId: SEEDANCE_MODEL,
  },
  byteplus: {
    id: 'byteplus', labelKey: 'video.providers.byteplus', defaultBaseURL: BYTEPLUS_VIDEO_BASE_URL, currency: 'USD',
    apiKeyUrl: 'https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey',
    envKeys: ['VITE_BYTEPLUS_API_KEY', 'BYTEPLUS_API_KEY'],
    defaultModelId: BYTEPLUS_SEEDANCE_FAST,
  },
  minimax: {
    id: 'minimax', labelKey: 'video.providers.minimax', defaultBaseURL: MINIMAX_CN_VIDEO_BASE_URL, currency: 'CNY',
    apiKeyUrl: 'https://platform.minimax.cn/console/keys',
    envKeys: ['VITE_MINIMAX_API_KEY', 'MINIMAX_API_KEY'],
    defaultModelId: MINIMAX_H3_LITE,
  },
  'minimax-intl': {
    id: 'minimax-intl', labelKey: 'video.providers.minimaxIntl', defaultBaseURL: MINIMAX_INTL_VIDEO_BASE_URL, currency: 'USD',
    apiKeyUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
    envKeys: ['VITE_MINIMAX_INTL_API_KEY', 'MINIMAX_INTL_API_KEY'],
    defaultModelId: MINIMAX_H3_LITE,
  },
}
export function isOfficialVideoBaseURL(providerId: VideoProviderId, baseURL: string) {
  const url = baseURL.trim().replace(/\/+$/, '')
  return url === VIDEO_PROVIDERS[providerId].defaultBaseURL ||
    (providerId === 'minimax' && url === 'https://api.minimaxi.com')
}

const range = (min: number, max: number, defaultValue: number): VideoParamDefinition =>
  ({ key: 'duration', labelKey: 'video.duration', kind: 'int-range', min, max, step: 1, defaultValue })
const choose = (key: string, options: readonly (string | number)[], defaultValue = options[0]): VideoParamDefinition =>
  ({ key, labelKey: 'video.' + key, kind: 'enum', options, defaultValue })
const toggle = (key: string): VideoParamDefinition =>
  ({ key, labelKey: 'video.' + key, kind: 'boolean', defaultValue: false })
const ratios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
const adaptive = [...ratios, 'adaptive']
const full = (maxReferenceImages: number, supportsCancel: boolean): VideoCapabilities =>
  ({ text2video: true, firstFrame: true, firstLastFrame: true, maxReferenceImages, supportsCancel })
const concreteRatio = (defs: readonly VideoParamDefinition[]) =>
  (_draft: VideoParams, { mode }: Parameters<NonNullable<VideoModelSpec['resolveParams']>>[1]) =>
    mode === 'text2video' ? defs.map(def => def.key === 'ratio' ? choose('ratio', ratios) : def) : defs

const arkPixels: Record<string, Record<string, number>> = {
  '480p': { '16:9': 864*496, '9:16': 496*864, '4:3': 752*560, '3:4': 560*752, '1:1': 640*640, '21:9': 992*432 },
  '720p': { '16:9': 1280*720, '9:16': 720*1280, '4:3': 1112*834, '3:4': 834*1112, '1:1': 960*960, '21:9': 1470*630 },
  '1080p': { '16:9': 1920*1080, '9:16': 1080*1920, '4:3': 1664*1248, '3:4': 1248*1664, '1:1': 1440*1440, '21:9': 2208*946 },
}
export const videoUsageCost = (outputTokens: number, rate: number) => outputTokens * rate / 1_000_000
export function estimateVideoCost(params: VideoParams, rate = 37) {
  const pixels = arkPixels[String(params.resolution)]
  return videoUsageCost((pixels?.[String(params.ratio)] ?? pixels?.['16:9'] ?? 0) * 24 * Number(params.duration) / 1024, rate)
}
function tokenPricing(providerId: 'ark' | 'byteplus', rates: number | Record<string, number>): VideoModelSpec['pricing'] {
  const currency = VIDEO_PROVIDERS[providerId].currency
  const rateFor = (params: VideoParams) => typeof rates === 'number' ? rates : rates[String(params.resolution)]
  return {
    estimate(params, { baseURL }) {
      const rate = rateFor(params)
      return isOfficialVideoBaseURL(providerId, baseURL) && rate != null
        ? { amount: estimateVideoCost(params, rate), currency, basis: 'outputTokens', estimated: true } : null
    },
    actual(usage, params, { baseURL }) {
      const rate = rateFor(params)
      return isOfficialVideoBaseURL(providerId, baseURL) && usage.outputTokens != null && rate != null
        ? { amount: videoUsageCost(usage.outputTokens, rate), currency, basis: 'outputTokens' } : null
    },
  }
}

function fixedPricing(providerId: 'minimax' | 'minimax-intl', basis: 'duration' | 'clip',
  rates: Record<string, number>, extraImageRate = 0): VideoModelSpec['pricing'] {
  const currency = VIDEO_PROVIDERS[providerId].currency
  return {
    estimate(params, { baseURL, images }) {
      const rate = rates[basis === 'duration' ? String(params.resolution) : params.resolution + '/' + params.duration]
      if (!isOfficialVideoBaseURL(providerId, baseURL) || rate == null) return null
      const imageCost = Math.max(0, images.length - 5) * extraImageRate
      const amount = rate * (basis === 'duration' ? Number(params.duration) : 1) + imageCost
      return { amount, currency, basis: imageCost > 0 ? 'durationAndImages' : basis, estimated: true }
    },
  }
}
function hailuo(providerId: 'minimax' | 'minimax-intl', id: string, name: string,
  text2video: boolean, firstLastFrame: boolean, rates: Record<string, number>): VideoModelSpec {
  const resolutions = ['768P', '1080P']
  const params = [choose('resolution', firstLastFrame ? ['512P', ...resolutions] : resolutions),
    choose('duration', [6, 10]), toggle('promptOptimizer')]
  return {
    id, name, providerId, legacy: true,
    capabilities: { text2video, firstFrame: true, firstLastFrame, maxReferenceImages: 0, supportsCancel: false },
    params,
    resolveParams(draft, { images }) {
      return [
        firstLastFrame && images.some(image => image.role === 'last_frame') ? choose('resolution', resolutions) : params[0],
        draft.resolution === '1080P' ? choose('duration', [6]) : params[1],
        params[2],
      ]
    },
    pricing: fixedPricing(providerId, 'clip', rates),
  }
}
const flagshipParams = [range(4, 30, 5), choose('resolution', ['480p', '720p', '1080p'], '720p'),
  choose('ratio', adaptive), toggle('audio')]
const fastParams = [range(4, 15, 4), choose('resolution', ['480p', '720p']), choose('ratio', ratios), toggle('audio')]
function h3(providerId: 'minimax' | 'minimax-intl', id: string, name: string,
  rates: Record<string, number>, extraImageRate: number): VideoModelSpec {
  const params = [range(4, 15, id === MINIMAX_H3_LITE ? 4 : 6),
    choose('resolution', Object.keys(rates)), choose('ratio', adaptive), toggle('audio')]
  return {
    id, name, providerId, capabilities: full(9, false), params,
    resolveParams(_draft, { mode }) {
      const options = mode === 'frames' ? ['adaptive'] : mode === 'text2video' || id === MINIMAX_H3_LITE ? ratios : adaptive
      return [params[0], params[1], choose('ratio', options), params[3]]
    },
    pricing: fixedPricing(providerId, 'duration', rates, extraImageRate),
  }
}
const hailuo23CN = { '768P/6': 2, '768P/10': 4, '1080P/6': 3.5 }
const hailuo23USD = { '768P/6': .28, '768P/10': .56, '1080P/6': .49 }
export const VIDEO_MODEL_SPECS: readonly VideoModelSpec[] = [
  { id: SEEDANCE_FLAGSHIP, providerId: 'ark', name: 'Seedance 2.5', capabilities: full(4, true),
    params: flagshipParams, resolveParams: concreteRatio(flagshipParams), pricing: tokenPricing('ark', 70) },
  { id: SEEDANCE_MODEL, providerId: 'ark', name: 'Seedance 2.0 Fast', capabilities: full(4, true),
    params: fastParams, pricing: tokenPricing('ark', 37) },
  { id: BYTEPLUS_SEEDANCE_FLAGSHIP, providerId: 'byteplus', name: 'Dreamina Seedance 2.5', capabilities: full(4, true),
    params: flagshipParams, resolveParams: concreteRatio(flagshipParams),
    pricing: tokenPricing('byteplus', { '480p': 10.7, '720p': 10.7, '1080p': 11.7 }) },
  { id: BYTEPLUS_SEEDANCE_FAST, providerId: 'byteplus', name: 'Dreamina Seedance 2.0 Fast', capabilities: full(4, true),
    params: fastParams, pricing: tokenPricing('byteplus', 5.6) },
  h3('minimax', MINIMAX_H3_LITE, 'MiniMax H3 Lite', { '480P': .16, '768P': .26 }, .13),
  h3('minimax', MINIMAX_H3_HIGHSPEED, 'MiniMax H3 Highspeed', { '480P': .26, '768P': .40 }, .20),
  h3('minimax', MINIMAX_H3, 'MiniMax H3', { '768P': .50, '2K': .80 }, .20),
  hailuo('minimax', 'MiniMax-Hailuo-2.3', 'Hailuo 2.3', true, false, hailuo23CN),
  hailuo('minimax', 'MiniMax-Hailuo-2.3-Fast', 'Hailuo 2.3 Fast', false, false, { '768P/6': 1.35, '768P/10': 2.25, '1080P/6': 2.31 }),
  hailuo('minimax', 'MiniMax-Hailuo-02', 'Hailuo 02', true, true, { '512P/6': .6, '512P/10': 1, ...hailuo23CN }),
  h3('minimax-intl', MINIMAX_H3_LITE, 'MiniMax H3 Lite', { '480P': .025, '768P': .04 }, .02),
  h3('minimax-intl', MINIMAX_H3_HIGHSPEED, 'MiniMax H3 Highspeed', { '480P': .04, '768P': .06 }, .03),
  h3('minimax-intl', MINIMAX_H3, 'MiniMax H3', { '768P': .08, '2K': .13 }, .04),
  hailuo('minimax-intl', 'MiniMax-Hailuo-2.3', 'Hailuo 2.3', true, false, hailuo23USD),
  hailuo('minimax-intl', 'MiniMax-Hailuo-2.3-Fast', 'Hailuo 2.3 Fast', false, false, { '768P/6': .19, '768P/10': .32, '1080P/6': .33 }),
  hailuo('minimax-intl', 'MiniMax-Hailuo-02', 'Hailuo 02', true, true, { '512P/6': .10, '512P/10': .15, ...hailuo23USD }),
]
export const getVideoModelSpec = (modelId: string, providerId?: VideoProviderId) =>
  VIDEO_MODEL_SPECS.find(spec => spec.id === modelId && (!providerId || spec.providerId === providerId))
export const listVideoModelPresets = (providerId: VideoProviderId, retainedModelId?: string) =>
  VIDEO_MODEL_SPECS.filter(spec => spec.providerId === providerId && (!spec.legacy || spec.id === retainedModelId))

type VideoModelEndpoint = { providerId: VideoProviderId; baseURL: string; modelId: string; customModel?: string }
export function resolveVideoConfigModel<T extends VideoModelEndpoint>(config: T, modelId: string): T | undefined {
  if (modelId === config.modelId) return config
  const spec = getVideoModelSpec(modelId, config.providerId)
  if (!spec || spec.legacy || config.customModel || !isOfficialVideoBaseURL(config.providerId, config.baseURL)) return undefined
  return { ...config, modelId }
}

export const videoWireModel = (config: { modelId: string; customModel?: string }) => config.customModel || config.modelId
export const DEFAULT_VIDEO_PARAMS = { duration: 4, ratio: '16:9', resolution: '480p' } as const

export function videoTokenRate(model: string, baseURL?: string) {
  if (!baseURL || !isOfficialVideoBaseURL('ark', baseURL)) return null
  if (model === SEEDANCE_MODEL) return 37
  return model === SEEDANCE_FLAGSHIP ? 70 : null
}
