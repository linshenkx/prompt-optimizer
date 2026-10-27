/**
 * 评估服务实现
 *
 * 使用 LLM 对测试结果进行智能评估和打分
 */

import type { ILLMService, Message, StreamHandlers } from '../llm/types';
import type { IModelManager } from '../model/types';
import type { TextModelConfig } from '../model/types';
import type { ITemplateManager, Template } from '../template/types';
import { TemplateProcessor, type TemplateContext } from '../template/processor';
import type { IImageStorageService } from '../image/types';
import type { IImageUnderstandingService } from '../image-understanding/types';
import {
  buildStructuredComparePairJudgeMessages,
  buildStructuredCompareSynthesisMessages,
} from './structured-compare-prompts';
import {
  renderStructuredCompareConflictSignal as renderStructuredCompareConflictCopy,
  renderStructuredCompareJudgeResults as renderStructuredCompareJudgeResultsCopy,
  renderStructuredComparePairGuidance as renderStructuredComparePairGuidanceCopy,
  renderStructuredCompareRoleBindings as renderStructuredCompareRoleBindingsCopy,
  renderStructuredCompareSnapshot as renderStructuredCompareSnapshotCopy,
  renderStructuredCompareSynthesisHints as renderStructuredCompareSynthesisHintsCopy,
  renderStructuredCompareTestCases as renderStructuredCompareTestCasesCopy,
  resolveStructuredComparePromptSubjectConfig,
} from '../template/default-templates/evaluation-structured-compare/runtime-copy';
import {
  type IEvaluationService,
  type EvaluationRequest,
  type EvaluationResponse,
  type EvaluationStreamHandlers,
  type EvaluationScore,
  type EvaluationType,
  type EvaluationDimension,
  type EvaluationModeConfig,
  type PatchOperation,
  type PatchOperationType,
  type EvaluationContentBlock,
  type EvaluationMediaItem,
  type EvaluationSnapshot,
  type EvaluationTestCase,
  type StructuredCompareRole,
  type CompareStopSignals,
  type CompareJudgement,
  type CompareInsightHighlight,
  type CompareInsights,
  type CompareJudgementPairType,
  type CompareConflictSignal,
} from './types';
import {
  EvaluationValidationError,
  EvaluationModelError,
  EvaluationTemplateError,
  EvaluationExecutionError,
  EvaluationParseError,
} from './errors';
import { jsonrepair } from 'jsonrepair';

type ComparePromptLanguage = 'zh' | 'en';

interface NormalizedEvaluationTestCase {
  id: string;
  label: string;
  hasLabel: boolean;
  inputKind: string;
  inputLabel: string;
  inputContent: string;
  inputSummary: string;
  hasInputSummary: boolean;
  settingsSummary: string;
  hasSettingsSummary: boolean;
}

interface NormalizedEvaluationSnapshot {
  id: string;
  label: string;
  testCaseId: string;
  testCaseLabel: string;
  promptText: string;
  promptMatchesWorkspace: boolean;
  hasDistinctPromptText: boolean;
  promptRefKind: EvaluationSnapshot['promptRef']['kind'];
  promptRefLabel: string;
  role: StructuredCompareRole | '';
  roleLabel: string;
  hasRole: boolean;
  isTarget: boolean;
  isBaseline: boolean;
  isReference: boolean;
  isReferenceBaseline: boolean;
  isReplica: boolean;
  isAuxiliary: boolean;
  modelKey: string;
  hasModelKey: boolean;
  versionLabel: string;
  hasVersionLabel: boolean;
  reasoning: string;
  hasReasoning: boolean;
  output: string;
  executionInputLabel: string;
  executionInputContent: string;
  executionInputSummary: string;
  hasExecutionInputSummary: boolean;
  hasExecutionInput: boolean;
  inputLabel: string;
  inputContent: string;
  inputSummary: string;
  hasInputSummary: boolean;
  hasInput: boolean;
}

interface StructuredCompareRoleBinding {
  snapshotId: string;
  snapshotLabel: string;
  role: StructuredCompareRole;
  roleLabel: string;
}

interface StructuredCompareJudgePlanItem {
  key: string;
  pairType: CompareJudgementPairType;
  label: string;
  purpose: string;
  signalName: 'progress' | 'gap' | 'promptValidity' | 'stability';
  allowedSignals: string[];
  left: NormalizedEvaluationSnapshot;
  right: NormalizedEvaluationSnapshot;
}

interface StructuredCompareJudgeResult extends CompareJudgement {}

interface StructuredCompareSignalSnapshot {
  progress?: 'improved' | 'flat' | 'regressed' | 'unclear';
  gap?: 'none' | 'minor' | 'major' | 'unclear';
  promptValidity?: 'supported' | 'mixed' | 'unsupported' | 'unclear';
  stability?: 'stable' | 'unstable' | 'unclear';
}

interface ComparePromptSubjectConfig {
  subjectLabel: string;
  roleName: string;
}

interface NormalizedContentBlock {
  kind: string;
  label: string;
  content: string;
  summary: string;
  hasSummary: boolean;
}

interface NormalizedCompareContext {
  compareMode: 'generic' | 'structured';
  snapshotRoles?: Record<string, StructuredCompareRole>;
  normalizedTestCases: NormalizedEvaluationTestCase[];
  renderedTestCases: NormalizedEvaluationTestCase[];
  testCaseMap: Map<string, NormalizedEvaluationTestCase>;
  normalizedSnapshots: NormalizedEvaluationSnapshot[];
  compareRoleBindings: StructuredCompareRoleBinding[];
  samePromptAcrossSnapshots: boolean;
  sharedCompareInputs: boolean;
  crossModelComparison: boolean;
  hasEditableWorkspaceTarget: boolean;
  judgePlan: StructuredCompareJudgePlanItem[];
}

interface EvaluationServiceDependencies {
  imageStorageService?: IImageStorageService;
  imageUnderstandingService?: IImageUnderstandingService;
}

interface ResolvedEvaluationMedia {
  label: string;
  role: string;
  snapshotId?: string;
  snapshotLabel?: string;
  blockLabel: string;
  promptRefKind?: EvaluationSnapshot['promptRef']['kind'];
  testCaseLabel: string;
  description: string;
  b64: string;
  mimeType?: string;
}

/**
 * 评估服务实现类
 */
export class EvaluationService implements IEvaluationService {
  private readonly imageStorageService?: IImageStorageService;
  private readonly imageUnderstandingService?: IImageUnderstandingService;

  constructor(
    private llmService: ILLMService,
    private modelManager: IModelManager,
    private templateManager: ITemplateManager,
    dependencies: EvaluationServiceDependencies = {}
  ) {
    this.imageStorageService = dependencies.imageStorageService;
    this.imageUnderstandingService = dependencies.imageUnderstandingService;
  }

  private formatExecutionErrorMessage(error: unknown, fallback = 'Unknown evaluation execution error'): string {
    if (typeof error === 'string') {
      return error.trim() || fallback;
    }

    if (error instanceof Error) {
      const message = error.message?.trim();
      if (message && !/^\[object .+\]$/.test(message)) {
        return message;
      }

      const cause = (error as Error & { cause?: unknown }).cause;
      if (cause !== undefined) {
        return this.formatExecutionErrorMessage(cause, fallback);
      }

      return message || fallback;
    }

    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const directMessage = record.message;
      if (typeof directMessage === 'string' && directMessage.trim() && !/^\[object .+\]$/.test(directMessage.trim())) {
        return directMessage.trim();
      }
      if (directMessage !== undefined && directMessage !== error) {
        return this.formatExecutionErrorMessage(directMessage, fallback);
      }

      const nestedError = record.error;
      if (nestedError !== undefined && nestedError !== error) {
        const nestedMessage = this.formatExecutionErrorMessage(nestedError, '');
        if (nestedMessage) {
          return nestedMessage;
        }
      }

      const status = record.status ?? record.statusCode ?? (record.response as Record<string, unknown> | undefined)?.status;
      const body = record.body ?? record.data ?? (record.response as Record<string, unknown> | undefined)?.data;
      const bodyMessage = body !== undefined && body !== error
        ? this.formatExecutionErrorMessage(body, '')
        : '';

      if (status !== undefined) {
        return bodyMessage
          ? `HTTP ${String(status)}: ${bodyMessage}`
          : `HTTP ${String(status)} error`;
      }

      try {
        return JSON.stringify(error);
      } catch {
        return fallback;
      }
    }

    if (error === null || error === undefined) {
      return fallback;
    }

    return String(error);
  }

  private toError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error(this.formatExecutionErrorMessage(error));
  }

  /**
   * 执行评估（非流式）
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    this.validateRequest(request);
    const modelConfig = await this.validateModel(request.evaluationModelKey);

    let normalizedCompare: NormalizedCompareContext | undefined;
    if (request.type === 'compare') {
      normalizedCompare = this.normalizeCompareRequest(request);
      if (normalizedCompare.compareMode === 'structured') {
        return this.evaluateStructuredCompare(request, normalizedCompare);
      }
    }

    const template = await this.getEvaluationTemplate(request.type, request.mode);
    const context = this.buildTemplateContext(request, normalizedCompare);
    const messages = TemplateProcessor.processTemplate(template, context);

    const startTime = Date.now();
    try {
      if (this.shouldUseMultimodalEvaluation(request)) {
        const responseMetadata = this.buildResponseMetadata(
          request,
          {
            model: request.evaluationModelKey,
            timestamp: Date.now(),
            duration: 0,
          },
          normalizedCompare
        );
        const content = await this.executeMultimodalEvaluation(request, messages, modelConfig);
        responseMetadata.duration = Date.now() - startTime;
        return this.parseEvaluationResult(content, request.type, responseMetadata);
      }

      const result = await this.llmService.sendMessage(messages, request.evaluationModelKey);
      const duration = Date.now() - startTime;
      const responseMetadata = this.buildResponseMetadata(
        request,
        {
          model: request.evaluationModelKey,
          timestamp: Date.now(),
          duration,
        },
        normalizedCompare
      );

      return this.parseEvaluationResult(result, request.type, responseMetadata);
    } catch (error) {
      throw new EvaluationExecutionError(
        this.formatExecutionErrorMessage(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 流式评估
   */
  async evaluateStream(
    request: EvaluationRequest,
    callbacks: EvaluationStreamHandlers
  ): Promise<void> {
    try {
      this.validateRequest(request);
    } catch (error) {
      callbacks.onError(this.toError(error));
      return;
    }

    try {
      const modelConfig = await this.validateModel(request.evaluationModelKey);
      await this.evaluateStreamInternal(request, callbacks, modelConfig);
    } catch (error) {
      callbacks.onError(this.toError(error));
    }
  }

  private async evaluateStreamInternal(
    request: EvaluationRequest,
    callbacks: EvaluationStreamHandlers,
    modelConfig: TextModelConfig
  ): Promise<void> {
    let normalizedCompare: NormalizedCompareContext | undefined;
    if (request.type === 'compare') {
      normalizedCompare = this.normalizeCompareRequest(request);
      if (normalizedCompare.compareMode === 'structured') {
        try {
          await this.evaluateStructuredCompareStream(request, normalizedCompare, callbacks);
        } catch (error) {
          callbacks.onError(this.toError(error));
        }
        return;
      }
    }

    let template: Template;
    try {
      template = await this.getEvaluationTemplate(request.type, request.mode);
    } catch (error) {
      callbacks.onError(this.toError(error));
      return;
    }

    const context = this.buildTemplateContext(request, normalizedCompare);
    const messages = TemplateProcessor.processTemplate(template, context);
    const startTime = Date.now();

    if (this.shouldUseMultimodalEvaluation(request)) {
      try {
        const content = await this.executeMultimodalEvaluation(request, messages, modelConfig);
        callbacks.onToken(content);
        const response = this.parseEvaluationResult(
          content,
          request.type,
          this.buildResponseMetadata(
            request,
            {
              model: request.evaluationModelKey,
              timestamp: Date.now(),
              duration: Date.now() - startTime,
            },
            normalizedCompare
          )
        );
        callbacks.onComplete(response);
      } catch (error) {
        callbacks.onError(this.toError(error));
      }
      return;
    }

    let fullContent = '';
    const streamHandlers: StreamHandlers = {
      signal: callbacks.signal,
      onToken: (token) => {
        fullContent += token;
        callbacks.onToken(token);
      },
      onComplete: () => {
        const duration = Date.now() - startTime;
        try {
          const response = this.parseEvaluationResult(
            fullContent,
            request.type,
            this.buildResponseMetadata(
              request,
              {
                model: request.evaluationModelKey,
                timestamp: Date.now(),
                duration,
              },
              normalizedCompare
            )
          );
          callbacks.onComplete(response);
        } catch (error) {
          callbacks.onError(this.toError(error));
        }
      },
      onError: (error) => {
        callbacks.onError(new EvaluationExecutionError(this.formatExecutionErrorMessage(error), error));
      },
    };

    try {
      await this.llmService.sendMessageStream(messages, request.evaluationModelKey, streamHandlers);
    } catch (error) {
      callbacks.onError(
        new EvaluationExecutionError(
          this.formatExecutionErrorMessage(error),
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  /**
   * 验证评估请求
   */
  private validateRequest(request: EvaluationRequest): void {
    if (!request.evaluationModelKey?.trim()) {
      throw new EvaluationValidationError('Evaluation model key must not be empty.');
    }

    if (!request.mode) {
      throw new EvaluationValidationError('Evaluation mode configuration must not be empty.');
    }
    if (!request.mode.functionMode) {
      throw new EvaluationValidationError('Function mode must not be empty.');
    }
    if (!request.mode.subMode) {
      throw new EvaluationValidationError('Sub mode must not be empty.');
    }

    switch (request.type) {
      case 'result':
        if (!request.target?.workspacePrompt?.trim()) {
          throw new EvaluationValidationError('Workspace prompt must not be empty.');
        }
        this.validateTestCase(request.testCase, 'Result evaluation test case');
        this.validateSnapshot(request.snapshot, 'Result evaluation snapshot');
        if (request.snapshot.testCaseId !== request.testCase.id) {
          throw new EvaluationValidationError(
            'Result evaluation snapshot testCaseId must match testCase.id.'
          );
        }
        if (this.isImageText2ImageMode(request) && !this.hasSnapshotOutputMedia(request.snapshot)) {
          throw new EvaluationValidationError(
            'Image result evaluation requires at least one output image evidence item.'
          );
        }
        break;

      case 'compare':
        if (!request.target?.workspacePrompt?.trim()) {
          throw new EvaluationValidationError('Workspace prompt must not be empty.');
        }
        if (!Array.isArray(request.testCases) || request.testCases.length < 1) {
          throw new EvaluationValidationError('Compare evaluation requires at least one test case.');
        }
        if (!Array.isArray(request.snapshots) || request.snapshots.length < 2) {
          throw new EvaluationValidationError('Compare evaluation requires at least two snapshots.');
        }

        const testCaseIds = new Set<string>();
        request.testCases.forEach((testCase, index) => {
          this.validateTestCase(testCase, `Compare test case #${index + 1}`);
          if (testCaseIds.has(testCase.id)) {
            throw new EvaluationValidationError(
              `Compare test case #${index + 1} id must be unique.`
            );
          }
          testCaseIds.add(testCase.id);
        });

        request.snapshots.forEach((snapshot, index) => {
          this.validateSnapshot(snapshot, `Compare snapshot #${index + 1}`);
          if (!testCaseIds.has(snapshot.testCaseId)) {
            throw new EvaluationValidationError(
              `Compare snapshot #${index + 1} references unknown testCaseId "${snapshot.testCaseId}".`
            );
          }
        });
        if (this.isImageText2ImageMode(request)) {
          const snapshotsWithMedia = request.snapshots.filter((snapshot) =>
            this.hasSnapshotOutputMedia(snapshot)
          );
          if (snapshotsWithMedia.length < 2) {
            throw new EvaluationValidationError(
              'Image compare evaluation requires at least two snapshots with output image evidence.'
            );
          }
          if (snapshotsWithMedia.length !== request.snapshots.length) {
            throw new EvaluationValidationError(
              'Image compare evaluation requires every compared snapshot to include output image evidence.'
            );
          }
        }
        break;

      case 'prompt-only':
        if (!request.target?.workspacePrompt?.trim()) {
          throw new EvaluationValidationError('Workspace prompt must not be empty.');
        }
        break;

      case 'prompt-iterate':
        if (!request.target?.workspacePrompt?.trim()) {
          throw new EvaluationValidationError('Workspace prompt must not be empty.');
        }
        if (!request.iterateRequirement?.trim()) {
          throw new EvaluationValidationError('Iteration requirement must not be empty.');
        }
        break;

      default:
        throw new EvaluationValidationError(`Unknown evaluation type: ${(request as any).type}`);
    }
  }

  /**
   * 验证评估模型
   */
  private async validateModel(modelKey: string): Promise<TextModelConfig> {
    const model = await this.modelManager.getModel(modelKey);
    if (!model) {
      throw new EvaluationModelError(modelKey);
    }
    return model;
  }

  /**
   * 获取评估模板
   */
  private async getEvaluationTemplate(type: EvaluationType, mode: EvaluationModeConfig): Promise<Template> {
    const templateId = this.getTemplateId(type, mode);

    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template?.content) {
        throw new EvaluationTemplateError(templateId);
      }
      return template;
    } catch (error) {
      if (error instanceof EvaluationTemplateError) {
        throw error;
      }
      throw new EvaluationTemplateError(templateId);
    }
  }

  /**
   * 根据评估类型和模式获取模板ID
   */
  private getTemplateId(type: EvaluationType, mode: EvaluationModeConfig): string {
    return `evaluation-${mode.functionMode}-${mode.subMode}-${type}`;
  }

  /**
   * 构建模板上下文
   */
  private buildTemplateContext(
    request: EvaluationRequest,
    normalizedCompare?: NormalizedCompareContext
  ): TemplateContext {
    const baseContext: TemplateContext = {
      ...(request.variables || {}),
    };

    const focus = request.focus?.content?.trim() || '';
    baseContext.hasFocus = !!focus;
    baseContext.focusBrief = focus;
    // 兼容仍使用旧字段命名的模板
    baseContext.hasUserFeedback = !!focus;
    if (focus) {
      baseContext.userFeedback = focus;
    }

    switch (request.type) {
      case 'result':
        return this.buildResultTemplateContext(baseContext, request);

      case 'compare':
        return this.buildCompareTemplateContext(
          baseContext,
          request,
          normalizedCompare ?? this.normalizeCompareRequest(request)
        );

      case 'prompt-only':
        return {
          ...baseContext,
          ...this.buildTargetContext(request.target),
          optimizedPrompt: request.target.workspacePrompt,
        };

      case 'prompt-iterate':
        return {
          ...baseContext,
          ...this.buildTargetContext(request.target),
          optimizedPrompt: request.target.workspacePrompt,
          iterateRequirement: request.iterateRequirement,
        };

      default:
        return baseContext;
    }
  }

  private buildResponseMetadata(
    request: EvaluationRequest,
    baseMetadata: NonNullable<EvaluationResponse['metadata']>,
    normalizedCompare?: NormalizedCompareContext
  ): NonNullable<EvaluationResponse['metadata']> {
    if (request.type !== 'compare') {
      return baseMetadata;
    }

    const compare = normalizedCompare ?? this.normalizeCompareRequest(request);

    return {
      ...baseMetadata,
      compareMode: compare.compareMode,
      ...(compare.snapshotRoles ? { snapshotRoles: compare.snapshotRoles } : {}),
    };
  }

  private isImageText2ImageMode(request: Pick<EvaluationRequest, 'mode'>): boolean {
    return request.mode.functionMode === 'image' && request.mode.subMode === 'text2image';
  }

  private shouldForceGenericCompare(
    request: Extract<EvaluationRequest, { type: 'compare' }>
  ): boolean {
    return (
      this.isImageText2ImageMode(request) ||
      this.hasBasicSystemTestCaseInputMedia(request)
    );
  }

  private shouldUseMultimodalEvaluation(
    request: EvaluationRequest
  ): request is Extract<EvaluationRequest, { type: 'result' | 'compare' }> {
    if (request.type !== 'result' && request.type !== 'compare') {
      return false;
    }

    if (this.hasBasicSystemTestCaseInputMedia(request)) {
      return true;
    }

    if (!this.isImageText2ImageMode(request)) {
      return false;
    }

    if (request.type === 'result') {
      return this.hasSnapshotOutputMedia(request.snapshot);
    }

    if (request.type === 'compare') {
      return request.snapshots.some((snapshot) => this.hasSnapshotOutputMedia(snapshot));
    }

    return false;
  }

  private async executeMultimodalEvaluation(
    request: Extract<EvaluationRequest, { type: 'result' | 'compare' }>,
    messages: Message[],
    modelConfig: TextModelConfig
  ): Promise<string> {
    if (!this.imageUnderstandingService) {
      throw new EvaluationExecutionError(
        'Image understanding service is not available for multimodal evaluation.'
      );
    }

    const { systemPrompt, userPrompt } = this.splitEvaluationMessages(messages);
    const resolvedMedia = await this.resolveEvaluationMedia(request);
    const manifest = this.buildImageEvidenceManifest(resolvedMedia);

    const result = await this.imageUnderstandingService.understand({
      modelConfig,
      systemPrompt,
      userPrompt: `${userPrompt}\n\n${manifest}`.trim(),
      images: resolvedMedia.map((item) => ({
        b64: item.b64,
        mimeType: item.mimeType,
      })),
    });

    return result.content;
  }

  private splitEvaluationMessages(messages: Message[]): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();

    const userPrompt = messages
      .filter((message) => message.role !== 'system')
      .map((message) => {
        const content = message.content.trim();
        if (!content) {
          return '';
        }
        return message.role === 'user'
          ? content
          : `${message.role.toUpperCase()}:\n${content}`;
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();

    return {
      systemPrompt,
      userPrompt,
    };
  }

  private async resolveEvaluationMedia(
    request: Extract<EvaluationRequest, { type: 'result' | 'compare' }>
  ): Promise<ResolvedEvaluationMedia[]> {
    const testCaseLabelMap =
      request.type === 'compare'
        ? new Map(request.testCases.map((testCase) => [testCase.id.trim(), testCase.label?.trim() || '']))
        : new Map([[request.testCase.id.trim(), request.testCase.label?.trim() || '']]);

    const resolvedMedia: ResolvedEvaluationMedia[] = [];

    if (this.isBasicSystemMode(request)) {
      const inputMediaKeys = new Set<string>();
      const testCases = request.type === 'compare' ? request.testCases : [request.testCase];

      for (const testCase of testCases) {
        const block = testCase.input;
        if (!block.media?.length) {
          continue;
        }

        for (const mediaItem of block.media) {
          const identity = this.buildEvaluationMediaIdentity(mediaItem);
          if (inputMediaKeys.has(identity)) {
            continue;
          }
          inputMediaKeys.add(identity);

          const media = await this.resolveEvaluationMediaItem(mediaItem);
          resolvedMedia.push({
            label: mediaItem.label.trim(),
            role: 'test-case-input-image',
            blockLabel: block.label.trim(),
            testCaseLabel: testCase.label?.trim() || testCase.id.trim(),
            description: block.content.trim(),
            b64: media.b64,
            mimeType: media.mimeType,
          });
        }
      }
    }

    const snapshots = request.type === 'compare'
      ? request.snapshots.filter((snapshot) => this.hasSnapshotOutputMedia(snapshot))
      : [request.snapshot];

    for (const snapshot of snapshots) {
      const block = snapshot.outputBlock;
      if (!block?.media?.length) {
        continue;
      }

      for (const mediaItem of block.media) {
        const media = await this.resolveEvaluationMediaItem(mediaItem);
        resolvedMedia.push({
          label: mediaItem.label.trim(),
          role: request.type === 'compare' ? 'compare-output-image' : 'result-output-image',
          snapshotId: snapshot.id.trim(),
          snapshotLabel: snapshot.label.trim(),
          blockLabel: block.label.trim(),
          promptRefKind: snapshot.promptRef.kind,
          testCaseLabel:
            testCaseLabelMap.get(snapshot.testCaseId.trim()) ||
            snapshot.testCaseId.trim(),
          description: block.content?.trim() || snapshot.output.trim(),
          b64: media.b64,
          mimeType: media.mimeType,
        });
      }
    }

    if (!resolvedMedia.length) {
      throw new EvaluationExecutionError('No valid image evidence could be resolved for evaluation.');
    }

    return resolvedMedia;
  }

  private async resolveEvaluationMediaItem(
    mediaItem: EvaluationMediaItem
  ): Promise<{ b64: string; mimeType?: string }> {
    const label = mediaItem.label?.trim() || 'image';
    const inlineB64 = mediaItem.b64?.trim() || '';
    const assetId = mediaItem.assetId?.trim() || '';

    if (inlineB64) {
      return {
        b64: inlineB64,
        mimeType: mediaItem.mimeType?.trim() || 'image/png',
      };
    }

    if (!assetId) {
      throw new EvaluationExecutionError(
        `Evaluation image evidence "${label}" is missing both assetId and b64 data.`
      );
    }

    if (!this.imageStorageService) {
      throw new EvaluationExecutionError(
        `Image storage service is required to resolve evaluation image asset "${assetId}".`
      );
    }

    const storedImage = await this.imageStorageService.getImage(assetId);
    if (!storedImage?.data?.trim()) {
      throw new EvaluationExecutionError(
        `Failed to resolve evaluation image asset "${assetId}".`
      );
    }

    return {
      b64: storedImage.data,
      mimeType: mediaItem.mimeType?.trim() || storedImage.metadata?.mimeType || 'image/png',
    };
  }

  private buildEvaluationMediaIdentity(mediaItem: EvaluationMediaItem): string {
    const assetId = mediaItem.assetId?.trim() || '';
    if (assetId) {
      return `asset:${assetId}`;
    }

    return `inline:${mediaItem.mimeType?.trim() || 'image/png'}:${mediaItem.b64?.trim() || ''}`;
  }

  private buildImageEvidenceManifest(mediaItems: ResolvedEvaluationMedia[]): string {
    const lines = [
      '## Image Evidence Manifest',
      'Use the attached images in the exact order listed below when grounding the evaluation.',
    ];

    mediaItems.forEach((item, index) => {
      if (item.snapshotId) {
        lines.push(
          `${index + 1}. role=${item.role}; snapshot=${item.snapshotLabel} (${item.snapshotId}); testCase=${item.testCaseLabel}; promptRef=${item.promptRefKind}; block=${item.blockLabel}; media=${item.label}; description=${item.description}`
        );
        return;
      }

      lines.push(
        `${index + 1}. role=${item.role}; testCase=${item.testCaseLabel}; block=${item.blockLabel}; media=${item.label}; description=${item.description}`
      );
    });

    return lines.join('\n');
  }

  private normalizeStructuredCompareRole(value: unknown): StructuredCompareRole | undefined {
    switch (value) {
      case 'target':
      case 'baseline':
      case 'reference':
      case 'referenceBaseline':
      case 'replica':
      case 'auxiliary':
        return value;
      default:
        return undefined;
    }
  }

  private normalizeSnapshotRoles(
    snapshotRoles: Record<string, unknown> | undefined,
    snapshots?: EvaluationSnapshot[]
  ): Record<string, StructuredCompareRole> | undefined {
    if (!snapshotRoles || typeof snapshotRoles !== 'object') {
      return undefined;
    }

    const validSnapshotIds =
      Array.isArray(snapshots) && snapshots.length > 0
        ? new Set(snapshots.map((snapshot) => snapshot.id.trim()).filter(Boolean))
        : null;
    const normalizedEntries = Object.entries(snapshotRoles)
      .map(([snapshotId, role]) => {
        const normalizedId = snapshotId.trim();
        const normalizedRole = this.normalizeStructuredCompareRole(role);
        if (
          !normalizedId ||
          !normalizedRole ||
          (validSnapshotIds && !validSnapshotIds.has(normalizedId))
        ) {
          return null;
        }
        return [normalizedId, normalizedRole] as const;
      })
      .filter((entry): entry is readonly [string, StructuredCompareRole] => !!entry);

    return normalizedEntries.length
      ? Object.fromEntries(normalizedEntries)
      : undefined;
  }

  private hasStructuredSingletonRoleConflicts(
    snapshotRoles: Record<string, StructuredCompareRole> | undefined
  ): boolean {
    if (!snapshotRoles) {
      return false;
    }

    const singletonRoleCounts = Object.values(snapshotRoles).reduce(
      (accumulator, role) => {
        if (
          role === 'target' ||
          role === 'baseline' ||
          role === 'reference' ||
          role === 'referenceBaseline'
        ) {
          accumulator[role] += 1;
        }
        return accumulator;
      },
      {
        target: 0,
        baseline: 0,
        reference: 0,
        referenceBaseline: 0,
      } as Record<'target' | 'baseline' | 'reference' | 'referenceBaseline', number>
    );

    return Object.values(singletonRoleCounts).some((count) => count > 1);
  }

  private normalizeCompareStopSignals(value: unknown): CompareStopSignals | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const normalized = value as Record<string, unknown>;
    const stopReasons = Array.isArray(normalized.stopReasons)
      ? normalized.stopReasons
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      : undefined;

    const compareStopSignals: CompareStopSignals = {
      targetVsBaseline:
        normalized.targetVsBaseline === 'improved' ||
        normalized.targetVsBaseline === 'flat' ||
        normalized.targetVsBaseline === 'regressed'
          ? normalized.targetVsBaseline
          : undefined,
      targetVsReferenceGap:
        normalized.targetVsReferenceGap === 'none' ||
        normalized.targetVsReferenceGap === 'minor' ||
        normalized.targetVsReferenceGap === 'major'
          ? normalized.targetVsReferenceGap
          : undefined,
      improvementHeadroom:
        normalized.improvementHeadroom === 'none' ||
        normalized.improvementHeadroom === 'low' ||
        normalized.improvementHeadroom === 'medium' ||
        normalized.improvementHeadroom === 'high'
          ? normalized.improvementHeadroom
          : undefined,
      overfitRisk:
        normalized.overfitRisk === 'low' ||
        normalized.overfitRisk === 'medium' ||
        normalized.overfitRisk === 'high'
          ? normalized.overfitRisk
          : undefined,
      stopRecommendation:
        normalized.stopRecommendation === 'continue' ||
        normalized.stopRecommendation === 'stop' ||
        normalized.stopRecommendation === 'review'
          ? normalized.stopRecommendation
          : undefined,
      stopReasons: stopReasons?.length ? stopReasons : undefined,
    };

    return Object.values(compareStopSignals).some((item) =>
      Array.isArray(item) ? item.length > 0 : item !== undefined
    )
      ? compareStopSignals
      : undefined;
  }

  private normalizeCompareJudgements(value: unknown): CompareJudgement[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const judgements = value
      .map<CompareJudgement | null>((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const pairKey = String(record.pairKey || '').trim();
        const pairLabel = String(record.pairLabel || pairKey).trim();
        const leftSnapshotId = String(record.leftSnapshotId || '').trim();
        const leftSnapshotLabel = String(record.leftSnapshotLabel || leftSnapshotId).trim();
        const rightSnapshotId = String(record.rightSnapshotId || '').trim();
        const rightSnapshotLabel = String(record.rightSnapshotLabel || rightSnapshotId).trim();

        if (
          !pairKey ||
          !pairLabel ||
          !leftSnapshotId ||
          !leftSnapshotLabel ||
          !rightSnapshotId ||
          !rightSnapshotLabel
        ) {
          return null;
        }

        const pairType =
          record.pairType === 'targetBaseline' ||
          record.pairType === 'targetReference' ||
          record.pairType === 'referenceBaseline' ||
          record.pairType === 'targetReplica'
            ? record.pairType
            : null;
        if (!pairType) {
          return null;
        }

        const verdict =
          record.verdict === 'left-better' ||
          record.verdict === 'right-better' ||
          record.verdict === 'mixed' ||
          record.verdict === 'similar'
            ? record.verdict
            : 'mixed';
        const winner =
          record.winner === 'left' || record.winner === 'right' || record.winner === 'none'
            ? record.winner
            : 'none';
        const confidence =
          record.confidence === 'low' ||
          record.confidence === 'medium' ||
          record.confidence === 'high'
            ? record.confidence
            : 'low';

        const judgement: CompareJudgement = {
          pairKey,
          pairType,
          pairLabel,
          leftSnapshotId,
          leftSnapshotLabel,
          leftRole: this.normalizeStructuredCompareRole(record.leftRole),
          rightSnapshotId,
          rightSnapshotLabel,
          rightRole: this.normalizeStructuredCompareRole(record.rightRole),
          verdict,
          winner,
          confidence,
          pairSignal: String(record.pairSignal || '').trim(),
          analysis: String(record.analysis || '').trim(),
          evidence: Array.isArray(record.evidence)
            ? record.evidence
                .map((entry) => String(entry || '').trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
          learnableSignals: Array.isArray(record.learnableSignals)
            ? record.learnableSignals
                .map((entry) => String(entry || '').trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
          overfitWarnings: Array.isArray(record.overfitWarnings)
            ? record.overfitWarnings
                .map((entry) => String(entry || '').trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
        };

        return judgement;
      })
      .filter((item): item is CompareJudgement => item !== null);

    return judgements.length ? judgements : undefined;
  }

  private buildCompareInsights(compareJudgements: CompareJudgement[] | undefined): CompareInsights | undefined {
    if (!compareJudgements?.length) {
      return undefined;
    }

    const sortedJudgements = [...compareJudgements].sort((left, right) => {
      const pairPriority =
        this.getCompareJudgementPairPriority(left.pairType) -
        this.getCompareJudgementPairPriority(right.pairType);
      if (pairPriority !== 0) {
        return pairPriority;
      }

      const confidencePriority =
        this.getCompareJudgementConfidencePriority(left.confidence) -
        this.getCompareJudgementConfidencePriority(right.confidence);
      if (confidencePriority !== 0) {
        return confidencePriority;
      }

      return left.pairLabel.localeCompare(right.pairLabel);
    });

    const pairHighlights: CompareInsightHighlight[] = sortedJudgements.slice(0, 4).map((judgement) => ({
      pairKey: judgement.pairKey,
      pairType: judgement.pairType,
      pairLabel: judgement.pairLabel,
      pairSignal: judgement.pairSignal,
      verdict: judgement.verdict,
      confidence: judgement.confidence,
      analysis: judgement.analysis.trim(),
    }));
    const progressSummary = sortedJudgements.find((judgement) => judgement.pairType === 'targetBaseline');
    const referenceGapSummary = sortedJudgements.find((judgement) => judgement.pairType === 'targetReference');
    const promptChangeSummary = sortedJudgements.find((judgement) => judgement.pairType === 'referenceBaseline');
    const stabilitySummary = sortedJudgements.find((judgement) => judgement.pairType === 'targetReplica');

    const evidenceHighlights = this.collectRankedCompareStrings(
      sortedJudgements.flatMap((judgement) => judgement.evidence),
      6
    );
    const learnableSignals = this.collectRankedCompareStrings(
      sortedJudgements.flatMap((judgement) => judgement.learnableSignals),
      6
    );
    const overfitWarnings = this.collectRankedCompareStrings(
      sortedJudgements.flatMap((judgement) => judgement.overfitWarnings),
      6
    );
    const conflictSignals = this.buildCompareConflictSignals(sortedJudgements);

    return {
      pairHighlights,
      ...(progressSummary ? { progressSummary: this.toCompareInsightHighlight(progressSummary) } : {}),
      ...(referenceGapSummary ? { referenceGapSummary: this.toCompareInsightHighlight(referenceGapSummary) } : {}),
      ...(promptChangeSummary ? { promptChangeSummary: this.toCompareInsightHighlight(promptChangeSummary) } : {}),
      ...(stabilitySummary ? { stabilitySummary: this.toCompareInsightHighlight(stabilitySummary) } : {}),
      ...(evidenceHighlights.length ? { evidenceHighlights } : {}),
      ...(learnableSignals.length ? { learnableSignals } : {}),
      ...(overfitWarnings.length ? { overfitWarnings } : {}),
      ...(conflictSignals.length ? { conflictSignals } : {}),
    };
  }

  private buildCompareConflictSignals(
    compareJudgements: CompareJudgement[] | undefined
  ): CompareConflictSignal[] {
    if (!compareJudgements?.length) {
      return [];
    }

    const signalSnapshot = this.summarizeStructuredCompareJudgeSignals(compareJudgements);
    const hasOverfitWarnings = compareJudgements.some((item) => item.overfitWarnings.length > 0);
    const conflictSignals: CompareConflictSignal[] = [];

    if (
      signalSnapshot.progress === 'improved' &&
      signalSnapshot.promptValidity === 'unsupported'
    ) {
      conflictSignals.push('improvementNotSupportedOnReference');
    }

    if (
      signalSnapshot.progress === 'improved' &&
      signalSnapshot.stability === 'unstable'
    ) {
      conflictSignals.push('improvementUnstableAcrossReplicas');
    }

    if (signalSnapshot.progress === 'regressed') {
      conflictSignals.push('regressionOutweighsCosmeticGains');
    }

    if (hasOverfitWarnings) {
      conflictSignals.push('sampleOverfitRiskVisible');
    }

    return Array.from(new Set(conflictSignals));
  }

  private renderCompareConflictSignal(
    signal: CompareConflictSignal,
    language: ComparePromptLanguage
  ): string {
    return renderStructuredCompareConflictCopy(signal, language);
  }

  private toCompareInsightHighlight(judgement: CompareJudgement): CompareInsightHighlight {
    return {
      pairKey: judgement.pairKey,
      pairType: judgement.pairType,
      pairLabel: judgement.pairLabel,
      pairSignal: judgement.pairSignal,
      verdict: judgement.verdict,
      confidence: judgement.confidence,
      analysis: judgement.analysis.trim(),
    };
  }

  private getCompareJudgementPairPriority(pairType: CompareJudgementPairType): number {
    switch (pairType) {
      case 'targetBaseline':
        return 0;
      case 'targetReference':
        return 1;
      case 'referenceBaseline':
        return 2;
      case 'targetReplica':
        return 3;
      default:
        return 99;
    }
  }

  private getCompareJudgementConfidencePriority(confidence: CompareJudgement['confidence']): number {
    switch (confidence) {
      case 'high':
        return 0;
      case 'medium':
        return 1;
      case 'low':
      default:
        return 2;
    }
  }

  private collectRankedCompareStrings(values: string[], limit: number): string[] {
    const ranked = new Map<string, { text: string; count: number; firstIndex: number }>();

    values.forEach((value, index) => {
      const normalizedText = String(value || '').trim().replace(/\s+/g, ' ');
      if (!normalizedText) {
        return;
      }

      const key = normalizedText.toLowerCase();
      const current = ranked.get(key);
      if (current) {
        current.count += 1;
        return;
      }

      ranked.set(key, {
        text: normalizedText,
        count: 1,
        firstIndex: index,
      });
    });

    return Array.from(ranked.values())
      .sort((left, right) => right.count - left.count || left.firstIndex - right.firstIndex)
      .slice(0, limit)
      .map((item) => item.text);
  }

  private summarizeStructuredCompareJudgeSignals(
    judgeResults: CompareJudgement[] | undefined
  ): StructuredCompareSignalSnapshot {
    if (!judgeResults?.length) {
      return {};
    }

    const progressJudge = judgeResults.find((item) => item.pairType === 'targetBaseline');
    const gapJudge = judgeResults.find((item) => item.pairType === 'targetReference');
    const promptValidityJudge = judgeResults.find((item) => item.pairType === 'referenceBaseline');
    const stabilityJudges = judgeResults.filter((item) => item.pairType === 'targetReplica');

    const stability = (() => {
      if (!stabilityJudges.length) {
        return undefined;
      }
      if (stabilityJudges.some((item) => item.pairSignal === 'unstable')) {
        return 'unstable' as const;
      }
      if (stabilityJudges.every((item) => item.pairSignal === 'stable')) {
        return 'stable' as const;
      }
      return 'unclear' as const;
    })();

    return {
      progress:
        progressJudge?.pairSignal === 'improved' ||
        progressJudge?.pairSignal === 'flat' ||
        progressJudge?.pairSignal === 'regressed' ||
        progressJudge?.pairSignal === 'unclear'
          ? progressJudge.pairSignal
          : undefined,
      gap:
        gapJudge?.pairSignal === 'none' ||
        gapJudge?.pairSignal === 'minor' ||
        gapJudge?.pairSignal === 'major' ||
        gapJudge?.pairSignal === 'unclear'
          ? gapJudge.pairSignal
          : undefined,
      promptValidity:
        promptValidityJudge?.pairSignal === 'supported' ||
        promptValidityJudge?.pairSignal === 'mixed' ||
        promptValidityJudge?.pairSignal === 'unsupported' ||
        promptValidityJudge?.pairSignal === 'unclear'
          ? promptValidityJudge.pairSignal
          : undefined,
      stability,
    };
  }

  private deriveCompareStopSignalsFromJudgements(
    judgeResults: CompareJudgement[] | undefined
  ): CompareStopSignals | undefined {
    if (!judgeResults?.length) {
      return undefined;
    }

    const signalSnapshot = this.summarizeStructuredCompareJudgeSignals(judgeResults);
    const hasOverfitWarnings = judgeResults.some((item) => item.overfitWarnings.length > 0);
    const hasExplicitLowOverfitEvidence =
      !hasOverfitWarnings &&
      signalSnapshot.promptValidity === 'supported' &&
      signalSnapshot.stability === 'stable';

    const overfitRisk: CompareStopSignals['overfitRisk'] = (() => {
      if (signalSnapshot.promptValidity === 'unsupported') {
        return 'high';
      }
      if (signalSnapshot.stability === 'unstable' && hasOverfitWarnings) {
        return 'high';
      }
      if (
        signalSnapshot.promptValidity === 'mixed' ||
        signalSnapshot.stability === 'unstable' ||
        hasOverfitWarnings
      ) {
        return 'medium';
      }
      if (hasExplicitLowOverfitEvidence) {
        return 'low';
      }
      return undefined;
    })();

    const improvementHeadroom: CompareStopSignals['improvementHeadroom'] = (() => {
      if (signalSnapshot.progress === 'regressed') {
        return 'high';
      }
      if (signalSnapshot.gap === 'major') {
        return 'high';
      }
      if (signalSnapshot.gap === 'minor') {
        return 'medium';
      }
      if (signalSnapshot.progress === 'flat') {
        return signalSnapshot.gap === 'none' && overfitRisk === 'low'
          ? 'low'
          : 'medium';
      }
      if (
        signalSnapshot.progress === 'improved' &&
        signalSnapshot.gap === 'none' &&
        overfitRisk === 'low' &&
        signalSnapshot.promptValidity !== 'unsupported' &&
        signalSnapshot.stability !== 'unstable'
      ) {
        return 'low';
      }
      return undefined;
    })();

    const stopRecommendation: CompareStopSignals['stopRecommendation'] = (() => {
      if (signalSnapshot.progress === 'regressed' || overfitRisk === 'high') {
        return 'review';
      }
      if (
        (signalSnapshot.progress === 'improved' || signalSnapshot.progress === 'flat') &&
        signalSnapshot.gap === 'none' &&
        improvementHeadroom === 'low' &&
        overfitRisk === 'low' &&
        signalSnapshot.promptValidity !== 'unsupported' &&
        signalSnapshot.stability !== 'unstable'
      ) {
        return 'stop';
      }
      if (
        improvementHeadroom === 'medium' ||
        improvementHeadroom === 'high' ||
        signalSnapshot.gap === 'minor' ||
        signalSnapshot.gap === 'major'
      ) {
        return 'continue';
      }
      return undefined;
    })();

    const stopReasons = this.collectRankedCompareStrings(
      [
        signalSnapshot.progress === 'regressed'
          ? 'target regressed vs baseline'
          : undefined,
        signalSnapshot.gap === 'major'
          ? 'major learnable gap remains vs reference'
          : signalSnapshot.gap === 'minor'
            ? 'minor learnable gap remains vs reference'
            : undefined,
        signalSnapshot.promptValidity === 'unsupported'
          ? 'reference-side evidence does not support the prompt change'
          : signalSnapshot.promptValidity === 'mixed'
            ? 'reference-side evidence is mixed'
            : undefined,
        signalSnapshot.stability === 'unstable'
          ? 'replica evidence suggests unstable behavior'
          : undefined,
        hasOverfitWarnings
          ? 'pairwise judges flagged possible sample overfit'
          : undefined,
        stopRecommendation === 'stop'
          ? 'little evidence for additional broad gains'
          : undefined,
      ].filter((item): item is string => !!item),
      4
    );

    const stopSignals: CompareStopSignals = {
      targetVsBaseline:
        signalSnapshot.progress && signalSnapshot.progress !== 'unclear'
          ? signalSnapshot.progress
          : undefined,
      targetVsReferenceGap:
        signalSnapshot.gap && signalSnapshot.gap !== 'unclear'
          ? signalSnapshot.gap
          : undefined,
      improvementHeadroom,
      overfitRisk,
      stopRecommendation,
      stopReasons: stopReasons.length ? stopReasons : undefined,
    };

    return Object.values(stopSignals).some((item) =>
      Array.isArray(item) ? item.length > 0 : item !== undefined
    )
      ? stopSignals
      : undefined;
  }

  private mergeCompareStopSignals(
    primary: CompareStopSignals | undefined,
    fallback: CompareStopSignals | undefined
  ): CompareStopSignals | undefined {
    if (!primary) {
      return fallback;
    }
    if (!fallback) {
      return primary;
    }

    const merged: CompareStopSignals = {
      targetVsBaseline: this.pickConservativeCompareTargetProgress(
        primary.targetVsBaseline,
        fallback.targetVsBaseline
      ),
      targetVsReferenceGap: this.pickConservativeCompareReferenceGap(
        primary.targetVsReferenceGap,
        fallback.targetVsReferenceGap
      ),
      improvementHeadroom: this.pickConservativeCompareHeadroom(
        primary.improvementHeadroom,
        fallback.improvementHeadroom
      ),
      overfitRisk: this.pickConservativeCompareOverfitRisk(
        primary.overfitRisk,
        fallback.overfitRisk
      ),
      stopRecommendation: this.pickConservativeCompareStopRecommendation(
        primary.stopRecommendation,
        fallback.stopRecommendation
      ),
      stopReasons: this.mergeCompareStopReasons(primary.stopReasons, fallback.stopReasons),
    };

    return Object.values(merged).some((item) =>
      Array.isArray(item) ? item.length > 0 : item !== undefined
    )
      ? merged
      : undefined;
  }

  private pickConservativeCompareTargetProgress(
    left: CompareStopSignals['targetVsBaseline'],
    right: CompareStopSignals['targetVsBaseline']
  ): CompareStopSignals['targetVsBaseline'] {
    const severity: Record<NonNullable<CompareStopSignals['targetVsBaseline']>, number> = {
      improved: 0,
      flat: 1,
      regressed: 2,
    };

    return this.pickConservativeEnumValue(left, right, severity);
  }

  private pickConservativeCompareReferenceGap(
    left: CompareStopSignals['targetVsReferenceGap'],
    right: CompareStopSignals['targetVsReferenceGap']
  ): CompareStopSignals['targetVsReferenceGap'] {
    const severity: Record<NonNullable<CompareStopSignals['targetVsReferenceGap']>, number> = {
      none: 0,
      minor: 1,
      major: 2,
    };

    return this.pickConservativeEnumValue(left, right, severity);
  }

  private pickConservativeCompareHeadroom(
    left: CompareStopSignals['improvementHeadroom'],
    right: CompareStopSignals['improvementHeadroom']
  ): CompareStopSignals['improvementHeadroom'] {
    const severity: Record<NonNullable<CompareStopSignals['improvementHeadroom']>, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
    };

    return this.pickConservativeEnumValue(left, right, severity);
  }

  private pickConservativeCompareOverfitRisk(
    left: CompareStopSignals['overfitRisk'],
    right: CompareStopSignals['overfitRisk']
  ): CompareStopSignals['overfitRisk'] {
    const severity: Record<NonNullable<CompareStopSignals['overfitRisk']>, number> = {
      low: 0,
      medium: 1,
      high: 2,
    };

    return this.pickConservativeEnumValue(left, right, severity);
  }

  private pickConservativeCompareStopRecommendation(
    left: CompareStopSignals['stopRecommendation'],
    right: CompareStopSignals['stopRecommendation']
  ): CompareStopSignals['stopRecommendation'] {
    const severity: Record<NonNullable<CompareStopSignals['stopRecommendation']>, number> = {
      stop: 0,
      continue: 1,
      review: 2,
    };

    return this.pickConservativeEnumValue(left, right, severity);
  }

  private pickConservativeEnumValue<T extends string>(
    left: T | undefined,
    right: T | undefined,
    severity: Record<T, number>
  ): T | undefined {
    if (!left) {
      return right;
    }
    if (!right) {
      return left;
    }

    return severity[left] >= severity[right] ? left : right;
  }

  private mergeCompareStopReasons(
    primary: CompareStopSignals['stopReasons'],
    fallback: CompareStopSignals['stopReasons']
  ): CompareStopSignals['stopReasons'] {
    const mergedReasons = this.collectRankedCompareStrings(
      [...(primary || []), ...(fallback || [])],
      4
    );

    return mergedReasons.length ? mergedReasons : undefined;
  }

  private hasBlockMedia(block: EvaluationContentBlock | null | undefined): boolean {
    return Array.isArray(block?.media) && block.media.some((item) => this.hasMediaPayload(item));
  }

  private isBasicSystemMode(request: Pick<EvaluationRequest, 'mode'>): boolean {
    return request.mode.functionMode === 'basic' && request.mode.subMode === 'system';
  }

  private hasBasicSystemTestCaseInputMedia(request: EvaluationRequest): boolean {
    if (!this.isBasicSystemMode(request)) {
      return false;
    }

    if (request.type === 'result') {
      return this.hasBlockMedia(request.testCase.input);
    }

    if (request.type === 'compare') {
      return request.testCases.some((testCase) => this.hasBlockMedia(testCase.input));
    }

    return false;
  }

  private hasSnapshotOutputMedia(snapshot: EvaluationSnapshot | null | undefined): boolean {
    return this.hasBlockMedia(snapshot?.outputBlock);
  }

  private hasMediaPayload(mediaItem: EvaluationMediaItem | null | undefined): boolean {
    const assetId = mediaItem?.assetId?.trim() || '';
    const b64 = mediaItem?.b64?.trim() || '';
    return !!assetId || !!b64;
  }

  private validateMediaItems(mediaItems: EvaluationMediaItem[], label: string): void {
    mediaItems.forEach((item, index) => {
      const itemLabel = item?.label?.trim() || '';
      const assetId = item?.assetId?.trim() || '';
      const b64 = item?.b64?.trim() || '';

      if (!itemLabel) {
        throw new EvaluationValidationError(`${label} #${index + 1} label must not be empty.`);
      }

      if (!assetId && !b64) {
        throw new EvaluationValidationError(
          `${label} #${index + 1} must provide either assetId or b64.`
        );
      }

      if (assetId && b64) {
        throw new EvaluationValidationError(
          `${label} #${index + 1} must not provide both assetId and b64.`
        );
      }
    });
  }

  private validateContentBlock(
    block: EvaluationContentBlock | undefined,
    label: string
  ): void {
    if (!block) {
      throw new EvaluationValidationError(`${label} must not be empty.`);
    }
    if (!block.label?.trim()) {
      throw new EvaluationValidationError(`${label} label must not be empty.`);
    }
    const hasContent = !!block.content?.trim();
    const hasMedia = this.hasBlockMedia(block);
    if (!hasContent && !hasMedia) {
      throw new EvaluationValidationError(`${label} content must not be empty.`);
    }
    if (block.media) {
      this.validateMediaItems(block.media, `${label} media`);
    }
  }

  private validateTestCase(testCase: EvaluationTestCase | undefined, label: string): void {
    if (!testCase?.id?.trim()) {
      throw new EvaluationValidationError(`${label} id must not be empty.`);
    }
    this.validateContentBlock(testCase.input, `${label} input`);
  }

  private validateSnapshot(snapshot: EvaluationSnapshot | undefined, label: string): void {
    if (!snapshot?.id?.trim()) {
      throw new EvaluationValidationError(`${label} id must not be empty.`);
    }
    if (!snapshot?.label?.trim()) {
      throw new EvaluationValidationError(`${label} label must not be empty.`);
    }
    if (!snapshot?.testCaseId?.trim()) {
      throw new EvaluationValidationError(`${label} testCaseId must not be empty.`);
    }
    if (!snapshot?.promptText?.trim()) {
      throw new EvaluationValidationError(`${label} promptText must not be empty.`);
    }
    if (!snapshot?.output?.trim()) {
      throw new EvaluationValidationError(`${label} output must not be empty.`);
    }
    if (!snapshot?.promptRef?.kind) {
      throw new EvaluationValidationError(`${label} promptRef.kind must not be empty.`);
    }
    if (snapshot.executionInput) {
      this.validateContentBlock(snapshot.executionInput, `${label} executionInput`);
    }
    if (snapshot.outputBlock) {
      this.validateContentBlock(snapshot.outputBlock, `${label} outputBlock`);
    }
  }

  private normalizeContentBlock(block?: EvaluationContentBlock): NormalizedContentBlock | undefined {
    const label = block?.label?.trim() || '';
    const content = block?.content?.trim() || '';
    if (!label || (!content && !this.hasBlockMedia(block))) {
      return undefined;
    }

    const summary = block?.summary?.trim() || '';
    return {
      kind: block?.kind || 'custom',
      label,
      content,
      summary,
      hasSummary: !!summary,
    };
  }

  private buildTargetContext(target: {
    workspacePrompt: string;
    referencePrompt?: string;
    designContext?: EvaluationContentBlock;
  }): TemplateContext {
    const workspacePrompt = target?.workspacePrompt?.trim() || '';
    const referencePrompt = target?.referencePrompt?.trim() || '';
    const designContext = this.normalizeContentBlock(target?.designContext);

    return {
      workspacePrompt,
      hasWorkspacePrompt: !!workspacePrompt,
      currentWorkspacePrompt: workspacePrompt,
      referencePrompt,
      hasReferencePrompt: !!referencePrompt,
      originalPrompt: referencePrompt,
      hasOriginalPrompt: !!referencePrompt,
      hasDesignContext: !!designContext,
      designContextKind: designContext?.kind || '',
      designContextLabel: designContext?.label || '',
      designContextContent: designContext?.content || '',
      designContextSummary: designContext?.summary || '',
      designContextJson: designContext?.content || '',
      // 兼容旧模板中的 proContext 占位
      proContext: designContext?.content || '',
    };
  }

  private normalizeTestCase(testCase: EvaluationTestCase): NormalizedEvaluationTestCase {
    const input = this.normalizeContentBlock(testCase.input)!;
    const label = testCase.label?.trim() || '';
    const settingsSummary = testCase.settingsSummary?.trim() || '';

    return {
      id: testCase.id.trim(),
      label,
      hasLabel: !!label,
      inputKind: input.kind,
      inputLabel: input.label,
      inputContent: input.content,
      inputSummary: input.summary || '',
      hasInputSummary: !!input.hasSummary,
      settingsSummary,
      hasSettingsSummary: !!settingsSummary,
    };
  }

  private normalizeSnapshot(
    snapshot: EvaluationSnapshot,
    testCase: NormalizedEvaluationTestCase | undefined,
    workspacePrompt: string,
    structuredRole?: StructuredCompareRole
  ): NormalizedEvaluationSnapshot {
    const executionInput = this.normalizeContentBlock(snapshot.executionInput);
    const executionInputLabel = (executionInput?.label || '') as string;
    const executionInputContent = (executionInput?.content || '') as string;
    const executionInputSummary = (executionInput?.summary || '') as string;
    const modelKey = snapshot.modelKey?.trim() || '';
    const versionLabel = snapshot.versionLabel?.trim() || '';
    const reasoning = snapshot.reasoning?.trim() || '';
    const promptText = snapshot.promptText.trim();
    const workspacePromptTrimmed = workspacePrompt.trim();
    const promptMatchesWorkspace = !!workspacePromptTrimmed && promptText === workspacePromptTrimmed;
    const promptRefLabel =
      snapshot.promptRef.label?.trim() ||
      (
        snapshot.promptRef.kind === 'version' && typeof snapshot.promptRef.version === 'number'
          ? `v${snapshot.promptRef.version}`
          : snapshot.promptRef.kind
      );
    const roleLabel = structuredRole
      ? ({
          target: 'Target',
          baseline: 'Baseline',
          reference: 'Reference',
          referenceBaseline: 'Reference Baseline',
          replica: 'Replica',
          auxiliary: 'Auxiliary',
        } as const)[structuredRole]
      : '';

    return {
      id: snapshot.id.trim(),
      label: snapshot.label.trim(),
      testCaseId: snapshot.testCaseId.trim(),
      testCaseLabel: (testCase?.['label'] || '') as string,
      promptText,
      promptMatchesWorkspace,
      hasDistinctPromptText: !promptMatchesWorkspace,
      promptRefKind: snapshot.promptRef.kind,
      promptRefLabel,
      role: structuredRole || '',
      roleLabel,
      hasRole: !!structuredRole,
      isTarget: structuredRole === 'target',
      isBaseline: structuredRole === 'baseline',
      isReference: structuredRole === 'reference',
      isReferenceBaseline: structuredRole === 'referenceBaseline',
      isReplica: structuredRole === 'replica',
      isAuxiliary: structuredRole === 'auxiliary',
      modelKey,
      hasModelKey: !!modelKey,
      versionLabel,
      hasVersionLabel: !!versionLabel,
      reasoning,
      hasReasoning: !!reasoning,
      output: snapshot.output.trim(),
      executionInputLabel,
      executionInputContent,
      executionInputSummary,
      hasExecutionInputSummary: !!executionInputSummary,
      hasExecutionInput: !!executionInputContent,
      // 兼容旧模板字段，但不再回填公共测试输入，避免重复证据
      inputLabel: executionInputLabel,
      inputContent: executionInputContent,
      inputSummary: executionInputSummary,
      hasInputSummary: !!executionInputSummary,
      hasInput: !!executionInputContent,
    };
  }

  private buildResultTemplateContext(
    baseContext: TemplateContext,
    request: Extract<EvaluationRequest, { type: 'result' }>
  ): TemplateContext {
    const targetContext = this.buildTargetContext(request.target);
    const testCase = this.normalizeTestCase(request.testCase);
    const snapshot = this.normalizeSnapshot(
      request.snapshot,
      testCase,
      request.target.workspacePrompt
    );

    return {
      ...baseContext,
      ...targetContext,
      evaluationTestCase: testCase,
      testCaseLabel: testCase.label,
      hasTestCaseLabel: testCase.hasLabel,
      testCaseInputLabel: testCase.inputLabel,
      testCaseInputContent: testCase.inputContent,
      testCaseInputSummary: testCase.inputSummary,
      hasTestCaseInputSummary: testCase.hasInputSummary,
      evaluationSnapshot: snapshot,
      hasEditableWorkspaceTarget:
        snapshot.promptRefKind === 'workspace' && snapshot.promptMatchesWorkspace,
      prompt: snapshot.promptText,
      testContent: testCase.inputContent,
      testResult: snapshot.output,
      resultLabel: snapshot.label,
      hasResultLabel: !!snapshot.label,
    };
  }

  private buildCompareTemplateContext(
    baseContext: TemplateContext,
    request: Extract<EvaluationRequest, { type: 'compare' }>,
    normalizedCompare: NormalizedCompareContext
  ): TemplateContext {
    const targetContext = this.buildTargetContext(request.target);

    return {
      ...baseContext,
      ...targetContext,
      compareMode: normalizedCompare.compareMode,
      hasStructuredCompare: normalizedCompare.compareMode === 'structured',
      hasCompareRoleBindings: normalizedCompare.compareRoleBindings.length > 0,
      compareRoleBindings: normalizedCompare.compareRoleBindings,
      compareTestCaseCount: normalizedCompare.renderedTestCases.length,
      hasCompareTestCases: normalizedCompare.renderedTestCases.length > 0,
      compareTestCases: normalizedCompare.renderedTestCases,
      hasSharedCompareInputs: normalizedCompare.sharedCompareInputs,
      sharedTestCaseCount: normalizedCompare.renderedTestCases.length,
      hasSharedTestCases:
        normalizedCompare.sharedCompareInputs && normalizedCompare.renderedTestCases.length > 0,
      sharedTestCases: normalizedCompare.renderedTestCases,
      compareSnapshotCount: normalizedCompare.normalizedSnapshots.length,
      compareSnapshots: normalizedCompare.normalizedSnapshots,
      hasCrossModelComparison: normalizedCompare.crossModelComparison,
      hasEditableWorkspaceTarget: normalizedCompare.hasEditableWorkspaceTarget,
      compareHints: {
        mode: normalizedCompare.compareMode,
        snapshotRoles: normalizedCompare.snapshotRoles,
        hasSharedTestCases: normalizedCompare.sharedCompareInputs,
        hasSamePromptSnapshots: normalizedCompare.samePromptAcrossSnapshots,
        hasCrossModelComparison: normalizedCompare.crossModelComparison,
      },
      // 兼容旧 compare 模板字段
      compareVariantCount: normalizedCompare.normalizedSnapshots.length,
      compareVariants: normalizedCompare.normalizedSnapshots.map((snapshot) => ({
        id: snapshot.id,
        label: snapshot.label,
        prompt: snapshot.promptText,
        output: snapshot.output,
        reasoning: snapshot.reasoning,
        hasReasoning: snapshot.hasReasoning,
        modelKey: snapshot.modelKey,
        hasModelKey: snapshot.hasModelKey,
        versionLabel: snapshot.versionLabel,
        hasVersionLabel: snapshot.hasVersionLabel,
        promptMatchesWorkspace: snapshot.promptMatchesWorkspace,
        hasDistinctPromptText: snapshot.hasDistinctPromptText,
        hasInput: !!snapshot.inputContent,
        inputLabel: snapshot.inputLabel,
        inputContent: snapshot.inputContent,
        inputSummary: snapshot.inputSummary,
        hasInputSummary: snapshot.hasInputSummary,
      })),
    };
  }

  private normalizeCompareRequest(
    request: Extract<EvaluationRequest, { type: 'compare' }>
  ): NormalizedCompareContext {
    const normalizedTestCases = request.testCases.map((testCase) => this.normalizeTestCase(testCase));
    const renderedTestCases = Array.from(
      normalizedTestCases.reduce((map, testCase) => {
        const evidenceKey = this.buildCompareTestCaseEvidenceKey(testCase);
        if (!map.has(evidenceKey)) {
          map.set(evidenceKey, testCase);
        }
        return map;
      }, new Map<string, NormalizedEvaluationTestCase>()).values()
    );
    const testCaseMap = new Map(normalizedTestCases.map((testCase) => [testCase.id, testCase]));
    const rawSnapshotRoles = this.normalizeSnapshotRoles(
      request.compareHints?.snapshotRoles,
      request.snapshots
    );
    const snapshotsWithRoles = request.snapshots.map((snapshot) =>
      this.normalizeSnapshot(
        snapshot,
        testCaseMap.get(snapshot.testCaseId.trim()),
        request.target.workspacePrompt,
        rawSnapshotRoles?.[snapshot.id.trim()]
      )
    );
    const samePromptAcrossSnapshots =
      request.compareHints?.hasSamePromptSnapshots ??
      (new Set(request.snapshots.map((snapshot) => snapshot.promptText.trim())).size === 1);
    const sameTestCaseAcrossSnapshots =
      request.compareHints?.hasSharedTestCases ??
      (new Set(request.snapshots.map((snapshot) => snapshot.testCaseId.trim())).size === 1);
    const sharedCompareInputs = sameTestCaseAcrossSnapshots || renderedTestCases.length === 1;
    const crossModelComparison =
      request.compareHints?.hasCrossModelComparison ??
      (
        samePromptAcrossSnapshots &&
        sharedCompareInputs &&
        new Set(
          request.snapshots
            .map((snapshot) => (snapshot.modelKey || '').trim())
            .filter(Boolean)
        ).size > 1
      );
    const forceGenericCompare = this.shouldForceGenericCompare(request);
    const requestedStructured = request.compareHints?.mode === 'structured';
    const hasStructuredRoleConflicts = this.hasStructuredSingletonRoleConflicts(rawSnapshotRoles);
    const provisionalJudgePlan = requestedStructured && !hasStructuredRoleConflicts
      ? this.buildStructuredCompareJudgePlan(snapshotsWithRoles)
      : [];
    const compareMode =
      !forceGenericCompare &&
      requestedStructured &&
      !hasStructuredRoleConflicts &&
      provisionalJudgePlan.length > 0
        ? 'structured'
        : 'generic';
    const snapshotRoles = compareMode === 'structured' ? rawSnapshotRoles : undefined;
    const normalizedSnapshots =
      compareMode === 'structured'
        ? snapshotsWithRoles
        : request.snapshots.map((snapshot) =>
            this.normalizeSnapshot(
              snapshot,
              testCaseMap.get(snapshot.testCaseId.trim()),
              request.target.workspacePrompt
            )
          );
    const compareRoleBindings =
      compareMode === 'structured'
        ? normalizedSnapshots
            .filter((snapshot) => snapshot.hasRole)
            .map((snapshot) => ({
              snapshotId: snapshot.id,
              snapshotLabel: snapshot.label,
              role: snapshot.role as StructuredCompareRole,
              roleLabel: snapshot.roleLabel,
            }))
        : [];
    const hasEditableWorkspaceTarget = normalizedSnapshots.some(
      (snapshot) => snapshot.promptRefKind === 'workspace' && snapshot.promptMatchesWorkspace
    );

    return {
      compareMode,
      snapshotRoles,
      normalizedTestCases,
      renderedTestCases,
      testCaseMap,
      normalizedSnapshots,
      compareRoleBindings,
      samePromptAcrossSnapshots,
      sharedCompareInputs,
      crossModelComparison,
      hasEditableWorkspaceTarget,
      judgePlan:
        compareMode === 'structured'
          ? this.buildStructuredCompareJudgePlan(normalizedSnapshots)
          : [],
    };
  }

  private buildCompareTestCaseEvidenceKey(
    testCase: NormalizedEvaluationTestCase | undefined
  ): string {
    return JSON.stringify({
      inputKind: testCase?.inputKind || '',
      inputLabel: testCase?.inputLabel || '',
      inputSummary: testCase?.inputSummary || '',
      inputContent: testCase?.inputContent || '',
      settingsSummary: testCase?.settingsSummary || '',
    });
  }

  private buildStructuredCompareJudgePlan(
    snapshots: NormalizedEvaluationSnapshot[]
  ): StructuredCompareJudgePlanItem[] {
    const target = snapshots.find((snapshot) => snapshot.role === 'target');
    if (!target) {
      return [];
    }

    const baseline = snapshots.find((snapshot) => snapshot.role === 'baseline');
    const reference = snapshots.find((snapshot) => snapshot.role === 'reference');
    const referenceBaseline = snapshots.find(
      (snapshot) => snapshot.role === 'referenceBaseline'
    );
    const replicas = snapshots.filter((snapshot) => snapshot.role === 'replica');
    const judgePlan: StructuredCompareJudgePlanItem[] = [];

    if (baseline) {
      judgePlan.push({
        key: 'target-vs-baseline',
        pairType: 'targetBaseline',
        label: 'Target vs Baseline',
        purpose:
          'Decide whether the current target prompt materially improved, stayed flat, or regressed relative to the previous version.',
        signalName: 'progress',
        allowedSignals: ['improved', 'flat', 'regressed', 'unclear'],
        left: target,
        right: baseline,
      });
    }

    if (reference) {
      judgePlan.push({
        key: 'target-vs-reference',
        pairType: 'targetReference',
        label: 'Target vs Reference',
        purpose:
          'Identify whether the target still has a learnable gap from the stronger/reference run, and what structural strategy is worth learning.',
        signalName: 'gap',
        allowedSignals: ['none', 'minor', 'major', 'unclear'],
        left: target,
        right: reference,
      });
    }

    if (reference && referenceBaseline) {
      judgePlan.push({
        key: 'reference-vs-reference-baseline',
        pairType: 'referenceBaseline',
        label: 'Reference vs Reference Baseline',
        purpose:
          'Judge whether the prompt change itself is supported on the reference side, instead of being a target-only coincidence.',
        signalName: 'promptValidity',
        allowedSignals: ['supported', 'mixed', 'unsupported', 'unclear'],
        left: reference,
        right: referenceBaseline,
      });
    }

    replicas.forEach((replica, index) => {
      judgePlan.push({
        key: index === 0 ? 'target-vs-replica' : `target-vs-replica-${index + 1}`,
        pairType: 'targetReplica',
        label: index === 0 ? 'Target vs Replica' : `Target vs Replica #${index + 1}`,
        purpose:
          'Judge whether the target prompt behaves stably across repeated executions instead of improving by chance.',
        signalName: 'stability',
        allowedSignals: ['stable', 'unstable', 'unclear'],
        left: target,
        right: replica,
      });
    });

    return judgePlan;
  }

  private async evaluateStructuredCompare(
    request: Extract<EvaluationRequest, { type: 'compare' }>,
    normalizedCompare: NormalizedCompareContext
  ): Promise<EvaluationResponse> {
    const startTime = Date.now();

    try {
      const language = await this.resolveComparePromptLanguage();
      const subject = this.resolveComparePromptSubjectConfig(request.mode, language);
      const judgeResults = await this.executeStructuredCompareJudgePlan(
        request,
        normalizedCompare,
        language
      );
      const synthesisMessages = this.buildStructuredCompareSynthesisMessages(
        request,
        normalizedCompare,
        judgeResults,
        language,
        subject
      );
      const synthesisResult = await this.llmService.sendMessage(
        synthesisMessages,
        request.evaluationModelKey
      );
      const duration = Date.now() - startTime;
      const responseMetadata = this.buildResponseMetadata(
        request,
        {
          model: request.evaluationModelKey,
          timestamp: Date.now(),
          duration,
          compareJudgements: judgeResults,
        },
        normalizedCompare
      );

      return this.parseEvaluationResult(synthesisResult, request.type, responseMetadata);
    } catch (error) {
      throw new EvaluationExecutionError(
        this.formatExecutionErrorMessage(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  private async evaluateStructuredCompareStream(
    request: Extract<EvaluationRequest, { type: 'compare' }>,
    normalizedCompare: NormalizedCompareContext,
    callbacks: EvaluationStreamHandlers
  ): Promise<void> {
    const startTime = Date.now();
    const language = await this.resolveComparePromptLanguage();
    const subject = this.resolveComparePromptSubjectConfig(request.mode, language);

    try {
      const judgeResults = await this.executeStructuredCompareJudgePlan(
        request,
        normalizedCompare,
        language,
        (message) => callbacks.onToken(message)
      );
      callbacks.onToken(
        language === 'en'
          ? '\n[Structured Compare] Synthesizing final evaluation...\n'
          : '\n[Structured Compare] 正在综合最终评估...\n'
      );

      const synthesisMessages = this.buildStructuredCompareSynthesisMessages(
        request,
        normalizedCompare,
        judgeResults,
        language,
        subject
      );

      let fullContent = '';
      await this.llmService.sendMessageStream(synthesisMessages, request.evaluationModelKey, {
        signal: callbacks.signal,
      onToken: (token) => {
          fullContent += token;
          callbacks.onToken(token);
        },
        onComplete: () => {
          try {
            const duration = Date.now() - startTime;
            const response = this.parseEvaluationResult(
              fullContent,
              request.type,
              this.buildResponseMetadata(
                request,
                {
                  model: request.evaluationModelKey,
                  timestamp: Date.now(),
                  duration,
                  compareJudgements: judgeResults,
                },
                normalizedCompare
              )
            );
            callbacks.onComplete(response);
          } catch (error) {
            callbacks.onError(this.toError(error));
          }
        },
        onError: (error) => {
          callbacks.onError(new EvaluationExecutionError(this.formatExecutionErrorMessage(error), error));
        },
      });
    } catch (error) {
      callbacks.onError(
        new EvaluationExecutionError(
          this.formatExecutionErrorMessage(error),
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  private async executeStructuredCompareJudgePlan(
    request: Extract<EvaluationRequest, { type: 'compare' }>,
    normalizedCompare: NormalizedCompareContext,
    language: ComparePromptLanguage,
    onProgress?: (message: string) => void
  ): Promise<StructuredCompareJudgeResult[]> {
    const judgeTasks = normalizedCompare.judgePlan.map(async (planItem, index) => {
      onProgress?.(
        language === 'en'
          ? `\n[Structured Compare] Starting pairwise judge ${index + 1}/${normalizedCompare.judgePlan.length}: ${planItem.label}\n`
          : `\n[Structured Compare] 已启动成对判断 ${index + 1}/${normalizedCompare.judgePlan.length}：${planItem.label}\n`
      );
      const messages = this.buildStructuredCompareJudgeMessages(
        request,
        normalizedCompare,
        planItem,
        language
      );
      const judgeContent = await this.llmService.sendMessage(messages, request.evaluationModelKey);
      const parsed = this.parseStructuredCompareJudgeResult(judgeContent, planItem);
      onProgress?.(
        language === 'en'
          ? `[Structured Compare] Pairwise judge finished: ${planItem.label}\n`
          : `[Structured Compare] 成对判断完成：${planItem.label}\n`
      );
      return parsed;
    });

    return Promise.all(judgeTasks);
  }

  private async resolveComparePromptLanguage(): Promise<ComparePromptLanguage> {
    try {
      const language = await this.templateManager.getCurrentBuiltinTemplateLanguage();
      return language === 'en-US' ? 'en' : 'zh';
    } catch {
      return 'zh';
    }
  }

  private resolveComparePromptSubjectConfig(
    mode: EvaluationModeConfig,
    language: ComparePromptLanguage
  ): ComparePromptSubjectConfig {
    return resolveStructuredComparePromptSubjectConfig(mode, language);
  }

  private buildStructuredCompareJudgeMessages(
    request: Extract<EvaluationRequest, { type: 'compare' }>,
    normalizedCompare: NormalizedCompareContext,
    planItem: StructuredCompareJudgePlanItem,
    language: ComparePromptLanguage
  ): Message[] {
    const relevantTestCases = Array.from(
      [planItem.left.testCaseId, planItem.right.testCaseId].reduce((map, testCaseId) => {
        const testCase = normalizedCompare.testCaseMap.get(testCaseId);
        if (testCase) {
          map.set(this.buildCompareTestCaseEvidenceKey(testCase), testCase);
        }
        return map;
      }, new Map<string, NormalizedEvaluationTestCase>()).values()
    );
    const focus = request.focus?.content?.trim() || '';
    void this.buildStructuredCompareDebugArtifacts({
      roleBindings: normalizedCompare.compareRoleBindings,
      testCases: relevantTestCases,
      snapshots: [planItem.left, planItem.right],
      language,
    });

    return buildStructuredComparePairJudgeMessages({
      language,
      pairGuidance: this.renderStructuredComparePairGuidance(planItem, language),
      payload: {
        scenario: {
          language,
          pairKey: planItem.key,
          pairType: planItem.pairType,
          pairLabel: planItem.label,
          purpose: planItem.purpose,
          signalName: planItem.signalName,
          allowedSignalValues: planItem.allowedSignals,
          ...(focus ? { focusBrief: focus } : {}),
        },
        roleBindings: this.toStructuredCompareRoleBindingPayloads(
          normalizedCompare.compareRoleBindings
        ),
        testCases: relevantTestCases.map((testCase) =>
          this.toStructuredCompareTestCasePayload(testCase)
        ),
        leftSnapshot: this.toStructuredCompareSnapshotPayload(planItem.left),
        rightSnapshot: this.toStructuredCompareSnapshotPayload(planItem.right),
      },
    });
  }

  private renderStructuredComparePairGuidance(
    planItem: StructuredCompareJudgePlanItem,
    language: ComparePromptLanguage
  ): string {
    return renderStructuredComparePairGuidanceCopy(planItem.pairType, language);
  }

  private buildStructuredCompareSynthesisMessages(
    request: Extract<EvaluationRequest, { type: 'compare' }>,
    normalizedCompare: NormalizedCompareContext,
    judgeResults: StructuredCompareJudgeResult[],
    language: ComparePromptLanguage,
    subject: ComparePromptSubjectConfig
  ): Message[] {
    const focus = request.focus?.content?.trim() || '';
    const signalSnapshot = this.summarizeStructuredCompareJudgeSignals(judgeResults);
    const derivedStopSignals = this.deriveCompareStopSignalsFromJudgements(judgeResults);
    const learnableSignals = this.collectRankedCompareStrings(
      judgeResults.flatMap((item) => item.learnableSignals),
      4
    );
    const overfitWarnings = this.collectRankedCompareStrings(
      judgeResults.flatMap((item) => item.overfitWarnings),
      4
    );
    const conflictSignals = this.buildCompareConflictSignals(judgeResults).map((signal) => ({
      key: signal,
      description: this.renderCompareConflictSignal(signal, language),
    }));
    void this.buildStructuredCompareDebugArtifacts({
      roleBindings: normalizedCompare.compareRoleBindings,
      testCases: normalizedCompare.renderedTestCases,
      snapshots: normalizedCompare.normalizedSnapshots,
      judgeResults,
      language,
    });

    return buildStructuredCompareSynthesisMessages({
      language,
      payload: {
        scenario: {
          language,
          roleName: subject.roleName,
          subjectLabel: subject.subjectLabel,
          sharedCompareInputs: normalizedCompare.sharedCompareInputs,
          samePromptAcrossSnapshots: normalizedCompare.samePromptAcrossSnapshots,
          crossModelComparison: normalizedCompare.crossModelComparison,
          ...(focus ? { focusBrief: focus } : {}),
        },
        roleBindings: this.toStructuredCompareRoleBindingPayloads(
          normalizedCompare.compareRoleBindings
        ),
        deterministicHints: {
          priorityOrder: [
            'targetBaseline',
            'targetReference',
            'referenceBaseline',
            'targetReplica',
          ],
          signalSnapshot: {
            ...(signalSnapshot.progress ? { progress: signalSnapshot.progress } : {}),
            ...(signalSnapshot.gap ? { gap: signalSnapshot.gap } : {}),
            ...(signalSnapshot.promptValidity ? { promptValidity: signalSnapshot.promptValidity } : {}),
            ...(signalSnapshot.stability ? { stability: signalSnapshot.stability } : {}),
          },
          ...(derivedStopSignals ? { derivedStopSignals } : {}),
          learnableSignals,
          overfitWarnings,
          conflictSignals,
        },
        judgeResults: judgeResults.map((item) => ({
          pairKey: item.pairKey,
          pairType: item.pairType,
          pairLabel: item.pairLabel,
          leftSnapshotId: item.leftSnapshotId,
          leftSnapshotLabel: item.leftSnapshotLabel,
          ...(item.leftRole ? { leftRole: item.leftRole } : {}),
          rightSnapshotId: item.rightSnapshotId,
          rightSnapshotLabel: item.rightSnapshotLabel,
          ...(item.rightRole ? { rightRole: item.rightRole } : {}),
          verdict: item.verdict,
          winner: item.winner,
          confidence: item.confidence,
          pairSignal: item.pairSignal,
          analysis: item.analysis,
          evidence: item.evidence,
          learnableSignals: item.learnableSignals,
          overfitWarnings: item.overfitWarnings,
        })),
      },
    });
  }

  private buildStructuredCompareDebugArtifacts(params: {
    roleBindings: StructuredCompareRoleBinding[];
    testCases: NormalizedEvaluationTestCase[];
    snapshots: NormalizedEvaluationSnapshot[];
    judgeResults?: StructuredCompareJudgeResult[];
    language: ComparePromptLanguage;
  }): {
    roleBindingsMarkdown: string;
    testCasesMarkdown: string;
    snapshotsMarkdown: string[];
    judgeResultsMarkdown?: string;
    synthesisHintsMarkdown?: string;
  } {
    return {
      roleBindingsMarkdown: this.renderStructuredCompareRoleBindings(
        params.roleBindings,
        params.language
      ),
      testCasesMarkdown: this.renderStructuredCompareTestCases(
        params.testCases,
        params.language
      ),
      snapshotsMarkdown: params.snapshots.map((snapshot) =>
        this.renderStructuredCompareSnapshot(snapshot, params.language)
      ),
      ...(params.judgeResults
        ? {
            judgeResultsMarkdown: this.renderStructuredCompareJudgeResults(
              params.judgeResults,
              params.language
            ),
            synthesisHintsMarkdown: this.renderStructuredCompareSynthesisHints(
              params.judgeResults,
              params.language
            ),
          }
        : {}),
    };
  }

  private toStructuredCompareRoleBindingPayloads(
    roleBindings: StructuredCompareRoleBinding[]
  ): Array<{
    snapshotId: string;
    snapshotLabel: string;
    role: string;
    roleLabel: string;
  }> {
    return roleBindings.map((binding) => ({
      snapshotId: binding.snapshotId,
      snapshotLabel: binding.snapshotLabel,
      role: binding.role,
      roleLabel: binding.roleLabel,
    }));
  }

  private toStructuredCompareTestCasePayload(
    testCase: NormalizedEvaluationTestCase
  ): {
    id: string;
    label?: string;
    input: {
      kind: string;
      label: string;
      content: string;
      summary?: string;
    };
    settingsSummary?: string;
  } {
    return {
      id: testCase.id,
      ...(testCase.hasLabel ? { label: testCase.label } : {}),
      input: {
        kind: testCase.inputKind,
        label: testCase.inputLabel,
        content: testCase.inputContent,
        ...(testCase.hasInputSummary ? { summary: testCase.inputSummary } : {}),
      },
      ...(testCase.hasSettingsSummary ? { settingsSummary: testCase.settingsSummary } : {}),
    };
  }

  private toStructuredCompareSnapshotPayload(
    snapshot: NormalizedEvaluationSnapshot
  ): {
    id: string;
    label: string;
    role?: string;
    roleLabel?: string;
    testCaseId: string;
    testCaseLabel?: string;
    promptRef: {
      kind: string;
      label: string;
    };
    promptText: string;
    modelKey?: string;
    versionLabel?: string;
    output: string;
    reasoning?: string;
    executionInput?: {
      kind: string;
      label: string;
      content: string;
      summary?: string;
    };
  } {
    return {
      id: snapshot.id,
      label: snapshot.label,
      ...(snapshot.hasRole ? { role: snapshot.role, roleLabel: snapshot.roleLabel } : {}),
      testCaseId: snapshot.testCaseId,
      ...(snapshot.testCaseLabel ? { testCaseLabel: snapshot.testCaseLabel } : {}),
      promptRef: {
        kind: snapshot.promptRefKind,
        label: snapshot.promptRefLabel,
      },
      promptText: snapshot.promptText,
      ...(snapshot.hasModelKey ? { modelKey: snapshot.modelKey } : {}),
      ...(snapshot.hasVersionLabel ? { versionLabel: snapshot.versionLabel } : {}),
      output: snapshot.output,
      ...(snapshot.hasReasoning ? { reasoning: snapshot.reasoning } : {}),
      ...(snapshot.hasExecutionInput
        ? {
            executionInput: {
              kind: 'custom',
              label: snapshot.executionInputLabel,
              content: snapshot.executionInputContent,
              ...(snapshot.hasExecutionInputSummary
                ? { summary: snapshot.executionInputSummary }
                : {}),
            },
          }
        : {}),
    };
  }

  private renderStructuredCompareSynthesisHints(
    judgeResults: StructuredCompareJudgeResult[],
    language: ComparePromptLanguage
  ): string {
    if (!judgeResults.length) {
      return '';
    }

    const signalSnapshot = this.summarizeStructuredCompareJudgeSignals(judgeResults);
    const derivedStopSignals = this.deriveCompareStopSignalsFromJudgements(judgeResults);
    const learnableSignals = this.collectRankedCompareStrings(
      judgeResults.flatMap((item) => item.learnableSignals),
      4
    );
    const overfitWarnings = this.collectRankedCompareStrings(
      judgeResults.flatMap((item) => item.overfitWarnings),
      4
    );
    const conflictChecks = this.buildCompareConflictSignals(judgeResults)
      .map((signal) => this.renderCompareConflictSignal(signal, language));

    return renderStructuredCompareSynthesisHintsCopy({
      language,
      signalSnapshot,
      derivedStopSignals,
      learnableSignals,
      overfitWarnings,
      conflictChecks,
    });
  }

  private parseStructuredCompareJudgeResult(
    content: string,
    planItem: StructuredCompareJudgePlanItem
  ): StructuredCompareJudgeResult {
    const fallback: StructuredCompareJudgeResult = {
      pairKey: planItem.key,
      pairType: planItem.pairType,
      pairLabel: planItem.label,
      leftSnapshotId: planItem.left.id,
      leftSnapshotLabel: planItem.left.label,
      leftRole: planItem.left.role || undefined,
      rightSnapshotId: planItem.right.id,
      rightSnapshotLabel: planItem.right.label,
      rightRole: planItem.right.role || undefined,
      verdict: 'mixed',
      winner: 'none',
      confidence: 'low',
      pairSignal: 'unclear',
      analysis: content.trim().slice(0, 4000),
      evidence: [],
      learnableSignals: [],
      overfitWarnings: [],
    };

    for (const candidate of this.extractJsonCandidates(content)) {
      try {
        const parsed = JSON.parse(jsonrepair(candidate));
        const payload = this.findStructuredCompareJudgePayload(parsed);
        if (!payload) {
          continue;
        }

        const payloadVerdict =
          typeof payload.verdict === 'string' ? payload.verdict.trim() : undefined;
        const payloadPairSignal =
          typeof payload.pairSignal === 'string' ? payload.pairSignal.trim() : undefined;
        const pairSignal =
          payloadPairSignal && planItem.allowedSignals.includes(payloadPairSignal)
            ? payloadPairSignal
            : payloadVerdict && planItem.allowedSignals.includes(payloadVerdict)
              ? payloadVerdict
              : fallback.pairSignal;
        const verdict = this.normalizeStructuredCompareJudgeVerdict(
          payloadVerdict,
          pairSignal,
          planItem
        );
        const winner = this.normalizeStructuredCompareJudgeWinner(
          typeof payload.winner === 'string' ? payload.winner.trim() : undefined,
          verdict,
          pairSignal,
          planItem
        );
        const confidence =
          payload.confidence === 'low' ||
          payload.confidence === 'medium' ||
          payload.confidence === 'high'
            ? payload.confidence
            : fallback.confidence;

        return {
          // Pair identity is determined by the judge plan, not by model echo fields.
          pairKey: planItem.key,
          pairType: planItem.pairType,
          pairLabel: planItem.label,
          leftSnapshotId: planItem.left.id,
          leftSnapshotLabel: planItem.left.label,
          leftRole: planItem.left.role || undefined,
          rightSnapshotId: planItem.right.id,
          rightSnapshotLabel: planItem.right.label,
          rightRole: planItem.right.role || undefined,
          verdict,
          winner,
          confidence,
          pairSignal,
          analysis:
            typeof payload.analysis === 'string' && payload.analysis.trim()
              ? payload.analysis.trim()
              : fallback.analysis,
          evidence: Array.isArray(payload.evidence)
            ? payload.evidence
                .map((item: unknown) => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
          learnableSignals: Array.isArray(payload.learnableSignals)
            ? payload.learnableSignals
                .map((item: unknown) => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
          overfitWarnings: Array.isArray(payload.overfitWarnings)
            ? payload.overfitWarnings
                .map((item: unknown) => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 4)
            : [],
        };
      } catch {
        continue;
      }
    }

    return fallback;
  }

  private normalizeStructuredCompareJudgeVerdict(
    rawVerdict: string | undefined,
    pairSignal: string,
    planItem: StructuredCompareJudgePlanItem
  ): StructuredCompareJudgeResult['verdict'] {
    if (
      rawVerdict === 'left-better' ||
      rawVerdict === 'right-better' ||
      rawVerdict === 'mixed' ||
      rawVerdict === 'similar'
    ) {
      return rawVerdict;
    }

    switch (planItem.pairType) {
      case 'targetBaseline':
        if (pairSignal === 'improved') return 'left-better';
        if (pairSignal === 'regressed') return 'right-better';
        if (pairSignal === 'flat') return 'similar';
        return 'mixed';
      case 'targetReference':
        if (pairSignal === 'minor' || pairSignal === 'major') return 'right-better';
        if (pairSignal === 'none') return 'similar';
        return 'mixed';
      case 'referenceBaseline':
        if (pairSignal === 'supported') return 'left-better';
        if (pairSignal === 'unsupported') return 'right-better';
        return 'mixed';
      case 'targetReplica':
        if (pairSignal === 'stable') return 'similar';
        return 'mixed';
      default:
        return 'mixed';
    }
  }

  private normalizeStructuredCompareJudgeWinner(
    rawWinner: string | undefined,
    verdict: StructuredCompareJudgeResult['verdict'],
    pairSignal: string,
    planItem: StructuredCompareJudgePlanItem
  ): StructuredCompareJudgeResult['winner'] {
    if (rawWinner === 'left' || rawWinner === 'right' || rawWinner === 'none') {
      return rawWinner;
    }

    if (verdict === 'left-better') {
      return 'left';
    }
    if (verdict === 'right-better') {
      return 'right';
    }
    if (verdict === 'similar') {
      return 'none';
    }

    if (planItem.pairType === 'targetReplica' && pairSignal === 'stable') {
      return 'none';
    }

    return 'none';
  }

  private findStructuredCompareJudgePayload(
    value: unknown
  ): Record<string, unknown> | null {
    const visited = new Set<unknown>();
    const queue: unknown[] = [value];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') {
        continue;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const record = current as Record<string, unknown>;
      if (this.isStructuredCompareJudgePayloadCandidate(record)) {
        return record;
      }

      for (const item of Object.values(record)) {
        if (item && typeof item === 'object') {
          queue.push(item);
        }
      }
    }

    return null;
  }

  private isStructuredCompareJudgePayloadCandidate(
    record: Record<string, unknown>
  ): boolean {
    const hasCoreVerdict =
      typeof record.verdict === 'string' &&
      (
        record.verdict === 'left-better' ||
        record.verdict === 'right-better' ||
        record.verdict === 'mixed' ||
        record.verdict === 'similar'
      );
    const hasCoreWinner =
      typeof record.winner === 'string' &&
      (record.winner === 'left' || record.winner === 'right' || record.winner === 'none');
    const hasCoreConfidence =
      typeof record.confidence === 'string' &&
      (record.confidence === 'low' || record.confidence === 'medium' || record.confidence === 'high');
    const hasCorePairSignal = typeof record.pairSignal === 'string';
    const hasSupportingField =
      hasCorePairSignal ||
      typeof record.analysis === 'string' ||
      Array.isArray(record.evidence) ||
      Array.isArray(record.learnableSignals) ||
      Array.isArray(record.overfitWarnings);

    return (hasCoreVerdict || hasCorePairSignal) && hasCoreWinner && hasCoreConfidence && hasSupportingField;
  }

  private renderStructuredCompareRoleBindings(
    roleBindings: StructuredCompareRoleBinding[],
    language: ComparePromptLanguage
  ): string {
    return renderStructuredCompareRoleBindingsCopy(roleBindings, language);
  }

  private renderStructuredCompareTestCases(
    testCases: NormalizedEvaluationTestCase[],
    language: ComparePromptLanguage
  ): string {
    return renderStructuredCompareTestCasesCopy(testCases, language);
  }

  private renderStructuredCompareSnapshot(
    snapshot: NormalizedEvaluationSnapshot,
    language: ComparePromptLanguage
  ): string {
    return renderStructuredCompareSnapshotCopy(snapshot, language);
  }

  private renderStructuredCompareJudgeResults(
    judgeResults: StructuredCompareJudgeResult[],
    language: ComparePromptLanguage
  ): string {
    return renderStructuredCompareJudgeResultsCopy(judgeResults, language);
  }

  /**
   * 解析评估结果
   */
  private parseEvaluationResult(
    content: string,
    type: EvaluationType,
    metadata?: EvaluationResponse['metadata']
  ): EvaluationResponse {
    const findEvaluationPayload = (value: unknown): unknown | null => {
      // 允许模型返回 "{ evaluation: {...} }" / "{ data: {...} }" 之类包装结构。
      // 为避免性能问题，这里做广度优先、有限步数的遍历。
      const visited = new Set<unknown>();
      const queue: unknown[] = [value];
      let steps = 0;

      while (queue.length > 0 && steps < 1000) {
        steps += 1;
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;

        if (visited.has(current)) continue;
        visited.add(current);

        if ((current as any).score !== undefined) {
          const score = (current as any).score;

          // 过滤掉类似维度项 "{ key, label, score }" 这种误命中。
          const isDimensionLike =
            typeof (current as any).key === 'string' &&
            typeof (current as any).label === 'string' &&
            (typeof score === 'number' || typeof score === 'string');

          const looksLikeEvaluation =
            (!isDimensionLike && (typeof score === 'number' || typeof score === 'string')) ||
            (score && typeof score === 'object' && ('overall' in score || 'dimensions' in score)) ||
            typeof (current as any).summary === 'string' ||
            Array.isArray((current as any).improvements) ||
            Array.isArray((current as any).patchPlan);

          if (looksLikeEvaluation) {
            return current;
          }
        }

        if (Array.isArray(current)) {
          for (const item of current) queue.push(item);
        } else {
          for (const v of Object.values(current as Record<string, unknown>)) {
            queue.push(v);
          }
        }
      }

      return null;
    };

    const jsonCandidates = this.extractJsonCandidates(content);
    for (const candidate of jsonCandidates) {
      try {
        const repairedJson = jsonrepair(candidate);
        const parsed = JSON.parse(repairedJson);
        const payload = findEvaluationPayload(parsed);
        if (!payload) continue;

        const normalized = this.normalizeEvaluationResponse(payload as any, type, metadata);
        return normalized;
      } catch (e) {
        console.warn(
          '[EvaluationService] Failed to parse evaluation JSON candidate:',
          e instanceof Error ? e.message : String(e)
        );
      }
    }

    // 降级解析
    const textResult = this.parseTextEvaluation(content, type, metadata);
    if (textResult) {
      console.warn('[EvaluationService] Using text fallback parsing');
      return textResult;
    }

    throw new EvaluationParseError(
      `Failed to parse evaluation result: no valid score JSON or recognizable overall score found. Raw content length: ${content.length} characters.`
    );
  }

  /**
   * 从模型输出中提取可能的 JSON 片段。
   *
   * 现实中模型可能：
   * - 输出 ```json ... ```
   * - 输出 ``` ... ```（无语言标注）
   * - 在解释文字中夹杂一段 JSON
   */
  private extractJsonCandidates(content: string): string[] {
    const candidates: string[] = [];

    // 1) 优先提取所有 fenced code block（不限语言），只挑看起来像 JSON 的块。
    const fencedRegex = /```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```/g;
    for (const match of content.matchAll(fencedRegex)) {
      const block = (match[1] ?? '').trim();
      if (!block) continue;
      const head = block.slice(0, 200);
      if (block.startsWith('{') || block.startsWith('[') || /["']score["']\s*:/.test(head)) {
        candidates.push(block);
      }
    }

    // 2) 尝试从正文中截取平衡的 JSON 子串（从 score 附近反向找起点）。
    const scoreIndex = content.search(/["']score["']\s*:/);
    if (scoreIndex >= 0) {
      const objCandidate = this.extractBalancedJsonSubstring(content, scoreIndex, '{', '}');
      if (objCandidate) candidates.push(objCandidate);

      const arrCandidate = this.extractBalancedJsonSubstring(content, scoreIndex, '[', ']');
      if (arrCandidate) candidates.push(arrCandidate);
    }

    // 3) 兜底：从第一个 '{' 或 '[' 开始尝试提取一个平衡块。
    const firstObj = content.indexOf('{');
    if (firstObj >= 0) {
      const objCandidate = this.extractBalancedFrom(content, firstObj, '{', '}');
      if (objCandidate) candidates.push(objCandidate);
    }
    const firstArr = content.indexOf('[');
    if (firstArr >= 0) {
      const arrCandidate = this.extractBalancedFrom(content, firstArr, '[', ']');
      if (arrCandidate) candidates.push(arrCandidate);
    }

    // 最后再把原始内容作为候选（部分情况下 jsonrepair 能救回来）。
    candidates.push(content);

    // 去重 + 过滤明显不可能的候选
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const c of candidates) {
      const trimmed = c.trim();
      if (!trimmed) continue;
      if (trimmed.length > 200_000) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      uniq.push(trimmed);
    }
    return uniq;
  }

  private extractBalancedJsonSubstring(
    content: string,
    aroundIndex: number,
    openChar: '{' | '[',
    closeChar: '}' | ']'
  ): string | null {
    // 从 aroundIndex 向左找一个可能的起点，然后做括号匹配。
    const start = content.lastIndexOf(openChar, aroundIndex);
    if (start < 0) return null;
    return this.extractBalancedFrom(content, start, openChar, closeChar);
  }

  private extractBalancedFrom(
    content: string,
    start: number,
    openChar: '{' | '[',
    closeChar: '}' | ']'
  ): string | null {
    let depth = 0;
    let inString = false;
    let stringQuote: '"' | "'" | null = null;
    let escaped = false;

    for (let i = start; i < content.length; i += 1) {
      const ch = content[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === stringQuote) {
          inString = false;
          stringQuote = null;
        }
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = true;
        stringQuote = ch as '"' | "'";
        continue;
      }

      if (ch === openChar) {
        depth += 1;
        continue;
      }
      if (ch === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return content.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * 标准化评估响应（统一结构）
   */
  private normalizeEvaluationResponse(
    data: any,
    type: EvaluationType,
    metadata?: EvaluationResponse['metadata']
  ): EvaluationResponse {
    if (!data || typeof data !== 'object') {
      throw new EvaluationParseError('Evaluation result is not a valid object.');
    }

    if (data.score === undefined || data.score === null) {
      throw new EvaluationParseError('Evaluation result is missing the "score" field.');
    }

    // 提取分数（0-100，整数）
    const extractScore = (value: any, fieldName: string): number => {
      if (value === undefined || value === null) {
        throw new EvaluationParseError(`Evaluation result is missing score for "${fieldName}".`);
      }
      const num = typeof value === 'number' ? value : parseInt(String(value));
      if (isNaN(num)) {
        throw new EvaluationParseError(`Invalid numeric score for "${fieldName}": ${value}`);
      }
      return Math.max(0, Math.min(100, num));
    };

    const tryExtractScore = (value: any, fieldName: string): number | null => {
      try {
        return extractScore(value, fieldName);
      } catch {
        return null;
      }
    };

    const toDimension = (key: string, label: string, scoreValue: any): EvaluationDimension | null => {
      const score = tryExtractScore(scoreValue, `dimension.${key}`);
      if (score === null) return null;
      return { key, label: label || key, score };
    };

    const normalizeDimensionsFromArray = (dims: any[]): EvaluationDimension[] => {
      const out: EvaluationDimension[] = [];
      dims.forEach((dim: any, index: number) => {
        if (dim === null || dim === undefined) return;

        // 常见结构：{ key, label, score }
        if (typeof dim === 'object' && !Array.isArray(dim)) {
          const key = typeof dim.key === 'string' ? dim.key : typeof dim.name === 'string' ? dim.name : '';
          const label = typeof dim.label === 'string' ? dim.label : typeof dim.title === 'string' ? dim.title : key;
          const scoreValue = (dim as any).score ?? (dim as any).value;
          if (key) {
            const d = toDimension(key, label, scoreValue);
            if (d) out.push(d);
          }
          return;
        }

        // 兜底：如果维度是 "85" 这种，仍然保留一个占位维度。
        if (typeof dim === 'number' || typeof dim === 'string') {
          const d = toDimension(`dim${index + 1}`, `dim${index + 1}`, dim);
          if (d) out.push(d);
        }
      });
      return out;
    };

    const normalizeDimensionsFromObject = (dims: Record<string, any>): EvaluationDimension[] => {
      const out: EvaluationDimension[] = [];
      for (const [key, value] of Object.entries(dims)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const label = typeof (value as any).label === 'string' ? (value as any).label : key;
          const scoreValue = (value as any).score ?? (value as any).value;
          const d = toDimension(key, label, scoreValue);
          if (d) out.push(d);
        } else {
          const d = toDimension(key, key, value);
          if (d) out.push(d);
        }
      }
      return out;
    };

    const scoreRaw = data.score;
    let overall: number | null = null;
    let dimensions: EvaluationDimension[] = [];

    // score 可能直接是数字（少数模型会这样输出）
    if (typeof scoreRaw === 'number' || typeof scoreRaw === 'string') {
      overall = tryExtractScore(scoreRaw, 'overall');
    } else if (scoreRaw && typeof scoreRaw === 'object') {
      overall = tryExtractScore((scoreRaw as any).overall, 'overall');

      const dimensionsRaw = (scoreRaw as any).dimensions;
      if (Array.isArray(dimensionsRaw)) {
        dimensions = normalizeDimensionsFromArray(dimensionsRaw);
      } else if (dimensionsRaw && typeof dimensionsRaw === 'object') {
        dimensions = normalizeDimensionsFromObject(dimensionsRaw as Record<string, any>);
      } else {
        // 有些模型会把维度直接平铺到 score 对象里：{ overall, goalAchievement, ... }
        const knownKeys = ['goalAchievement', 'outputQuality', 'formatCompliance', 'relevance'];
        const flattened: Record<string, any> = {};
        for (const k of knownKeys) {
          if ((scoreRaw as any)[k] !== undefined) {
            flattened[k] = (scoreRaw as any)[k];
          }
        }
        if (Object.keys(flattened).length > 0) {
          dimensions = normalizeDimensionsFromObject(flattened);
        }
      }
    }

    // 如果 overall 缺失，但维度存在，则按平均分计算。
    if (overall === null && dimensions.length > 0) {
      const avg = Math.round(
        dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
      );
      overall = Math.max(0, Math.min(100, avg));
    }

    // 如果维度缺失，但 overall 存在，则返回一个最小维度数组。
    if (dimensions.length === 0 && overall !== null) {
      dimensions = [{ key: 'overall', label: '综合评分', score: overall }];
    }

    if (overall === null) {
      throw new EvaluationParseError('Evaluation result is missing a valid overall score.');
    }

    const score: EvaluationScore = {
      overall,
      dimensions,
    };

    // 解析 improvements（最多3条）
    const improvements = Array.isArray(data.improvements)
      ? data.improvements.map((x: any) => String(x)).filter(Boolean).slice(0, 3)
      : typeof data.improvements === 'string' && data.improvements.trim()
        ? [data.improvements.trim()].slice(0, 3)
        : [];

    // 解析 patchPlan（最多3条）
    const patchPlan = this.normalizePatchPlan(data.patchPlan || []).slice(0, 3);

    const summary = typeof data.summary === 'string' ? data.summary : '';

    const responseMetadataRaw =
      (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata))
        ? data.metadata
        : {};
    const parsedCompareMode =
      responseMetadataRaw.compareMode === 'structured' || responseMetadataRaw.compareMode === 'generic'
        ? responseMetadataRaw.compareMode
        : (
            data.compareMode === 'structured' || data.compareMode === 'generic'
              ? data.compareMode
              : undefined
          );
    const parsedCompareStopSignals = this.normalizeCompareStopSignals(
      responseMetadataRaw.compareStopSignals ?? data.compareStopSignals
    );
    const parsedCompareJudgements = this.normalizeCompareJudgements(
      metadata?.compareJudgements ?? responseMetadataRaw.compareJudgements ?? data.compareJudgements
    );
    const finalMetadata: NonNullable<EvaluationResponse['metadata']> = {
      ...(parsedCompareMode ? { compareMode: parsedCompareMode } : {}),
      ...(parsedCompareStopSignals ? { compareStopSignals: parsedCompareStopSignals } : {}),
      ...metadata,
      ...(parsedCompareJudgements ? { compareJudgements: parsedCompareJudgements } : {}),
    };
    const derivedCompareStopSignals = this.deriveCompareStopSignalsFromJudgements(
      finalMetadata.compareJudgements
    );
    const mergedCompareStopSignals = this.mergeCompareStopSignals(
      finalMetadata.compareStopSignals,
      derivedCompareStopSignals
    );
    if (mergedCompareStopSignals) {
      finalMetadata.compareStopSignals = mergedCompareStopSignals;
    }
    const compareInsights = this.buildCompareInsights(finalMetadata.compareJudgements);

    if (compareInsights) {
      finalMetadata.compareInsights = compareInsights;
    }

    return {
      type,
      score,
      improvements,
      summary,
      patchPlan,
      metadata: finalMetadata,
    };
  }

  /**
   * 文本解析评估结果（降级方案）
   */
  private parseTextEvaluation(
    content: string,
    type: EvaluationType,
    metadata?: EvaluationResponse['metadata']
  ): EvaluationResponse | null {
    const scorePatterns = [
      // JSON 残片里常见的 overall 字段
      /["']overall["']\s*[:=]\s*(\d{1,3})/i,

      // 中文常见写法
      /综合评分\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/,
      /总[分评]\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/,
      /评分\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/,

      // 英文常见写法
      /overall(?:\s+score)?\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/i,
      /score\s*[:：]?\s*(\d{1,3})(?:\s*\/\s*100)?/i,

      // 纯数字 + /100
      /(\d{1,3})\s*\/\s*100/,
      /(\d{1,3})\s*[分点](?:\s*[（(]满分100[)）])?/,
    ];

    let overall: number | null = null;
    for (const pattern of scorePatterns) {
      const match = content.match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num >= 0 && num <= 100) {
          overall = num;
          break;
        }
      }
    }

    if (overall === null) {
      return null;
    }

    return {
      type,
      score: {
        overall,
        dimensions: [
          { key: 'overall', label: '综合评分', score: overall },
        ],
      },
      improvements: [],
      summary: '评估完成（解析降级）',
      patchPlan: [],
      metadata,
    };
  }

  /**
   * 标准化补丁计划数组（简化版）
   */
  private normalizePatchPlan(patchPlan: any[]): PatchOperation[] {
    if (!Array.isArray(patchPlan)) {
      return [];
    }

    const validOps: PatchOperationType[] = ['insert', 'replace', 'delete'];

    return patchPlan
      .map((op: any) => {
        if (!op || typeof op !== 'object') {
          return null;
        }

        let opType: PatchOperationType = 'replace';
        if (op.op && validOps.includes(op.op)) {
          opType = op.op;
        }

        // 反转义 HTML 实体（LLM 可能返回转义后的 XML 标签）
        const oldText = this.unescapeHtmlEntities(String(op.oldText || ''));
        if (!oldText) {
          return null;
        }

        const newText = this.unescapeHtmlEntities(
          op.newText !== undefined ? String(op.newText) : ''
        );

        const operation: PatchOperation = {
          op: opType,
          oldText,
          newText,
          instruction: String(op.instruction || ''),
        };

        if (typeof op.occurrence === 'number' && Number.isFinite(op.occurrence)) {
          const occ = Math.trunc(op.occurrence);
          if (occ > 0) {
            operation.occurrence = occ;
          }
        }

        return operation;
      })
      .filter((op): op is PatchOperation => op !== null);
  }

  /**
   * 反转义 HTML 实体
   * LLM 生成 JSON 时可能对 XML 标签进行 HTML 转义
   * 支持：命名实体、十进制实体(&#123;)、十六进制实体(&#x2F;)
   */
  private unescapeHtmlEntities(text: string): string {
    if (!text) return text;
    return text
      // 命名实体
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&sol;/g, '/')
      // 十六进制实体 &#xHH; 或 &#xHHHH;
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      // 十进制实体 &#DDD;
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }
}

/**
 * 创建评估服务的工厂函数
 */
export function createEvaluationService(
  llmService: ILLMService,
  modelManager: IModelManager,
  templateManager: ITemplateManager,
  dependencies: EvaluationServiceDependencies = {}
): IEvaluationService {
  return new EvaluationService(llmService, modelManager, templateManager, dependencies);
}
