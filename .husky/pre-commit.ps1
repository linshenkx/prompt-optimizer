# PowerShell版本的pre-commit钩子

# 检查是否存在package-lock.json或yarn.lock文件
if (Test-Path "package-lock.json") {
  Write-Host "错误: 检测到package-lock.json文件。" -ForegroundColor Red
  Write-Host "本项目强制使用pnpm作为包管理器，请删除package-lock.json并使用pnpm install安装依赖。" -ForegroundColor Red
  exit 1
}

if (Test-Path "yarn.lock") {
  Write-Host "错误: 检测到yarn.lock文件。" -ForegroundColor Red
  Write-Host "本项目强制使用pnpm作为包管理器，请删除yarn.lock并使用pnpm install安装依赖。" -ForegroundColor Red
  exit 1
}

# 确保pnpm-lock.yaml存在
if (-not (Test-Path "pnpm-lock.yaml")) {
  Write-Host "警告: 未检测到pnpm-lock.yaml文件。" -ForegroundColor Yellow
  Write-Host "请确保使用pnpm install安装依赖。" -ForegroundColor Yellow
} 

# 测试门禁（可用 SKIP_TEST_GATE=1 跳过，仅用于紧急情况）
if ($env:SKIP_TEST_GATE -eq "1") {
  Write-Host "跳过测试门禁：检测到 SKIP_TEST_GATE=1" -ForegroundColor Yellow
  exit 0
}

Write-Host "运行测试门禁（fast）：pnpm test:gate" -ForegroundColor Cyan
pnpm test:gate
