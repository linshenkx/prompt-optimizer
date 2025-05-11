import { createApp } from 'vue'
import { installI18n } from '@prompt-optimizer/ui'
import App from './App.vue'

import '@prompt-optimizer/ui/dist/style.css'

const app = createApp(App)
installI18n(app)
app.mount('#app')

// 只在Vercel环境中加载Analytics
// 当环境变量VITE_VERCEL_DEPLOYMENT为true时才尝试加载
if (import.meta.env.VITE_VERCEL_DEPLOYMENT === 'true') {
  // 使用完全运行时方式加载Vercel Analytics
  const loadAnalytics = () => {
    const script = document.createElement('script')
    script.src = '/_vercel/insights/script.js'
    script.defer = true
    script.onload = () => console.log('Vercel Analytics 已加载')
    script.onerror = () => console.log('Vercel Analytics 加载失败')
    document.head.appendChild(script)
  }
  
  // 延迟执行以确保DOM已完全加载
  window.addEventListener('DOMContentLoaded', loadAnalytics)
}else{
    console.log('Vercel Analytics 未加载')
}