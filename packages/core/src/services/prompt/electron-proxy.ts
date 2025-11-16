import {
  IPromptService,
  OptimizationRequest,
  MessageOptimizationRequest,
  StreamHandlers,
  CustomConversationRequest,
} from './types';
import { PromptRecord } from '../history/types';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';

// Helper function to check if running in Electron renderer process
function isRunningInElectron(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).electronAPI !== 'undefined';
}

/**
 * Proxy for using PromptService in Electron renderer process.
 * It communicates with the main process via IPC.
 */
export class ElectronPromptServiceProxy implements IPromptService {
  private get api() {
    if (!isRunningInElectron() || !(window as any).electronAPI?.prompt) {
      // The `prompt` property will be added to the electronAPI in the desktop package's preload script.
      // This error indicates a potential mismatch between frontend expectations and the preload script's exposure.
      throw new Error('Electron Prompt API is not available in this environment.');
    }
    return (window as any).electronAPI.prompt;
  }

  async optimizePrompt(request: OptimizationRequest): Promise<string> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeRequest = safeSerializeForIPC(request);
    return this.api.optimizePrompt(safeRequest);
  }

  async optimizeMessage(request: MessageOptimizationRequest): Promise<string> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeRequest = safeSerializeForIPC(request);
    return this.api.optimizeMessage(safeRequest);
  }

  async iteratePrompt(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    templateId?: string,
    contextData?: {
      messages?: any[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: any[];
    }
  ): Promise<string> {
    const safeContextData = contextData ? safeSerializeForIPC(contextData) : undefined;
    return this.api.iteratePrompt(originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId, safeContextData);
  }

  async testPrompt(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string
  ): Promise<string> {
    return this.api.testPrompt(systemPrompt, userPrompt, modelKey);
  }

  async getHistory(): Promise<PromptRecord[]> {
    return this.api.getHistory();
  }

  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    return this.api.getIterationChain(recordId);
  }

  // Streaming methods are complex over IPC and are not implemented in the proxy for now.
  // They would require event-based communication rather than a simple invoke/handle.
  async optimizePromptStream(request: OptimizationRequest, callbacks: StreamHandlers): Promise<void> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeRequest = safeSerializeForIPC(request);
    await this.api.optimizePromptStream(safeRequest, callbacks);
  }

  async optimizeMessageStream(request: MessageOptimizationRequest, callbacks: StreamHandlers): Promise<void> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeRequest = safeSerializeForIPC(request);
    await this.api.optimizeMessageStream(safeRequest, callbacks);
  }

  async iteratePromptStream(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    callbacks: StreamHandlers,
    templateId?: string,
    contextData?: {
      messages?: any[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: any[];
    }
  ): Promise<void> {
    const safeContextData = contextData ? safeSerializeForIPC(contextData) : undefined;
    await this.api.iteratePromptStream(originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId, callbacks, safeContextData);
  }

  async testPromptStream(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
    callbacks: StreamHandlers
  ): Promise<void> {
    await this.api.testPromptStream(systemPrompt, userPrompt, modelKey, callbacks);
  }

  async testCustomConversationStream(
    request: CustomConversationRequest,
    callbacks: StreamHandlers
  ): Promise<void> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeRequest = safeSerializeForIPC(request);
    await this.api.testCustomConversationStream(safeRequest, callbacks);
  }
}
