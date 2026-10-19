<template>
  <!-- 使用ToastUI包装整个布局以提供NMessageProvider -->
  <ToastUI>
    <NLayout style="position: fixed; inset: 0; width: 100vw; height: 100vh;
    max-height: 100vh;
    overflow: hidden; display: flex; min-height: 0;"
    content-style="height: 100%; max-height: 100%; min-height: 0; overflow: hidden;"
    >

      <NFlex vertical style="position: fixed; inset: 0; width: 100vw; max-height: 100vh; height: 100vh; min-height: 0;">
      <!-- 顶部导航栏 -->
      <NLayoutHeader class="theme-header nav-header-enhanced">
        <NFlex justify="space-between" align="center" class="w-full nav-content" :wrap="false" :size="[16, 12]">
          <!-- 左侧：Logo + 标题 + 核心导航 -->
          <NFlex align="center" :size="16" :wrap="false">
            <!-- Logo + 标题 -->
            <NButton
              text
              class="brand-link"
              @click="openBrandWebsite"
            >
              <NFlex align="center" :size="8" :wrap="false">
                <AppPreviewImage
                  :src="logoSrc"
                  alt="Logo"
                  :width="logoSize"
                  :height="logoSize"
                  object-fit="cover"
                  class="logo-image"
                  :show-toolbar="false"
                  :preview-disabled="true"
                  :fallback-src="fallbackLogoSrc"
                />
                <NText class="text-lg sm:text-xl font-bold theme-title" tag="h2">
                  <slot name="title">{{ t('common.appName') }}</slot>
                </NText>
              </NFlex>
            </NButton>

            <!-- 核心导航元素 -->
            <div class="core-navigation">
              <slot name="core-nav"></slot>
            </div>
          </NFlex>

          <!-- 右侧：操作按钮 -->
          <NFlex align="center" :size="8" :wrap="true" justify="end" class="nav-actions">
            <slot name="actions"></slot>
          </NFlex>
        </NFlex>
      </NLayoutHeader>

      <!-- 主要内容区域 - 严格控制在剩余空间内 -->
      <NLayoutContent has-sider
        style="flex: 1; min-height: 0; overflow: hidden;"
        content-style="height: 100%; max-height: 100%; min-height: 0; box-sizing: border-box; padding: 24px clamp(16px, 2vw, 48px) 40px; display: flex; flex-direction: column; align-items: stretch; overflow: hidden;"
      >
        <div class="main-content-wrapper">
          <slot name="main"></slot>
        </div>
      </NLayoutContent>
      </NFlex>

      <!-- 弹窗插槽 -->
      <slot name="modals"></slot>

    </NLayout>
  </ToastUI>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NLayout, NLayoutHeader, NLayoutContent, NFlex, NText } from 'naive-ui'
import ToastUI from './Toast.vue'
import logoImage from '../assets/logo.png'
import AppPreviewImage from './media/AppPreviewImage.vue'
import { openExternalUrl } from '../utils/open-external-url'

const { t } = useI18n()

// Logo图片配置
const logoSrc = logoImage

// 创建简单的SVG fallback logo
const createFallbackSvg = () => {
  const svg = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#3b82f6"/>
      <text x="16" y="21" text-anchor="middle" fill="white" font-family="system-ui" font-size="14" font-weight="bold">P</text>
    </svg>
  `)}`
  return svg
}

const fallbackLogoSrc = createFallbackSvg()

// 响应式Logo尺寸 - 使用更智能的检测
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    window.addEventListener('resize', updateWindowWidth)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateWindowWidth)
  }
})

const logoSize = computed(() => {
  if (windowWidth.value < 480) {
    return 20 // 超小屏幕
  } else if (windowWidth.value < 640) {
    return 24 // 小屏幕
  }
  return 28 // 默认尺寸
})

const openBrandWebsite = async () => {
  await openExternalUrl('https://always200.com', { logPrefix: 'MainLayout' })
}
</script>

<style>
.main-content-wrapper {
  width: 100%;
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.main-content-wrapper > * {
  flex: 1;
  min-height: 0;
}

/* 增强导航栏样式 */
.nav-header-enhanced {
  min-height: 64px !important;
  padding: 12px 16px !important;
}

.nav-content {
  min-height: 40px;
}

.nav-actions {
  min-height: 40px;
}

.brand-link {
  align-items: center;
  padding: 6px 10px 6px 6px;
  border-radius: 12px;
  color: inherit;
  transition:
    background-color 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out,
    transform 0.2s ease-in-out;
}

.brand-link:hover {
  background: color-mix(in srgb, var(--n-primary-color) 10%, transparent);
  transform: translateY(-1px);
}

.brand-link:hover .logo-image {
  transform: scale(1.05);
}

.brand-link:hover .theme-title {
  opacity: 0.88;
}

.brand-link:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--n-primary-color) 14%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-primary-color) 28%, transparent);
}

/* Logo样式优化 */
.logo-image {
  border-radius: 6px;
  transition: transform 0.2s ease-in-out;
  flex-shrink: 0;
}

/* 标题文字对齐优化 */
.theme-title {
  line-height: 1.2 !important;
  margin: 0 !important;
  white-space: nowrap;
  transition: opacity 0.2s ease-in-out;
}

/* 核心导航样式 */
.core-navigation {
  display: flex;
  align-items: center;
  margin-left: 16px;
  padding-left: 16px;
  border-left: 1px solid var(--n-border-color);
  min-height: 32px;
}

/* 响应式优化 */
@media (max-width: 639px) {
  .logo-image {
    border-radius: 4px;
  }

  .core-navigation {
    margin-left: 8px;
    padding-left: 8px;
  }
}

.custom-select {
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
}

.custom-select::-ms-expand {
  display: none;
}

/* ==========================================================================
 * 移动端适配（<= 767px）
 *
 * 断点对应 useResponsive 的 sm/md 边界，即 shouldUseVerticalLayout 为真的范围。
 * 在此之前，除 ImageMultiImageWorkspace 有 900px 的单列处理外，
 * 各工作区与顶部导航都没有任何响应式规则，窄屏下会出现：
 *   - 工作区左右分栏各被压到 ~180px，标题被迫竖排断字
 *   - 顶部导航的操作按钮组折成 4 行，占掉 26% 的屏幕高度
 * 这里把 ImageMultiImageWorkspace 已有的处理推广到其余工作区，并补齐导航。
 * ========================================================================== */
@media (max-width: 767px) {
  /* ------------------------------------------------------------------
   * 顶部导航：4 行 -> 2 行
   * ------------------------------------------------------------------ */
  .nav-header-enhanced {
    min-height: 0 !important;
    padding-top: calc(4px + env(safe-area-inset-top, 0px)) !important;
    padding-right: 10px !important;
    padding-bottom: 4px !important;
    padding-left: 10px !important;
  }

  /* 标题行与操作行改为上下排布 */
  .nav-content {
    flex-wrap: wrap !important;
    row-gap: 4px;
  }

  .nav-content > * {
    min-width: 0;
  }

  /* 模式选择器超宽时横向滚动，而不是把标题挤到换行 */
  .core-navigation {
    flex: 1 1 100%;
    margin-left: 0;
    padding-left: 0;
    border-left: none;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .core-navigation::-webkit-scrollbar {
    display: none;
  }

  /* 模式选择器内部默认会折成两行（约 95px），强制单行以压缩导航高度 */
  .core-navigation .n-space {
    flex-wrap: nowrap !important;
    align-items: center;
    height: 44px;
    min-height: 44px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .core-navigation .n-space::-webkit-scrollbar {
    display: none;
  }

  /* 操作按钮组：保持单行并可横向滚动，避免折成 4 行把导航撑高 */
  .nav-actions {
    flex-wrap: nowrap !important;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    justify-content: flex-start !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .nav-actions::-webkit-scrollbar {
    display: none;
  }

  /* ------------------------------------------------------------------
   * 工作区分栏：左右 -> 上下
   *
   * 列宽由组件通过内联样式 grid-template-columns 写入，
   * 内联样式优先级高于任何选择器，因此必须使用 !important。
   * 这与 ImageMultiImageWorkspace 既有的处理方式一致。
   * ------------------------------------------------------------------ */
  .basic-system-split,
  .basic-user-split,
  .context-system-split,
  .context-user-split,
  .image-image2image-split,
  .image-multiimage-split,
  .image-text2image-split {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) !important;
  }

  /* 触摸屏无法拖动分隔条，且单列后已无意义 */
  .split-divider {
    display: none !important;
  }

  /* 测试结果卡片：多列 -> 单列 */
  .variant-deck,
  .variant-results {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  /* ------------------------------------------------------------------
   * 文本与触摸目标
   * ------------------------------------------------------------------ */
  .test-area-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 触摸目标不小于 44px（Material Design / WCAG 2.5.5 建议值）。
     Naive UI 用 .n-button--{type}-type 这类双类选择器设置尺寸，
     优先级高于单个 .n-button，因此这里需要 !important。 */
  .n-button,
  .n-radio-button {
    min-width: 44px !important;
    min-height: 44px !important;
  }

  .n-base-selection {
    min-height: 44px !important;
  }

  /* ------------------------------------------------------------------
   * 全面屏安全区与滚动行为
   * ------------------------------------------------------------------ */
  .main-content-wrapper {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  html,
  body {
    overscroll-behavior-y: none;
    -webkit-text-size-adjust: 100%;
  }
}
</style>
