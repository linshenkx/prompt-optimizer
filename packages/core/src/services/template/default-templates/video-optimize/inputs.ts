const context = {
  zh: `可用片长 {{duration}} 秒{{#ratio}}，画幅 {{ratio}}{{/ratio}}。{{#referenceRoles}}
参考图用途（按上传顺序；角色或风格参考必须在正文中按序号写出 @图片1、@图片2，首帧或尾帧不写 @引用）
{{{referenceRoles}}}{{^hasInputImages}}
本次只有用途说明，没有图片内容。{{/hasInputImages}}{{/referenceRoles}}`,
  en: `Available clip length {{duration}} s{{#ratio}}, aspect ratio {{ratio}}{{/ratio}}.{{#referenceRoles}}
Reference roles in upload order (explicitly cite character or style references in prose as @Image1, @Image2 by index; do not add @ tags for first/last frames)
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
