#!/usr/bin/env node
/**
 * 智能 E2E 测试运行器
 *
 * 逻辑：
 * - 检查 VCR fixtures 是否存在
 * - 全部存在：回放模式（快速）
 * - 有缺失：录制模式（自动创建）
 *
 * 使用：
 * node scripts/smart-e2e.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// E2E 测试 fixture 目录
const FIXTURES_DIR = 'tests/e2e/fixtures/vcr'

// 需要检查的测试 fixture
const REQUIRED_FIXTURES = [
  // Basic 模式
  'analysis-basic-system-spec-ts/分析提示词并显示评估结果.json',
  'analysis-basic-system-spec-ts/验证分析按钮在没有提示词时禁用.json',
  'analysis-basic-user-spec-ts/分析提示词并显示评估结果.json',
  'analysis-basic-user-spec-ts/验证分析按钮在没有提示词时禁用.json',
  // Image 模式
  'analysis-image-text2image-spec-ts/分析提示词并显示评估结果.json',
  'analysis-image-text2image-spec-ts/验证分析按钮在没有提示词时禁用.json',
  'analysis-image-image2image-spec-ts/分析提示词并显示评估结果.json',
  'analysis-image-image2image-spec-ts/验证分析按钮在没有提示词时禁用.json',
  // Pro 模式
  'analysis-pro-variable-spec-ts/分析带变量的提示词并显示评估结果.json',
  'analysis-pro-variable-spec-ts/验证分析按钮在没有提示词时禁用.json',
]

/**
 * 检查所有 required fixtures 是否存在
 */
function checkFixtures() {
  const missing = []

  for (const fixture of REQUIRED_FIXTURES) {
    const fullPath = path.join(FIXTURES_DIR, fixture)
    if (!fs.existsSync(fullPath)) {
      missing.push(fixture)
    }
  }

  return missing
}

/**
 * 主函数
 */
function main() {
  console.log('\n🔍 检查 E2E fixtures...\n')

  const missing = checkFixtures()

  if (missing.length === 0) {
    // 所有 fixtures 都存在，使用回放模式
    console.log('✅ 所有 VCR fixtures 已存在')
    console.log('▶️  使用回放模式运行 E2E 测试\n')

    try {
      execSync('playwright test', {
        stdio: 'inherit',
        env: { ...process.env, E2E_VCR_MODE: 'replay' }
      })
    } catch (error) {
      process.exit(error.status || 1)
    }

  } else {
    // 有 fixtures 缺失，使用录制模式
    console.log(`📼 检测到 ${missing.length} 个 fixtures 缺失：`)
    missing.forEach(f => console.log(`   - ${f}`))
    console.log('\n⚠️  切换到录制模式')
    console.log('💡 提示：这将调用真实的 LLM API，请确保已配置 API keys\n')

    try {
      execSync('playwright test', {
        stdio: 'inherit',
        env: { ...process.env, E2E_VCR_MODE: 'record' }
      })
    } catch (error) {
      process.exit(error.status || 1)
    }
  }
}

main()
