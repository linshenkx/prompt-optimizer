/**
 * 导入导出接口定义
 * 
 * 这个文件定义了导入导出相关的接口，避免循环依赖
 */

import { IMPORT_EXPORT_ERROR_CODES } from '../constants/error-codes'

/**
 * 可导入导出的服务接口
 * 所有需要参与数据导入导出的服务都应该实现此接口
 */
export interface IImportExportable {
  /**
   * 导出服务的所有数据
   * @returns 服务数据的JSON表示
   */
  exportData(): Promise<any>;

  /**
   * 导入数据到服务
   * @param data 要导入的数据
   */
  importData(data: any): Promise<void>;

  /**
   * 获取服务的数据类型标识
   * 用于在导入导出JSON中标识数据类型
   */
  getDataType(): Promise<string>;

  /**
   * 验证数据格式是否正确
   * @param data 要验证的数据
   * @returns 是否为有效格式
   */
  validateData(data: any): Promise<boolean>;
}

/**
 * 导入导出错误类型
 */
export class ImportExportError extends Error {
  public readonly code: string
  public readonly params?: Record<string, unknown>

  constructor(
    message: string,
    public readonly dataType?: string,
    public readonly originalError?: Error,
    code: string = IMPORT_EXPORT_ERROR_CODES.IMPORT_FAILED,
  ) {
    // Keep message for debugging; user-facing text should come from `code + params`.
    super(message)
    this.name = 'ImportExportError'

    this.code = code
    this.params = { details: message, dataType }
  }
}
