const context = {
  zh: `可用片长 {{duration}} 秒。{{#referenceRoles}}
参考图用途（按上传顺序）
{{{referenceRoles}}}{{^hasInputImages}}
本次只有用途说明，没有图片内容。{{/hasInputImages}}{{/referenceRoles}}`,
  en: `Available clip length {{duration}} s.{{#referenceRoles}}
Reference roles in upload order
{{{referenceRoles}}}{{^hasInputImages}}
Only the roles are available in this request.{{/hasInputImages}}{{/referenceRoles}}`,
}

export const creativeBrief = {
  zh: `${context.zh}

{{{originalPrompt}}}`,
  en: `${context.en}

{{{originalPrompt}}}`,
}

export const revisionBrief = {
  zh: `${context.zh}

{{#originalPrompt}}创作背景
{{{originalPrompt}}}

{{/originalPrompt}}待编辑稿
{{{lastOptimizedPrompt}}}

这次只改
{{{iterateInput}}}`,
  en: `${context.en}

{{#originalPrompt}}Original brief
{{{originalPrompt}}}

{{/originalPrompt}}Current draft
{{{lastOptimizedPrompt}}}

Make this change
{{{iterateInput}}}`,
}
