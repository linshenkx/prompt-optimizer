import { defineComponent, h, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalSettings, type GlobalSettingsApi } from '../stores/settings/useGlobalSettings'

export const getInitialRouteFromGlobalSettings = (globalSettings: GlobalSettingsApi) => {
  const { functionMode, basicSubMode, proSubMode, imageSubMode } = globalSettings.state

  switch (functionMode) {
    case 'basic':
      return `/basic/${basicSubMode}`
    case 'pro':
      return `/pro/${proSubMode}`
    case 'image':
      return `/image/${imageSubMode}`
    default:
      return '/basic/system'
  }
}

/**
 * RootBootstrapRoute
 *
 * Root path (/) does not represent a workspace. This component waits for
 * global settings to be restored (driven by PromptOptimizerApp) and then
 * redirects to the initial workspace route.
 *
 * IMPORTANT:
 * - Avoid calling restoreGlobalSettings() here, because router components may
 *   mount before PreferenceService is injected (E2E treats console warnings as failures).
 * - Only redirect when still on '/'.
 */
export const RootBootstrapRoute = defineComponent({
  name: 'RootBootstrapRoute',
  setup() {
    const router = useRouter()
    const globalSettings = useGlobalSettings()
    let redirected = false

    watchEffect(() => {
      if (redirected) return
      if (!globalSettings.isInitialized) return
      if (router.currentRoute.value.path !== '/') return
      // In hash mode, when a non-root hash is present (e.g. #/image/text2image),
      // Vue Router may briefly report path === '/' during initial hydration.
      // Do not override explicit navigation in that case.
      if (typeof window !== 'undefined') {
        const hash = window.location.hash || ''
        const hasExplicitHashRoute = hash.startsWith('#/') && hash !== '#/' && hash !== '#'
        if (hasExplicitHashRoute) return
      }

      const initialRoute = getInitialRouteFromGlobalSettings(globalSettings)
      if (initialRoute === '/' || !initialRoute) return

      redirected = true
      void router.replace(initialRoute)
    })

    return () =>
      h(
        'div',
        {
          'aria-busy': 'true',
          'aria-live': 'polite',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            color: 'rgba(0,0,0,0.65)',
            fontSize: '14px'
          }
        },
        'Loading…'
      )
  }
})

export default RootBootstrapRoute
