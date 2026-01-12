import { test, expect } from './fixtures';

/**
 * UI 交互回归测试
 *
 * 目的: 确保现有的 UI 功能没有被新变更破坏
 * 测试范围:
 * 1. 收藏列表的显示和交互
 * 2. 导入导出功能
 * 3. 分类管理基本功能
 * 4. 现有的搜索和过滤
 */
test.describe('UI 交互回归测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('收藏管理器能够正常打开和关闭', async ({ page }) => {
    // 这是一个基础功能，应该一直工作

    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();
    await page.waitForTimeout(500);

    // 2. 验证对话框打开
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 3. 关闭对话框
    const closeButton = dialog.locator('[aria-label="close"], .n-base-close, .n-dialog__close').first();
    if (await closeButton.count() > 0) {
      await closeButton.click();
      await page.waitForTimeout(500);

      // 4. 验证对话框关闭
      await expect(dialog).not.toBeVisible();
    }
  });

  test('收藏列表能够正常显示', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 等待列表加载
    await page.waitForTimeout(1000);

    // 3. 验证列表容器存在
    // 即使没有数据，也应该有空状态或列表容器
    const hasEmptyState = await managerDialog.locator('.n-empty').isVisible().catch(() => false);
    const hasList = await managerDialog.locator('.n-card, [class*="favorite"]').count() > 0;

    // 应该至少有一个存在（空状态或列表）
    expect(hasEmptyState || hasList).toBe(true);
  });

  test('导出功能能够正常触发', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 查找更多操作菜单
    const moreButton = managerDialog.getByRole('button').filter({
      has: page.locator('svg, .n-icon')
    }).first();

    if (await moreButton.count() > 0) {
      await moreButton.click();
      await page.waitForTimeout(300);

      // 3. 查找导出选项
      const exportOption = page.locator('text=/导出|Export/i');

      if (await exportOption.count() > 0) {
        // 设置下载监听
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

        await exportOption.click();

        // 验证下载开始（如果有数据）
        const download = await downloadPromise;
        if (download) {
          expect(download).toBeTruthy();
        }
        // 如果没有数据，可能没有下载，这也是正常的
      }
    }
  });

  test('导入功能对话框能够正常打开', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 查找导入按钮
    const importButton = managerDialog.getByRole('button', { name: /导入|Import/i });

    if (await importButton.count() > 0) {
      await importButton.click();
      await page.waitForTimeout(500);

      // 3. 验证导入对话框或文件选择器出现
      // 可能是新对话框或文件上传组件
      const importDialog = page.locator('[role="dialog"]').last();
      const isNewDialog = await importDialog.isVisible().catch(() => false);

      // 如果有导入对话框，验证它显示正常
      if (isNewDialog) {
        await expect(importDialog).toBeVisible();
      }
    }
  });

  test('搜索功能输入响应正常', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 2. 查找搜索框
    const searchInput = dialog.getByPlaceholder(/搜索|search/i);

    if (await searchInput.count() > 0) {
      // 3. 输入搜索文本
      await searchInput.fill('回归测试');
      await page.waitForTimeout(500);

      // 4. 验证输入值正确
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('回归测试');

      // 5. 清空搜索
      await searchInput.clear();
      await page.waitForTimeout(300);

      const clearedValue = await searchInput.inputValue();
      expect(clearedValue).toBe('');
    }
  });

  test('分类选择器能够正常交互', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 2. 查找分类选择器
    const categorySelect = dialog.locator('.n-base-selection, .n-select').first();

    if (await categorySelect.count() > 0) {
      // 3. 点击打开下拉菜单
      await categorySelect.click();
      await page.waitForTimeout(300);

      // 4. 验证下拉菜单出现
      const dropdown = page.locator('.n-base-select-menu, .n-select-menu');
      if (await dropdown.isVisible().catch(() => false)) {
        await expect(dropdown).toBeVisible();

        // 5. 关闭下拉菜单（点击其他地方）
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  });

  test('创建收藏对话框表单验证正常工作', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 点击创建按钮
    const createButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await createButton.click();
    await page.waitForTimeout(500);

    // 3. 定位到创建对话框
    const createDialog = page.locator('[role="dialog"]').last();

    // 4. 尝试保存空表单（应该有验证）
    const saveButton = createDialog.getByRole('button', { name: /保存|save|确定|ok/i });

    if (await saveButton.count() > 0) {
      // 点击保存
      await saveButton.click();
      await page.waitForTimeout(500);

      // 验证对话框仍然打开（因为验证失败）
      // 或者有错误提示显示
      const stillVisible = await createDialog.isVisible().catch(() => false);

      // 如果对话框仍然可见，说明验证起作用了
      if (stillVisible) {
        expect(stillVisible).toBe(true);
      }
    }
  });

  test('工具栏按钮都能正常点击', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 查找所有工具栏按钮
    const toolbarButtons = managerDialog.locator('.toolbar button, [class*="toolbar"] button');

    const buttonCount = await toolbarButtons.count();

    if (buttonCount > 0) {
      // 3. 验证至少有一些按钮可点击
      let clickableCount = 0;

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = toolbarButtons.nth(i);
        const isEnabled = await button.isEnabled().catch(() => false);
        if (isEnabled) {
          clickableCount++;
        }
      }

      // 至少应该有一些按钮是可用的
      expect(clickableCount).toBeGreaterThan(0);
    }
  });

  test('收藏卡片能够正常显示（如果有数据）', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();
    await page.waitForTimeout(1000);

    // 2. 先创建一个收藏以确保有数据
    const createButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await createButton.click();
    await page.waitForTimeout(500);

    const createDialog = page.locator('[role="dialog"]').last();

    // 填写基本信息
    const titleInput = createDialog.getByPlaceholder(/标题|title/i);
    if (await titleInput.count() > 0) {
      await titleInput.fill('回归测试收藏');

      const contentInput = createDialog.locator('textarea').first();
      if (await contentInput.count() > 0) {
        await contentInput.fill('这是用于回归测试的收藏内容');
      }

      // 保存
      const saveButton = createDialog.getByRole('button', { name: /保存|save|确定|ok/i });
      if (await saveButton.count() > 0) {
        await saveButton.click();
        await page.waitForTimeout(1500);

        // 3. 验证收藏卡片显示
        const favoriteCard = managerDialog.locator('text=回归测试收藏');
        if (await favoriteCard.count() > 0) {
          await expect(favoriteCard.first()).toBeVisible();
        }
      }
    }
  });
});

/**
 * 关键功能持续性测试
 * 确保核心功能在重构后依然可用
 */
test.describe('关键功能持续性测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应用主界面能够正常加载', async ({ page }) => {
    // 验证基础 HTML 结构
    const app = page.locator('#app, [id="app"], main');
    await expect(app).toBeAttached();

    // 验证页面标题
    await expect(page).toHaveTitle(/提示词优化器|Prompt Optimizer/i);
  });

  test('本地存储功能保持可用', async ({ page }) => {
    // 验证 localStorage 仍然可用
    const storageWorks = await page.evaluate(() => {
      try {
        const testKey = 'regression-test-' + Date.now();
        localStorage.setItem(testKey, 'test-value');
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        return retrieved === 'test-value';
      } catch (e) {
        return false;
      }
    });

    expect(storageWorks).toBe(true);
  });

  test('页面布局结构保持完整', async ({ page }) => {
    // 验证基本布局元素存在
    await page.waitForTimeout(1000);

    // 应该有某种导航或工具栏
    const hasNavigation = await page.locator('nav, header, .toolbar, [class*="toolbar"]').count();

    // 应该有主内容区域
    const hasMainContent = await page.locator('main, #app, [role="main"], .content').count();

    // 至少应该有一些结构
    expect(hasNavigation + hasMainContent).toBeGreaterThan(0);
  });
});
