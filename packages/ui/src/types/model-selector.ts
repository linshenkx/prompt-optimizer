/** Presentation data only: callers retain selection identity and persistence. */
export interface ModelSelectorChoice {
  value: string
  label: string
  searchText?: string
  disabled?: boolean
}

export interface ModelSelectorGroup {
  value: string
  label: string
  searchText?: string
  choices: ModelSelectorChoice[]
  configurable?: boolean
  loading?: boolean
  failed?: boolean
}
