import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { defineComponent, h } from 'vue'
import { beforeRouteSwitch } from './guards'

/**
 * Vue Router 配置
 *
 * 设计说明：
 * - 使用 hash 模式（#/basic/system），Electron 兼容
 * - 路由懒加载，减少初始 bundle
 * - 路由守卫：监控导航事件
 */

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    // 根路径不再强制 redirect：由 PromptOptimizerApp 基于 useGlobalSettings 决定初始路由
    name: 'root',
    component: defineComponent({
      name: 'RootBootstrapRoute',
      render: () => h('div')
    })
  },
  // ✨ Basic 模式重构：2 个独立路由
  {
    path: '/basic/system',
    name: 'basic-system',
    component: () => import('../components/basic-mode/BasicSystemWorkspace.vue')
  },
  {
    path: '/basic/user',
    name: 'basic-user',
    component: () => import('../components/basic-mode/BasicUserWorkspace.vue')
  },
  // ✨ Pro 模式重构：4 个独立路由，直接指向 ContextWorkspace
  {
    path: '/pro/system',
    name: 'pro-system',
    component: () => import('../components/context-mode/ContextSystemWorkspace.vue')
  },
  {
    path: '/pro/multi',
    name: 'pro-multi',
    component: () => import('../components/context-mode/ContextSystemWorkspace.vue')
  },
  {
    path: '/pro/user',
    name: 'pro-user',
    component: () => import('../components/context-mode/ContextUserWorkspace.vue')
  },
  {
    path: '/pro/variable',
    name: 'pro-variable',
    component: () => import('../components/context-mode/ContextUserWorkspace.vue')
  },
  // ✨ Image 模式重构：2 个独立路由
  {
    path: '/image/text2image',
    name: 'image-text2image',
    component: () => import('../components/image-mode/ImageText2ImageWorkspace.vue')
  },
  {
    path: '/image/image2image',
    name: 'image-image2image',
    component: () => import('../components/image-mode/ImageImage2ImageWorkspace.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 挂载路由守卫
router.beforeEach(beforeRouteSwitch)

export default router
