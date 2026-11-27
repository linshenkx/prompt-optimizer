import type { VideoCostEstimate, VideoParams, VideoParamValue } from '@prompt-optimizer/core'
import { useI18n } from 'vue-i18n'

export function sameVideoSettings(a: VideoParams, b: VideoParams) {
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value)
}

export function useVideoSettings() {
  const { t, locale } = useI18n()
  const paramLabel = (key: string, value: VideoParamValue) => {
    if (typeof value === 'boolean') return t(value ? 'video.on' : 'video.off')
    if (key === 'duration') return t('video.seconds', { n: value })
    if (key === 'resolution') return String(value).replace(/P$/, 'p')
    if (key === 'ratio' && value === 'adaptive') return t('video.adaptive')
    return String(value)
  }
  const describe = (params: VideoParams) => Object.entries(params).map(([key, value]) => {
    if (key === 'audio' && typeof value === 'boolean') return t(value ? 'video.audioOn' : 'video.audioOff')
    const label = paramLabel(key, value)
    const name = 'video.' + key
    return typeof value === 'boolean' ? (t(name) === name ? key : t(name)) + ' ' + label : label
  }).join(' · ')
  const formatMoney = (amount: number, currency: VideoCostEstimate['currency'], digits = amount > 0 && amount < 0.01 ? 6 : 2) => {
    const symbol = currency === 'CNY' ? '¥' : '$'
    return symbol + amount.toLocaleString(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: digits })
  }
  return { describe, formatMoney, paramLabel }
}
