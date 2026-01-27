// Utilities for working with {{var}} placeholders.
// Intentionally skips Mustache control tags (e.g. {{#if}}, {{/if}}, {{> partial}}, {{& raw}}).

// Keep consistent with VariableAwareInput detection: no whitespace inside {{...}}.
// Example: {{foo}} is valid; {{ foo }} is NOT treated as a variable.
const VARIABLE_PATTERN = /\{\{([^{}\s]+)\}\}/gu;

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
