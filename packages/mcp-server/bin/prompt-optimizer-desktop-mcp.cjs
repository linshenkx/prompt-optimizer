#!/usr/bin/env node
'use strict';

if (process.argv.slice(2).some(argument => argument.startsWith('--mode'))) {
  process.stderr.write('The desktop command does not accept a mode override.\n');
  process.exitCode = 1;
} else {
  process.argv.splice(2, 0, '--mode=desktop');
  require('./prompt-optimizer-mcp.cjs');
}
