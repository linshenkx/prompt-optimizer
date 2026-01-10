#!/usr/bin/env node
/**
 * 智能 E2E 测试运行器
 *
 * 使用 VCR auto 模式：每个测试独立检查自己的 fixture
 * - fixture 存在 → 回放（快速）
 * - fixture 不存在 → 录制（自动创建）
 *
 * 使用：
 * node scripts/smart-e2e.js
 */

const { execSync } = require('child_process')

/**
 * 主函数
 */
function main() {
  console.log('\n🎬 使用 VCR auto 模式运行 E2E 测试')
  console.log('   - 有 fixture 的测试：回放')
  console.log('   - 无 fixture 的测试：录制\n')

  try {
    // 不设置 E2E_VCR_MODE，使用默认的 auto 模式
    execSync('playwright test', {
      stdio: 'inherit',
      env: process.env // 继承现有环境变量，不覆盖 E2E_VCR_MODE
    })
  } catch (error) {
    process.exit(error.status || 1)
  }
}

main()
