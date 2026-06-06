import { describe, expect, it } from 'vitest';

import {
  buildPromptFitEvaluationPrompt,
  buildPromptWithXCContext,
  buildRequirementsWithXCContext,
  buildWikiPromptGoal,
  buildXCAdvancedVariables,
  validateXCContext
} from '../src/adapters/xc-context.js';

describe('XC context adapter edge cases', () => {
  it('returns original prompt text when no XC context is supplied', () => {
    expect(buildPromptWithXCContext('Plain prompt', {})).toBe('Plain prompt');
    expect(buildRequirementsWithXCContext('Keep JSON output.', {})).toBe('Keep JSON output.');
  });

  it('formats string wiki context and source excerpts into prompts and variables', () => {
    const args = {
      caller_system: 'xgd',
      task_type: 'workflow_agent',
      business_context: 'Factory dispatch assistant',
      output_contract: 'Return JSON with risk and next_action.',
      wiki_context: 'Confirmed dispatch SOP excerpt.',
      source_refs: [{
        id: 'dispatch-sop',
        title: 'Dispatch SOP',
        url: 'https://example.com/wiki/dispatch',
        excerpt: 'Only use confirmed dispatch rules.'
      }]
    };

    const prompt = buildPromptWithXCContext('Generate the dispatch prompt.', args);
    expect(prompt).toContain('Caller System: xgd');
    expect(prompt).toContain('Wiki Context:\nConfirmed dispatch SOP excerpt.');
    expect(prompt).toContain('excerpt: Only use confirmed dispatch rules.');

    expect(buildXCAdvancedVariables(args)).toEqual(expect.objectContaining({
      xcCallerSystem: 'xgd',
      xcTaskType: 'workflow_agent',
      xcBusinessContext: 'Factory dispatch assistant',
      xcOutputContract: 'Return JSON with risk and next_action.',
      xcWikiContext: 'Confirmed dispatch SOP excerpt.',
      xcSourceRefs: expect.stringContaining('id=dispatch-sop')
    }));
  });

  it('combines wiki source refs with top-level source refs', () => {
    const prompt = buildWikiPromptGoal('Create an OpenClaw wiki-grounded prompt.', {
      caller_system: 'openclaw',
      wiki_context: {
        query: 'safety',
        scope: 'robotics/wiki',
        chunks: ['Stop on unsafe command.'],
        source_refs: [{ id: 'wiki-safety', title: 'Safety SOP' }]
      },
      source_refs: [{ title: 'Fallback policy' }]
    });

    expect(prompt).toContain('Query: safety');
    expect(prompt).toContain('1. Stop on unsafe command.');
    expect(prompt).toContain('id=wiki-safety');
    expect(prompt).toContain('title=Fallback policy');
  });

  it('builds evaluation prompts with a fallback expected use', () => {
    const prompt = buildPromptFitEvaluationPrompt('Summarize confirmed wiki facts.', undefined, {
      caller_system: 'feishu'
    });

    expect(prompt).toContain('the supplied XC prompt engineering use case');
    expect(prompt).toContain('[Prompt To Evaluate]');
    expect(prompt).toContain('Summarize confirmed wiki facts.');
    expect(prompt).toContain('Caller System: feishu');
  });

  it('rejects invalid optional text fields and wiki context shapes', () => {
    expect(() => validateXCContext({ task_type: 123 as never })).toThrow('task_type must be a string');
    expect(() => validateXCContext({ business_context: 'a'.repeat(10_001) })).toThrow('business_context must not exceed 10000 characters');
    expect(() => validateXCContext({ output_contract: 'a'.repeat(8_001) })).toThrow('output_contract must not exceed 8000 characters');
    expect(() => validateXCContext({ wiki_context: ['bad'] as never })).toThrow('wiki_context must be a string or object');
    expect(() => validateXCContext({ wiki_context: { chunks: 'bad' as never } })).toThrow('wiki_context.chunks must be an array');
    expect(() => validateXCContext({ wiki_context: { chunks: [123 as never] } })).toThrow('wiki_context.chunks[0] must be a string');
  });

  it('rejects invalid source reference shapes and excessive fields', () => {
    expect(() => validateXCContext({ source_refs: 'bad' as never })).toThrow('source_refs must be an array');
    expect(() => validateXCContext({ source_refs: Array.from({ length: 21 }, () => ({})) })).toThrow('source_refs must not exceed 20 items');
    expect(() => validateXCContext({ source_refs: [null as never] })).toThrow('source_refs[0] must be an object');
    expect(() => validateXCContext({ source_refs: [{ id: 'a'.repeat(201) }] })).toThrow('source_refs[0].id must not exceed 200 characters');
    expect(() => validateXCContext({ source_refs: [{ title: 'a'.repeat(501) }] })).toThrow('source_refs[0].title must not exceed 500 characters');
    expect(() => validateXCContext({ source_refs: [{ url: 'a'.repeat(1_001) }] })).toThrow('source_refs[0].url must not exceed 1000 characters');
    expect(() => validateXCContext({ source_refs: [{ excerpt: 'a'.repeat(3_001) }] })).toThrow('source_refs[0].excerpt must not exceed 3000 characters');
  });
});
