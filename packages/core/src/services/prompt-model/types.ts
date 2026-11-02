import type { ConversationMessage } from '../prompt/types';
import type { PromptRecordType } from '../history/types';

export const PROMPT_MODEL_SCHEMA_VERSION = 'prompt-model/v1' as const;

export type PromptModelSchemaVersion = typeof PROMPT_MODEL_SCHEMA_VERSION;

export type PromptModeKey =
  | 'arena'
  | 'basic-system'
  | 'basic-user'
  | 'pro-variable'
  | 'pro-conversation'
  | 'image-text2image'
  | 'image-image2image'
  | 'image-multiimage';

export type PromptModeFamily = 'basic' | 'pro' | 'image' | 'arena';

export type PromptVariableType = 'string' | 'number' | 'boolean' | 'enum';

export interface PromptVariable {
  name: string;
  description?: string;
  type?: PromptVariableType;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  source?: string;
}

export type PromptInputSlotType = 'text' | 'messages' | 'image' | 'images' | 'variables' | 'custom';

export interface PromptInputSlot {
  id: string;
  type: PromptInputSlotType;
  label?: string;
  required?: boolean;
  description?: string;
  accepts?: string[];
  metadata?: Record<string, unknown>;
}

export type PromptOutputKind = 'text' | 'message' | 'image' | 'images' | 'json' | 'custom';

export interface PromptOutputSpec {
  id: string;
  kind: PromptOutputKind;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptContractBase {
  modeKey: PromptModeKey;
  variables: PromptVariable[];
  inputs?: PromptInputSlot[];
  outputs?: PromptOutputSpec[];
  metadata?: Record<string, unknown>;
}

export interface BasicPromptContract extends PromptContractBase {
  family: 'basic';
  subMode: 'system' | 'user';
  modeKey: 'basic-system' | 'basic-user';
}

export interface ProPromptContract extends PromptContractBase {
  family: 'pro';
  subMode: 'variable' | 'conversation';
  modeKey: 'pro-variable' | 'pro-conversation';
}

export interface ImagePromptContract extends PromptContractBase {
  family: 'image';
  subMode: 'text2image' | 'image2image' | 'multiimage';
  modeKey: 'image-text2image' | 'image-image2image' | 'image-multiimage';
}

export interface ArenaPromptContract extends PromptContractBase { family: 'arena'; modeKey: 'arena' }
export type PromptContract = BasicPromptContract | ProPromptContract | ImagePromptContract | ArenaPromptContract;

export type PromptContent =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'messages';
      messages: ConversationMessage[];
    }
  | {
      kind: 'image-prompt';
      text: string;
      images?: PromptImageRef[];
    };

export type PromptImageRef =
  | {
      kind: 'url';
      url: string;
    }
  | {
      kind: 'asset';
      assetId: string;
    };

export interface PromptContentVersion {
  id: string;
  version: number;
  content: PromptContent;
  title?: string;
  createdAt: number;
  updatedAt?: number;
  source?: PromptSourceRef;
  metadata?: Record<string, unknown>;
}

export interface PromptRunInput {
  text?: string;
  messages?: ConversationMessage[];
  parameters?: Record<string, string>;
  images?: PromptImageRef[];
  metadata?: Record<string, unknown>;
}

export interface PromptRunOutput {
  text?: string;
  images?: PromptImageRef[];
  metadata?: Record<string, unknown>;
}

export interface PromptExample {
  id: string;
  basedOnVersionId: string;
  title?: string;
  description?: string;
  input: PromptRunInput;
  output?: PromptRunOutput;
  createdAt?: number;
  source?: PromptSourceRef;
  metadata?: Record<string, unknown>;
}

export interface PromptSourceRef {
  kind: 'workspace' | 'favorite' | 'garden' | 'history' | 'external' | 'unknown';
  id?: string;
  label?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptAsset {
  schemaVersion: PromptModelSchemaVersion;
  id: string;
  title: string;
  description?: string;
  tags: string[];
  category?: string;
  contract: PromptContract;
  currentVersionId: string;
  versions: PromptContentVersion[];
  examples: PromptExample[];
  source?: PromptSourceRef;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface PromptAssetBinding {
  assetId: string;
  versionId?: string;
  status?: 'linked' | 'forked' | 'detached';
}

export interface PromptAssetDraft {
  title?: string;
  description?: string;
  content: PromptContent;
  variables?: PromptVariable[];
  metadata?: Record<string, unknown>;
}

export type PromptSessionLifecycle = 'implicit' | 'active' | 'background' | 'closed' | 'archived';

export interface PromptSessionOrigin {
  kind: 'blank' | 'workspace' | 'asset' | 'favorite' | 'history' | 'garden' | 'import' | 'external';
  id?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptSessionSummary {
  id: string;
  modeKey: PromptModeKey;
  title?: string;
  lifecycle: PromptSessionLifecycle;
  updatedAt: number;
  assetBinding?: PromptAssetBinding;
  origin?: PromptSessionOrigin;
  metadata?: Record<string, unknown>;
}

export interface PromptSessionRegistry {
  schemaVersion: PromptModelSchemaVersion;
  activeSessionId?: string;
  activeSessionIdByMode: Partial<Record<PromptModeKey, string>>;
  sessions: PromptSessionSummary[];
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface PromptSession {
  schemaVersion: PromptModelSchemaVersion;
  id: string;
  title?: string;
  modeKey: PromptModeKey;
  lifecycle: PromptSessionLifecycle;
  createdAt: number;
  updatedAt: number;
  assetBinding?: PromptAssetBinding;
  draft?: PromptAssetDraft;
  optimization: PromptOptimizationChain;
  testRuns: PromptTestRunSet[];
  origin?: PromptSessionOrigin;
  ui?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PromptRootSnapshot {
  id: string;
  content: PromptContent;
  createdAt: number;
  sourceRecordId?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptOptimizationTarget {
  kind: 'prompt' | 'message' | 'image-prompt' | 'custom';
  id?: string;
  role?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptOptimizationRecord {
  id: string;
  type: PromptRecordType;
  version: number;
  input: PromptContent;
  output: PromptContent;
  createdAt: number;
  previousRecordId?: string;
  modelKey: string;
  modelName?: string;
  templateId: string;
  iterationNote?: string;
  sourceRecordId?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptOptimizationChain {
  id: string;
  modeKey: PromptModeKey;
  root: PromptRootSnapshot;
  records: PromptOptimizationRecord[];
  currentRecordId?: string;
  target?: PromptOptimizationTarget;
  legacyPromptRecordChainId?: string;
  metadata?: Record<string, unknown>;
}

export type PromptRevisionRef =
  | {
      kind: 'root';
      chainId: string;
    }
  | {
      kind: 'record';
      chainId: string;
      recordId: string;
      version?: number;
    }
  | {
      kind: 'workspace';
      sessionId?: string;
    }
  | {
      kind: 'asset-version';
      assetId: string;
      versionId: string;
    };

export interface PromptTestRun {
  id: string;
  revision: PromptRevisionRef;
  input: PromptRunInput;
  output?: PromptRunOutput;
  status: 'success' | 'error';
  modelKey?: string;
  modelName?: string;
  createdAt: number;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptTestRunSet {
  id: string;
  title?: string;
  runs: PromptTestRun[];
  createdAt: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}
