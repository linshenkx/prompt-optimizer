import { describe, expect, it } from 'vitest'
import { pruneVideoRuns, readVideoSession, type VideoRun } from '../../../src/services/video/session'
import { SEEDANCE_MODEL } from '../../../src/services/video-model/catalog'

const run = (id: string, status: VideoRun['status'], variantId?: VideoRun['variantId']) =>
  ({ id, status, variantId, prompt: id, model: SEEDANCE_MODEL, params: {}, images: [] })

describe('video snapshots', () => {
  it('keeps every active run and the newest terminal run per variant in snapshot order', () => {
    const records = [
      run('submitting', 'submitting', 'a'), run('latest-a', 'succeeded', 'a'), run('old-a', 'failed', 'a'),
      run('unknown', 'unknown', 'b'), run('queued', 'queued', 'b'), run('running', 'running', 'd'),
      run('latest-b', 'untracked', 'b'), run('old-b', 'succeeded'),
      run('latest-c', 'expired', 'c'), run('latest-d', 'cancelled', 'd'), run('old-d', 'succeeded', 'd'),
    ].map((item, i, all) => ({ ...item, submittedAt: all.length - i }))
    const snapshot = readVideoSession({ originalPrompt: '', optimizedPrompt: '', runs: records })
    expect(snapshot.runs.map(item => item.id)).toEqual(records.map(item => item.id))
    expect(pruneVideoRuns(snapshot.runs).map(item => item.id)).toEqual([
      'submitting', 'latest-a', 'unknown', 'queued', 'running', 'latest-b', 'latest-c', 'latest-d',
    ])
  })

  it('keeps both legacy positions while column A uses the second one as its fallback', () => {
    const records = [
      run('latest-b', 'succeeded', 'b'), run('legacy-b', 'succeeded'),
      run('legacy-a', 'failed'), run('legacy-old', 'succeeded'),
    ].map((item, i, all) => ({ ...item, submittedAt: all.length - i }))
    const snapshot = readVideoSession({ originalPrompt: '', optimizedPrompt: '', runs: records })
    const pruned = pruneVideoRuns(snapshot.runs)
    expect(pruned.map(item => item.id)).toEqual(['latest-b', 'legacy-b', 'legacy-a'])
    expect(pruneVideoRuns(pruned)).toEqual(pruned)
    const explicitA: VideoRun = { ...pruned[0], id: 'explicit-a', variantId: 'a', submittedAt: 5 }
    expect(pruneVideoRuns([explicitA, ...pruned]).map(item => item.id)).toEqual(['explicit-a', 'latest-b'])
  })
})
