<template>
    <NScrollbar
        v-if="!disableInternalScroll"
        style="height: 100%; max-height: 100%"
        :bordered="false"
    >
        <div
            ref="markdownContainer"
            class="markdown-content markdown-content--scrollable"
        ></div>
    </NScrollbar>
    <div
        v-else
        ref="markdownContainer"
        class="markdown-content"
        style="height: 100%; max-height: 100%; overflow-y: auto"
    ></div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { NScrollbar } from "naive-ui";

import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

const props = defineProps({
    content: {
        type: String,
        default: "",
    },
    // 新增：流式模式标识，用于优化流式渲染性能
    streaming: {
        type: Boolean,
        default: false,
    },
    // 新增：禁用内部滚动，避免与外层滚动冲突
    disableInternalScroll: {
        type: Boolean,
        default: false,
    },
});

const markdownContainer = ref(null);
const renderError = ref(null);

// 通用防抖函数
const debounce = (fn, delay) => {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
};

// 统一错误处理
const handleError = (error, context = "") => {
    console.error(`Markdown ${context} error:`, error);
    renderError.value = error.message;
    return ""; // 返回空字符串作为默认值
};

// 创建 markdown-it 实例并配置插件
const md = new MarkdownIt({
    html: true,
    breaks: false,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        if (!lang || !hljs.getLanguage(lang)) return str;

        try {
            return hljs.highlight(str, { language: lang }).value;
        } catch (error) {
            handleError(error, "syntax highlighting");
            return str;
        }
    },
});

// 预处理Markdown内容，移除多余空行
const removeExtraEmptyLines = (content) => {
    if (!content) return "";
    return content.replace(/\n\s*\n\s*(\n\s*)+/g, "\n\n");
};

// 为代码块添加语言标签的高效实现
const addLanguageLabels = () => {
    if (!markdownContainer.value) return;

    try {
        // 批量操作避免频繁重排
        const preElements = markdownContainer.value.querySelectorAll("pre");
        if (!preElements.length) return;

        const processedPres = new Set();

        preElements.forEach((pre) => {
            // 如果已经处理过，跳过
            if (processedPres.has(pre)) return;
            processedPres.add(pre);

            // 查找代码元素和语言类
            const codeEl = pre.querySelector("code");
            if (!codeEl || !codeEl.className) return;

            const langMatch = codeEl.className.match(/language-(\w+)/);
            if (!langMatch || !langMatch[1]) return;

            // 如果pre已经在pre-wrapper中，只更新标签内容
            if (pre.parentNode.classList.contains("pre-wrapper")) {
                const existingLabel = pre.parentNode.querySelector(
                    ".code-language-label",
                );
                if (existingLabel) {
                    existingLabel.textContent = langMatch[1];
                }
                return;
            }

            // 创建包装容器和标签
            const wrapper = document.createElement("div");
            wrapper.className = "pre-wrapper";

            const label = document.createElement("div");
            label.className = "code-language-label";
            label.textContent = langMatch[1];

            // 获取pre的父元素和位置
            const parent = pre.parentNode;
            const nextSibling = pre.nextSibling;

            // 构建DOM结构
            wrapper.appendChild(label);
            wrapper.appendChild(pre.cloneNode(true));

            // 替换原始pre
            if (nextSibling) {
                parent.insertBefore(wrapper, nextSibling);
            } else {
                parent.appendChild(wrapper);
            }

            // 移除原始pre（因为我们已经克隆并添加到wrapper）
            parent.removeChild(pre);
        });
    } catch (error) {
        handleError(error, "language label processing");
    }
};

// 优化的HTML处理函数
const processHTML = (html) => {
    if (!html) return "";

    try {
        // 先将代码块提取出来保存，避免处理
        const codeBlocks = [];
        let processedHtml = html.replace(
            /<pre\b[^>]*>([\s\S]*?)<\/pre>/g,
            (match) => {
                const id = `CODE_BLOCK_${codeBlocks.length}`;
                codeBlocks.push(match);
                return id;
            },
        );

        // 处理非代码块部分的HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(processedHtml, "text/html");

        // 判断是否解析成功
        const parseError = doc.querySelector("parsererror");
        if (parseError) {
            throw new Error("HTML parsing error");
        }

        const fragment = doc.body;

        // 删除空节点处理函数 - 保持不变
        const processNode = (node) => {
            const preserveElements = ["HR", "BR"];
            if (
                node.nodeType !== Node.ELEMENT_NODE ||
                preserveElements.includes(node.tagName)
            ) {
                return;
            }

            const children = Array.from(node.childNodes);

            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];

                if (child.nodeType === Node.TEXT_NODE) {
                    if (!child.textContent.trim()) {
                        node.removeChild(child);
                    } else {
                        child.textContent = child.textContent.replace(
                            /\s{2,}/g,
                            " ",
                        );
                    }
                    continue;
                }

                if (child.nodeType === Node.ELEMENT_NODE) {
                    processNode(child);

                    if (
                        child.tagName === "P" &&
                        !child.textContent.trim() &&
                        !child.querySelector("img, br")
                    ) {
                        node.removeChild(child);
                    }
                }
            }
        };

        // 处理整个文档
        processNode(fragment);

        // 获取处理后的HTML
        processedHtml = fragment.innerHTML;

        // 将代码块放回原处
        codeBlocks.forEach((block, i) => {
            processedHtml = processedHtml.replace(`CODE_BLOCK_${i}`, block);
        });

        return processedHtml;
    } catch (error) {
        return handleError(error, "HTML processing");
    }
};

// 渲染Markdown内容
const renderMarkdown = () => {
    renderError.value = null;

    if (!props.content) {
        if (markdownContainer.value) {
            markdownContainer.value.innerHTML = "";
        }
        return;
    }

    try {
        // 预处理内容
        const processedContent = removeExtraEmptyLines(props.content);

        // 使用markdown-it将Markdown转为HTML
        const rawHtml = md.render(processedContent);

        // 处理HTML
        const processedHtml = processHTML(rawHtml);

        // 使用DOMPurify清理HTML
        const cleanHtml = DOMPurify.sanitize(processedHtml);

        if (markdownContainer.value) {
            markdownContainer.value.innerHTML = cleanHtml;

            // 使用requestAnimationFrame提高渲染性能
            requestAnimationFrame(() => {
                addLanguageLabels();
            });
        }
    } catch (error) {
        handleError(error, "rendering");
        if (markdownContainer.value) {
            markdownContainer.value.innerHTML = `<p class="text-red-500">Error rendering markdown: ${renderError.value}</p>`;
        }
    }
};

// 使用防抖处理内容变化，但对流式场景优化
const debouncedRenderMarkdown = debounce(renderMarkdown, 10); // 从50ms降低到10ms
const streamingRenderMarkdown = debounce(renderMarkdown, 5); // 流式模式使用更短的延迟

// 监听content变化时重新渲染
watch(
    () => props.content,
    (newContent) => {
        if (!newContent || newContent.trim() === "") {
            // 对于空内容，立即渲染，不使用防抖
            renderMarkdown();
            return;
        }

        // 根据是否在流式模式选择不同的渲染策略
        if (props.streaming) {
            // 流式模式：使用更短的防抖延迟以获得更快的响应
            streamingRenderMarkdown();
        } else {
            // 普通模式：使用标准防抖
            debouncedRenderMarkdown();
        }
    },
    { immediate: true },
);

// 组件挂载时渲染
onMounted(renderMarkdown);
// A responsive scroll-mode change replaces the DOM container without changing
// the content. Populate the new container after Vue has updated the template.
watch(() => props.disableInternalScroll, renderMarkdown, { flush: "post" });
</script>

<style>
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
