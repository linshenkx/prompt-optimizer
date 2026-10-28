<template>
  <div class="markdown-renderer">
    <template v-if="suspended" />
    <template v-else-if="sourceMode || streaming">
      <NText v-if="!streaming" depth="3" class="output-source-notice">{{ t('common.outputSourceFallback') }}</NText>
      <OutputSourceView :content="content" :fit-content="disableInternalScroll" />
    </template>
    <NScrollbar v-else-if="!disableInternalScroll" style="height:100%; max-height:100%" :bordered="false">
      <div ref="markdownContainer" class="markdown-content markdown-content--scrollable" />
    </NScrollbar>
    <div v-else ref="markdownContainer" class="markdown-content" style="height:100%; max-height:100%; overflow-y:auto" />
    <Teleport v-for="preview in previewTargets" :key="preview.id" :to="preview.target">
      <HtmlPreview :html="preview.html" />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, shallowRef, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { NScrollbar, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import DOMPurify from 'dompurify';
import OutputSourceView from './OutputSourceView.vue';
import HtmlPreview from './HtmlPreview.vue';
import { createMarkdownOutputClient } from '../utils/markdown-output-client';
import 'highlight.js/styles/github.css';

const props = defineProps({
  content: { type: String, default: '' },
  streaming: { type: Boolean, default: false },
  disableInternalScroll: { type: Boolean, default: false },
  htmlPreviews: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
});
const { t } = useI18n();
const markdownContainer = ref(null);
const sourceMode = ref(false);
const previewTargets = shallowRef([]);
let previews = [];
let client;
let generation = 0;
let html = '';
let cachedContent;
let cachedHtmlPreviews;
let renderedContainer;
let renderedHtml;
let renderedPreviews;
let disposed = false;

const commit = () => {
  const container = markdownContainer.value;
  if (!container || disposed || (container === renderedContainer && html === renderedHtml && previews === renderedPreviews)) return;
  const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
  for (const pre of fragment.querySelectorAll('pre')) {
    const language = pre.querySelector('code')?.className.match(/(?:^|\s)language-([^\s]+)/)?.[1];
    if (!language) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'pre-wrapper';
    const label = document.createElement('div');
    label.className = 'code-language-label';
    label.textContent = language;
    pre.replaceWith(wrapper);
    wrapper.append(label, pre);
  }
  container.replaceChildren(fragment);
  previewTargets.value = previews.flatMap(preview => {
    const target = container.querySelector(`[data-html-preview-slot="${preview.id}"]`);
    if (!target) return [];
    target.className = 'markdown-html-preview';
    return [{ ...preview, target }];
  });
  renderedContainer = container;
  renderedHtml = html;
  renderedPreviews = previews;
};
const render = () => {
  const current = ++generation;
  client?.cancel();
  if (props.streaming || props.suspended) {
    previewTargets.value = []; previews = []; html = '';
    renderedContainer = undefined; renderedHtml = undefined; renderedPreviews = undefined; cachedContent = undefined;
    client?.release();
    return;
  }
  if (!props.htmlPreviews) { previewTargets.value = []; previews = []; }
  if (cachedContent === props.content && cachedHtmlPreviews === props.htmlPreviews && !sourceMode.value) { commit(); return; }
  client?.request(props.content, output => {
    if (disposed || current !== generation) return;
    sourceMode.value = output.kind === 'source';
    cachedContent = props.content;
    cachedHtmlPreviews = props.htmlPreviews;
    if (output.kind === 'html') {
      html = output.html;
      previews = output.previews ?? [];
      if (markdownContainer.value) commit();
      else nextTick(() => { if (current === generation) commit(); });
    } else if (output.kind === 'source') {
      // The rich-node lease has been released. Do not retain its detached DOM
      // or cached HTML while this component displays the source fallback.
      html = '';
      previews = []; previewTargets.value = [];
      renderedHtml = undefined;
      renderedPreviews = undefined;
      renderedContainer = undefined;
    }
  }, undefined, props.htmlPreviews);
};
onMounted(() => { client = createMarkdownOutputClient(); render(); });
watch(() => [props.content, props.streaming, props.disableInternalScroll, props.htmlPreviews, props.suspended], render, { flush: 'post' });
onBeforeUnmount(() => { disposed = true; generation++; client?.dispose(); previewTargets.value = []; previews = []; renderedPreviews = undefined; renderedContainer = undefined; });
</script>

<style>
.markdown-renderer { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; height:100%; overflow:hidden; }
.output-source-notice { padding:4px 12px; font-size:12px; flex:none; }
.markdown-html-preview { height:clamp(320px, 55vh, 640px); min-width:0; margin:12px 0; contain:layout paint; }
/* 基本布局和非颜色样式 */
.markdown-content {
    line-height: 1.5;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    /* Pure Naive UI theme - remove custom CSS variables */
    padding: 0.75rem; /* 提供合适的内边距，与其他组件保持一致 */
}

/* 当使用 NScrollbar 时，不需要自己的滚动条 */
.markdown-content--scrollable {
    /* 隐藏滚动条但保持可滚动 */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

/* 隐藏 Webkit 滚动条 */
.markdown-content::-webkit-scrollbar {
    display: none;
}

/* 移除第一个子元素的上边距，避免顶部空白 */
.markdown-content > *:first-child {
    margin-top: 0 !important;
}

/* 移除最后一个子元素的下边距，保持底部对齐 */
.markdown-content > *:last-child {
    margin-bottom: 0 !important;
}

/* 使用CSS变量，方便主题切换 */
:root {
    --md-title-spacing: 1em 0;
    --md-spacing-sm: 0.3em 0;
    --md-spacing-md: 0.5em 0;
    --md-spacing-lg: 0.8em 0;
}

/* 标题样式优化 - 使用主题颜色 */
.markdown-content h1 {
    line-height: 1.5;
    font-size: 1.6em;
    margin: var(--md-title-spacing);
    font-weight: 600;
    color: inherit;
}

.markdown-content h2 {
    line-height: 1.5;
    font-size: 1.4em;
    margin: var(--md-spacing-lg);
    font-weight: 600;
    padding-bottom: 0.1em;
    color: inherit;
    border-bottom: 1px solid var(--n-divider-color, var(--n-border-color));
}

.markdown-content h3 {
    line-height: 1.5;
    font-size: 1.2em;
    margin: var(--md-spacing-md);
    font-weight: 600;
    color: inherit;
}

.markdown-content h4 {
    line-height: 1.5;
    font-size: 1em;
    margin: var(--md-spacing-sm);
    font-weight: 600;
    color: inherit;
}

/* 段落样式 */
.markdown-content p {
    line-height: 1.6;
    margin: var(--md-spacing-sm);
    white-space: pre-wrap;
    color: inherit;
}

/* 列表样式 */
.markdown-content ul,
.markdown-content ol {
    padding-left: 1.5em;
    margin: var(--md-spacing-sm);
    line-height: 1.5;
    color: inherit;
}

/* 设置列表项为紧凑布局 */
.markdown-content li {
    line-height: 1.5;
    margin: var(--md-spacing-sm);
    color: inherit;
}

/* 嵌套列表优化 */
.markdown-content li > ul,
.markdown-content li > ol {
    margin-top: 0;
    margin-bottom: 0;
}

/* 代码块样式 */
.markdown-content pre {
    border-radius: 6px;
    padding: 0.5em;
    overflow: auto;
    margin-bottom: 0.1em;
    position: relative;
    background: var(--n-color-embedded, color-mix(in srgb, var(--n-color) 92%, var(--n-text-color) 8%));
    border: 1px solid var(--n-border-color);
    /* 添加滚动条样式 */
    scrollbar-width: thin; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

/* Webkit滚动条样式 */
.markdown-content pre::-webkit-scrollbar {
    height: 3px;
}

.markdown-content pre::-webkit-scrollbar-thumb {
    background-color: var(--n-scrollbar-color, var(--n-border-color));
    border-radius: 3px;
}

.pre-wrapper {
    position: relative;
}

.pre-wrapper .code-language-label {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    /* 其他样式保持不变 */
}
.code-language-label {
    position: absolute;
    top: 0;
    right: 0;
    padding: 0.2em 0.5em;
    font-size: 0.75em;
    font-family:
        "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    border-bottom-left-radius: 4px;
    user-select: none;
    background-color: var(--n-primary-color);
    color: var(--n-text-color-primary);
}

.markdown-content code {
    font-family:
        "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.85em;
    padding: 0.1em;
    margin: 0.3em;
    border-radius: 6px;
    white-space: pre;
    background-color: var(--n-color-embedded, color-mix(in srgb, var(--n-color) 92%, var(--n-text-color) 8%));
    color: inherit;
    border: 1px solid var(--n-border-color);
}

/* 引用样式 */
.markdown-content blockquote {
    padding: 0.1em 0.5em;
    margin: var(--md-spacing-sm);
    border-left-width: 0.25em;
    border-left-style: solid;
    border-left-color: var(--n-primary-color);
    background-color: var(--n-color-embedded, color-mix(in srgb, var(--n-color) 92%, var(--n-text-color) 8%));
    color: inherit;
}

/* 表格样式 */
.markdown-content table {
    border-collapse: collapse;
    width: 100%;
    margin: var(--md-spacing-sm);
    overflow: auto;
    font-size: 0.9em;
    border: 1px solid var(--n-border-color);
}

.markdown-content table th,
.markdown-content table td {
    line-height: 1.5;
    padding: 0.3em 0.5em;
    border: 1px solid var(--n-border-color);
    color: inherit;
}

.markdown-content table th {
    background-color: var(--n-color-embedded, color-mix(in srgb, var(--n-color) 92%, var(--n-text-color) 8%));
    font-weight: 600;
}

/* 响应式表格 */
@media (max-width: 600px) {
    .markdown-content table {
        display: block;
        overflow-x: auto;
    }
}

/* 图片样式 */
.markdown-content img {
    max-width: 100%;
    height: auto; /* 确保保持纵横比 */
    box-sizing: border-box;
    margin: var(--md-spacing-sm);
    /* 增加图片加载中的显示效果 */
    opacity: 1;
    transition: opacity 0.3s ease;
}

.markdown-content img:not([src]) {
    opacity: 0.5;
}

/* 水平线样式 */
.markdown-content hr {
    height: 0.25em;
    border: none;
    margin: 1em 0;
}

/* 链接样式 */
.markdown-content a {
    text-decoration: none;
    transition: color 0.2s ease; /* 平滑颜色变化 */
    color: var(--n-primary-color);
}

.markdown-content a:hover {
    text-decoration: underline;
    opacity: 0.8;
}
</style>
