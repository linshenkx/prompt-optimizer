import { describe, it, expect } from 'vitest'

describe('LLM Mock Service (MSW)', () => {
  it('should intercept OpenAI chat completions and return mock JSON', async () => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: false
      })
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toHaveProperty('choices')
    expect(data.choices[0].message.content).toContain('[Mock Response]')
  })
})

