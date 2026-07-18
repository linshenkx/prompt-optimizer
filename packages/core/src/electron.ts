/**
 * Electron-only adapters.
 *
 * Keep this entry separate from the browser-facing core graph so Web and
 * Extension builds do not preload Electron proxy implementations.
 */
export { ElectronTemplateManagerProxy } from './services/template/electron-proxy'
export { ElectronTemplateLanguageServiceProxy } from './services/template/electron-language-proxy'
export { ElectronHistoryManagerProxy } from './services/history/electron-proxy'
export { ElectronLLMProxy } from './services/llm/electron-proxy'
export { ElectronModelManagerProxy } from './services/model/electron-proxy'
export {
  ElectronImageServiceProxy,
  ElectronImageModelManagerProxy,
} from './services/image/electron-proxy'
export { ElectronPromptServiceProxy } from './services/prompt/electron-proxy'
export { ElectronDataManagerProxy } from './services/data/electron-proxy'
export { ElectronPreferenceServiceProxy } from './services/preference/electron-proxy'
export { ElectronContextRepoProxy } from './services/context/electron-proxy'
export { FavoriteManagerElectronProxy } from './services/favorite/electron-proxy'
export { waitForElectronApi } from './utils/environment'
