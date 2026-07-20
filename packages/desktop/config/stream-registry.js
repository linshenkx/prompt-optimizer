const { createIpcError } = require('./ipc-security');

/** 获取 renderer sender 的稳定标识，并拒绝无效 sender。 */
function getSenderId(sender) {
  if (!sender || typeof sender.id !== 'number') {
    throw createIpcError('IPC_UNTRUSTED_SENDER', 'IPC request sender is not trusted');
  }
  return sender.id;
}

/** 创建限制并发数、校验所有权并支持取消的流任务注册表。 */
function createStreamRegistry({ maxStreamsPerSender = 4 } = {}) {
  const streams = new Map();
  const observedSenders = new WeakSet();

  /** 注册新流任务并返回供领域执行器使用的取消信号。 */
  function register(sender, streamId) {
    const senderId = getSenderId(sender);
    if (streams.has(streamId)) {
      throw createIpcError('IPC_STREAM_ALREADY_EXISTS', 'IPC stream identifier is already active');
    }

    const activeForSender = [...streams.values()]
      .filter((stream) => stream.senderId === senderId)
      .length;
    if (activeForSender >= maxStreamsPerSender) {
      throw createIpcError('IPC_STREAM_LIMIT_REACHED', 'Too many active IPC streams');
    }

    const controller = new AbortController();
    const stream = { sender, senderId, controller, signal: controller.signal };
    streams.set(streamId, stream);

    observeSender(sender);

    return stream;
  }

  /** 判断流标识是否仍在注册表中。 */
  function has(streamId) {
    return streams.has(streamId);
  }

  /** 判断流是否属于指定 sender 且仍可向 renderer 转发事件。 */
  function isOwned(sender, streamId) {
    const stream = streams.get(streamId);
    return Boolean(stream)
      && stream.senderId === getSenderId(sender);
  }

  /** 流仍归该 sender 且未取消时，才转发 token/tool 事件。 */
  function isActive(sender, streamId) {
    const stream = streams.get(streamId);
    return isOwned(sender, streamId) && !stream.signal.aborted;
  }

  /** 由流所有者取消任务并触发对应 AbortSignal。 */
  function cancel(sender, streamId) {
    const stream = streams.get(streamId);
    if (!stream) {
      throw createIpcError('IPC_STREAM_NOT_FOUND', 'IPC stream was not found');
    }
    if (stream.senderId !== getSenderId(sender)) {
      throw createIpcError('IPC_STREAM_NOT_OWNER', 'IPC stream is not owned by this renderer');
    }

    stream.controller.abort();
    streams.delete(streamId);
    return true;
  }

  /** 在任务正常完成或异常结束后释放所有权记录。 */
  function complete(sender, streamId) {
    const stream = streams.get(streamId);
    if (!stream) {
      return false;
    }
    if (stream.senderId !== getSenderId(sender)) {
      throw createIpcError('IPC_STREAM_NOT_OWNER', 'IPC stream is not owned by this renderer');
    }

    streams.delete(streamId);
    return true;
  }

  /** sender 销毁时取消其全部活动流，避免后台任务继续占用资源。 */
  function cancelAllForSender(sender) {
    const senderId = getSenderId(sender);
    for (const [streamId, stream] of streams) {
      if (stream.senderId !== senderId) {
        continue;
      }
      stream.controller.abort();
      streams.delete(streamId);
    }
  }

  /** 每个 sender 只绑定一次销毁监听，避免频繁流调用累积 EventEmitter listener。 */
  function observeSender(sender) {
    if (typeof sender.once !== 'function' || observedSenders.has(sender)) {
      return;
    }

    observedSenders.add(sender);
    sender.once('destroyed', () => {
      try {
        cancelAllForSender(sender);
      } finally {
        observedSenders.delete(sender);
      }
    });
  }

  return {
    cancel,
    cancelAllForSender,
    complete,
    has,
    isActive,
    isOwned,
    register,
  };
}

/** 创建只向流所有者发送 token、工具、完成和错误事件的回调集合。 */
function createOwnedStreamHandlers({ registry, sender, streamId, channels }) {
  /** 在流仍活动时发送单个 renderer 事件。 */
  const send = function send(channel, payload) {
    if (!channel || !registry.isActive(sender, streamId)) {
      return false;
    }
    if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) {
      registry.complete(sender, streamId);
      return false;
    }

    const eventName = `${channel}-${streamId}`;
    if (arguments.length === 1) {
      sender.send(eventName);
    } else {
      sender.send(eventName, payload);
    }
    return true;
  };

  const sendOwned = function sendOwned(channel, payload) {
    if (!channel || !registry.isOwned(sender, streamId)) {
      return false;
    }
    if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) {
      registry.complete(sender, streamId);
      return false;
    }
    const eventName = `${channel}-${streamId}`;
    if (arguments.length === 1) {
      sender.send(eventName);
    } else {
      sender.send(eventName, payload);
    }
    return true;
  };

  return {
    onToken: (token) => send(channels.token, token),
    onReasoningToken: (token) => send(channels.reasoning, token),
    onToolCall: (toolCall) => send(channels.toolCall, toolCall),
    onComplete: () => {
      if (sendOwned(channels.finish)) {
        registry.complete(sender, streamId);
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (sendOwned(channels.error, message)) {
        registry.complete(sender, streamId);
      }
    },
  };
}

module.exports = {
  createOwnedStreamHandlers,
  createStreamRegistry,
};
