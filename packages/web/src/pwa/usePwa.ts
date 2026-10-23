import { computed, onMounted, onUnmounted, ref } from 'vue'
import { supportsPwa } from './policy'
import { prepareUpdate, requestWorkerUpdate, type PrepareForUpdate, type UpdateOutcome } from './update'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_DISMISSED_KEY = 'prompt-optimizer:pwa-install-dismissed'
const INSTALL_REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000

export function usePwa(prepare: PrepareForUpdate) {
  const supported = ref(false)
  const offlineReady = ref(false)
  const standalone = ref(false)
  const offline = ref(false)
  const updateAvailable = ref(false)
  const updating = ref(false)
  const updateOutcome = ref<UpdateOutcome | null>(null)
  const installPrompt = ref<InstallPrompt | null>(null)
  const ios = ref(false)
  const dismissedInstall = ref(false)
  const dismissedUpdate = ref(false)
  const dismissedOffline = ref(false)
  const keyboardVisible = ref(false)
  let registration: ServiceWorkerRegistration | undefined
  let media: MediaQueryList | undefined
  let disposed = false
  let applyingWorker: ServiceWorker | null = null
  let activationTimer: ReturnType<typeof setTimeout> | undefined

  const installAvailable = computed(() => supported.value && offlineReady.value && !standalone.value && !dismissedInstall.value &&
    (Boolean(installPrompt.value) || ios.value))
  const showUpdate = computed(() => updateAvailable.value && !dismissedUpdate.value)
  const showOffline = computed(() => supported.value && offline.value && !dismissedOffline.value)
  const syncKeyboard = () => {
    keyboardVisible.value = Boolean(window.visualViewport && innerHeight - window.visualViewport.height > 120)
  }

  const syncNetwork = () => {
    offline.value = !navigator.onLine
    if (!offline.value) dismissedOffline.value = false
  }
  const syncStandalone = () => {
    standalone.value = Boolean(media?.matches || (navigator as Navigator & { standalone?: boolean }).standalone)
    document.documentElement.classList.toggle('web-app-standalone', standalone.value)
  }
  const onInstallPrompt = (event: Event) => {
    if (!supported.value) return
    event.preventDefault()
    installPrompt.value = event as InstallPrompt
  }
  const onInstalled = () => {
    installPrompt.value = null
    standalone.value = true
  }
  const inspectWaiting = () => {
    updateAvailable.value = Boolean(registration?.waiting)
    offlineReady.value = registration?.active?.state === 'activated'
  }
  const onUpdateFound = () => {
    const installing = registration?.installing ||
      (registration?.active?.state !== 'activated' ? registration?.active : null)
    if (!installing) return
    installing.addEventListener('statechange', () => {
      if (disposed) return
      inspectWaiting()
      if (installing.state === 'redundant' && !offlineReady.value) {
        console.warn('[PWA] App shell installation failed; online mode retained')
      }
    })
  }
  const checkForUpdate = () => {
    if (!disposed && document.visibilityState === 'visible' && navigator.onLine) {
      void registration?.update().catch(() => { /* Connection can disappear while resuming. */ })
    }
  }

  onMounted(async () => {
    supported.value = supportsPwa({
      production: import.meta.env.PROD,
      secure: window.isSecureContext,
      protocol: location.protocol,
      electron: Boolean((window as Window & { electronAPI?: unknown }).electronAPI),
      serviceWorker: 'serviceWorker' in navigator,
    })
    if (!supported.value) return
    media = window.matchMedia('(display-mode: standalone)')
    syncStandalone()
    syncNetwork()
    syncKeyboard()
    ios.value = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    try {
      const dismissed = Number(localStorage.getItem(INSTALL_DISMISSED_KEY))
      dismissedInstall.value = dismissed > 0 && Date.now() - dismissed < INSTALL_REMINDER_INTERVAL
    } catch { /* Installation is still usable when persistent storage is unavailable. */ }
    media.addEventListener('change', syncStandalone)
    window.addEventListener('online', syncNetwork)
    window.addEventListener('offline', syncNetwork)
    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.visualViewport?.addEventListener('resize', syncKeyboard)
    document.addEventListener('visibilitychange', checkForUpdate)
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      if (disposed) return
      inspectWaiting()
      registration.addEventListener('updatefound', onUpdateFound)
      onUpdateFound()
    } catch (error) {
      // A normal online web session remains fully usable if installation is unavailable.
      supported.value = false
      offlineReady.value = false
      console.warn('[PWA] Service worker registration failed', error)
    }
  })

  const dismissInstall = () => {
    dismissedInstall.value = true
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now())) } catch { /* optional preference */ }
  }
  const install = async () => {
    const prompt = installPrompt.value
    if (!prompt) return
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'dismissed') dismissInstall()
    } finally {
      installPrompt.value = null
    }
  }

  const applyUpdate = async () => {
    if (updating.value) return
    const worker = registration?.waiting
    if (!worker) { updateOutcome.value = 'unavailable'; inspectWaiting(); return }
    updating.value = true
    updateOutcome.value = null
    const preparation = await prepareUpdate(prepare)
    if (preparation !== 'ready') {
      updateOutcome.value = preparation
      updating.value = false
      return
    }
    applyingWorker = worker
    // No controllerchange reload listener: another window cannot refresh this page.
    const onActivated = () => {
      if (applyingWorker === worker && worker.state === 'activated') {
        if (activationTimer) clearTimeout(activationTimer)
        location.reload()
      }
    }
    worker.addEventListener('statechange', onActivated)
    const outcome = await requestWorkerUpdate(worker)
    updateOutcome.value = outcome
    if (outcome !== 'ready') {
      worker.removeEventListener('statechange', onActivated)
      applyingWorker = null
      updating.value = false
      return
    }
    onActivated()
    activationTimer = setTimeout(() => {
      worker.removeEventListener('statechange', onActivated)
      applyingWorker = null
      updating.value = false
      updateOutcome.value = 'failed'
    }, 15000)
  }

  onUnmounted(() => {
    disposed = true
    applyingWorker = null
    if (activationTimer) clearTimeout(activationTimer)
    media?.removeEventListener('change', syncStandalone)
    registration?.removeEventListener('updatefound', onUpdateFound)
    window.removeEventListener('online', syncNetwork)
    window.removeEventListener('offline', syncNetwork)
    window.removeEventListener('beforeinstallprompt', onInstallPrompt)
    window.removeEventListener('appinstalled', onInstalled)
    window.visualViewport?.removeEventListener('resize', syncKeyboard)
    document.removeEventListener('visibilitychange', checkForUpdate)
    document.documentElement.classList.remove('web-app-standalone')
  })

  return {
    installAvailable, showUpdate, showOffline, offlineReady, updating, updateOutcome, ios, keyboardVisible,
    install, applyUpdate, dismissInstall,
    dismissUpdate: () => { dismissedUpdate.value = true },
    dismissOffline: () => { dismissedOffline.value = true },
  }
}
