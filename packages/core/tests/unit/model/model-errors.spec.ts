import { describe, expect, it } from 'vitest'
import { MODEL_ERROR_CODES } from '../../../src/constants/error-codes'
import { ModelError, ModelValidationError } from '../../../src/services/model/errors'

describe('model errors', () => {
  it('formats model errors with optional message and structured params', () => {
    const withMessage = new ModelError(MODEL_ERROR_CODES.INVALID_CONFIG, '配置缺少模型名称')
    expect(withMessage).toMatchObject({
      name: 'ModelError',
      message: `[${MODEL_ERROR_CODES.INVALID_CONFIG}] 配置缺少模型名称`,
      code: MODEL_ERROR_CODES.INVALID_CONFIG,
      params: { details: '配置缺少模型名称' },
    })

    const withParams = new ModelError(MODEL_ERROR_CODES.NOT_FOUND, '模型不存在', {
      modelId: 'missing-model',
    })
    expect(withParams.params).toEqual({ modelId: 'missing-model' })

    const withoutMessage = new ModelError(MODEL_ERROR_CODES.NOT_FOUND)
    expect(withoutMessage).toMatchObject({
      message: `[${MODEL_ERROR_CODES.NOT_FOUND}]`,
      code: MODEL_ERROR_CODES.NOT_FOUND,
    })
    expect(withoutMessage.params).toBeUndefined()
  })

  it('keeps validation details and original validation error list', () => {
    const errors = ['provider 必填', 'baseURL 格式无效']
    const error = new ModelValidationError('模型配置校验失败', errors)

    expect(error).toMatchObject({
      name: 'ModelValidationError',
      message: `[${MODEL_ERROR_CODES.VALIDATION_ERROR}] 模型配置校验失败`,
      code: MODEL_ERROR_CODES.VALIDATION_ERROR,
      params: { details: '模型配置校验失败' },
      errors,
    })
    expect(error.errors).toBe(errors)
    expect(error).toBeInstanceOf(ModelError)
  })
})
