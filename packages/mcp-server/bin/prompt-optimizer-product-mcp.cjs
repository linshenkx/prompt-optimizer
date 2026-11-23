#!/usr/bin/env node

'use strict';

process.argv.splice(2, 0, '--mode=product');
require('./prompt-optimizer-mcp.cjs');
