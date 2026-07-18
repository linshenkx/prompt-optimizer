const test = require('node:test');
const assert = require('node:assert/strict');

const { getPublicRuntimeConfig } = require('./runtime-security');

test('renderer runtime config exposes only explicitly public VITE variables', () => {
  const config = getPublicRuntimeConfig({
    VITE_PUBLIC_RELEASE_CHANNEL: 'stable',
    VITE_APP_BUILD_LABEL: 'desktop',
    VITE_OPENAI_API_KEY: 'secret-openai-key',
    VITE_CUSTOM_API_HEADERS: '{"Authorization":"Bearer secret"}',
    VITE_CUSTOM_API_BASE_URL: 'https://provider.example',
    INTERNAL_FEATURE_FLAG: 'hidden',
  });

  assert.deepEqual(config, {
    VITE_PUBLIC_RELEASE_CHANNEL: 'stable',
    PUBLIC_RELEASE_CHANNEL: 'stable',
    VITE_APP_BUILD_LABEL: 'desktop',
    APP_BUILD_LABEL: 'desktop',
  });
  assert.equal(JSON.stringify(config).includes('secret-openai-key'), false);
  assert.equal(JSON.stringify(config).includes('Bearer secret'), false);
  assert.equal(JSON.stringify(config).includes('provider.example'), false);
});

test('renderer runtime config rejects public-looking names that contain sensitive segments', () => {
  const config = getPublicRuntimeConfig({
    VITE_PUBLIC_API_TOKEN_HINT: 'still-secret',
    VITE_APP_PASSWORD_STATUS: 'still-secret',
    VITE_PUBLIC_FEATURE_FLAG: 'enabled',
  });

  assert.deepEqual(config, {
    VITE_PUBLIC_FEATURE_FLAG: 'enabled',
    PUBLIC_FEATURE_FLAG: 'enabled',
  });
});
