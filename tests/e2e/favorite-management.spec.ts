import path from 'node:path';
import type { Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { openFavoritesPage, waitForAppReady } from './helpers/common';

const imageFixturePath = (fileName: string) =>
  path.resolve(process.cwd(), 'tests/e2e/fixtures/images', fileName);
const inlineExampleImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l9v7rwAAAABJRU5ErkJggg==';

async function fillFieldByTestId(page: Page, testId: string, value: string): Promise<void> {
  const field = page
    .locator(
      `[data-testid="${testId}"] input, ` +
      `[data-testid="${testId}"] textarea, ` +
      `input[data-testid="${testId}"], ` +
      `textarea[data-testid="${testId}"]`
    )
    .first();

  await expect(field).toBeVisible({ timeout: 5000 });
  await field.fill(value);
}

async function uploadFavoriteImage(page: Page, fileName: string): Promise<void> {
  const uploadInput = page
    .locator(
      '[data-testid="favorite-editor-image-upload-empty"] input[type="file"], ' +
      '[data-testid="favorite-editor-image-upload"] input[type="file"]'
    )
    .first();

  await uploadInput.setInputFiles(imageFixturePath(fileName));
  await expect(page.getByTestId('favorite-editor-remove-image')).toBeVisible({ timeout: 10000 });
}

async function uploadExampleImage(
  page: Page,
  testId: 'favorite-repro-example-image-upload' | 'favorite-repro-example-input-image-upload',
  removeTestId: 'favorite-repro-example-remove-image' | 'favorite-repro-example-remove-input-image',
  fileName: string
): Promise<void> {
  const uploadInput = page
    .locator(`[data-testid="${testId}"] input[type="file"]`)
    .first();
  const previousCount = await page.getByTestId(removeTestId).count();

  await uploadInput.setInputFiles(imageFixturePath(fileName));
  await expect.poll(async () => page.getByTestId(removeTestId).count(), { timeout: 10000 }).toBeGreaterThan(previousCount);
}

async function addExampleImageUrl(
  page: Page,
  fieldTestId: 'favorite-repro-example-images' | 'favorite-repro-example-input-images',
  buttonTestId: 'favorite-repro-example-add-image-url' | 'favorite-repro-example-add-input-image-url',
  removeTestId: 'favorite-repro-example-remove-image' | 'favorite-repro-example-remove-input-image',
  value: string
): Promise<void> {
  const previousCount = await page.getByTestId(removeTestId).count();
  await fillFieldByTestId(page, fieldTestId, value);
  await page.getByTestId(buttonTestId).click();
  await expect.poll(async () => page.getByTestId(removeTestId).count(), { timeout: 10000 }).toBeGreaterThan(previousCount);
}

async function addExampleParameter(page: Page, key: string, value: string): Promise<void> {
  await fillFieldByTestId(page, 'favorite-repro-example-parameter-key', key);
  await fillFieldByTestId(page, 'favorite-repro-example-parameter-new-value', value);
  await page.getByTestId('favorite-repro-example-add-parameter').click();
}

async function closeFavoritesDrawerIfOpen(page: Page): Promise<void> {
  const modalCloseButton = page.locator('.n-modal .n-base-close:visible').last();
  if (await modalCloseButton.count()) {
    await modalCloseButton.dispatchEvent('click').catch(() => {});
    await expect(page.locator('.n-modal-mask')).toBeHidden({ timeout: 10000 }).catch(() => {});
  }

  const closeButton = page.locator('.n-drawer .n-base-close:visible').last();
  if (await closeButton.count()) {
    await closeButton.dispatchEvent('click').catch(() => {});
    await expect(page.locator('.n-drawer-mask')).toBeHidden({ timeout: 10000 }).catch(() => {});
  }
}

async function createFavoriteWithReproData(
  page: Page,
  data: {
    title: string;
    description: string;
    content: string;
    image: string;
    variableName: string;
    variableDefault: string;
    variableDescription: string;
    exampleId: string;
    exampleText: string;
    exampleDescription: string;
    exampleParameterKey: string;
    exampleParameterValue: string;
    exampleImages: string;
    exampleInputImages: string;
    exampleImageUpload: string;
    exampleInputImageUpload: string;
  }
): Promise<void> {
  await closeFavoritesDrawerIfOpen(page);
  await page.getByTestId('favorites-manager-add').click();
  await expect(page.getByTestId('favorite-editor-title')).toBeVisible({ timeout: 10000 });

  await fillFieldByTestId(page, 'favorite-editor-title', data.title);
  await fillFieldByTestId(page, 'favorite-editor-description', data.description);
  await fillFieldByTestId(page, 'favorite-editor-content', data.content);
  await uploadFavoriteImage(page, data.image);

  await page.getByTestId('favorite-repro-add-variable').click();
  await fillFieldByTestId(page, 'favorite-repro-variable-name', data.variableName);
  await fillFieldByTestId(page, 'favorite-repro-variable-default', data.variableDefault);
  await fillFieldByTestId(page, 'favorite-repro-variable-description', data.variableDescription);

  await page.getByTestId('favorite-repro-add-example').click();
  await fillFieldByTestId(page, 'favorite-repro-example-id', data.exampleId);
  await fillFieldByTestId(page, 'favorite-repro-example-text', data.exampleText);
  await fillFieldByTestId(page, 'favorite-repro-example-description', data.exampleDescription);
  await addExampleParameter(page, data.exampleParameterKey, data.exampleParameterValue);
  await addExampleImageUrl(page, 'favorite-repro-example-images', 'favorite-repro-example-add-image-url', 'favorite-repro-example-remove-image', data.exampleImages);
  await addExampleImageUrl(page, 'favorite-repro-example-input-images', 'favorite-repro-example-add-input-image-url', 'favorite-repro-example-remove-input-image', data.exampleInputImages);
  await uploadExampleImage(page, 'favorite-repro-example-image-upload', 'favorite-repro-example-remove-image', data.exampleImageUpload);
  await uploadExampleImage(page, 'favorite-repro-example-input-image-upload', 'favorite-repro-example-remove-input-image', data.exampleInputImageUpload);

  await page.getByTestId('favorite-editor-save').click();
  const detailPanel = page.getByTestId('favorite-detail-panel');
  await expect(detailPanel).toBeVisible({ timeout: 15000 });
  await expect(detailPanel).toContainText(data.title);
  await expect(detailPanel).toContainText(data.variableName);
  await expect(detailPanel).toContainText(data.exampleText);
}

async function selectFavoriteByTitle(page: Page, title: string): Promise<void> {
  await closeFavoritesDrawerIfOpen(page);
  await page.locator('.favorites-manager-search input').fill(title);
  const listItem = page.getByTestId('favorite-workspace-list-item').filter({ hasText: title }).first();
  await expect(listItem).toBeVisible({ timeout: 10000 });
  await listItem.click();
  await expect(page.getByTestId('favorite-detail-panel')).toContainText(title, { timeout: 10000 });
}

async function seedFavorites(page: Page, favorites: unknown[]): Promise<void> {
  await page.evaluate(async (items) => {
    const dbName = (window as unknown as { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ || 'PromptOptimizerDB';
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage', { keyPath: 'key' });
        }
      };
      request.onerror = () => reject(request.error || new Error('Failed to open test database'));
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        store.put({ key: 'favorites', value: JSON.stringify(items), timestamp: Date.now() });
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error || new Error('Failed to seed favorites'));
        };
      };
    });
  }, favorites);
}

async function expectAnyTextareaValue(page: Page, value: string): Promise<void> {
  await expect.poll(async () => {
    const values = await page.locator('textarea').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLTextAreaElement).value)
    );
    return values.includes(value);
  }, { timeout: 10000 }).toBe(true);
}

/**
 * 收藏管理基础 E2E 测试
 * 验证收藏管理器的核心功能
 */
test.describe('收藏管理基础功能', () => {
  test.beforeEach(async ({ page }) => {
    await openFavoritesPage(page);
  });

  test('应用能够正常加载', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/小词|GlobalCloud XiaoC/i);

    // 验证主要元素存在
    const mainContent = page.locator('main, #app, [role="main"]');
    await expect(mainContent).toBeAttached();
  });

  test('能够打开收藏管理器', async ({ page }) => {
    await expect(page).toHaveURL(/\/#\/favorites/);
    await expect(page.getByTestId('favorites-page')).toBeVisible();
    await expect(page.getByTestId('favorites-manager-workspace')).toBeVisible();
  });

  test('收藏管理器包含必要的UI元素', async ({ page }) => {
    const workspace = page.getByTestId('favorites-page');

    // 验证搜索输入框
    await expect(workspace.getByPlaceholder(/搜索|search/i)).toBeVisible();

    await expect(page.getByTestId('favorites-manager-actions')).toBeVisible();
    await expect(page.getByTestId('favorites-manager-import')).toBeVisible();
    await expect(page.getByTestId('favorites-manager-add')).toBeVisible();
  });

  test('能够创建新收藏(基础验证)', async ({ page }) => {
    await page.getByTestId('favorites-manager-add').click();

    // 等待创建对话框出现
    await expect(page.getByTestId('favorite-editor-title')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('favorite-editor-content')).toBeVisible();
  });
});

/**
 * 收藏 CRUD 完整流程测试
 */
test.describe('收藏完整 CRUD 流程', () => {
  test.beforeEach(async ({ page }) => {
    await openFavoritesPage(page);
  });

  test('完整的创建、编辑、删除收藏流程', async ({ page }) => {
    await page.getByTestId('favorites-manager-add').click();

    // 填写标题
    await fillFieldByTestId(page, 'favorite-editor-title', 'E2E 测试收藏');

    // 填写内容
    await fillFieldByTestId(page, 'favorite-editor-content', '这是一个 E2E 测试创建的收藏内容');

    // 4. 保存收藏
    await page.getByTestId('favorite-editor-save').click();
    await expect(page.getByTestId('favorite-detail-panel')).toContainText('E2E 测试收藏', { timeout: 15000 });

    // 5. 验证收藏已创建 - 搜索刚创建的收藏
    const searchInput = page.locator('.favorites-manager-search input');
    await searchInput.fill('E2E 测试收藏');
    const favoriteCard = page.getByTestId('favorite-workspace-list-item').filter({ hasText: 'E2E 测试收藏' }).first();
    await expect(favoriteCard).toBeVisible({ timeout: 10000 });

    // 6. 编辑收藏
    await expect(page.getByTestId('favorite-detail-panel')).toContainText('E2E 测试收藏');
    await page.getByTestId('favorite-detail-edit').click();
    await fillFieldByTestId(page, 'favorite-editor-description', 'E2E 编辑后的说明');
    await page.getByTestId('favorite-editor-save').click();
    await expect(page.getByTestId('favorite-detail-panel')).toContainText('E2E 编辑后的说明', { timeout: 15000 });

    // 7. 删除收藏
    await page.getByTestId('favorite-detail-delete').click();
    await page.getByRole('button', { name: /确认|确定|Confirm|OK/i }).last().click();
    await expect(page.getByTestId('favorite-workspace-list-item').filter({ hasText: 'E2E 测试收藏' })).toHaveCount(0, {
      timeout: 10000,
    });
  });
});

/**
 * 搜索和过滤功能测试
 */
test.describe('搜索和过滤功能', () => {
  test.beforeEach(async ({ page }) => {
    await openFavoritesPage(page);
  });

  test('搜索功能能够正常工作', async ({ page }) => {
    // 测试搜索功能
    const searchInput = page.locator('.favorites-manager-search input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('测试');
    await page.waitForTimeout(800);

    // 验证搜索输入框的值已更新
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('测试');

    // 清空搜索
    await searchInput.clear();
    await page.waitForTimeout(500);

    // 验证搜索已清空
    const clearedValue = await searchInput.inputValue();
    expect(clearedValue).toBe('');
  });

  test('分类过滤能够正常工作', async ({ page }) => {
    // 查找分类选择器
    const categorySelect = page.getByTestId('favorites-page').locator('.favorites-manager-filters .n-base-selection').first();
    await expect(categorySelect).toBeVisible();
    await categorySelect.click();
    await page.waitForTimeout(300);

    // 选择一个分类选项（如果有）
    const firstOption = page.locator('.n-base-select-option').first();
    if (await firstOption.count() > 0) {
      await firstOption.click();
      await page.waitForTimeout(800);

      // 验证选择器不再显示下拉菜单（已选择）
      const dropdownHidden = await page.locator('.n-base-select-menu').isHidden().catch(() => true);
      expect(dropdownHidden).toBe(true);
    }
  });
});

/**
 * 标签管理功能测试
 */
test.describe('标签管理功能', () => {
  test.beforeEach(async ({ page }) => {
    await openFavoritesPage(page);
  });

  test('能够打开标签管理器', async ({ page }) => {
    // 打开更多操作下拉菜单（NDropdown 的菜单渲染在 portal 中，不在 dialog DOM 内）
    // 用 data-testid 精确定位触发按钮，避免误点输入框的 clear icon 等。
    const moreButton = page.getByTestId('favorites-manager-actions');
    await expect(moreButton).toBeVisible({ timeout: 5000 });
    await moreButton.click();

    await page.getByTestId('favorites-manager-action-manage-tags').click();

    // 验证标签管理器对话框出现（标题是“标签管理”/“Tag Manager”）
    const tagDialog = page.locator('[role="dialog"]').filter({ hasText: /标签管理|Tag Manager/i }).last();
    await expect(tagDialog).toBeVisible({ timeout: 5000 });
  });
});

/**
 * 分类管理功能测试
 */
test.describe('分类管理功能', () => {
  test.beforeEach(async ({ page }) => {
    await openFavoritesPage(page);
  });

  test('能够打开分类管理器', async ({ page }) => {
    // 打开更多操作下拉菜单（NDropdown 的菜单渲染在 portal 中，不在 dialog DOM 内）
    const moreButton = page.getByTestId('favorites-manager-actions');
    await expect(moreButton).toBeVisible({ timeout: 5000 });
    await moreButton.click();

    await page.getByTestId('favorites-manager-action-manage-categories').click();

    // 验证分类管理器对话框出现（标题是“分类管理”/“Category Manager”）
    const categoryDialog = page.locator('[role="dialog"]').filter({ hasText: /分类管理|Category Manager/i }).last();
    await expect(categoryDialog).toBeVisible({ timeout: 5000 });
  });
});

/**
 * 导入导出功能测试
 */
test.describe('导入导出功能', () => {
  test.beforeEach(async ({ page }) => {
    await openFavoritesPage(page);
  });

  test('导出按钮能够正常工作', async ({ page }) => {
    await page.getByTestId('favorites-manager-actions').click();

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.getByTestId('favorites-manager-action-export').click();

    const download = await downloadPromise;
    expect(download).toBeTruthy();
  });
});

/**
 * 收藏管理数据持久化测试
 */
test.describe('收藏数据持久化', () => {
  test('本地存储能够正常工作', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 检查 localStorage 是否可用
    const localStorageAvailable = await page.evaluate(() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch (e) {
        return false;
      }
    });

    expect(localStorageAvailable).toBe(true);
  });
});

test.describe('收藏夹图片、变量和示例流程', () => {
  test('能够创建、编辑切换并使用带图片/变量/示例的收藏', async ({ page }) => {
    test.setTimeout(90000);

    const firstFavorite = {
      title: 'E2E 图片收藏 A',
      description: '红色图片收藏，包含变量和示例',
      content: '使用 {{topic}} 生成一段正式中文系统提示词。',
      image: 'favorite-red.svg',
      variableName: 'topic',
      variableDefault: '产品发布',
      variableDescription: '需要生成提示词的主题',
      exampleId: 'case-red',
      exampleText: '围绕新品发布生成语气稳重的系统提示词',
      exampleDescription: '红色图片收藏的示例说明',
      exampleParameterKey: 'topic',
      exampleParameterValue: '新品发布',
      exampleImages: inlineExampleImage,
      exampleInputImages: inlineExampleImage,
      exampleImageUpload: 'favorite-red.svg',
      exampleInputImageUpload: 'favorite-red.svg',
    };
    const secondFavorite = {
      title: 'E2E 图片收藏 B',
      description: '蓝色图片收藏，验证编辑态不会串数据',
      content: '请根据 {{audience}} 输出精简版图像提示词。',
      image: 'favorite-blue.svg',
      variableName: 'audience',
      variableDefault: '开发者',
      variableDescription: '目标读者或使用者',
      exampleId: 'case-blue',
      exampleText: '为开发者输出一段精简提示词',
      exampleDescription: '蓝色图片收藏的示例说明',
      exampleParameterKey: 'audience',
      exampleParameterValue: '开发者',
      exampleImages: inlineExampleImage,
      exampleInputImages: inlineExampleImage,
      exampleImageUpload: 'favorite-blue.svg',
      exampleInputImageUpload: 'favorite-blue.svg',
    };

    await openFavoritesPage(page);

    await createFavoriteWithReproData(page, firstFavorite);
    await createFavoriteWithReproData(page, secondFavorite);

    await selectFavoriteByTitle(page, firstFavorite.title);
    await expect(page.getByTestId('favorite-detail-panel')).toContainText(firstFavorite.variableName);
    await expect(page.getByTestId('favorite-detail-panel')).toContainText(firstFavorite.exampleText);

    await page.getByTestId('favorite-detail-edit').click();
    await expect(page.getByTestId('favorite-editor-title')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="favorite-editor-title"] input')).toHaveValue(firstFavorite.title);

    await page.getByTestId('favorite-editor-cancel').click();
    await closeFavoritesDrawerIfOpen(page);
    await selectFavoriteByTitle(page, secondFavorite.title);
    await page.getByTestId('favorite-detail-edit').click();
    await expect(page.locator('[data-testid="favorite-editor-title"] input')).toHaveValue(secondFavorite.title);
    await expect(page.locator('[data-testid="favorite-editor-content"] textarea')).toHaveValue(secondFavorite.content);
    await expect(page.locator('[data-testid="favorite-repro-variable-name"] input')).toHaveValue(secondFavorite.variableName);

    await fillFieldByTestId(page, 'favorite-editor-description', '蓝色图片收藏已通过 E2E 编辑验证');
    await page.getByTestId('favorite-editor-save').click();
    const detailPanel = page.getByTestId('favorite-detail-panel');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await expect(detailPanel).toContainText('蓝色图片收藏已通过 E2E 编辑验证');
    await expect(detailPanel).toContainText(secondFavorite.variableName);
    await expect(detailPanel).toContainText(secondFavorite.exampleText);

    await page.getByTestId('favorite-detail-use').click();
    await expect(page).toHaveURL(/\/#\/basic\/system$/, { timeout: 20000 });
    await expect(page.locator('[data-testid="basic-system-input"] textarea')).toHaveValue(secondFavorite.content, {
      timeout: 10000,
    });

    await openFavoritesPage(page);
    await selectFavoriteByTitle(page, secondFavorite.title);
    await page.getByTestId('favorite-detail-delete').click();
    await page.getByRole('button', { name: /确认|确定|Confirm|OK/i }).last().click();
    await expect(page.getByTestId('favorite-workspace-list-item').filter({ hasText: secondFavorite.title })).toHaveCount(0, {
      timeout: 10000,
    });
  });
});

test.describe('收藏示例应用流程', () => {
  test('能够从收藏示例应用非图像变量提示词、会话提示词和图像提示词，不调用 LLM', async ({ page }) => {
    test.setTimeout(60000);

    const now = Date.now();
    const nonImageFavorite = {
      id: 'e2e-fav-pro-variable-example',
      title: 'E2E 非图像示例收藏',
      description: '验证收藏示例参数进入上下文变量模式',
      content: '请围绕 {{topic}} 写一个结构化提示词。',
      createdAt: now,
      updatedAt: now,
      tags: [],
      useCount: 0,
      functionMode: 'context',
      optimizationMode: 'user',
      metadata: {
        reproducibility: {
          variables: [{ name: 'topic', defaultValue: '默认主题', required: true }],
          examples: [{ id: 'case-topic', parameters: { topic: '收藏示例主题' } }],
        },
      },
    };
    const imageFavorite = {
      id: 'e2e-fav-image-example',
      title: 'E2E 图像示例收藏',
      description: '验证收藏示例可应用图像模式输入图和变量',
      content: '生成一张 {{scene}} 的参考图。',
      createdAt: now + 1,
      updatedAt: now + 1,
      tags: [],
      useCount: 0,
      functionMode: 'image',
      imageSubMode: 'multiimage',
      metadata: {
        reproducibility: {
          variables: [{ name: 'scene', defaultValue: '默认场景' }],
          examples: [{ id: 'case-image', parameters: { scene: '夜晚花园' }, inputImages: ['https://favorite-example.local/input.png'] }],
        },
      },
    };
    const conversationFavorite = {
      id: 'e2e-fav-pro-conversation-asset',
      title: 'E2E 会话资产收藏',
      description: '验证 pro-conversation 标准资产恢复到 pro-multi 消息工作区',
      content: 'Legacy conversation fallback',
      createdAt: now + 2,
      updatedAt: now + 2,
      tags: [],
      useCount: 0,
      functionMode: 'context',
      optimizationMode: 'system',
      metadata: {
        promptAsset: {
          schemaVersion: 'prompt-model/v1',
          id: 'asset-e2e-conversation',
          title: 'E2E 会话资产',
          tags: [],
          contract: {
            family: 'pro',
            subMode: 'conversation',
            modeKey: 'pro-conversation',
            variables: [],
          },
          currentVersionId: 'messages-v1',
          versions: [
            {
              id: 'messages-v1',
              version: 1,
              content: {
                kind: 'messages',
                messages: [
                  { role: 'system', content: '你是一个结构化摘要助手。' },
                  { role: 'user', content: '请总结 {{topic}} 的关键价值。' },
                ],
              },
              createdAt: now + 2,
            },
          ],
          examples: [],
          createdAt: now + 2,
          updatedAt: now + 2,
        },
      },
    };

    await openFavoritesPage(page);
    await seedFavorites(page, [nonImageFavorite, imageFavorite, conversationFavorite]);
    await page.route('https://favorite-example.local/input.png', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(inlineExampleImage.split(',')[1] || '', 'base64'),
      });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page.getByTestId('favorites-manager-add')).toBeVisible({ timeout: 20000 });
    await selectFavoriteByTitle(page, nonImageFavorite.title);
    await page.getByTestId('favorite-repro-example-apply-0').click();
    await expect(page).toHaveURL(/\/#\/pro\/variable$/, { timeout: 20000 });
    await expect(page.getByTestId('workspace')).toHaveAttribute('data-mode', 'pro-variable');
    await expect(page.getByTestId('pro-variable-input')).toContainText(nonImageFavorite.content, { timeout: 10000 });
    await expect(page.locator('[data-testid="workspace"][data-mode="pro-variable"]')).toContainText('topic', { timeout: 10000 });
    await expectAnyTextareaValue(page, '收藏示例主题');

    await openFavoritesPage(page);
    await selectFavoriteByTitle(page, imageFavorite.title);
    await page.getByTestId('favorite-repro-example-apply-0').click();
    await expect(page).toHaveURL(/\/#\/image\/multiimage$/, { timeout: 20000 });
    await expect(page.getByTestId('workspace')).toHaveAttribute('data-mode', 'image-multiimage');
    await expect(page.getByTestId('workspace')).toContainText(imageFavorite.content, { timeout: 10000 });
    await expectAnyTextareaValue(page, '夜晚花园');
    await expect(page.locator('[data-testid="workspace"][data-mode="image-multiimage"] img[src^="data:image/"]')).toHaveCount(1, { timeout: 10000 });

    await openFavoritesPage(page);
    await selectFavoriteByTitle(page, conversationFavorite.title);
    await page.getByTestId('favorite-detail-use').click();
    await expect(page).toHaveURL(/\/#\/pro\/multi$/, { timeout: 20000 });
    await expect(page.getByTestId('workspace')).toHaveAttribute('data-mode', 'pro-multi');
    await expect(page.getByTestId('pro-multi-message-card-0')).toContainText('你是一个结构化摘要助手。', { timeout: 10000 });
    await expect(page.getByTestId('pro-multi-message-card-1')).toContainText('请总结 {{topic}} 的关键价值。', { timeout: 10000 });
  });
});

test.describe('从工作区保存收藏的可复现信息', () => {
  test('基础模式普通保存收藏时带出变量但不自动生成当前示例，不调用 LLM', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/#/basic/system', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page.getByTestId('workspace')).toHaveAttribute('data-mode', 'basic-system');

    const originalPrompt = '原始提示词包含 {{topic}}';
    const savedPrompt = '优化结果围绕 {{topic}} 输出';
    await page.locator('[data-testid="basic-system-input"] textarea').fill(originalPrompt);
    await page.locator('[data-testid="basic-system-output"] textarea').fill(savedPrompt);
    await page.getByTestId('basic-system-output-favorite').click();

    await expect(page.getByTestId('favorite-editor-title')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="favorite-editor-content"] textarea')).toHaveValue(savedPrompt);
    await expect(page.locator('[data-testid="favorite-repro-variable-name"] input')).toHaveValue('topic');
    await expect(page.getByTestId('favorite-repro-example-text')).toHaveCount(0);

    const title = 'E2E 工作区保存变量收藏';
    await fillFieldByTestId(page, 'favorite-editor-title', title);
    await page.getByTestId('favorite-editor-save').click();

    await openFavoritesPage(page);
    await selectFavoriteByTitle(page, title);
    const detailPanel = page.getByTestId('favorite-detail-panel');
    await expect(detailPanel).toContainText('topic', { timeout: 10000 });
    await expect(detailPanel).not.toContainText('workspace-current');
    await expect(page.getByTestId('favorite-repro-example-apply-0')).toHaveCount(0);

    await page.getByTestId('favorite-detail-use').click();
    await expect(page).toHaveURL(/\/#\/basic\/system$/, { timeout: 20000 });
    await expect(page.locator('[data-testid="basic-system-input"] textarea')).toHaveValue(savedPrompt, {
      timeout: 10000,
    });
  });
});
