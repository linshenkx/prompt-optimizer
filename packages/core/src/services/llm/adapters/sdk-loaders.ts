type Loader<T> = () => Promise<T>

export const createRetryableLoader = <T>(loader: Loader<T>): Loader<T> => {
  let pending: Promise<T> | undefined

  return () => {
    if (!pending) {
      pending = loader().catch((error) => {
        pending = undefined
        throw error
      })
    }

    return pending
  }
}

export const loadOpenAISdk = createRetryableLoader(async () => {
  const module = await import('openai')
  return module.default
})

export const loadAnthropicSdk = createRetryableLoader(async () => {
  const module = await import('@anthropic-ai/sdk')
  return module.default
})

export const loadGoogleGenAISdk = createRetryableLoader(async () => {
  const module = await import('@google/genai')
  return module.GoogleGenAI
})
