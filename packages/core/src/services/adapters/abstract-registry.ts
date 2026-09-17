/**
 * 适配器注册表抽象基类
 * 提供文本和图像适配器注册表的共享逻辑
 *
 * @template TAdapter 适配器类型
 * @template TProvider Provider 元数据类型
 * @template TModel Model 元数据类型
 * @template TConnectionConfig 连接配置类型（用于动态模型获取）
 */
export abstract class AbstractAdapterRegistry<
  TAdapter,
  TProvider extends { id: string; name: string; supportsDynamicModels: boolean },
  TModel extends { id: string },
  TConnectionConfig = Record<string, unknown>,
  TDiscoveryOptions = undefined
> {
  protected adapters: Map<string, TAdapter> = new Map();
  protected staticModelsCache: Map<string, TModel[]> = new Map();

  constructor() {
    this.initializeAdapters();
  }

  /**
   * 子类必须实现：初始化并注册所有适配器
   */
  protected abstract initializeAdapters(): void;

  /**
   * 子类必须实现：从适配器获取 Provider 元数据
   */
  protected abstract getProviderFromAdapter(adapter: TAdapter): TProvider;

  /**
   * 子类必须实现：从适配器获取静态模型列表
   */
  protected abstract getModelsFromAdapter(adapter: TAdapter): TModel[];

  /**
   * 子类必须实现：调用适配器的异步模型获取方法
   * @param requirements 可选的能力要求，透传给支持能力过滤的适配器
   */
  protected abstract getModelsAsyncFromAdapter(
    adapter: TAdapter,
    connectionConfig: TConnectionConfig,
    requirements?: TDiscoveryOptions
  ): Promise<TModel[]>;

  /**
   * 子类可选实现：获取错误消息的提供商类型描述
   */
  protected getProviderTypeDescription(): string {
    return 'provider';
  }

  /**
   * 子类可覆盖：生成“未知 Provider”错误（用于 i18n 对齐）
   */
  protected createUnknownProviderError(providerId: string): Error {
    return new Error(`Unknown ${this.getProviderTypeDescription()}: ${providerId}`);
  }

  /**
   * 子类可覆盖：生成“不支持动态模型”错误（用于 i18n 对齐）
   */
  protected createDynamicModelUnsupportedError(provider: TProvider): Error {
    return new Error(`${provider.name} does not support dynamic model fetching`);
  }

  /**
   * 预加载所有 Provider 的静态模型到缓存
   */
  protected preloadStaticModels(): void {
    this.adapters.forEach((adapter, providerId) => {
      const provider = this.getProviderFromAdapter(adapter);
      if (provider.id === providerId) {
        this.staticModelsCache.set(providerId, this.getModelsFromAdapter(adapter));
      }
    });
  }

  // ===== 基础适配器管理 =====

  /**
   * 通过 providerId 获取适配器实例
   * @param providerId Provider ID（自动转换为小写）
   * @returns 适配器实例
   * @throws {Error} 当 providerId 不存在时
   */
  public getAdapter(providerId: string): TAdapter {
    const adapter = this.adapters.get(providerId.toLowerCase());
    if (!adapter) {
      throw this.createUnknownProviderError(providerId);
    }
    return adapter;
  }

  // ===== 元数据查询 =====

  /**
   * 获取所有已注册的 Provider 元数据
   * @returns Provider 元数据数组
   */
  public getAllProviders(): TProvider[] {
    const providers: TProvider[] = [];
    const seenIds = new Set<string>();

    this.adapters.forEach((adapter) => {
      const provider = this.getProviderFromAdapter(adapter);
      if (!seenIds.has(provider.id)) {
        seenIds.add(provider.id);
        providers.push(provider);
      }
    });

    return providers;
  }

  // ===== 静态模型获取（即时可用） =====

  /**
   * 获取静态模型列表（带缓存）
   * @param providerId Provider ID
   * @returns 静态模型数组
   */
  public getStaticModels(providerId: string): TModel[] {
    const normalizedId = providerId.toLowerCase();

    // 尝试从缓存获取
    if (this.staticModelsCache.has(normalizedId)) {
      return this.staticModelsCache.get(normalizedId)!;
    }

    // 如果缓存未命中，从适配器获取
    const adapter = this.getAdapter(normalizedId);
    const models = this.getModelsFromAdapter(adapter);
    this.staticModelsCache.set(normalizedId, models);
    return models;
  }

  // ===== 动态模型获取（需要连接配置） =====

  /**
   * 该 Provider 的动态结果是否应独占（不并入静态模型）。
   * 默认 false，保持既有“静态 + 动态合并、动态优先”的行为。
   */
  public dynamicModelsOverrideStatic(providerId: string): boolean {
    const adapter = this.adapters.get(providerId);
    if (!adapter) return false;
    return Boolean(this.getAdapterFlag(adapter));
  }

  /**
   * 子类可覆写以从适配器读取该策略；默认读取同名可选属性。
   */
  protected getAdapterFlag(adapter: TAdapter): boolean | undefined {
    return (adapter as { dynamicModelsOverrideStatic?: boolean }).dynamicModelsOverrideStatic;
  }

  /**
   * 动态获取模型列表
   * @param providerId Provider ID
   * @param connectionConfig 连接配置
   * @param requirements 可选的能力要求，用于按 AI 入口过滤模型
   * @returns 动态获取的模型数组
   * @throws {Error} 当 Provider 不支持动态获取时
   */
  public async getDynamicModels(
    providerId: string,
    connectionConfig: TConnectionConfig,
    requirements?: TDiscoveryOptions
  ): Promise<TModel[]> {
    const adapter = this.getAdapter(providerId);
    const provider = this.getProviderFromAdapter(adapter);

    if (!provider.supportsDynamicModels) {
      throw this.createDynamicModelUnsupportedError(provider);
    }

    try {
      return await this.getModelsAsyncFromAdapter(adapter, connectionConfig, requirements);
    } catch (error) {
      console.warn(`Failed to fetch dynamic models (${providerId}):`, error);
      throw error;
    }
  }

  // ===== 统一的模型获取接口（自动选择静态或动态） =====

  /**
   * 统一的模型获取接口
   * 优先动态获取，失败则 fallback 到静态模型
   *
   * @param providerId Provider ID
   * @param connectionConfig 连接配置（可选，提供时尝试动态获取）
   * @param requirements 可选的能力要求，用于按 AI 入口过滤模型
   * @returns 模型数组
   */
  public async getModels(
    providerId: string,
    connectionConfig?: TConnectionConfig,
    requirements?: TDiscoveryOptions
  ): Promise<TModel[]> {
    const adapter = this.getAdapter(providerId);
    const provider = this.getProviderFromAdapter(adapter);

    // 如果支持动态获取且提供了连接配置，尝试动态获取
    if (provider.supportsDynamicModels && connectionConfig) {
      try {
        const dynamicModels = await this.getDynamicModels(providerId, connectionConfig, requirements);

        // 该 Provider 声明动态结果独占时，不并入静态模型。
        if (this.dynamicModelsOverrideStatic(providerId)) {
          return dynamicModels;
        }

        // 合并静态和动态模型，动态模型优先
        const staticModels = this.getStaticModels(providerId);
        const dynamicIds = new Set(dynamicModels.map((m) => m.id));
        const mergedModels = [
          ...dynamicModels,
          ...staticModels.filter((m) => !dynamicIds.has(m.id))
        ];

        return mergedModels;
      } catch (error) {
        console.warn(
          `Failed to load dynamic models (${providerId}); falling back to static models:`,
          error
        );
        // 降级到静态模型
        return this.getStaticModels(providerId);
      }
    }

    // 返回静态模型
    return this.getStaticModels(providerId);
  }

  /**
   * 获取所有静态模型的组合视图
   * @returns Provider-Model 对数组
   */
  public getAllStaticModels(): Array<{ provider: TProvider; model: TModel }> {
    const result: Array<{ provider: TProvider; model: TModel }> = [];

    for (const provider of this.getAllProviders()) {
      const models = this.getStaticModels(provider.id);
      for (const model of models) {
        result.push({ provider, model });
      }
    }

    return result;
  }

  // ===== 能力检查 =====

  /**
   * 检查 Provider 是否支持动态模型获取
   * @param providerId Provider ID
   * @returns 是否支持动态获取
   */
  public supportsDynamicModels(providerId: string): boolean {
    try {
      const adapter = this.getAdapter(providerId);
      return this.getProviderFromAdapter(adapter).supportsDynamicModels;
    } catch {
      return false;
    }
  }

  // ===== 验证方法 =====

  /**
   * 验证 Provider 和 Model 组合是否有效
   * @param providerId Provider ID
   * @param modelId Model ID
   * @returns 是否有效
   */
  public validateProviderModel(providerId: string, modelId: string): boolean {
    try {
      const models = this.getStaticModels(providerId);
      return models.some((model) => model.id === modelId);
    } catch {
      return false;
    }
  }

  // ===== 辅助方法：清除缓存 =====

  /**
   * 清除静态模型缓存并重新加载
   */
  public clearCache(): void {
    this.staticModelsCache.clear();
    this.preloadStaticModels();
  }
}
