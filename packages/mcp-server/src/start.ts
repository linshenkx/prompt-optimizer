#!/usr/bin/env node

/**
 * MCP Server 启动文件
 * 这个文件专门用于启动服务器，避免在构建时执行
 */

// stdout belongs to the MCP protocol in stdio mode. Configure diagnostics before
// loading Core or dotenv, which can log while their modules are being imported.
const transport = process.argv.slice(2)
  .find(arg => arg.startsWith('--transport='))?.split('=')[1] || 'stdio';

if (transport !== 'http') {
  console.log = console.error.bind(console);
  console.info = console.error.bind(console);
  console.debug = console.error.bind(console);
}

// 启动服务器
import('./index.js').then(({ main }) => main()).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
