import { createApp } from 'vue'
import { installI18n } from '@prompt-optimizer/ui'
import App from './App.vue'

import '@prompt-optimizer/ui/dist/style.css'

const app = createApp(App)
installI18n(app)
app.mount('#app')

// 正确集成Vercel Analytics
try {
  import('@vercel/analytics').then(({ inject }) => {
    // 导入成功后调用inject函数初始化Analytics
    inject()
    console.log('Vercel Analytics 已加载')
  }).catch(error => {
    console.log('Vercel Analytics 未安装或不可用')
  })
} catch (error) {
  console.log('无法动态导入 Vercel Analytics')
} 