#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const builtCliPath = path.join(__dirname, '..', 'dist', 'start.cjs');

if (!fs.existsSync(builtCliPath)) {
  console.error(
    [
      'prompt-optimizer-mcp is not built yet.',
      'Run `pnpm mcp:build` or `pnpm --filter @prompt-optimizer/mcp-server build` first.',
    ].join(' '),
  );
  process.exit(1);
}

require(builtCliPath);
