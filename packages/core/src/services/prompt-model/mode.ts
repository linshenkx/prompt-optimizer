import type {
  BasicPromptContract,
  ImagePromptContract,
  ProPromptContract,
  PromptContract,
  PromptInputSlot,
  PromptModeKey,
  PromptOutputSpec,
  PromptVariable,
} from './types';

export const PROMPT_MODE_KEYS = [
  'arena',
  'basic-system',
  'basic-user',
  'pro-variable',
  'pro-conversation',
  'image-text2image',
  'image-image2image',
  'image-multiimage',
] as const satisfies readonly PromptModeKey[];

export type FavoriteModeCompat = {
  functionMode: 'basic' | 'context' | 'image';
  optimizationMode?: 'system' | 'user';
  imageSubMode?: 'text2image' | 'image2image' | 'multiimage';
};

export type LegacyPromptModeInput = {
  functionMode?: 'basic' | 'context' | 'pro' | 'image' | string;
  optimizationMode?: 'system' | 'user' | string;
  imageSubMode?: 'text2image' | 'image2image' | 'multiimage' | string;
  proSubMode?: 'multi' | 'variable' | 'conversation' | string;
  subMode?: 'system' | 'user' | 'multi' | 'variable' | 'conversation' | string;
};

export type CreatePromptContractOptions = {
  variables?: PromptVariable[];
  inputs?: PromptInputSlot[];
  outputs?: PromptOutputSpec[];
  metadata?: Record<string, unknown>;
};

export const isPromptModeKey = (value: unknown): value is PromptModeKey =>
  typeof value === 'string' && PROMPT_MODE_KEYS.includes(value as PromptModeKey);

const normalizeString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const normalizeImageSubMode = (
  value: unknown,
): 'text2image' | 'image2image' | 'multiimage' => {
  if (value === 'image2image') return 'image2image';
  if (value === 'multiimage') return 'multiimage';
  return 'text2image';
};

export const resolvePromptModeKey = (input: LegacyPromptModeInput): PromptModeKey => {
  const functionMode = normalizeString(input.functionMode);
  const optimizationMode = normalizeString(input.optimizationMode);
  const proSubMode = normalizeString(input.proSubMode ?? input.subMode);

  if (functionMode === 'arena') return 'arena';
  if (functionMode === 'image') {
    return `image-${normalizeImageSubMode(input.imageSubMode)}` as PromptModeKey;
  }

  if (functionMode === 'context') {
    return optimizationMode === 'user' ? 'pro-variable' : 'pro-conversation';
  }

  if (functionMode === 'pro') {
    return proSubMode === 'variable' ? 'pro-variable' : 'pro-conversation';
  }

  return optimizationMode === 'user' ? 'basic-user' : 'basic-system';
};

export const promptModeKeyToFavoriteMode = (modeKey: PromptModeKey): FavoriteModeCompat => {
  switch (modeKey) {
    case 'basic-user':
      return { functionMode: 'basic', optimizationMode: 'user' };
    case 'pro-variable':
      return { functionMode: 'context', optimizationMode: 'user' };
    case 'pro-conversation':
      return { functionMode: 'context', optimizationMode: 'system' };
    case 'image-text2image':
      return { functionMode: 'image', imageSubMode: 'text2image' };
    case 'image-image2image':
      return { functionMode: 'image', imageSubMode: 'image2image' };
    case 'image-multiimage':
      return { functionMode: 'image', imageSubMode: 'multiimage' };
    case 'basic-system':
    default:
      return { functionMode: 'basic', optimizationMode: 'system' };
  }
};

export const createPromptContract = (
  modeKey: PromptModeKey,
  options: CreatePromptContractOptions = {},
): PromptContract => {
  const base = {
    modeKey,
    variables: options.variables ?? [],
    inputs: options.inputs,
    outputs: options.outputs,
    metadata: options.metadata,
  };

  switch (modeKey) {
    case 'arena': return { ...base, family: 'arena', modeKey };
    case 'basic-user':
      return {
        ...base,
        family: 'basic',
        subMode: 'user',
        modeKey,
      } satisfies BasicPromptContract;
    case 'pro-variable':
      return {
        ...base,
        family: 'pro',
        subMode: 'variable',
        modeKey,
      } satisfies ProPromptContract;
    case 'pro-conversation':
      return {
        ...base,
        family: 'pro',
        subMode: 'conversation',
        modeKey,
      } satisfies ProPromptContract;
    case 'image-text2image':
      return {
        ...base,
        family: 'image',
        subMode: 'text2image',
        modeKey,
      } satisfies ImagePromptContract;
    case 'image-image2image':
      return {
        ...base,
        family: 'image',
        subMode: 'image2image',
        modeKey,
      } satisfies ImagePromptContract;
    case 'image-multiimage':
      return {
        ...base,
        family: 'image',
        subMode: 'multiimage',
        modeKey,
      } satisfies ImagePromptContract;
    case 'basic-system':
    default:
      return {
        ...base,
        family: 'basic',
        subMode: 'system',
        modeKey: 'basic-system',
      } satisfies BasicPromptContract;
  }
};
