export default {
  browserBridge: {
    title: 'Codex 连接',
    connecting: '正在连接…',
    connected: '本页面已授权并连接',
    disconnected: '本页面未连接',
    context: '只共享当前页面及此浏览器档案中的产品数据。关闭页面或撤销授权会断开 Codex；不会读取浏览器档案文件。',
    label: '来源名称（例如 Firefox — 工作）',
    readScope: '授权读取已保存模型的说明、收藏和已保存比较；不会共享模型密钥。',
    compareScope: '授权读取和编辑收藏、使用已配置的文本模型优化提示词和测试，以及保存、查看和删除比较结果。模型密钥留在本页面。',
    charges: '优化和测试会向已配置的服务商发送提示词，可能产生费用；请求使用当前浏览器的网络设置。',
    authorize: '授权此页面',
    revoke: '立即撤销授权',
    instructions: '在 Codex 中让 Prompt Optimizer MCP 使用 po_sources_authorize 为实际产品地址生成授权链接，然后在目标浏览器档案中打开该一次性链接。',
    failure: '连接未能保持。请检查浏览器的本地网络权限、页面策略，以及本机 MCP 是否运行。授权失败或过期后，请让 Codex 生成新链接。',
  },
}
