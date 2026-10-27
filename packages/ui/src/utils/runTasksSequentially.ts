export async function runTasksSequentially<T, TResult>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = []

  for (let index = 0; index < items.length; index += 1) {
    results.push(await task(items[index]!, index))
  }

  return results
}

export type TaskExecutionMode = 'parallel' | 'sequential'

export function detectTaskExecutionMode(): TaskExecutionMode {
  // Acceptance and production must exercise the same scheduler. Callers that
  // need ordering opt in explicitly; browser automation is not a product mode.
  return 'parallel'
}

export async function runTasksWithExecutionMode<T, TResult>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<TResult>,
  options?: {
    mode?: TaskExecutionMode
  },
): Promise<TResult[]> {
  const mode = options?.mode ?? detectTaskExecutionMode()

  if (mode === 'sequential') {
    return runTasksSequentially(items, task)
  }

  return Promise.all(items.map((item, index) => task(item, index)))
}
