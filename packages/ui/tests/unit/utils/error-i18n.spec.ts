import { describe, it, expect } from 'vitest'

import { i18n } from '../../../src/plugins/i18n'
import { getI18nErrorMessage } from '../../../src/utils/error'

function setLocale(locale: 'zh-CN' | 'zh-TW' | 'en-US') {
  i18n.global.locale.value = locale
}

describe('getI18nErrorMessage', () => {
  it('同一 code+params 在不同语言下返回不同文本（并包含 details 插值）', () => {
    const error = {
      code: 'error.prompt.optimization',
      params: { details: 'DETAILS_X' },
    }

    setLocale('zh-CN')
    const zh = getI18nErrorMessage(error)

    setLocale('en-US')
    const en = getI18nErrorMessage(error)

    expect(zh).toContain('DETAILS_X')
    expect(en).toContain('DETAILS_X')

    // 确保 i18n 真的生效（语言不同 -> 文本不同）
    expect(zh).not.toBe(en)

    // 不应把 debug 前缀暴露给用户
    expect(zh).not.toContain('[error.')
    expect(en).not.toContain('[error.')
  })

  it('context 插值在不同语言下返回不同文本', () => {
    const error = {
      code: 'error.history.not_found',
      params: { context: 'HISTORY_ID_1' },
    }

    setLocale('zh-TW')
    const zhtw = getI18nErrorMessage(error)

    setLocale('en-US')
    const en = getI18nErrorMessage(error)

    expect(zhtw).toContain('HISTORY_ID_1')
    expect(en).toContain('HISTORY_ID_1')
    expect(zhtw).not.toBe(en)
  })

  it('当 code 不存在或 key 不存在时回退到 error.message', () => {
    const fallbackError = Object.assign(new Error('RAW_MESSAGE'), {
      code: 'error.nonexistent.key',
      params: { details: 'SHOULD_NOT_APPEAR' },
    })

    setLocale('zh-CN')
    const msg = getI18nErrorMessage(fallbackError)
    expect(msg).toBe('RAW_MESSAGE')
  })
})
