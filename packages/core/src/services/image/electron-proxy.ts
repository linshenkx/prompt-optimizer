import type {
  IImageModelManager,
  IImageService,
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  ImageModel,
  Text2ImageRequest,
  Image2ImageRequest
} from './types'

type ElectronAPI = {
  image: {
    generate: (request: ImageRequest) => Promise<ImageResult>
    generateText2Image: (request: Text2ImageRequest) => Promise<ImageResult>
    generateImage2Image: (request: Image2ImageRequest) => Promise<ImageResult>
    validateRequest: (request: ImageRequest) => Promise<void>
    validateText2ImageRequest: (request: Text2ImageRequest) => Promise<void>
    validateImage2ImageRequest: (request: Image2ImageRequest) => Promise<void>
    testConnection: (config: ImageModelConfig) => Promise<ImageResult>
    getDynamicModels: (providerId: string, connectionConfig: Record<string, unknown>) => Promise<ImageModel[]>
  }
  imageModel: {
    ensureInitialized: () => Promise<void>
    isInitialized: () => Promise<boolean>
    addConfig: (config: ImageModelConfig) => Promise<void>
    updateConfig: (id: string, updates: Partial<ImageModelConfig>) => Promise<void>
    deleteConfig: (id: string) => Promise<void>
    getConfig: (id: string) => Promise<ImageModelConfig | null>
    getAllConfigs: () => Promise<ImageModelConfig[]>
    getEnabledConfigs: () => Promise<ImageModelConfig[]>
    exportData: () => Promise<unknown>
    importData: (data: unknown) => Promise<void>
    getDataType: () => Promise<string>
    validateData: (data: unknown) => Promise<boolean>
  }
}

export class ElectronImageServiceProxy implements IImageService {
  private electronAPI: ElectronAPI

  constructor() {
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new Error(
        'ElectronImageServiceProxy can only be used in Electron renderer process'
      )
    }
    this.electronAPI = (window as unknown as { electronAPI: ElectronAPI }).electronAPI
  }

  async generate(request: ImageRequest): Promise<ImageResult> {
    const safeReq = JSON.parse(JSON.stringify(request))
    return await this.electronAPI.image.generate(safeReq)
  }

  async generateText2Image(request: Text2ImageRequest): Promise<ImageResult> {
    const safeReq = JSON.parse(JSON.stringify(request))
    return await this.electronAPI.image.generateText2Image(safeReq)
  }

  async generateImage2Image(request: Image2ImageRequest): Promise<ImageResult> {
    const safeReq = JSON.parse(JSON.stringify(request))
    return await this.electronAPI.image.generateImage2Image(safeReq)
  }

  async validateRequest(request: ImageRequest): Promise<void> {
    const safeReq = JSON.parse(JSON.stringify(request))
    await this.electronAPI.image.validateRequest(safeReq)
  }

  async validateText2ImageRequest(request: Text2ImageRequest): Promise<void> {
    const safeReq = JSON.parse(JSON.stringify(request))
    await this.electronAPI.image.validateText2ImageRequest(safeReq)
  }

  async validateImage2ImageRequest(request: Image2ImageRequest): Promise<void> {
    const safeReq = JSON.parse(JSON.stringify(request))
    await this.electronAPI.image.validateImage2ImageRequest(safeReq)
  }

  async testConnection(config: ImageModelConfig): Promise<ImageResult> {
    const safeCfg = JSON.parse(JSON.stringify(config))
    return await this.electronAPI.image.testConnection(safeCfg)
  }

  async getDynamicModels(providerId: string, connectionConfig: Record<string, any>) {
    const safeConn = JSON.parse(JSON.stringify(connectionConfig || {}))
    return await this.electronAPI.image.getDynamicModels(providerId, safeConn)
  }
}

export class ElectronImageModelManagerProxy implements IImageModelManager {
  private electronAPI: ElectronAPI

  constructor() {
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new Error(
        'ElectronImageModelManagerProxy can only be used in Electron renderer process'
      )
    }
    this.electronAPI = (window as unknown as { electronAPI: ElectronAPI }).electronAPI
  }

  async ensureInitialized(): Promise<void> {
    await this.electronAPI.imageModel.ensureInitialized()
  }

  async isInitialized(): Promise<boolean> {
    return await this.electronAPI.imageModel.isInitialized()
  }

  // 新的配置 CRUD 操作
  async addConfig(config: ImageModelConfig): Promise<void> {
    const safeCfg = JSON.parse(JSON.stringify(config))
    await this.electronAPI.imageModel.addConfig(safeCfg)
  }

  async updateConfig(id: string, updates: Partial<ImageModelConfig>): Promise<void> {
    const safeUpdates = JSON.parse(JSON.stringify(updates))
    await this.electronAPI.imageModel.updateConfig(id, safeUpdates)
  }

  async deleteConfig(id: string): Promise<void> {
    await this.electronAPI.imageModel.deleteConfig(id)
  }

  async getConfig(id: string): Promise<ImageModelConfig | null> {
    return await this.electronAPI.imageModel.getConfig(id)
  }

  async getAllConfigs(): Promise<ImageModelConfig[]> {
    return await this.electronAPI.imageModel.getAllConfigs()
  }

  async getEnabledConfigs(): Promise<ImageModelConfig[]> {
    return await this.electronAPI.imageModel.getEnabledConfigs()
  }

  // IImportExportable 接口
  async exportData(): Promise<any> {
    return await this.electronAPI.imageModel.exportData()
  }

  async importData(data: any): Promise<void> {
    const safe = JSON.parse(JSON.stringify(data))
    await this.electronAPI.imageModel.importData(safe)
  }

  async getDataType(): Promise<string> {
    return await this.electronAPI.imageModel.getDataType()
  }

  async validateData(data: any): Promise<boolean> {
    const safe = JSON.parse(JSON.stringify(data))
    return await this.electronAPI.imageModel.validateData(safe)
  }
}
