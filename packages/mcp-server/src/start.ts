#!/usr/bin/env node

/**
 * MCP Server 启动文件
 * 这个文件专门用于启动服务器，避免在构建时执行
 */

import { main } from './index.js';

// 启动服务器
main().catch(() => {
  // Paths, argv and provider exceptions must not escape into CLI diagnostics.
  process.stderr.write('MCP startup failed (INVALID_CONFIGURATION_OR_SOURCE).\n');
  process.exitCode = 1;
});
