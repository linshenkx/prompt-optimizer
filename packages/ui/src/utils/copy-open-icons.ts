import BrandGoogle from '../components/icons/GoogleBrandIcon.vue'
import { h, type Component } from 'vue'
import { Copy } from '@lucide/vue'
import type { CopyOpenActionId } from './copy-open-action'

const ChatGptMark = {
  name: 'ChatGptMark',
  render: () => h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('path', { d: 'M12 3.4a3.3 3.3 0 0 1 3 1.8 3.35 3.35 0 0 1 4 4.1 3.3 3.3 0 0 1-1.7 3 3.35 3.35 0 0 1-.6 4.9 3.3 3.3 0 0 1-4.3.1 3.35 3.35 0 0 1-5 .5 3.3 3.3 0 0 1-1-4.1 3.35 3.35 0 0 1-1.8-4.8 3.3 3.3 0 0 1 3.8-1.5A3.35 3.35 0 0 1 12 3.4Z' }),
    h('path', { d: 'M8.5 7.1 15 10.8v7' }),
    h('path', { d: 'M15.5 5.9v7.3L9 16.9' }),
    h('path', { d: 'M18.4 11.8 12 15.4l-6.4-3.6' }),
  ]),
}

const ClaudeMark = {
  name: 'ClaudeMark',
  render: () => h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('path', { d: 'm12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z' }),
    h('path', { d: 'm5.6 5.6 3.8 3.8' }),
    h('path', { d: 'm18.4 5.6-3.8 3.8' }),
    h('path', { d: 'm18.4 18.4-3.8-3.8' }),
    h('path', { d: 'm5.6 18.4 3.8-3.8' }),
  ]),
}

const DeepSeekMark = {
  name: 'DeepSeekMark',
  render: () => h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, [
    h('path', { d: 'M3.5 13.2c2.2-3.7 5.8-5.6 9.9-5.1 3.5.4 6.1 2.5 7.1 5.7-1.5-.9-3.1-1-4.5-.3-1.2.6-2 1.6-2.4 2.9-3.6.6-7.5-.5-10.1-3.2Z' }),
    h('path', { d: 'M3.6 13.4c1.5 3 4.8 5 8.7 5 2.7 0 5-.9 6.6-2.5' }),
    h('path', { d: 'M7.6 9.1c-.2-1.8-1.2-3.2-2.9-4.1 2.4-.2 4.2.7 5.4 2.6' }),
    h('path', { d: 'M9.7 8.2c.2-1.6 1.1-2.8 2.8-3.6-.1 1.7-.8 3-2.1 4' }),
    h('path', { d: 'M13.8 8.3c-.6 2-2.3 3.5-4.9 4.3' }),
    h('circle', { cx: '16.7', cy: '10.8', r: '0.8', fill: 'currentColor', stroke: 'none' }),
  ]),
}

export const copyOpenActionIconMap: Record<CopyOpenActionId, Component> = {
  copy: Copy,
  chatgpt: ChatGptMark,
  claude: ClaudeMark,
  gemini: BrandGoogle,
  deepseek: DeepSeekMark,
}
