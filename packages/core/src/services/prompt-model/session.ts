import type { ConversationMessage } from '../prompt/types';
import {
  PROMPT_MODEL_SCHEMA_VERSION,
  type PromptContent,
  type PromptImageRef,
  type PromptModeKey,
  type PromptOptimizationChain,
  type PromptOptimizationTarget,
  type PromptRevisionRef,
  type PromptRunInput,
  type PromptRunOutput,
  type PromptSession,
  type PromptSessionLifecycle,
  type PromptSessionOrigin,
  type PromptSessionRegistry,
  type PromptSessionSummary,
  type PromptTestRun,
  type PromptTestRunSet,
} from './types';
import { promptContentFromText } from './content';
import { createRootOnlyPromptOptimizationChain } from './history';

export const LEGACY_SESSION_SUB_MODE_KEYS = [
  'arena',
  'basic-system',
  'basic-user',
  'pro-multi',
  'pro-variable',
  'image-text2image',
  'image-image2image',
  'image-multiimage',
] as const;

export type LegacySessionSubModeKey = typeof LEGACY_SESSION_SUB_MODE_KEYS[number];

export type LegacyTestPanelVersionValue = 'workspace' | 'previous' | 0 | number;

export interface LegacyPromptSessionTestVariant {
  id: string;
  version: LegacyTestPanelVersionValue;
  modelKey?: string;
}

export interface LegacyTextTestVariantResult {
  result?: string;
  reasoning?: string;
}

export interface LegacyImageResultItem {
  b64?: string;
  url?: string;
  id?: string;
  mimeType?: string;
  _type?: string;
}

export interface LegacyImageResult {
  images?: LegacyImageResultItem[];
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface LegacyPromptSessionSnapshot {
  subModeKey: LegacySessionSubModeKey | PromptModeKey | string;
  prompt?: string;
  originalPrompt?: string;
  optimizedPrompt?: string;
  reasoning?: string;
  chainId?: string;
  versionId?: string;
  testContent?: string;
  conversationMessagesSnapshot?: ConversationMessage[];
  selectedMessageId?: string;
  messageChainMap?: Record<string, string>;
  temporaryVariables?: Record<string, string>;
  inputImageId?: string | null;
  inputImageIds?: string[];
  inputImages?: LegacyImageResultItem[];
  testVariants?: LegacyPromptSessionTestVariant[];
  testVariantResults?: Record<string, LegacyTextTestVariantResult | LegacyImageResult | null>;
  testVariantLastRunFingerprint?: Record<string, string>;
  selectedOptimizeModelKey?: string;
  selectedTestModelKey?: string;
  selectedTextModelKey?: string;
  selectedImageModelKey?: string;
  selectedTemplateId?: string | null;
  selectedIterateTemplateId?: string | null;
  isCompareMode?: boolean;
  lastActiveAt?: number;
  origin?: PromptSessionOrigin;
  assetBinding?: PromptSession['assetBinding'];
  lifecycle?: PromptSessionLifecycle;
  title?: string;
  ui?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PromptSessionFromLegacySnapshotOptions {
  now?: number;
  sessionId?: string;
}

export interface PromptSessionRegistryInput {
  sessions: PromptSessionSummary[];
  activeSessionId?: string;
  activeLegacySubModeKey?: LegacySessionSubModeKey | string;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const legacySessionSubModeKeyToPromptModeKey = (
  key: LegacySessionSubModeKey | PromptModeKey | string,
): PromptModeKey => {
  switch (key) {
    case 'arena': return 'arena';
    case 'basic-user':
      return 'basic-user';
    case 'pro-variable':
      return 'pro-variable';
    case 'pro-multi':
    case 'pro-conversation':
      return 'pro-conversation';
    case 'image-text2image':
      return 'image-text2image';
    case 'image-image2image':
      return 'image-image2image';
    case 'image-multiimage':
      return 'image-multiimage';
    case 'basic-system':
    default:
      return 'basic-system';
  }
};

export const promptModeKeyToLegacySessionSubModeKey = (
  modeKey: PromptModeKey,
): LegacySessionSubModeKey => {
  if (modeKey === 'pro-conversation') return 'pro-multi';
  return modeKey;
};

export const createImplicitPromptSessionId = (
  key: LegacySessionSubModeKey | PromptModeKey | string,
): string => `implicit:${legacySessionSubModeKeyToPromptModeKey(key)}`;

const createDefaultSessionSummary = (
  snapshot: LegacyPromptSessionSnapshot,
  modeKey: PromptModeKey,
  sessionId: string,
  updatedAt: number,
): PromptSessionSummary => ({
  id: sessionId,
  modeKey,
  title: snapshot.title,
  lifecycle: snapshot.lifecycle ?? 'implicit',
  updatedAt,
  assetBinding: snapshot.assetBinding,
  origin: snapshot.origin ?? { kind: 'workspace' },
  metadata: {
    ...(snapshot.metadata ?? {}),
    legacySubModeKey: snapshot.subModeKey,
    ...(snapshot.chainId ? { legacyChainId: snapshot.chainId } : {}),
    ...(snapshot.versionId ? { legacyVersionId: snapshot.versionId } : {}),
  },
});

const getSelectedConversationMessage = (
  snapshot: LegacyPromptSessionSnapshot,
): ConversationMessage | undefined => {
  const messages = snapshot.conversationMessagesSnapshot ?? [];
  const selectedId = asTrimmedString(snapshot.selectedMessageId);
  if (!selectedId) return messages[0];
  return messages.find((message) => message.id === selectedId) ?? messages[0];
};

const getRootText = (
  snapshot: LegacyPromptSessionSnapshot,
  modeKey: PromptModeKey,
): string => {
  if (modeKey === 'pro-conversation') {
    const selectedMessage = getSelectedConversationMessage(snapshot);
    return selectedMessage?.originalContent ?? selectedMessage?.content ?? '';
  }

  if (modeKey.startsWith('image-')) {
    return snapshot.originalPrompt ?? snapshot.prompt ?? '';
  }

  return snapshot.prompt ?? snapshot.originalPrompt ?? '';
};

const getDraftContent = (
  snapshot: LegacyPromptSessionSnapshot,
  modeKey: PromptModeKey,
): PromptContent => {
  if (modeKey === 'pro-conversation') {
    return {
      kind: 'messages',
      messages: snapshot.conversationMessagesSnapshot ?? [],
    };
  }

  const text = snapshot.optimizedPrompt || snapshot.prompt || snapshot.originalPrompt || '';
  return promptContentFromText(text, modeKey);
};

const getChainId = (
  snapshot: LegacyPromptSessionSnapshot,
  sessionId: string,
): string => {
  const selectedMessageId = asTrimmedString(snapshot.selectedMessageId);
  const selectedMessageChainId = selectedMessageId
    ? asTrimmedString(snapshot.messageChainMap?.[selectedMessageId])
    : undefined;
  return selectedMessageChainId ?? snapshot.chainId ?? `${sessionId}:chain`;
};

const getOptimizationTarget = (
  snapshot: LegacyPromptSessionSnapshot,
  modeKey: PromptModeKey,
): PromptOptimizationTarget | undefined => {
  if (modeKey !== 'pro-conversation') return undefined;
  const selectedMessage = getSelectedConversationMessage(snapshot);
  if (!selectedMessage?.id) return undefined;
  return {
    kind: 'message',
    id: selectedMessage.id,
    role: selectedMessage.role,
  };
};

const createOptimizationFromLegacySnapshot = (
  snapshot: LegacyPromptSessionSnapshot,
  modeKey: PromptModeKey,
  sessionId: string,
  timestamp: number,
): PromptOptimizationChain => {
  const chainId = getChainId(snapshot, sessionId);
  return createRootOnlyPromptOptimizationChain({
    chainId,
    modeKey,
    content: getRootText(snapshot, modeKey),
    createdAt: timestamp,
    target: getOptimizationTarget(snapshot, modeKey),
    metadata: {
      legacySubModeKey: snapshot.subModeKey,
      ...(snapshot.chainId ? { legacyChainId: snapshot.chainId } : {}),
      ...(snapshot.versionId ? { legacyVersionId: snapshot.versionId } : {}),
      ...(snapshot.reasoning ? { reasoning: snapshot.reasoning } : {}),
      ...(snapshot.messageChainMap ? { messageChainMap: snapshot.messageChainMap } : {}),
    },
  });
};

const compactStringRecord = (value: Record<string, string> | undefined): Record<string, string> | undefined => {
  if (!value) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    out[normalizedKey] = String(raw);
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const imageRefsFromLegacyItems = (
  items: LegacyImageResultItem[] | undefined,
): PromptImageRef[] => {
  const refs: PromptImageRef[] = [];
  const seen = new Set<string>();

  for (const item of items ?? []) {
    if (!isPlainObject(item)) continue;

    const assetId = item._type === 'image-ref' ? asTrimmedString(item.id) : undefined;
    if (assetId && !seen.has(`asset:${assetId}`)) {
      seen.add(`asset:${assetId}`);
      refs.push({ kind: 'asset', assetId });
    }

    const url = asTrimmedString(item.url);
    if (url && !seen.has(`url:${url}`)) {
      seen.add(`url:${url}`);
      refs.push({ kind: 'url', url });
    }

    const b64 = asTrimmedString(item.b64);
    if (b64) {
      const mimeType = asTrimmedString(item.mimeType) ?? 'image/png';
      const dataUrl = b64.startsWith('data:')
        ? b64
        : `data:${mimeType};base64,${b64}`;
      if (!seen.has(`url:${dataUrl}`)) {
        seen.add(`url:${dataUrl}`);
        refs.push({ kind: 'url', url: dataUrl });
      }
    }
  }

  return refs;
};

const inputImageRefsFromSnapshot = (
  snapshot: LegacyPromptSessionSnapshot,
): PromptImageRef[] | undefined => {
  const refs: PromptImageRef[] = [];
  const seen = new Set<string>();

  const pushRef = (ref: PromptImageRef) => {
    const key = ref.kind === 'asset' ? `asset:${ref.assetId}` : `url:${ref.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  const pushAsset = (assetId: string | undefined) => {
    if (!assetId) return;
    pushRef({ kind: 'asset', assetId });
  };

  pushAsset(asTrimmedString(snapshot.inputImageId));
  for (const id of snapshot.inputImageIds ?? []) {
    pushAsset(asTrimmedString(id));
  }
  for (const ref of imageRefsFromLegacyItems(snapshot.inputImages)) {
    pushRef(ref);
  }

  return refs.length > 0 ? refs : undefined;
};

const revisionFromLegacyVersion = (
  version: LegacyTestPanelVersionValue,
  chainId: string,
  sessionId: string,
): PromptRevisionRef => {
  if (version === 'workspace') {
    return { kind: 'workspace', sessionId };
  }

  if (version === 0) {
    return { kind: 'root', chainId };
  }

  return {
    kind: 'record',
    chainId,
    recordId: typeof version === 'number' ? `legacy-version:${version}` : 'legacy-version:previous',
    version: typeof version === 'number' ? version : undefined,
  };
};

const cloneAssetBinding = (
  binding: LegacyPromptSessionSnapshot['assetBinding'],
): LegacyPromptSessionSnapshot['assetBinding'] =>
  binding
    ? {
        assetId: binding.assetId,
        ...(binding.versionId ? { versionId: binding.versionId } : {}),
        ...(binding.status ? { status: binding.status } : {}),
      }
    : undefined;

const cloneOrigin = (
  origin: PromptSessionOrigin | undefined,
): PromptSessionOrigin | undefined =>
  origin
    ? {
        kind: origin.kind,
        ...(origin.id ? { id: origin.id } : {}),
        ...(origin.metadata ? { metadata: { ...origin.metadata } } : {}),
      }
    : undefined;

const textOutputFromLegacyResult = (
  value: LegacyTextTestVariantResult | LegacyImageResult | null | undefined,
): PromptRunOutput | null => {
  if (!value || !isPlainObject(value)) return null;
  const text = asTrimmedString(value.result) ?? asTrimmedString(value.text);
  const reasoning = asTrimmedString(value.reasoning);
  if (!text && !reasoning) return null;
  return {
    ...(text ? { text } : {}),
    ...(reasoning ? { metadata: { reasoning } } : {}),
  };
};

const imageOutputFromLegacyResult = (
  value: LegacyTextTestVariantResult | LegacyImageResult | null | undefined,
): PromptRunOutput | null => {
  if (!value || !isPlainObject(value)) return null;
  const text = asTrimmedString(value.text) ?? asTrimmedString(value.result);
  const images = imageRefsFromLegacyItems(Array.isArray(value.images) ? value.images : []);
  if (!text && images.length === 0) return null;
  return {
    ...(text ? { text } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(isPlainObject(value.metadata) ? { metadata: value.metadata } : {}),
  };
};

const createRunInput = (
  snapshot: LegacyPromptSessionSnapshot,
  modeKey: PromptModeKey,
): PromptRunInput => {
  const parameters = compactStringRecord(snapshot.temporaryVariables);
  const inputImages = inputImageRefsFromSnapshot(snapshot);

  if (modeKey === 'pro-conversation') {
    return {
      messages: snapshot.conversationMessagesSnapshot ?? [],
      ...(parameters ? { parameters } : {}),
    };
  }

  return {
    ...(snapshot.testContent ? { text: snapshot.testContent } : {}),
    ...(parameters ? { parameters } : {}),
    ...(inputImages ? { images: inputImages } : {}),
  };
};

export const promptTestRunSetsFromLegacySessionSnapshot = (
  snapshot: LegacyPromptSessionSnapshot,
  options: PromptSessionFromLegacySnapshotOptions = {},
): PromptTestRunSet[] => {
  const modeKey = legacySessionSubModeKeyToPromptModeKey(snapshot.subModeKey);
  const sessionId = options.sessionId ?? createImplicitPromptSessionId(snapshot.subModeKey);
  const timestamp = snapshot.lastActiveAt ?? options.now ?? 0;
  const chainId = getChainId(snapshot, sessionId);
  const variants = snapshot.testVariants ?? [];
  const results = snapshot.testVariantResults ?? {};
  const runs: PromptTestRun[] = [];
  const assetBinding = cloneAssetBinding(snapshot.assetBinding);
  const origin = cloneOrigin(snapshot.origin);

  for (const variant of variants) {
    const result = results[variant.id];
    const output = modeKey.startsWith('image-')
      ? imageOutputFromLegacyResult(result)
      : textOutputFromLegacyResult(result);
    if (!output) continue;

    runs.push({
      id: `${sessionId}:test:${variant.id}`,
      revision: revisionFromLegacyVersion(variant.version, chainId, sessionId),
      input: createRunInput(snapshot, modeKey),
      output,
      status: 'success',
      modelKey:
        asTrimmedString(variant.modelKey) ??
        asTrimmedString(snapshot.selectedTestModelKey) ??
        asTrimmedString(snapshot.selectedImageModelKey),
      createdAt: timestamp,
      metadata: {
        sessionId,
        modeKey,
        chainId,
        ...(snapshot.versionId ? { versionId: snapshot.versionId } : {}),
        ...(assetBinding ? { assetBinding } : {}),
        ...(origin ? { origin } : {}),
        legacyVariantId: variant.id,
        legacyVersionSelection: variant.version,
        ...(snapshot.testVariantLastRunFingerprint?.[variant.id]
          ? { legacyFingerprint: snapshot.testVariantLastRunFingerprint[variant.id] }
          : {}),
      },
    });
  }

  if (runs.length === 0) return [];

  return [
    {
      id: `${sessionId}:tests`,
      runs,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        legacySubModeKey: snapshot.subModeKey,
      },
    },
  ];
};

export const promptSessionFromLegacySnapshot = (
  snapshot: LegacyPromptSessionSnapshot,
  options: PromptSessionFromLegacySnapshotOptions = {},
): PromptSession => {
  const modeKey = legacySessionSubModeKeyToPromptModeKey(snapshot.subModeKey);
  const sessionId = options.sessionId ?? createImplicitPromptSessionId(snapshot.subModeKey);
  const timestamp = snapshot.lastActiveAt ?? options.now ?? 0;
  const optimization = createOptimizationFromLegacySnapshot(snapshot, modeKey, sessionId, timestamp);

  return {
    schemaVersion: PROMPT_MODEL_SCHEMA_VERSION,
    id: sessionId,
    title: snapshot.title,
    modeKey,
    lifecycle: snapshot.lifecycle ?? 'implicit',
    createdAt: timestamp,
    updatedAt: timestamp,
    assetBinding: snapshot.assetBinding,
    draft: {
      content: getDraftContent(snapshot, modeKey),
      metadata: {
        legacySubModeKey: snapshot.subModeKey,
        ...(snapshot.chainId ? { legacyChainId: snapshot.chainId } : {}),
        ...(snapshot.versionId ? { legacyVersionId: snapshot.versionId } : {}),
      },
    },
    optimization,
    testRuns: promptTestRunSetsFromLegacySessionSnapshot(snapshot, {
      ...options,
      sessionId,
    }),
    origin: snapshot.origin ?? { kind: 'workspace' },
    ui: {
      ...(snapshot.ui ?? {}),
      ...(snapshot.selectedOptimizeModelKey
        ? { selectedOptimizeModelKey: snapshot.selectedOptimizeModelKey }
        : {}),
      ...(snapshot.selectedTestModelKey ? { selectedTestModelKey: snapshot.selectedTestModelKey } : {}),
      ...(snapshot.selectedTextModelKey ? { selectedTextModelKey: snapshot.selectedTextModelKey } : {}),
      ...(snapshot.selectedImageModelKey ? { selectedImageModelKey: snapshot.selectedImageModelKey } : {}),
      ...(snapshot.selectedTemplateId ? { selectedTemplateId: snapshot.selectedTemplateId } : {}),
      ...(snapshot.selectedIterateTemplateId
        ? { selectedIterateTemplateId: snapshot.selectedIterateTemplateId }
        : {}),
      ...(snapshot.isCompareMode !== undefined ? { isCompareMode: snapshot.isCompareMode } : {}),
    },
    metadata: createDefaultSessionSummary(snapshot, modeKey, sessionId, timestamp).metadata,
  };
};

export const createPromptSessionSummaryFromLegacySnapshot = (
  snapshot: LegacyPromptSessionSnapshot,
  options: PromptSessionFromLegacySnapshotOptions = {},
): PromptSessionSummary => {
  const modeKey = legacySessionSubModeKeyToPromptModeKey(snapshot.subModeKey);
  const sessionId = options.sessionId ?? createImplicitPromptSessionId(snapshot.subModeKey);
  const timestamp = snapshot.lastActiveAt ?? options.now ?? 0;
  return createDefaultSessionSummary(snapshot, modeKey, sessionId, timestamp);
};

export const createPromptSessionRegistry = (
  input: PromptSessionRegistryInput,
): PromptSessionRegistry => {
  const activeSessionId = input.activeSessionId
    ?? (input.activeLegacySubModeKey
      ? createImplicitPromptSessionId(input.activeLegacySubModeKey)
      : undefined);
  const activeSessionIdByMode: Partial<Record<PromptModeKey, string>> = {};

  for (const session of input.sessions) {
    if (!activeSessionIdByMode[session.modeKey]) {
      activeSessionIdByMode[session.modeKey] = session.id;
    }
  }

  if (input.activeLegacySubModeKey && activeSessionId) {
    const activeModeKey = legacySessionSubModeKeyToPromptModeKey(input.activeLegacySubModeKey);
    activeSessionIdByMode[activeModeKey] = activeSessionId;
  }

  return {
    schemaVersion: PROMPT_MODEL_SCHEMA_VERSION,
    activeSessionId,
    activeSessionIdByMode,
    sessions: input.sessions,
    updatedAt: input.updatedAt ?? 0,
    metadata: input.metadata,
  };
};
