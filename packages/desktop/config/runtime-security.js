/** Runtime config exposed to renderer must be explicitly public.
 * Supplier API keys (VITE_*_API_KEY) stay main-process-only and are never
 * returned by getPublicRuntimeConfig / config-getEnvironmentVariables.
 */
const PUBLIC_RUNTIME_CONFIG_PATTERN = /^VITE_(?:APP|PUBLIC)_[A-Z0-9_]+$/;
const SENSITIVE_RUNTIME_CONFIG_SEGMENT = /(?:^|_)(?:API_KEY|KEY|TOKEN|SECRET|PASSWORD|PASS|AUTHORIZATION|HEADERS|CREDENTIALS?|COOKIE|PRIVATE)(?:_|$)/i;

/** 判断环境变量是否明确允许暴露给 renderer，且名称不包含敏感字段。 */
function isPublicRuntimeConfigKey(key) {
  return PUBLIC_RUNTIME_CONFIG_PATTERN.test(key)
    && !SENSITIVE_RUNTIME_CONFIG_SEGMENT.test(key);
}

/** 从主进程环境中提取 renderer 可见的公共配置及其无前缀兼容键。 */
function getPublicRuntimeConfig(environment) {
  const config = {};

  for (const [key, value] of Object.entries(environment)) {
    if (!isPublicRuntimeConfigKey(key) || value === undefined || value === null || String(value).length === 0) {
      continue;
    }

    const stringValue = String(value);
    config[key] = stringValue;
    config[key.replace(/^VITE_/, '')] = stringValue;
  }

  return config;
}

module.exports = {
  getPublicRuntimeConfig,
  isPublicRuntimeConfigKey,
};
