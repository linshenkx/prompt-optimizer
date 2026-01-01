import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'

export type TemporaryVariablesMap = Record<string, string>

export interface TemporaryVariablesStoreApi {
  temporaryVariables: Ref<TemporaryVariablesMap>

  setVariable: (name: string, value: string) => void
  getVariable: (name: string) => string | undefined
  deleteVariable: (name: string) => void
  clearAll: () => void

  hasVariable: (name: string) => boolean
  listVariables: () => TemporaryVariablesMap

  batchSet: (variables: TemporaryVariablesMap) => void
  batchDelete: (names: string[]) => void
}

export const useTemporaryVariablesStore = defineStore(
  'temporaryVariables',
  (): TemporaryVariablesStoreApi => {
    const temporaryVariables = ref<TemporaryVariablesMap>({})

    const setVariable = (name: string, value: string): void => {
      temporaryVariables.value[name] = value
    }

    const getVariable = (name: string): string | undefined => {
      return temporaryVariables.value[name]
    }

    const deleteVariable = (name: string): void => {
      delete temporaryVariables.value[name]
    }

    const clearAll = (): void => {
      temporaryVariables.value = {}
    }

    const hasVariable = (name: string): boolean => {
      return Object.prototype.hasOwnProperty.call(temporaryVariables.value, name)
    }

    const listVariables = (): TemporaryVariablesMap => {
      return { ...temporaryVariables.value }
    }

    const batchSet = (variables: TemporaryVariablesMap): void => {
      temporaryVariables.value = {
        ...temporaryVariables.value,
        ...variables,
      }
    }

    const batchDelete = (names: string[]): void => {
      for (const name of names) {
        delete temporaryVariables.value[name]
      }
    }

    return {
      temporaryVariables,
      setVariable,
      getVariable,
      deleteVariable,
      clearAll,
      hasVariable,
      listVariables,
      batchSet,
      batchDelete,
    }
  },
)
