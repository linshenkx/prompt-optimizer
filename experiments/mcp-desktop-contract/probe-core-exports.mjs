// Only pure exports required by the UI helpers used in this isolated probe.
// Do not import the core barrel: it also loads runtime providers and SDKs.
export { PREDEFINED_VARIABLES } from '../../packages/core/src/services/context/constants.ts';
export { PROMPT_MODEL_SCHEMA_VERSION } from '../../packages/core/src/services/prompt-model/types.ts';
export { promptAssetFromFavorite } from '../../packages/core/src/services/prompt-model/favorite.ts';
