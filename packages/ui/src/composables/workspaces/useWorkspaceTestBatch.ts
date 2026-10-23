import { runTasksWithExecutionMode } from '../../utils/runTasksSequentially'

interface PreparedTestBatch<TId> {
  run: (id: TId) => Promise<boolean>
  complete: (results: readonly boolean[]) => void
}

interface WorkspaceTestBatchOptions<TId> {
  isRunning: () => boolean
  getIds: () => readonly TId[]
  validate: (id: TId) => unknown
  prepare: (ids: readonly TId[]) => PreparedTestBatch<TId>
}

/**
 * Share only the batch boundary: guard, validate every column, dispatch and finish.
 * Preparation runs once after validation, so each workspace can capture per-click
 * inputs and keep its own evaluation, persistence and notification policies.
 * Per-column execution owns busy state and errors; scheduling uses the existing
 * environment policy without adding another lock or changing rejection behavior.
 */
export function useWorkspaceTestBatch<TId>(options: WorkspaceTestBatchOptions<TId>) {
  return async () => {
    if (options.isRunning()) return

    const ids = options.getIds()
    for (const id of ids) {
      if (!options.validate(id)) return
    }

    const batch = options.prepare(ids)
    const results = await runTasksWithExecutionMode(ids, (id) => batch.run(id))
    batch.complete(results)
  }
}
