/**
 * 数据导入导出相关类型定义
 */

/**
 * 完整的导出数据结构
 */
export interface ExportData {
  version: number;
  timestamp: number;
  data: Record<string, any>;
}

/**
 * 数据管理器接口
 */
export interface IDataManager {
  /**
   * 导出所有数据
   * @returns JSON格式的数据字符串
   */
  exportAllData(): Promise<string>;

  validateImportData(dataString: string): Promise<void>;

  /**
   * 导入所有数据
   * @param dataString JSON格式的数据字符串
   */
  importAllData(dataString: string): Promise<void>;
}

// ImportExportError 已移动到 ../../interfaces/import-export.ts
