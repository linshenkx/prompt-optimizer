export const MARKDOWN_SOURCE_BUDGET = 64 * 1024
export const MARKDOWN_HTML_BUDGET = 256 * 1024
export const MARKDOWN_NODE_BUDGET = 1500
// HTML source is transported separately, never expanded into host-page markup.
export const MARKDOWN_PREVIEW_INPUT_BUDGET = 1024 * 1024
export const MARKDOWN_PREVIEW_BUDGET = 8
export const PAGE_PREVIEW_BUDGET = 24

// Only a cheap admission hint; the Markdown parser decides which blocks run.
export const hasHtmlPreviewHint = (content: string) => /(?:`{3,}|~{3,})[ \t]*html(?:5)?(?:\s|$)|<(?:!doctype\s+html|html|head|body|div|section|article|main|header|footer|nav|aside|h[1-6]|p|table|ul|ol|form|button|input|canvas|svg|style|script|details)\b/iu.test(content)
