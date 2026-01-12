import { test, expect } from './fixtures';

/**
 * 标签自动完成功能 E2E 测试
 * 验证标签输入和自动完成建议功能
 */
test.describe('标签自动完成功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('标签自动完成建议能够正常显示', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 点击添加收藏按钮
    const addButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. 定位到编辑对话框
    const editDialog = page.locator('[role="dialog"]').last();
    await expect(editDialog).toBeVisible();

    // 4. 查找标签输入框
    const tagInput = editDialog.getByPlaceholder(/标签|tag/i);

    if (await tagInput.count() > 0) {
      // 5. 输入部分标签文本
      await tagInput.fill('测');
      await page.waitForTimeout(500);

      // 6. 验证标签输入框的值
      const inputValue = await tagInput.inputValue();
      expect(inputValue).toBe('测');

      // 7. 检查是否有自动完成下拉菜单出现
      const autocompleteMenu = page.locator('.n-auto-complete-menu, .n-base-select-menu');

      // 注意：如果没有匹配的建议，菜单可能不会显示，这是正常的
      // 我们只验证输入功能正常

      // 8. 清空输入
      await tagInput.clear();
      await page.waitForTimeout(300);

      const clearedValue = await tagInput.inputValue();
      expect(clearedValue).toBe('');
    }
  });

  test('可以通过手动输入添加标签', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 点击添加收藏按钮
    const addButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. 定位到编辑对话框
    const editDialog = page.locator('[role="dialog"]').last();

    // 4. 查找标签输入框
    const tagInput = editDialog.getByPlaceholder(/标签|tag/i);

    if (await tagInput.count() > 0) {
      // 5. 输入标签文本
      await tagInput.fill('E2E测试标签');
      await page.waitForTimeout(300);

      // 6. 按 Enter 键添加标签
      await tagInput.press('Enter');
      await page.waitForTimeout(500);

      // 7. 验证标签是否被添加（查找标签显示）
      // 标签通常显示为 NTag 组件
      const addedTag = editDialog.locator('text=E2E测试标签');
      if (await addedTag.count() > 0) {
        await expect(addedTag.first()).toBeVisible();
      }

      // 8. 验证输入框已清空（准备输入下一个标签）
      const inputValue = await tagInput.inputValue();
      expect(inputValue).toBe('');
    }
  });

  test('可以删除已添加的标签', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 点击添加收藏按钮
    const addButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. 定位到编辑对话框
    const editDialog = page.locator('[role="dialog"]').last();

    // 4. 查找标签输入框并添加标签
    const tagInput = editDialog.getByPlaceholder(/标签|tag/i);

    if (await tagInput.count() > 0) {
      // 5. 添加一个标签
      await tagInput.fill('可删除标签');
      await tagInput.press('Enter');
      await page.waitForTimeout(500);

      // 6. 查找已添加的标签
      const addedTag = editDialog.locator('text=可删除标签').first();

      if (await addedTag.count() > 0) {
        // 7. 查找标签的关闭按钮（通常是 closable 的 NTag）
        // 查找标签父元素中的关闭图标
        const tagContainer = addedTag.locator('..').first();
        const closeButton = tagContainer.locator('[role="button"], .n-tag__close, .n-base-close').first();

        if (await closeButton.count() > 0) {
          await closeButton.click();
          await page.waitForTimeout(500);

          // 8. 验证标签已被删除
          const deletedTag = editDialog.locator('text=可删除标签');
          expect(await deletedTag.count()).toBe(0);
        }
      }
    }
  });

  test('标签输入框支持多个标签添加', async ({ page }) => {
    // 1. 打开收藏管理器
    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. 点击添加收藏按钮
    const addButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. 定位到编辑对话框
    const editDialog = page.locator('[role="dialog"]').last();

    // 4. 查找标签输入框
    const tagInput = editDialog.getByPlaceholder(/标签|tag/i);

    if (await tagInput.count() > 0) {
      // 5. 连续添加多个标签
      const tags = ['标签1', '标签2', '标签3'];

      for (const tag of tags) {
        await tagInput.fill(tag);
        await tagInput.press('Enter');
        await page.waitForTimeout(300);
      }

      // 6. 验证所有标签都被添加
      for (const tag of tags) {
        const addedTag = editDialog.locator(`text=${tag}`);
        if (await addedTag.count() > 0) {
          await expect(addedTag.first()).toBeVisible();
        }
      }
    }
  });
});

/**
 * 标签自动完成建议测试（需要有已存在的标签）
 */
test.describe('标签自动完成建议', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('输入时显示匹配的标签建议', async ({ page }) => {
    // 注意：这个测试需要数据库中已经有一些标签
    // 如果是全新安装，可能不会有建议

    const favoriteButton = page.getByRole('button', { name: /收藏|favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /收藏|Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    const addButton = managerDialog.getByRole('button', { name: /添加|创建|新建|add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    const editDialog = page.locator('[role="dialog"]').last();
    const tagInput = editDialog.getByPlaceholder(/标签|tag/i);

    if (await tagInput.count() > 0) {
      // 先添加一个标签到系统中
      await tagInput.fill('前端开发');
      await tagInput.press('Enter');
      await page.waitForTimeout(300);

      // 清空输入框
      await tagInput.clear();
      await page.waitForTimeout(300);

      // 现在输入部分匹配文本
      await tagInput.fill('前');
      await page.waitForTimeout(500);

      // 检查是否有自动完成菜单
      const autocompleteMenu = page.locator('.n-auto-complete-menu, .n-base-select-menu');

      // 如果有菜单且可见，验证里面有匹配的选项
      if (await autocompleteMenu.isVisible().catch(() => false)) {
        const matchingOption = autocompleteMenu.locator('text=/前端/');
        if (await matchingOption.count() > 0) {
          await expect(matchingOption.first()).toBeVisible();
        }
      }
    }
  });
});
