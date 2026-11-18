const CONNECTION_KEYS = /^(?:__proto__|prototype|constructor|api.?key|secret|client.?secret|access.?token|refresh.?token|password|authorization|credentials?|headers|base.?url|endpoint)$/i

/** Connection fields are excluded only at the parameter boundary; nested JSON is business data. */
export function cleanLocalParameterOverrides(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const ancestors = new WeakSet<object>()
  const clean = (item: unknown): unknown => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item
    if (typeof item === 'number') return Number.isFinite(item) ? item : undefined
    if (typeof item !== 'object' || ancestors.has(item)) return undefined
    ancestors.add(item)
    const result = Array.isArray(item) ? item.map(entry => clean(entry) ?? null)
      : Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, clean(entry)]).filter(([, entry]) => entry !== undefined))
    ancestors.delete(item)
    return result
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => !CONNECTION_KEYS.test(key))
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, clean(item)])
    .filter(([, item]) => item !== undefined))
}
