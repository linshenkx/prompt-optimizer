export interface ModelNetworkSettings {
  mode: 'system' | 'direct' | 'manual'
  proxyUrl: string
  bypassRules: string[]
}

export interface ModelNetworkTest {
  routes: Array<{ host: string; mode: 'direct' | 'system-proxy' | 'manual-proxy' }>
  testedAt: string
}

export interface ModelNetworkState {
  saved: ModelNetworkSettings
  active: ModelNetworkSettings
  restartRequired: boolean
  busy: boolean
  lastConnection: ModelNetworkTest | null
}

export interface ModelNetworkAPI {
  getSettings(): Promise<ModelNetworkState>
  saveSettings(settings: ModelNetworkSettings): Promise<ModelNetworkState>
  restart(): Promise<void>
}
