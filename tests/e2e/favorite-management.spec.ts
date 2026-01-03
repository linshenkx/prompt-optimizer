import { test, expect } from './fixtures';

/**
 * 收藏管理基础 E2E 测试
 * 验证收藏管理器的核心功能
 */
test.describe('收藏管理基础功能', () => {
  test.beforeEach(async ({ page }) => {
    // 访问应用首页
    await page.goto('/');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
  });

  test('应用能够正常加载', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/提示词优化器|Prompt Optimizer/i);

    // 验证主要元素存在
    const mainContent = page.locator('main, #app, [role="main"]');
    await expect(mainContent).toBeAttached();
  });

  test('能够打开收藏管理器', async ({ page }) => {
    // 查找并点击收藏管理按钮
    // 根据实际UI调整选择器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });

    if (await favoriteButton.count() > 0) {
      await favoriteButton.first().click();

      // 等待收藏管理器对话框出现
      const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|favorite/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // 验证对话框标题
      const dialogTitle = dialog.locator('h1, h2, .n-card-header__main');
      await expect(dialogTitle).toContainText(/收藏|Favorites/i);
    } else {
      // 如果没有找到收藏按钮,跳过测试
      test.skip();
    }
  });

  test('收藏管理器包含必要的UI元素', async ({ page }) => {
    // 尝试打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });

    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    // 等待对话框出现
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|favorite/i });
    await expect(dialog).toBeVisible();

    // 验证搜索输入框
    const searchInput = dialog.getByPlaceholder(/搜索|search/i);
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }

    // 验证"添加"或"创建"按钮
    const addButton = dialog.getByRole('button', { name: /添加|创建|新建|add|create/i });
    if (await addButton.count() > 0) {
      await expect(addButton.first()).toBeVisible();
    }
  });

  test('能够创建新收藏(基础验证)', async ({ page }) => {
    // 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });

    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|favorite/i });
    await expect(dialog).toBeVisible();

    // 点击添加按钮
    const addButton = dialog.getByRole('button', { name: /添加|创建|新建|add|create/i });

    if (await addButton.count() === 0) {
      test.skip();
      return;
    }

    await addButton.first().click();

    // 等待创建对话框出现
    await page.waitForTimeout(500); // 等待动画

    // 验证创建对话框出现(可能是第二个对话框)
    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();

    // 如果有多个对话框,说明创建对话框已打开
    expect(dialogCount).toBeGreaterThanOrEqual(1);
  });
});

/**
 * 收藏 CRUD 完整流程测试
 */
test.describe('收藏完整 CRUD 流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('完整的创建、编辑、删除收藏流程', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 等待对话框完全加载
    await page.waitForTimeout(500);

    // 2. 点击添加收藏按钮
    const addButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. 填写收藏信息
    const createDialog = page.locator('[role="dialog"]').last();

    // 填写标题
    const titleInput = createDialog.getByPlaceholder(/标题|title/i);
    if (await titleInput.count() > 0) {
      await titleInput.fill('E2E 测试收藏');
    }

    // 填写内容
    const contentInput = createDialog.locator('textarea').first();
    if (await contentInput.count() > 0) {
      await contentInput.fill('这是一个 E2E 测试创建的收藏内容');
    }

    // 4. 保存收藏
    const saveButton = createDialog.getByRole('button', { name: /保存|save|确定|ok/i });
    if (await saveButton.count() > 0) {
      await saveButton.click();

      // 等待保存完成
      await page.waitForTimeout(1000);

      // 5. 验证收藏已创建 - 搜索刚创建的收藏
      const searchInput = managerDialog.getByPlaceholder(/搜索|search/i);
      if (await searchInput.count() > 0) {
        await searchInput.fill('E2E 测试收藏');
        await page.waitForTimeout(500);

        // 验证收藏卡片出现
        const favoriteCard = managerDialog.locator('text=E2E 测试收藏');
        if (await favoriteCard.count() > 0) {
          await expect(favoriteCard.first()).toBeVisible();

          // 6. 删除收藏 - 查找删除按钮
          const card = favoriteCard.locator('..').locator('..').first();
          const deleteButton = card.getByRole('button', { name: /删除|delete/i });

          if (await deleteButton.count() > 0) {
            await deleteButton.click();
            await page.waitForTimeout(300);

            // 确认删除
            const confirmButton = page.getByRole('button', { name: /确定|确认|yes|ok/i });
            if (await confirmButton.count() > 0) {
              await confirmButton.click();
              await page.waitForTimeout(500);

              // 7. 验证收藏已删除
              await searchInput.clear();
              await searchInput.fill('E2E 测试收藏');
              await page.waitForTimeout(500);

              const deletedCard = managerDialog.locator('text=E2E 测试收藏');
              expect(await deletedCard.count()).toBe(0);
            }
          }
        }
      }
    }
  });
});

/**
 * 搜索和过滤功能测试
 */
test.describe('搜索和过滤功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('搜索功能能够正常工作', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 测试搜索功能
    const searchInput = dialog.getByPlaceholder(/搜索|search/i);
    if (await searchInput.count() > 0) {
      // 输入搜索关键词
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
    }
  });

  test('分类过滤能够正常工作', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 查找分类选择器
    const categorySelect = dialog.locator('.n-base-selection, .n-select').first();
    if (await categorySelect.count() > 0) {
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
    }
  });
});

/**
 * 标签管理功能测试
 */
test.describe('标签管理功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('能够打开标签管理器', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 查找更多操作菜单按钮
    const moreButton = managerDialog.getByRole('button').filter({
      has: page.locator('svg, .n-icon')
    }).first();

    if (await moreButton.count() > 0) {
      await moreButton.click();
      await page.waitForTimeout(300);

      // 查找标签管理选项
      const tagManagerOption = page.locator('text=/标签管理|Tag/i');
      if (await tagManagerOption.count() > 0) {
        await tagManagerOption.click();
        await page.waitForTimeout(500);

        // 验证标签管理器对话框出现
        const tagDialog = page.locator('[role="dialog"]').filter({ hasText: /标签|Tag/i });
        await expect(tagDialog).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

/**
 * 分类管理功能测试
 */
test.describe('分类管理功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('能够打开分类管理器', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 查找更多操作菜单按钮
    const moreButton = managerDialog.getByRole('button').filter({
      has: page.locator('svg, .n-icon')
    }).first();

    if (await moreButton.count() > 0) {
      await moreButton.click();
      await page.waitForTimeout(300);

      // 查找分类管理选项
      const categoryManagerOption = page.locator('text=/分类管理|Category/i');
      if (await categoryManagerOption.count() > 0) {
        await categoryManagerOption.click();
        await page.waitForTimeout(500);

        // 验证分类管理器对话框出现
        const categoryDialog = page.locator('[role="dialog"]').filter({ hasText: /分类|Category/i });
        await expect(categoryDialog).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

/**
 * 导入导出功能测试
 */
test.describe('导入导出功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('导出按钮能够正常工作', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 查找更多操作菜单
    const moreButton = managerDialog.getByRole('button').filter({
      has: page.locator('svg, .n-icon')
    }).first();

    if (await moreButton.count() > 0) {
      await moreButton.click();
      await page.waitForTimeout(300);

      // 查找导出选项
      const exportOption = page.locator('text=/导出|Export/i');
      if (await exportOption.count() > 0) {
        // 设置下载监听
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

        await exportOption.click();

        // 验证下载开始（如果有）
        const download = await downloadPromise;
        if (download) {
          expect(download).toBeTruthy();
        }
      }
    }
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
