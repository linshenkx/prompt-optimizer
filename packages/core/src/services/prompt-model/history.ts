import type { PromptRecord, PromptRecordChain } from '../history/types';
import {
  type PromptContent,
  type PromptModeKey,
  type PromptOptimizationChain,
  type PromptOptimizationRecord,
  type PromptOptimizationTarget,
  type PromptRevisionRef,
  type PromptRootSnapshot,
  type PromptSession,
  type PromptTestRunSet,
} from './types';
import { promptContentFromText } from './content';
import { resolvePromptModeKey } from './mode';

export type RootOnlyPromptOptimizationChainInput = {
  chainId: string;
  modeKey: PromptModeKey;
  content: string | PromptContent;
  createdAt: number;
  target?: PromptOptimizationTarget;
  metadata?: Record<string, unknown>;
};

const contentFromText = (text: string, modeKey: PromptModeKey): PromptContent =>
  promptContentFromText(text, modeKey);

const inferModeKeyFromRecord = (record: PromptRecord): PromptModeKey => {
  switch (record.type) {
    case 'userOptimize':
      return 'basic-user';
    case 'contextUserOptimize':
      return 'pro-variable';
    case 'contextIterate':
    case 'conversationMessageOptimize':
      return 'pro-conversation';
    case 'imageOptimize':
    case 'contextImageOptimize':
    case 'imageIterate':
    case 'text2imageOptimize':
      return 'image-text2image';
    case 'image2imageOptimize':
      return 'image-image2image';
    case 'videoOptimize':
      return 'video-create';
    case 'multiimageOptimize':
      return 'image-multiimage';
    case 'optimize':
    case 'iterate':
    case 'test':
    default:
      return resolvePromptModeKey({
        functionMode: 'basic',
        optimizationMode: record.metadata?.optimizationMode ?? 'system',
      });
  }
};

const targetFromRecord = (record: PromptRecord): PromptOptimizationTarget | undefined => {
  const messageId = typeof record.metadata?.messageId === 'string' ? record.metadata.messageId : '';
  if (!messageId) return undefined;

  return {
    kind: 'message',
    id: messageId,
    role: typeof record.metadata?.messageRole === 'string' ? record.metadata.messageRole : undefined,
  };
};

const recordToOptimizationRecord = (
  record: PromptRecord,
  modeKey: PromptModeKey,
): PromptOptimizationRecord => ({
  id: record.id,
  type: record.type,
  version: record.version,
  input: contentFromText(record.originalPrompt, modeKey),
  output: contentFromText(record.optimizedPrompt, modeKey),
  createdAt: record.timestamp,
  previousRecordId: record.previousId,
  modelKey: record.modelKey,
  modelName: record.modelName,
  templateId: record.templateId,
  iterationNote: record.iterationNote,
  sourceRecordId: record.id,
  metadata: record.metadata,
});

export const promptRecordChainToOptimizationChain = (
  chain: PromptRecordChain,
): PromptOptimizationChain => {
  const modeKey = inferModeKeyFromRecord(chain.rootRecord);
  const root: PromptRootSnapshot = {
    id: `${chain.chainId}:root`,
    content: contentFromText(chain.rootRecord.originalPrompt, modeKey),
    createdAt: chain.rootRecord.timestamp,
    sourceRecordId: chain.rootRecord.id,
  };

  return {
    id: chain.chainId,
    modeKey,
    root,
    records: chain.versions.map((record) => recordToOptimizationRecord(record, modeKey)),
    currentRecordId: chain.currentRecord.id,
    target: targetFromRecord(chain.rootRecord),
    legacyPromptRecordChainId: chain.chainId,
  };
};

const remapRevisionRefForOptimizationChain = (
  revision: PromptRevisionRef,
  optimization: PromptOptimizationChain,
): PromptRevisionRef => {
  if (revision.kind === 'root') {
    return {
      kind: 'root',
      chainId: optimization.id,
    };
  }

  if (revision.kind === 'record') {
    const matchedRecord = findRecordForHydrationRevision(revision, optimization);

    if (!matchedRecord) {
      return { ...revision };
    }

    return {
      ...revision,
      chainId: optimization.id,
      recordId: matchedRecord.id,
      version: matchedRecord.version,
    };
  }

  return { ...revision };
};

const findRecordForHydrationRevision = (
  revision: Extract<PromptRevisionRef, { kind: 'record' }>,
  optimization: PromptOptimizationChain,
): PromptOptimizationRecord | undefined => {
  if (typeof revision.version === 'number') {
    return optimization.records.find((record) => record.version === revision.version);
  }

  if (revision.recordId !== 'legacy-version:previous') {
    return undefined;
  }

  const currentRecord = optimization.records.find((record) => record.id === optimization.currentRecordId);
  if (!currentRecord) {
    return undefined;
  }

  if (currentRecord.previousRecordId) {
    const previousRecord = optimization.records.find((record) => record.id === currentRecord.previousRecordId);
    if (previousRecord) return previousRecord;
  }

  return optimization.records.find((record) => record.version === currentRecord.version - 1);
};

const remapTestRunSetsForOptimizationChain = (
  runSets: PromptTestRunSet[],
  optimization: PromptOptimizationChain,
): PromptTestRunSet[] => runSets.map((runSet) => ({
  ...runSet,
  runs: runSet.runs.map((run) => ({
    ...run,
    revision: remapRevisionRefForOptimizationChain(run.revision, optimization),
  })),
}));

const mergeMetadata = (
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  const merged = {
    ...(left ?? {}),
    ...(right ?? {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
};

export const hydratePromptSessionWithOptimizationChain = (
  session: PromptSession,
  optimization: PromptOptimizationChain,
): PromptSession => {
  const hydratedOptimization: PromptOptimizationChain = {
    ...optimization,
    target: optimization.target ?? session.optimization.target,
    metadata: mergeMetadata(session.optimization.metadata, optimization.metadata),
  };

  return {
    ...session,
    optimization: hydratedOptimization,
    testRuns: remapTestRunSetsForOptimizationChain(session.testRuns, hydratedOptimization),
  };
};

export const createRootOnlyPromptOptimizationChain = (
  input: RootOnlyPromptOptimizationChainInput,
): PromptOptimizationChain => ({
  id: input.chainId,
  modeKey: input.modeKey,
  root: {
    id: `${input.chainId}:root`,
    content:
      typeof input.content === 'string'
        ? contentFromText(input.content, input.modeKey)
        : input.content,
    createdAt: input.createdAt,
  },
  records: [],
  target: input.target,
  metadata: input.metadata,
});
