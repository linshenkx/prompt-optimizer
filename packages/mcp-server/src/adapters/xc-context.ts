/**
 * XC MCP context adapter.
 *
 * This module does not retrieve wiki content by itself. Callers provide wiki
 * excerpts, source references, or business context gathered by their own system,
 * and XC injects that context into prompt generation and optimization requests.
 */

export interface XCSourceRef {
  id?: string;
  title?: string;
  url?: string;
  excerpt?: string;
}

export interface XCWikiContext {
  query?: string;
  scope?: string;
  chunks?: string[];
  source_refs?: XCSourceRef[];
}

export interface XCContextArgs {
  caller_system?: string;
  task_type?: string;
  business_context?: string;
  output_contract?: string;
  wiki_context?: string | XCWikiContext;
  source_refs?: XCSourceRef[];
}

const MAX_CONTEXT_FIELD_LENGTH = 10_000;
const MAX_OUTPUT_CONTRACT_LENGTH = 8_000;
const MAX_WIKI_CHUNKS = 20;
const MAX_SOURCE_REFS = 20;
const MAX_SOURCE_EXCERPT_LENGTH = 3_000;

const KNOWN_CALLERS = new Set(['feishu', 'xgd', 'gpc', 'hermes', 'openclaw', 'web', 'desktop', 'other']);

export function getXCContextSchemaProperties(): Record<string, unknown> {
  const sourceRefSchema = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Optional source identifier from the caller system.'
      },
      title: {
        type: 'string',
        description: 'Human-readable wiki page, document, or policy title.'
      },
      url: {
        type: 'string',
        description: 'Optional URL to the source document.'
      },
      excerpt: {
        type: 'string',
        description: 'Short source excerpt that should ground the prompt.'
      }
    }
  };

  return {
    caller_system: {
      type: 'string',
      description: 'Calling system or client, for example feishu, xgd, gpc, hermes, openclaw, web, desktop, or other.',
      enum: Array.from(KNOWN_CALLERS)
    },
    task_type: {
      type: 'string',
      description: 'Business task type, such as wiki_summary, workflow_agent, qa, report, code_review, or custom.'
    },
    business_context: {
      type: 'string',
      description: 'Business background, operating boundary, audience, workflow step, or system-specific constraints.'
    },
    output_contract: {
      type: 'string',
      description: 'Expected output structure, language, format, tone, fields, or validation rules.'
    },
    wiki_context: {
      oneOf: [
        {
          type: 'string',
          description: 'Plain wiki context or policy excerpt supplied by the caller.'
        },
        {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Wiki query, topic, or retrieval intent.'
            },
            scope: {
              type: 'string',
              description: 'Wiki namespace, product area, department, project, or retrieval boundary.'
            },
            chunks: {
              type: 'array',
              items: { type: 'string' },
              description: 'Retrieved wiki chunks or excerpts supplied by the caller.'
            },
            source_refs: {
              type: 'array',
              items: sourceRefSchema,
              description: 'Source references for wiki chunks.'
            }
          }
        }
      ],
      description: 'Wiki retrieval result or context supplied by the caller. XC injects it into prompt work but does not claim independent retrieval.'
    },
    source_refs: {
      type: 'array',
      items: sourceRefSchema,
      description: 'Additional source references that should be preserved in the generated prompt.'
    }
  };
}

export function validateXCContext(args: XCContextArgs): void {
  validateOptionalText(args.caller_system, 'caller_system', 80);
  validateOptionalText(args.task_type, 'task_type', 120);
  validateOptionalText(args.business_context, 'business_context', MAX_CONTEXT_FIELD_LENGTH);
  validateOptionalText(args.output_contract, 'output_contract', MAX_OUTPUT_CONTRACT_LENGTH);

  if (args.caller_system && !KNOWN_CALLERS.has(args.caller_system)) {
    throw new Error(`caller_system must be one of: ${Array.from(KNOWN_CALLERS).join(', ')}`);
  }

  validateWikiContext(args.wiki_context);
  validateSourceRefs(args.source_refs, 'source_refs');
}

export function buildPromptWithXCContext(prompt: string, args: XCContextArgs): string {
  const contextBlock = buildXCContextBlock(args);
  if (!contextBlock) {
    return prompt;
  }

  return `${contextBlock}\n\n[Original Prompt]\n${prompt}`;
}

export function buildRequirementsWithXCContext(requirements: string, args: XCContextArgs): string {
  const contextBlock = buildXCContextBlock(args);
  if (!contextBlock) {
    return requirements;
  }

  return `${contextBlock}\n\n[Iteration Requirements]\n${requirements}`;
}

export function buildXCAdvancedVariables(args: XCContextArgs): Record<string, string> {
  const variables: Record<string, string> = {};
  const maybeSet = (key: string, value?: string) => {
    if (value && value.trim().length > 0) {
      variables[key] = value.trim();
    }
  };

  maybeSet('xcCallerSystem', args.caller_system);
  maybeSet('xcTaskType', args.task_type);
  maybeSet('xcBusinessContext', args.business_context);
  maybeSet('xcOutputContract', args.output_contract);

  const wikiSummary = formatWikiContext(args.wiki_context);
  maybeSet('xcWikiContext', wikiSummary);

  const sourceSummary = formatSourceRefs(collectSourceRefs(args));
  maybeSet('xcSourceRefs', sourceSummary);

  return variables;
}

export function buildWikiPromptGoal(goal: string, args: XCContextArgs): string {
  const lines = [
    'Create a production-ready prompt for GlobalCloud XiaoC (XC).',
    '',
    '[Prompt Goal]',
    goal,
    '',
    'The prompt must be usable as an embedded prompt engineering asset for Feishu, XGD, GPC, Hermes, OpenClaw, Web, or Desktop clients.',
    'It should preserve wiki grounding, source boundaries, output format rules, and the caller system contract.'
  ];

  return buildPromptWithXCContext(lines.join('\n'), args);
}

export function buildPromptFitEvaluationPrompt(prompt: string, expectedUse: string | undefined, args: XCContextArgs): string {
  const target = expectedUse && expectedUse.trim().length > 0 ? expectedUse.trim() : 'the supplied XC prompt engineering use case';
  return buildPromptWithXCContext(
    [
      'Evaluate whether the following prompt is fit for the expected XC use case.',
      '',
      '[Expected Use]',
      target,
      '',
      '[Prompt To Evaluate]',
      prompt,
      '',
      'Return concise JSON with these keys: score, strengths, risks, missing_context, improvement_plan.',
      'Use score as an integer from 0 to 100.'
    ].join('\n'),
    args
  );
}

function buildXCContextBlock(args: XCContextArgs): string {
  validateXCContext(args);

  const sections: string[] = [];
  addLineSection(sections, 'Caller System', args.caller_system);
  addLineSection(sections, 'Task Type', args.task_type);
  addBlockSection(sections, 'Business Context', args.business_context);
  addBlockSection(sections, 'Output Contract', args.output_contract);
  addBlockSection(sections, 'Wiki Context', formatWikiContext(args.wiki_context));
  addBlockSection(sections, 'Source References', formatSourceRefs(collectSourceRefs(args)));

  if (sections.length === 0) {
    return '';
  }

  return ['[XC Context]', ...sections].join('\n');
}

function validateOptionalText(value: unknown, field: string, maxLength: number): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }

  if (value.length > maxLength) {
    throw new Error(`${field} must not exceed ${maxLength} characters`);
  }
}

function validateWikiContext(value: XCContextArgs['wiki_context']): void {
  if (value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    if (value.length > MAX_CONTEXT_FIELD_LENGTH) {
      throw new Error(`wiki_context must not exceed ${MAX_CONTEXT_FIELD_LENGTH} characters`);
    }
    return;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('wiki_context must be a string or object');
  }

  validateOptionalText(value.query, 'wiki_context.query', 500);
  validateOptionalText(value.scope, 'wiki_context.scope', 500);

  if (value.chunks !== undefined) {
    if (!Array.isArray(value.chunks)) {
      throw new Error('wiki_context.chunks must be an array');
    }
    if (value.chunks.length > MAX_WIKI_CHUNKS) {
      throw new Error(`wiki_context.chunks must not exceed ${MAX_WIKI_CHUNKS} items`);
    }
    value.chunks.forEach((chunk, index) => validateOptionalText(chunk, `wiki_context.chunks[${index}]`, MAX_CONTEXT_FIELD_LENGTH));
  }

  validateSourceRefs(value.source_refs, 'wiki_context.source_refs');
}

function validateSourceRefs(value: XCSourceRef[] | undefined, field: string): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  if (value.length > MAX_SOURCE_REFS) {
    throw new Error(`${field} must not exceed ${MAX_SOURCE_REFS} items`);
  }

  value.forEach((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error(`${field}[${index}] must be an object`);
    }
    validateOptionalText(source.id, `${field}[${index}].id`, 200);
    validateOptionalText(source.title, `${field}[${index}].title`, 500);
    validateOptionalText(source.url, `${field}[${index}].url`, 1_000);
    validateOptionalText(source.excerpt, `${field}[${index}].excerpt`, MAX_SOURCE_EXCERPT_LENGTH);
  });
}

function formatWikiContext(value: XCContextArgs['wiki_context']): string {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  const lines: string[] = [];
  addLineSection(lines, 'Query', value.query);
  addLineSection(lines, 'Scope', value.scope);

  if (value.chunks && value.chunks.length > 0) {
    lines.push('Chunks:');
    value.chunks
      .map(chunk => chunk.trim())
      .filter(Boolean)
      .forEach((chunk, index) => {
        lines.push(`${index + 1}. ${chunk}`);
      });
  }

  return lines.join('\n');
}

function collectSourceRefs(args: XCContextArgs): XCSourceRef[] {
  const wikiRefs = typeof args.wiki_context === 'object' && args.wiki_context && !Array.isArray(args.wiki_context)
    ? args.wiki_context.source_refs || []
    : [];

  return [...wikiRefs, ...(args.source_refs || [])];
}

function formatSourceRefs(refs: XCSourceRef[]): string {
  return refs
    .map((ref, index) => {
      const parts = [
        ref.id ? `id=${ref.id.trim()}` : '',
        ref.title ? `title=${ref.title.trim()}` : '',
        ref.url ? `url=${ref.url.trim()}` : ''
      ].filter(Boolean);
      const head = parts.length > 0 ? parts.join(', ') : `source=${index + 1}`;
      const excerpt = ref.excerpt && ref.excerpt.trim().length > 0 ? `\n   excerpt: ${ref.excerpt.trim()}` : '';
      return `${index + 1}. ${head}${excerpt}`;
    })
    .join('\n');
}

function addLineSection(lines: string[], label: string, value?: string): void {
  if (value && value.trim().length > 0) {
    lines.push(`${label}: ${value.trim()}`);
  }
}

function addBlockSection(lines: string[], label: string, value?: string): void {
  if (value && value.trim().length > 0) {
    lines.push(`${label}:\n${value.trim()}`);
  }
}
