#!/usr/bin/env node

'use strict';

import('../dist/product/index.js').then(({ main }) => main()).catch(() => {
  process.stderr.write('MCP startup failed (INVALID_CONFIGURATION_OR_SOURCE).\n');
  process.exitCode = 1;
});
