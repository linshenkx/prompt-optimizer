import { isVideoParams, type VideoParams } from '@prompt-optimizer/core'
import { useI18n } from 'vue-i18n'

export function sameVideoSettings(a: VideoParams, b: VideoParams) {
  return a.duration === b.duration && a.ratio === b.ratio && a.resolution === b.resolution
}

export function useVideoSettings() {
  const { t } = useI18n()
  const describe = (params: VideoParams) =>
    [t('video.seconds', { n: params.duration }), params.ratio, params.resolution].join(' · ')
  const changeNotice = (before: unknown, current: VideoParams) =>
    isVideoParams(before) && !sameVideoSettings(before, current)
      ? t('video.warning.settingsChanged', { before: describe(before), after: describe(current) })
      : ''
  return { describe, changeNotice }
}
