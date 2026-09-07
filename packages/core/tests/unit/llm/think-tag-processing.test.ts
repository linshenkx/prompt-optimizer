import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/services/llm/adapters/openai-adapter';

describe('Think标签处理测试', () => {

  describe('流式处理', () => {
    it('应该能正确处理流式think标签：开始标签 -> 推理内容 -> 结束标签 -> 正文', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      // 模拟流式处理：分多个chunk接收
      // Chunk 1: 开始标签
      (adapter as any).processStreamContentWithThinkTags('<think>', mockCallbacks, thinkState);

      // Chunk 2: 推理内容第一部分
      (adapter as any).processStreamContentWithThinkTags('我需要思考', mockCallbacks, thinkState);

      // Chunk 3: 推理内容第二部分
      (adapter as any).processStreamContentWithThinkTags('这个问题', mockCallbacks, thinkState);

      // Chunk 4: 结束标签
      (adapter as any).processStreamContentWithThinkTags('</think>', mockCallbacks, thinkState);

      // Chunk 5: 正文内容
      (adapter as any).processStreamContentWithThinkTags('这是最终答案', mockCallbacks, thinkState);

      // 验证推理内容被正确分离
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('我需要思考');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('这个问题');

      // 验证正文内容被正确发送
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('这是最终答案');

      // 验证没有将标签内容发送到主流
      expect(mockCallbacks.onToken).not.toHaveBeenCalledWith('<think>');
      expect(mockCallbacks.onToken).not.toHaveBeenCalledWith('</think>');
    });

    it('应该能处理单个chunk包含完整think标签的情况', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      // 单个chunk包含完整的think标签
      (adapter as any).processStreamContentWithThinkTags(
        '前面内容<think>推理过程</think>后面内容',
        mockCallbacks,
        thinkState
      );

      expect(mockCallbacks.onToken).toHaveBeenCalledWith('前面内容');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('推理过程');
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('后面内容');
    });

    it('应该能处理跨chunk的think标签', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      // Chunk 1: 包含开始标签的一部分
      (adapter as any).processStreamContentWithThinkTags('前面<thi', mockCallbacks, thinkState);

      // Chunk 2: 完成开始标签并开始推理内容
      (adapter as any).processStreamContentWithThinkTags('nk>推理开始', mockCallbacks, thinkState);

      // Chunk 3: 推理内容和部分结束标签
      (adapter as any).processStreamContentWithThinkTags('推理结束</thi', mockCallbacks, thinkState);

      // Chunk 4: 完成结束标签并开始正文
      (adapter as any).processStreamContentWithThinkTags('nk>正文内容', mockCallbacks, thinkState);

      expect(mockCallbacks.onToken).toHaveBeenCalledWith('前面');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('推理开始');
      expect(mockCallbacks.onReasoningToken).toHaveBeenCalledWith('推理结束');
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('正文内容');
    });

    it('应该能处理没有推理回调的流式情况', () => {
      const adapter = new OpenAIAdapter();

      const mockCallbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
        // 注意：没有 onReasoningToken
      };

      const thinkState = { isInThinkMode: false, buffer: '' };

      (adapter as any).processStreamContentWithThinkTags(
        '<think>推理过程</think>正文内容',
        mockCallbacks,
        thinkState
      );

      // 当没有推理回调时，think标签内容被过滤，只返回正文
      expect(mockCallbacks.onToken).toHaveBeenCalledWith('正文内容');
    });

    it('在没有推理回调时应跨 chunk 识别拆分的开始标签', () => {
      const adapter = new OpenAIAdapter();
      const mockCallbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };
      const thinkState = { isInThinkMode: false, buffer: '' };

      (adapter as any).processStreamContentWithThinkTags('Answer: <thi', mockCallbacks, thinkState);
      (adapter as any).processStreamContentWithThinkTags('nk>private reasoning</think> visible', mockCallbacks, thinkState);

      expect(mockCallbacks.onToken).toHaveBeenNthCalledWith(1, 'Answer: ');
      expect(mockCallbacks.onToken).toHaveBeenNthCalledWith(2, ' visible');
      expect(mockCallbacks.onToken).toHaveBeenCalledTimes(2);
    });

    it('在没有推理回调时应跨 chunk 识别拆分的结束标签', () => {
      const adapter = new OpenAIAdapter();
      const mockCallbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };
      const thinkState = { isInThinkMode: false, buffer: '' };

      (adapter as any).processStreamContentWithThinkTags('Answer: <think>private reasoning</thi', mockCallbacks, thinkState);
      (adapter as any).processStreamContentWithThinkTags('nk> visible', mockCallbacks, thinkState);

      expect(mockCallbacks.onToken).toHaveBeenNthCalledWith(1, 'Answer: ');
      expect(mockCallbacks.onToken).toHaveBeenNthCalledWith(2, ' visible');
      expect(mockCallbacks.onToken).toHaveBeenCalledTimes(2);
    });

    it('在没有推理回调时应保留普通可见文本的 chunk 边界', () => {
      const adapter = new OpenAIAdapter();
      const mockCallbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };
      const thinkState = { isInThinkMode: false, buffer: '' };

      (adapter as any).processStreamContentWithThinkTags('Answer: ', mockCallbacks, thinkState);
      (adapter as any).processStreamContentWithThinkTags('visible', mockCallbacks, thinkState);

      expect(mockCallbacks.onToken).toHaveBeenNthCalledWith(1, 'Answer: ');
      expect(mockCallbacks.onToken).toHaveBeenNthCalledWith(2, 'visible');
      expect(mockCallbacks.onToken).toHaveBeenCalledTimes(2);
    });
  });
});
