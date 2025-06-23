export { CompareService } from './service';
export * from './types';
export * from './errors';

// 导入服务类以创建单例
import { CompareService } from './service';

// 创建单例实例
export const compareService = new CompareService(); 