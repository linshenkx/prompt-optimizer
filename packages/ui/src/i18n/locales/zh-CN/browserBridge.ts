export default {
  browserBridge: {
    title: '允许 MCP 连接此网页？',
    connection: 'MCP 连接',
    connected: 'MCP 已连接',
    lifetime: '关闭此标签页即断开连接。',
    label: '给这份资料命名（可选）',
    readScope: '允许读取这份资料和已保存的结果。查询会隐藏模型密钥。',
    businessScope: '允许管理这份资料、导入导出备份和调用已配置的模型。模型调用会向服务商发送提示词，可能产生费用。导出含凭据的备份会包含已保存的密钥。',
    compareScope: '允许编辑收藏、优化和测试提示词，以及管理对照结果。模型调用会向服务商发送提示词，可能产生费用。',
    authorize: '允许连接',
    revoke: '断开连接',
    failure: '连接失败。请确认本机 MCP 正在运行、浏览器允许此网页访问本地网络，然后向助手获取新的连接链接。',
  },
}
