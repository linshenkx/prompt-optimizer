#!/usr/bin/env node

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { groups } = require('./e2e-groups')

/** 解析 Playwright CLI：优先直调本地依赖，避免 Windows 上 pnpm exec 异常。 */
function resolvePlaywrightCli() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', '@playwright', 'test', 'cli.js'),
    path.join(__dirname, '..', 'node_modules', 'playwright', 'cli.js'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function runGroup(groupName, extraArgs = []) {
  const specs = groups[groupName]
  if (!specs) {
    console.error(`[E2E] Unknown group "${groupName}". Available groups: ${Object.keys(groups).join(', ')}`)
    return 1
  }
  console.log(`\n[E2E] Running "${groupName}" suite (${specs.length} spec file(s))`)
  for (const spec of specs) console.log(`  - ${spec}`)
  console.log('')

  const playwrightCli = resolvePlaywrightCli()
  const cwd = path.join(__dirname, '..')
  let result
  if (playwrightCli) {
    console.log(`[E2E] Using Playwright CLI: ${playwrightCli}`)
    result = spawnSync(process.execPath, [playwrightCli, 'test', ...specs, ...extraArgs], {
      stdio: 'inherit',
      env: process.env,
      cwd,
    })
  } else {
    const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
    result = spawnSync(pnpmCommand, ['exec', 'playwright', 'test', ...specs, ...extraArgs], {
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
      cwd,
    })
  }
  if (result.error) throw result.error
  return result.status ?? 0
}

if (require.main === module) {
  const [groupName, ...extraArgs] = process.argv.slice(2)
  process.exit(runGroup(groupName, extraArgs))
}

module.exports = { runGroup }
