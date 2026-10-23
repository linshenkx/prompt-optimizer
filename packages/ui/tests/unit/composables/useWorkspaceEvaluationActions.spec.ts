import { describe, expect, it, vi } from 'vitest'
import type { EvaluationDetailTarget } from '../../../src/composables/prompt/useEvaluation'
import { useWorkspaceEvaluationActions } from '../../../src/composables/workspaces/useWorkspaceEvaluationActions'

const createHarness = (refreshActive = false) => {
  const state: { active: EvaluationDetailTarget | null } = { active: null }
  const handler = {
    handleEvaluate: vi.fn(async () => {}),
    handleEvaluateWithFeedback: vi.fn(async () => {}),
    handleReEvaluate: vi.fn(async () => {}),
    handleEvaluateActiveWithFeedback: vi.fn(async () => {}),
  }
  const ensureResultReady = vi.fn(() => true)
  const ensureCompareReady = vi.fn(() => true)
  const onResultEvaluated = vi.fn()
  const onCompareEvaluated = vi.fn()
  const onActiveEvaluated = vi.fn()
  const actions = useWorkspaceEvaluationActions({
    handler,
    getActiveDetail: () => state.active,
    ensureResultReady,
    ensureCompareReady,
    onResultEvaluated,
    onCompareEvaluated,
    onActiveEvaluated: refreshActive ? onActiveEvaluated : undefined,
  })
  return { state, handler, actions, ensureResultReady, ensureCompareReady, onResultEvaluated, onCompareEvaluated, onActiveEvaluated }
}

describe('workspace evaluation actions', () => {
  it('routes result actions and feedback to the selected column only', async () => {
    const h = createHarness()
    await h.actions.handleEvaluateResult('c')
    expect(h.handler.handleEvaluate).toHaveBeenCalledWith('result', { variantId: 'c' })
    await h.actions.handleResultEvaluateWithFeedbackEvent('d', { feedback: '  preserve whitespace  ' })
    expect(h.handler.handleEvaluateWithFeedback).toHaveBeenCalledWith('result', '  preserve whitespace  ', { variantId: 'd' })
    expect(h.ensureResultReady.mock.calls).toEqual([['c'], ['d']])
    expect(h.onResultEvaluated.mock.calls).toEqual([['c'], ['d']])
    expect(h.onCompareEvaluated).not.toHaveBeenCalled()
  })

  it('routes compare and compare-feedback through the same readiness check', async () => {
    const h = createHarness()
    await h.actions.handleEvaluate('compare')
    await h.actions.handleEvaluateWithFeedback({ type: 'compare', feedback: 'compare' })
    expect(h.handler.handleEvaluate).toHaveBeenCalledWith('compare')
    expect(h.handler.handleEvaluateWithFeedback).toHaveBeenCalledWith('compare', 'compare')
    expect(h.ensureCompareReady).toHaveBeenCalledTimes(2)
    expect(h.onCompareEvaluated).toHaveBeenCalledTimes(2)
    expect(h.onResultEvaluated).not.toHaveBeenCalled()
  })

  it('leaves prompt analysis feedback eligibility to the existing handler', async () => {
    const h = createHarness()
    h.ensureResultReady.mockReturnValue(false)
    h.ensureCompareReady.mockReturnValue(false)
    await h.actions.handleEvaluateWithFeedback({ type: 'prompt-only', feedback: 'analyze' })
    expect(h.handler.handleEvaluateWithFeedback).toHaveBeenCalledWith('prompt-only', 'analyze')
    expect(h.ensureResultReady).not.toHaveBeenCalled()
    expect(h.ensureCompareReady).not.toHaveBeenCalled()
    expect(h.onCompareEvaluated).not.toHaveBeenCalled()
  })

  it('does not execute or update fingerprints when either guard blocks an action', async () => {
    const h = createHarness()
    h.ensureResultReady.mockReturnValue(false)
    h.ensureCompareReady.mockReturnValue(false)
    await h.actions.handleEvaluateResult('a')
    await h.actions.handleResultEvaluateWithFeedbackEvent('a', { feedback: 'blocked' })
    await h.actions.handleEvaluate()
    await h.actions.handleEvaluateWithFeedback({ type: 'compare', feedback: 'blocked' })
    expect(h.handler.handleEvaluate).not.toHaveBeenCalled()
    expect(h.handler.handleEvaluateWithFeedback).not.toHaveBeenCalled()
    expect(h.onResultEvaluated).not.toHaveBeenCalled()
    expect(h.onCompareEvaluated).not.toHaveBeenCalled()
  })

  it('runs completion policy after awaiting, using current caller state', async () => {
    const h = createHarness()
    let finish = () => {}
    let fingerprint = 'before'
    h.handler.handleEvaluate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    h.onResultEvaluated.mockImplementation(() => fingerprint)
    const pending = h.actions.handleEvaluateResult('b')
    expect(h.onResultEvaluated).not.toHaveBeenCalled()
    fingerprint = 'after'
    finish()
    await pending
    expect(h.onResultEvaluated).toHaveReturnedWith('after')
  })

  it('preserves failures without running completion hooks', async () => {
    const h = createHarness(true)
    const failure = new Error('request failed')
    h.handler.handleEvaluate.mockRejectedValue(failure)
    await expect(h.actions.handleEvaluateResult('a')).rejects.toBe(failure)
    await expect(h.actions.handleEvaluate()).rejects.toBe(failure)
    expect(h.onResultEvaluated).not.toHaveBeenCalled()
    expect(h.onCompareEvaluated).not.toHaveBeenCalled()
  })

  it('does nothing with no active detail and applies result/compare guards to active actions', async () => {
    const h = createHarness(true)
    await h.actions.handleReEvaluateActive()
    await h.actions.handleEvaluateActiveWithFeedback({ feedback: 'none' })
    h.state.active = { type: 'result', variantId: 'd' }
    h.ensureResultReady.mockReturnValue(false)
    await h.actions.handleReEvaluateActive()
    await h.actions.handleEvaluateActiveWithFeedback({ feedback: 'blocked' })
    expect(h.ensureResultReady).toHaveBeenCalledWith('d')
    h.state.active = { type: 'compare' }
    h.ensureCompareReady.mockReturnValue(false)
    await h.actions.handleReEvaluateActive()
    await h.actions.handleEvaluateActiveWithFeedback({ feedback: 'blocked' })
    expect(h.handler.handleReEvaluate).not.toHaveBeenCalled()
    expect(h.handler.handleEvaluateActiveWithFeedback).not.toHaveBeenCalled()
    expect(h.onActiveEvaluated).not.toHaveBeenCalled()
  })

  it('leaves missing variant eligibility to the caller and forwards active feedback unchanged', async () => {
    const h = createHarness()
    h.state.active = { type: 'result' }
    await h.actions.handleEvaluateActiveWithFeedback({ feedback: '  active  ' })
    expect(h.ensureResultReady).toHaveBeenCalledWith(undefined)
    expect(h.handler.handleEvaluateActiveWithFeedback).toHaveBeenCalledWith('  active  ')
    expect(h.onResultEvaluated).not.toHaveBeenCalled()
    expect(h.onActiveEvaluated).not.toHaveBeenCalled()
  })

  it.each(['re-evaluate', 'feedback'] as const)('captures the original active target for image %s completion', async kind => {
    const h = createHarness(true)
    let finish = () => {}
    const pendingRequest = () => new Promise<void>(resolve => { finish = resolve })
    h.handler.handleReEvaluate.mockImplementation(pendingRequest)
    h.handler.handleEvaluateActiveWithFeedback.mockImplementation(pendingRequest)
    h.state.active = { type: 'result', variantId: 'b' }
    const startedTarget = h.state.active
    const pending = kind === 're-evaluate'
      ? h.actions.handleReEvaluateActive()
      : h.actions.handleEvaluateActiveWithFeedback({ feedback: 'inspect' })
    h.state.active = { type: 'compare' }
    finish()
    await pending
    expect(h.onActiveEvaluated).toHaveBeenCalledExactlyOnceWith(startedTarget)
  })

  it('allows active prompt analysis without result or compare gates', async () => {
    const h = createHarness()
    h.state.active = { type: 'prompt-iterate' }
    await h.actions.handleReEvaluateActive()
    expect(h.handler.handleReEvaluate).toHaveBeenCalledOnce()
    expect(h.ensureResultReady).not.toHaveBeenCalled()
    expect(h.ensureCompareReady).not.toHaveBeenCalled()
  })
})
