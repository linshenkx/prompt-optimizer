/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 启用基于类的暗黑模式
  theme: {
    extend: {
      colors: {
        // 定义自定义颜色变量，便于主题切换
        'theme': {
          'primary': 'var(--color-primary)',
          'secondary': 'var(--color-secondary)',
          'background': 'var(--color-background)',
          'card': 'var(--color-card)',
          'text': 'var(--color-text)',
          'border': 'var(--color-border)',
        }
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}