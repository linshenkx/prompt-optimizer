const { createOwnedStreamHandlers } = require('../stream-registry');

/**
 * 创建绑定 renderer 所有权的流任务执行器，集中处理事件转发、错误通知和注册表清理。
 *
 * @param {object} dependencies 运行流任务所需的后端依赖。
 * @param {ReturnType<import('../stream-registry').createStreamRegistry>} dependencies.streamRegistry
 *   维护 sender 与 streamId 所有权的注册表。
 * @returns {Function} 供各领域 IPC module 复用的流任务执行函数。
 */
function createOwnedStreamRunner({ streamRegistry }) {
  if (!streamRegistry || typeof streamRegistry.register !== 'function') {
    throw new TypeError('Owned stream runner requires a stream registry');
  }

  /**
   * 执行单个流任务，并确保结束、异常或取消后都释放该任务的所有权记录。
   */
  return async function runOwnedStream(
    event,
    streamId,
    channels,
    operation,
    notifyError = false,
  ) {
    const stream = streamRegistry.register(event.sender, streamId);
    const handlers = createOwnedStreamHandlers({
      registry: streamRegistry,
      sender: event.sender,
      streamId,
      channels,
    });

    try {
      // 将同一 AbortSignal 交给领域 service；取消后既停止 IPC 转发，也中止 provider 请求。
      await operation(handlers, stream.signal);
      return null;
    } catch (error) {
      if (notifyError) {
        handlers.onError(error);
      }
      throw error;
    } finally {
      streamRegistry.complete(event.sender, streamId);
    }
  };
}

module.exports = {
  createOwnedStreamRunner,
};
