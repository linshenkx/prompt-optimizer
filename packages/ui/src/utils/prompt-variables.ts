// Utilities for working with {{var}} placeholders.
// Intentionally skips Mustache control tags (e.g. {{#if}}, {{/if}}, {{> partial}}, {{& raw}}).

// Variable name cannot contain whitespace, but we allow whitespace around it:
// - valid: {{foo}}, {{ foo }}
// - invalid: {{ foo bar }} (variable name contains whitespace)
const VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/gu;

// We explicitly forbid Mustache "unescaped" tags because they bypass our
// missing/empty-variable gating and can produce surprising output.
// - triple braces: {{{foo}}}
// - ampersand: {{&foo}}
const FORBIDDEN_UNESCAPED_PATTERN = /\{\{\{[\s\S]*?\}\}\}|\{\{\s*&/gu;

export type ForbiddenTemplateSyntax = 'triple_braces' | 'ampersand_unescaped';

const isMustacheControlTag = (name: string): boolean => {
  const trimmed = name.trim();
  return (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('^') ||
    trimmed.startsWith('!') ||
    trimmed.startsWith('>') ||
    trimmed.startsWith('&')
  );
};

export const scanVariableNames = (content: string): string[] => {
  const result: string[] = [];
  if (!content) return result;

  const seen = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    const rawName = String(match[1] || '').trim();
    if (!rawName) continue;
    if (isMustacheControlTag(rawName)) continue;
    if (seen.has(rawName)) continue;
    seen.add(rawName);
    result.push(rawName);
  }

  return result;
};

export const findForbiddenTemplateSyntax = (
  content: string,
): ForbiddenTemplateSyntax[] => {
  if (!content) return [];

  const found: ForbiddenTemplateSyntax[] = [];

  // Fast checks to avoid scanning twice in the common case.
  if (content.includes('{{{')) found.push('triple_braces');
  if (content.includes('{{&') || content.includes('{{ &') || content.includes('{{\t&')) {
    found.push('ampersand_unescaped');
  }

  // If we didn't find anything via fast path, return early.
  if (found.length === 0) return found;

  // Ensure we only report syntax that actually matches our forbidden patterns.
  // This prevents false positives from raw strings like "{{{not closed".
  const confirmed: ForbiddenTemplateSyntax[] = [];

  if (/\{\{\{[\s\S]*?\}\}\}/u.test(content)) confirmed.push('triple_braces');
  if (/\{\{\s*&/u.test(content)) confirmed.push('ampersand_unescaped');

  return confirmed;
};

export const findMissingVariables = (
  content: string,
  variables: Record<string, string>,
): string[] => {
  const used = scanVariableNames(content);
  return used.filter((name) => {
    const value = variables[name];
    if (value === undefined) return true;
    return String(value).trim() === '';
  });
};

export const replaceVariablesInContent = (
  content: string,
  variables: Record<string, string>,
): string => {
  if (!content) return content;

  return content.replace(VARIABLE_PATTERN, (match, varName) => {
    const trimmedName = String(varName || '').trim();
    if (!trimmedName) return match;
    if (isMustacheControlTag(trimmedName)) return match;

    const value = variables[trimmedName];
    // Keep the placeholder if the variable is not provided.
    return value !== undefined ? String(value) : match;
  });
};

export const hashString = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

export const stableStringifyVars = (vars: Record<string, string>): string => {
  const keys = Object.keys(vars).sort();
  let out = '';
  for (const key of keys) {
    out += `${key}=${vars[key] ?? ''}\n`;
  }
  return out;
};

export const hashVariables = (vars: Record<string, string>): string => {
  return hashString(stableStringifyVars(vars));
};

export type PromptExecutionContext = {
  variables: Record<string, string>;
  variablesHash: string;
  missingVariables: string[];
  renderedContent: string;
  forbiddenTemplateSyntax: ForbiddenTemplateSyntax[];
};

export const buildPromptExecutionContext = (
  content: string,
  variables: Record<string, string>,
): PromptExecutionContext => {
  return {
    variables,
    variablesHash: hashVariables(variables),
    missingVariables: findMissingVariables(content, variables),
    renderedContent: replaceVariablesInContent(content, variables),
    forbiddenTemplateSyntax: findForbiddenTemplateSyntax(content),
  };
};

export type ConversationExecutionContext<TMessage extends { content: string }> = {
  variables: Record<string, string>;
  variablesHash: string;
  missingVariables: string[];
  renderedMessages: TMessage[];
  forbiddenTemplateSyntax: ForbiddenTemplateSyntax[];
};

export const buildConversationExecutionContext = <TMessage extends { content: string }>(
  messages: TMessage[],
  variables: Record<string, string>,
): ConversationExecutionContext<TMessage> => {
  const missing = new Set<string>();
  const forbidden = new Set<ForbiddenTemplateSyntax>();

  const renderedMessages = (messages || []).map((msg) => {
    const ctx = buildPromptExecutionContext(msg.content || '', variables);
    ctx.missingVariables.forEach((name) => missing.add(name));
    ctx.forbiddenTemplateSyntax.forEach((syntax) => forbidden.add(syntax));
    return { ...msg, content: ctx.renderedContent };
  });

  return {
    variables,
    variablesHash: hashVariables(variables),
    missingVariables: Array.from(missing),
    renderedMessages,
    forbiddenTemplateSyntax: Array.from(forbidden),
  };
};
