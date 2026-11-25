import type { ComparisonViewer, SavedComparison, SavedComparisonSummary } from '../text-comparison/types'
import { uuid, ComparisonRepositoryError } from '../text-comparison/validation'
import { DesktopRunRepositoryError, type DesktopRun, type DesktopRunRepository } from './repository'

function header(item: Pick<SavedComparisonSummary, 'id' | 'savedAt' | 'title'>): DesktopRun {
  return { id: item.id, kind: 'test-batch', saved: true, status: 'succeeded', createdAt: item.savedAt,
    updatedAt: item.savedAt, requestKey: item.id, requestHash: '', ownerId: '', input: { title: item.title } }
}

function asRun(comparison: SavedComparison): DesktopRun {
  const candidates = comparison.runs.map((run, index) => {
    const alternate = index === 1 ? comparison.candidatePrompt : undefined
    const prompt = alternate?.request ?? comparison.request
    return { modelKey: run.model.configKey, userPrompt: prompt.messages[0].content, rawUserPrompt: prompt.rawPrompt,
      variables: prompt.variables, source: alternate?.kind === 'draft' ? undefined : { ...comparison.source,
        versionId: alternate?.kind === 'saved-version' ? alternate.versionId : comparison.source.versionId } }
  })
  return {
    ...header({ ...comparison, title: comparison.source.title }),
    input: { title: comparison.source.title, request: { candidates }, executionSource: comparison.executionSource,
      executionModels: comparison.runs.map(run => ({ ...run.model, effective: run.effective })) },
    output: comparison.runs.map(run => ({ id: run.id, status: run.status === 'success' ? 'succeeded' :
      run.status === 'error' ? 'failed' : 'cancelled', output: run.output, reasoning: run.reasoning,
      startedAt: run.startedAt, completedAt: run.completedAt, ...(run.errorCode && { error: { code: run.errorCode } }) })),
  }
}

/** Read current runs and previously saved comparisons from their original repositories. */
export function createRunArchive(runs: DesktopRunRepository, comparisons: ComparisonViewer) {
  async function oldRecord(id: string) {
    if (uuid(id)) {
      try { return await comparisons.get(id) }
      catch (error) {
        if (!(error instanceof ComparisonRepositoryError) || error.code !== 'COMPARISON_NOT_FOUND') throw error
      }
    }
  }
  return {
    async list() {
      const items = (await runs.list()).filter(run => !run.deleted)
      const ids = new Set(items.map(run => run.id))
      let cursor: string | undefined
      do {
        const page = await comparisons.list({ limit: 100, cursor })
        for (const item of page.items) if (!ids.has(item.id)) items.push(header(item))
        cursor = page.nextCursor
      } while (cursor)
      return items.sort((left, right) => right.createdAt - left.createdAt)
    },
    async get(id: string) {
      try { return await runs.get(id) }
      catch (error) {
        if (!(error instanceof DesktopRunRepositoryError) || error.code !== 'RUN_NOT_FOUND') throw error
        const previous = await oldRecord(id)
        if (!previous) throw error
        return asRun(previous.comparison)
      }
    },
    async delete(id: string, expectedUpdatedAt: number) {
      if ((await runs.list()).some(run => run.id === id)) return runs.delete(id, expectedUpdatedAt)
      const previous = await oldRecord(id)
      if (!previous) return
      if (previous.comparison.savedAt !== expectedUpdatedAt) throw new DesktopRunRepositoryError('REVISION_CONFLICT')
      await comparisons.delete(id, previous.revision)
    },
  }
}
