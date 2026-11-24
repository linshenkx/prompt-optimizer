import type {
  PromptExample,
  PromptRevisionRef,
  PromptRunInput,
  PromptRunOutput,
  PromptSourceRef,
  PromptTestRun,
} from './types';

export interface PromptExampleFromTestRunOptions {
  basedOnVersionId: string;
  id?: string;
  title?: string;
  description?: string;
  source?: PromptSourceRef;
}

const hasRunOutput = (output: PromptRunOutput | undefined): output is PromptRunOutput =>
  Boolean(
    output &&
    (
      output.text ||
      (output.images && output.images.length > 0)
    ),
  );

const cloneRevisionRef = (revision: PromptRevisionRef): PromptRevisionRef => ({ ...revision });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const cloneCoordinateMetadata = (
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!metadata) return undefined;

  const out: Record<string, unknown> = {};
  const sessionId = asString(metadata.sessionId);
  const modeKey = asString(metadata.modeKey);
  const chainId = asString(metadata.chainId);
  const versionId = asString(metadata.versionId);

  if (sessionId) out.sessionId = sessionId;
  if (modeKey) out.modeKey = modeKey;
  if (chainId) out.chainId = chainId;
  if (versionId) out.versionId = versionId;
  if (isPlainObject(metadata.assetBinding)) {
    out.assetBinding = { ...metadata.assetBinding };
  }
  if (isPlainObject(metadata.origin)) {
    const origin = metadata.origin;
    out.origin = {
      ...origin,
      ...(isPlainObject(origin.metadata) ? { metadata: { ...origin.metadata } } : {}),
    };
  }

  return Object.keys(out).length > 0 ? out : undefined;
};

const inferSourceFromRevision = (
  revision: PromptRevisionRef,
  metadata: Record<string, unknown> | undefined,
): PromptSourceRef => {
  if (revision.kind === 'asset-version') {
    return {
      kind: 'favorite',
      id: revision.assetId,
      metadata: {
        versionId: revision.versionId,
      },
    };
  }

  const sourceMetadata = cloneCoordinateMetadata(metadata);
  return {
    kind: 'workspace',
    id:
      revision.kind === 'workspace'
        ? revision.sessionId ?? asString(metadata?.sessionId)
        : revision.chainId,
    ...(sourceMetadata ? { metadata: sourceMetadata } : {}),
  };
};

export const promptExampleFromTestRun = (
  run: PromptTestRun,
  options: PromptExampleFromTestRunOptions,
): PromptExample | null => {
  if (run.status !== 'success' || !hasRunOutput(run.output)) {
    return null;
  }

  const input: PromptRunInput = {
    ...(run.input.text ? { text: run.input.text } : {}),
    ...(run.input.messages && run.input.messages.length > 0
      ? { messages: run.input.messages.map((message) => ({ ...message })) }
      : {}),
    ...(run.input.parameters && Object.keys(run.input.parameters).length > 0
      ? { parameters: { ...run.input.parameters } }
      : {}),
    ...(run.input.images && run.input.images.length > 0
      ? { images: run.input.images.map((image) => ({ ...image })) }
      : {}),
    ...(run.input.metadata ? { metadata: { ...run.input.metadata } } : {}),
  };

  const output: PromptRunOutput = {
    ...(run.output.text ? { text: run.output.text } : {}),
    ...(run.output.images && run.output.images.length > 0
      ? { images: run.output.images.map((image) => ({ ...image })) }
      : {}),
    ...(run.output.metadata ? { metadata: { ...run.output.metadata } } : {}),
  };

  return {
    id: options.id ?? `test-run:${run.id}`,
    basedOnVersionId: options.basedOnVersionId,
    title: options.title,
    description: options.description,
    input,
    output,
    createdAt: run.createdAt,
    source: options.source ?? inferSourceFromRevision(run.revision, run.metadata),
    metadata: {
      testRunId: run.id,
      revision: cloneRevisionRef(run.revision),
      ...(run.modelKey ? { modelKey: run.modelKey } : {}),
      ...(run.modelName ? { modelName: run.modelName } : {}),
      ...(run.durationMs !== undefined ? { durationMs: run.durationMs } : {}),
      ...(run.metadata ? { runMetadata: { ...run.metadata } } : {}),
    },
  };
};
