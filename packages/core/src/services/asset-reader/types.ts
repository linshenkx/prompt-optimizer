import type { IStorageProvider } from '../storage/types'
import type { PromptModeKey, PromptVariableType } from '../prompt-model/types'

/** The caller owns source authorization/readiness and provider lifecycle. */
export type AssetReadStorage = Pick<IStorageProvider, 'getItem'>
export interface AssetReaderScope { readonly sourceId: string; readonly sourceEpoch: string }
export interface AssetReadPage<T> extends AssetReaderScope { items: T[]; nextCursor?: string }
export interface AssetReadPagination { limit?: number; cursor?: string }

export interface PublicStoredModel {
  configKey: string
  name: string
  enabled: boolean
  providerId: string
  modelId: string
  capabilities: { supportsTools?: boolean; supportsReasoning?: boolean; maxContextLength?: number }
  revision: string
  /** This reader does not attach or validate a model execution host. */
  executable: false
  unavailableReason: 'EXECUTION_NOT_CONNECTED' | 'MODEL_DISABLED' | 'MODEL_REQUIRES_MIGRATION' | 'MODEL_METADATA_MISMATCH'
}

export interface PublicStoredAsset {
  favoriteId: string
  assetId: string
  title: string
  modeKey: PromptModeKey
  tags: string[]
  currentVersionId: string
  versionCount: number
  updatedAt: number
  revision: string
}
export interface PublicStoredTextVersion extends PublicStoredAsset {
  versionId: string
  version: number
  content: { kind: 'text'; text: string }
  variables: Array<{ name: string; required: boolean; type?: PromptVariableType; options?: string[] }>
}
export interface PublicStoredVersionSummary {
  versionId: string
  version: number
  createdAt: number
}

export type PublicStoredAssetVersions = AssetReadPage<PublicStoredVersionSummary> &
  Pick<PublicStoredAsset, 'favoriteId' | 'assetId' | 'currentVersionId' | 'versionCount' | 'revision'>

export interface AssetSelection {
  favoriteId: string
  assetId: string
  expectedRevision?: string
}

export interface AssetVersionSelection extends AssetSelection {
  versionId: string
}
export interface IReadonlyAssetReader {
  listModels(options?: AssetReadPagination): Promise<AssetReadPage<PublicStoredModel>>
  listAssets(options?: AssetReadPagination & { modeKey?: PromptModeKey; query?: string }): Promise<AssetReadPage<PublicStoredAsset>>
  listAssetVersions(selection: AssetSelection, options?: AssetReadPagination): Promise<PublicStoredAssetVersions>
  getAssetVersion(selection: AssetVersionSelection): Promise<PublicStoredTextVersion & AssetReaderScope>
}
