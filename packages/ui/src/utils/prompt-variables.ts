// Utilities for working with {{var}} placeholders.
// Intentionally skips Mustache control tags (e.g. {{#if}}, {{/if}}, {{> partial}}, {{& raw}}).

import { VARIABLE_VALIDATION, isValidVariableName } from '../types/variable'

// Variable name cannot contain whitespace, but we allow whitespace around it:
// - valid: {{foo}}, {{ foo }}
// - invalid: {{ foo bar }} (variable name contains whitespace)
// Also disallow names starting with a digit.
const VARIABLE_PATTERN = /\{\{\s*([^\d{}\s][^{}\s]*)\s*\}\}/gu;

export type ForbiddenTemplateSyntax = 'triple_braces' | 'ampersand_unescaped';

const isMustacheControlTag = (name: string): boolean => {
  const trimmed = name.trim();
  return VARIABLE_VALIDATION.FORBIDDEN_PREFIX_PATTERN.test(trimmed)
};

export const scanVariableNames = (content: string): string[] => {
  const result: string[] = [];
  if (!content) return result;

  const seen = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    const rawName = String(match[1] || '').trim();
    if (!rawName) continue;
    if (isMustacheControlTag(rawName)) continue;
    if (!isValidVariableName(rawName)) continue;
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
  if (/\{\{\{[\s\S]*?\}\}\}/u.test(content)) found.push('triple_braces');
  if (/\{\{\s*&/u.test(content)) found.push('ampersand_unescaped');
  return found;
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
    if (!isValidVariableName(trimmedName)) return match;

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
