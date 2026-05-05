import { describe, expect, it } from 'vitest'

import {
  OPTIONAL_VARIABLE_PLACEHOLDER,
  applyWorkspaceTemporaryVariables,
  type WorkspaceTemporaryVariablesSession,
} from '../../../src/utils/workspace-external-apply'

const createSession = (
  initial: Record<string, string> = {},
): WorkspaceTemporaryVariablesSession & { values: Record<string, string> } => {
  const values = { ...initial }

  return {
    values,
    getTemporaryVariable: (name) => values[name],
    setTemporaryVariable: (name, value) => {
      values[name] = value
    },
    clearTemporaryVariables: () => {
      Object.keys(values).forEach((key) => {
        delete values[key]
      })
    },
  }
}

describe('applyWorkspaceTemporaryVariables', () => {
  it('uses defaults first and injects optional empty variables as a concrete placeholder', () => {
    const session = createSession()

    applyWorkspaceTemporaryVariables(
      'pro-variable',
      { proVariableSession: session },
      {
        variables: [
          { name: 'topic', required: true },
          { name: 'tone', required: false },
          { name: 'style', required: false, defaultValue: 'friendly' },
        ],
      },
    )

    expect(session.values).toEqual({
      topic: '',
      tone: OPTIONAL_VARIABLE_PLACEHOLDER,
      style: 'friendly',
    })
  })

  it('does not preserve empty existing values over optional placeholders', () => {
    const session = createSession({ tone: '' })

    applyWorkspaceTemporaryVariables(
      'pro-variable',
      { proVariableSession: session },
      {
        variables: [{ name: 'tone', required: false }],
        preserveExistingValues: true,
      },
    )

    expect(session.values.tone).toBe(OPTIONAL_VARIABLE_PLACEHOLDER)
  })

  it('applies empty example parameters through the variable definition fallback', () => {
    const session = createSession()

    applyWorkspaceTemporaryVariables(
      'pro-variable',
      { proVariableSession: session },
      {
        variables: [{ name: 'tone', required: false }],
        parameters: { tone: '' },
        restrictParametersToDefinitions: true,
      },
    )

    expect(session.values.tone).toBe(OPTIONAL_VARIABLE_PLACEHOLDER)
  })
})
