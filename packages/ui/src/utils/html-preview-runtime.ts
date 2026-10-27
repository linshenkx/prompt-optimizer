import { shallowRef } from 'vue'

// Only an explicit preview action owns the one live HTML execution context.
export const activeHtmlPreview = shallowRef<symbol>()
