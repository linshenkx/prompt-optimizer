import { createApp, watch } from 'vue'
import { installI18nOnly, installPinia, i18n, router } from '@prompt-optimizer/ui'
import App from './App.vue'

import './style.css'
import '@prompt-optimizer/ui/dist/style.css'

const app = createApp(App)
// 只安装i18n插件，语言初始化将在App.vue中服务准备好后进行
installI18nOnly(app)
installPinia(app)
app.use(router)

// 同步文档标题和语言属性
if (typeof document !== 'undefined') {
  const syncDocumentTitle = () => {
    document.title = i18n.global.t('common.appName')
    const currentLocale = String(i18n.global.locale.value || '')
    const htmlLang = currentLocale.startsWith('zh') ? 'zh' : 'en'
    document.documentElement.setAttribute('lang', htmlLang)
  }

  syncDocumentTitle()
  watch(i18n.global.locale, syncDocumentTitle)
}

// 等待 router 完成首航解析（Hash URL -> route），避免初始化逻辑在短暂的 "/" 状态下误重定向
// ⚠️ Extension 环境也可能通过 hash 直接进入工作区路由（例如 E2E/开发调试）
void router.isReady().then(() => {
  app.mount('#app')
})
