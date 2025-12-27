import { ref, computed, reactive, nextTick, toRef, type Ref } from 'vue'
import type { UploadFileInfo } from 'naive-ui'

import { useToast } from "../ui/useToast";
import { useI18n } from "vue-i18n";
import { usePreferences } from "../storage/usePreferenceManager";
import { useImageGeneration } from "./useImageGeneration";
import { useEvaluationHandler } from "../prompt/useEvaluationHandler";
import type { UseEvaluationReturn } from "../prompt/useEvaluation";
import { v4 as uuidv4 } from "uuid";

import {
  IMAGE_MODE_KEYS,
  UI_SETTINGS_KEYS,
  type Template,
  type PromptRecordChain,
  type PromptRecordType,
  type OptimizationRequest,
  type OptimizationMode,
  type ImageRequest,
  type ImageResult,
  type ImageModelConfig,
  type ImageResultItem,
} from "@prompt-optimizer/core";
import type { AppServices } from "../../types/services";
import type { ModelSelectOption, SelectOption } from "../../types/select-options";

/**
 * 图像模式工作区 Hook
 * 复用现有的历史记录系统，添加图像优化类型支持
 */
export interface ImageUploadChangePayload {
  file: UploadFileInfo | null | undefined
  fileList: UploadFileInfo[]
  event?: Event
}

type TemplateKind = Template['metadata']['templateType']

export function useImageWorkspace(
  services: Ref<AppServices | null>,
  externalEvaluation?: UseEvaluationReturn,
) {
  const toast = useToast();
  const { t } = useI18n();
  const { getPreference, setPreference } = usePreferences(services);
  const {
    imageModels,
    generating: isGenerating,
    progress: generationProgress,
    error: generationError,
    result: imageResult,
    generate: generateImage,
    loadImageModels,
  } = useImageGeneration();

  // 服务引用
  const modelManager = computed(() => services.value?.modelManager);
  const templateManager = computed(() => services.value?.templateManager);
  const historyManager = computed(() => services.value?.historyManager);
  const promptService = computed(() => services.value?.promptService);

  // 响应式状态
  const state = reactive({
    // 基础状态
    originalPrompt: "",
    optimizedPrompt: "",
    optimizedReasoning: "",
    isOptimizing: false,
    isIterating: false,

    // 图像模式状态
    imageMode: "text2image" as "text2image" | "image2image",

    // 模型和模板选择
    selectedTextModelKey: "",
    selectedImageModelKey: "",
    selectedTemplate: null as Template | null,
    selectedIterateTemplate: null as Template | null,

    // 图像相关状态
    inputImageB64: null as string | null,
    inputImageMime: "image/png",
    isCompareMode: true,

    // 图像结果
    originalImageResult: null as ImageResult | null,
    optimizedImageResult: null as ImageResult | null,
    currentImageResult: null as ImageResult | null,

    // 上传状态
    uploadStatus: "idle" as "idle" | "uploading" | "success" | "error",
    uploadProgress: 0,
  });

  // 🆕 创建历史管理专用的 ref，供全局历史刷新使用
  const currentChainId = ref("");
  const currentVersions = ref<PromptRecordChain["versions"]>([]);
  const currentVersionId = ref("");

  // 模板管理器状态
  type WorkspaceTemplateType =
    | 'text2imageOptimize'
    | 'image2imageOptimize'
    | 'iterate'
    | 'imageIterate'

  const templateManagerState = reactive({
    showTemplates: false,
    currentType: 'text2imageOptimize' as WorkspaceTemplateType,
  });

  // 模型选项
  const textModelOptions = ref<ModelSelectOption[]>([]);
  const imageModelOptions = ref<SelectOption<ImageModelConfig>[]>([]);

  // 当前使用的提示词
  const currentPrompt = computed(
    () => state.optimizedPrompt || state.originalPrompt,
  );

  // 根据图像模式确定模板类型
  const templateType = computed<TemplateKind>(() => {
    return state.imageMode === "text2image"
      ? "text2imageOptimize"
      : "image2imageOptimize";
  });

  // 计算优化模式（图像模式统一使用 user 模式）
  const optimizationMode = "user" as OptimizationMode;

  // 计算高级模式状态（图像模式暂不支持高级模式）
  const advancedModeEnabled = false;

  // 选中图像模型的能力（使用自包含配置数据）
  const selectedImageModelCapabilities = computed(() => {
    console.log("[selectedImageModelCapabilities] 调试信息:", {
      selectedImageModelKey: state.selectedImageModelKey,
      imageModelsCount: imageModels.value.length,
      imageModels: imageModels.value.map((m) => ({
        id: m.id,
        name: m.name,
        capabilities: m.model?.capabilities || null,
      })),
    });

    if (!state.selectedImageModelKey) {
      console.log(
        "[selectedImageModelCapabilities] selectedImageModelKey 为空",
      );
      return null;
    }

    const selectedConfig = imageModels.value.find(
      (m) => m.id === state.selectedImageModelKey,
    );
    console.log("[selectedImageModelCapabilities] 找到的配置:", selectedConfig);

    const capabilities = selectedConfig?.model?.capabilities || null;
    console.log("[selectedImageModelCapabilities] 最终能力:", capabilities);

    return capabilities;
  });

  // 选中图像模型的Provider和Model信息
  const selectedImageModelInfo = computed(() => {
    if (!state.selectedImageModelKey) {
      return null;
    }

    const selectedConfig = imageModels.value.find(
      (m) => m.id === state.selectedImageModelKey,
    );
    if (!selectedConfig) {
      return null;
    }

    return {
      provider:
        selectedConfig.provider?.name || selectedConfig.providerId || "Unknown",
      model: selectedConfig.model?.name || selectedConfig.modelId || "Unknown",
    };
  });

  // 预览图像URL - 加强防护，确保不会因为undefined值而出错
  const previewImageUrl = computed(() => {
    if (!state.inputImageB64) return null;
    const mimeType = state.inputImageMime || "image/png"; // 确保mime类型不为空
    return `data:${mimeType};base64,${state.inputImageB64}`;
  });

  // 刷新文本模型及下拉选项，并校验当前选择
  const refreshTextModels = async () => {
    if (!modelManager.value) {
      textModelOptions.value = [];
      state.selectedTextModelKey = "";
      return;
    }

    try {
      const manager = modelManager.value;
      await manager.ensureInitialized();

      const textModels = await manager.getEnabledModels();
      textModelOptions.value = textModels.map((m) => ({
        label: `${m.name} (${m.providerMeta.name})`,
        primary: m.name,
        secondary: m.providerMeta.name ?? "Unknown",
        value: m.id,
        raw: m,
      }));

      const currentKey = state.selectedTextModelKey;
      const keys = new Set(textModels.map((m) => m.id));
      const fallback = textModels[0]?.id || "";

      const needsFallback =
        (!currentKey && fallback) || (currentKey && !keys.has(currentKey));

      if (needsFallback) {
        state.selectedTextModelKey = fallback;
        if (fallback) {
          await setPreference(IMAGE_MODE_KEYS.SELECTED_TEXT_MODEL, fallback);
        }
      }

      if (!textModels.length) {
        state.selectedTextModelKey = "";
      }
    } catch (error) {
      console.error(
        "[useImageWorkspace] Failed to refresh text models:",
        error,
      );
      textModelOptions.value = [];
    }
  };

  // 初始化
  const initialize = async () => {
    try {
      await refreshTextModels();

      // 加载图像模型
      await loadImageModels();
      imageModelOptions.value = imageModels.value.map((m) => ({
        label: `${m.name} (${m.provider?.name || m.providerId || "Unknown"} - ${m.model?.name || m.modelId || "Unknown"})`,
        primary: m.name,
        secondary: `${m.provider?.name || m.providerId || "Unknown"} · ${m.model?.name || m.modelId || "Unknown"}`,
        value: m.id,
        raw: m,
      }));

      // 恢复保存的选择（包括模板选择）
      await restoreSelections();
    } catch (error) {
      console.error("Failed to initialize image workspace:", error);
    }
  };

  // 刷新图像模型及下拉选项，并校验当前选择
  const refreshImageModels = async () => {
    try {
      await loadImageModels();
      imageModelOptions.value = imageModels.value.map((m) => ({
        label: `${m.name} (${m.provider?.name || m.providerId || "Unknown"} - ${m.model?.name || m.modelId || "Unknown"})`,
        primary: m.name,
        secondary: `${m.provider?.name || m.providerId || "Unknown"} · ${m.model?.name || m.modelId || "Unknown"}`,
        value: m.id,
        raw: m,
      }));
      // 若当前选择已不在可用列表，回退到第一个可用项
      const current = state.selectedImageModelKey;
      const exists = imageModels.value.some((m) => m.id === current);
      if (!exists) {
        state.selectedImageModelKey = imageModels.value[0]?.id || "";
        await saveSelections();
      }
    } catch (e) {
      console.error("[useImageWorkspace] Failed to refresh image models:", e);
    }
  };

  // 恢复保存的选择
  const restoreSelections = async () => {
    try {
      state.selectedTextModelKey = await getPreference(
        IMAGE_MODE_KEYS.SELECTED_TEXT_MODEL,
        textModelOptions.value[0]?.value || "",
      );
      state.selectedImageModelKey = await getPreference(
        IMAGE_MODE_KEYS.SELECTED_IMAGE_MODEL,
        imageModelOptions.value[0]?.value || "",
      );
      state.isCompareMode = await getPreference(
        IMAGE_MODE_KEYS.COMPARE_MODE_ENABLED,
        true,
      );

      // ✅ 恢复图像子模式（从全局持久化存储读取）
      const savedImageMode = await getPreference(
        UI_SETTINGS_KEYS.IMAGE_SUB_MODE,
        "text2image",
      );
      if (savedImageMode === "text2image" || savedImageMode === "image2image") {
        state.imageMode = savedImageMode;
        console.log(
          `[useImageWorkspace] 图像子模式已从存储恢复: ${savedImageMode}`,
        );
      }

      // 恢复保存的模板选择
      await restoreTemplateSelection();

      // 恢复图像迭代模板选择（仅使用 imageIterate 类型，不做其他类型回退）
      await restoreImageIterateTemplateSelection();
    } catch (error) {
      console.warn("Failed to restore selections:", error);
    }
  };

  // 恢复模板选择
  const restoreTemplateSelection = async () => {
    if (!templateManager.value) return;

    try {
      // 根据当前图像模式获取对应的模板
      const currentTemplateType = templateType.value;
      console.log(
        "[restoreTemplateSelection] Current template type:",
        currentTemplateType,
      );
      const templates = await templateManager.value.listTemplatesByType(
        currentTemplateType,
      );
      console.log(
        "[restoreTemplateSelection] Available templates:",
        templates.map((t) => ({ id: t.id, name: t.name })),
      );
      if (templates.length === 0) {
        state.selectedTemplate = null;
        return;
      }

      // 尝试恢复保存的模板（从对应模式的存储键读取）
      const perModeKey =
        currentTemplateType === "text2imageOptimize"
          ? IMAGE_MODE_KEYS.SELECTED_TEMPLATE_TEXT2IMAGE
          : IMAGE_MODE_KEYS.SELECTED_TEMPLATE_IMAGE2IMAGE;
      console.log(
        "[restoreTemplateSelection] Reading from storage key:",
        perModeKey,
      );
      const savedTemplateId = await getPreference(perModeKey, "");
      console.log(
        "[restoreTemplateSelection] Saved template ID:",
        savedTemplateId,
      );
      let selectedTemplate: Template | null = null;

      if (savedTemplateId) {
        selectedTemplate =
          templates.find((t) => t.id === savedTemplateId) || null;
        console.log(
          "[restoreTemplateSelection] Found saved template:",
          selectedTemplate?.name || "not found",
        );
      }

      // 如果没有保存的模板或找不到，使用默认模板
      if (!selectedTemplate) {
        console.log(
          "[restoreTemplateSelection] No saved template found, using default...",
        );
        // 根据模板类型选择合适的默认模板
        if (currentTemplateType === "text2imageOptimize") {
          selectedTemplate =
            templates.find((t) => t.id === "image-chinese-optimize") ||
            templates.find((t) => t.id === "image-dalle-optimize") ||
            templates.find((t) => t.name.includes("通用")) ||
            templates[0];
        } else {
          // image2imageOptimize 模板
          selectedTemplate =
            templates.find((t) => t.id === "image2image-general-optimize") ||
            templates[0];
        }

        // 保存默认选择
        if (selectedTemplate) {
          console.log(
            "[restoreTemplateSelection] Saving default template:",
            selectedTemplate.id,
            "to key:",
            perModeKey,
          );
          await setPreference(perModeKey, selectedTemplate.id);
        }
      }

      state.selectedTemplate = selectedTemplate;
      console.log(
        "[restoreTemplateSelection] Final selected template:",
        selectedTemplate?.name,
        "ID:",
        selectedTemplate?.id,
        "Type:",
        currentTemplateType,
      );
    } catch (error) {
      console.error("Failed to restore template selection:", error);
      state.selectedTemplate = null;
    }
  };

  // 加载默认模板（仅在没有保存选择时使用）
  const loadDefaultTemplate = async () => {
    // 这个函数现在由 restoreTemplateSelection 处理
    // 保留为空函数以保持兼容性
  };

  // 保存选择
  const saveSelections = async () => {
    try {
      await setPreference(
        IMAGE_MODE_KEYS.SELECTED_TEXT_MODEL,
        state.selectedTextModelKey,
      );
      await setPreference(
        IMAGE_MODE_KEYS.SELECTED_IMAGE_MODEL,
        state.selectedImageModelKey,
      );
      await setPreference(
        IMAGE_MODE_KEYS.COMPARE_MODE_ENABLED,
        state.isCompareMode,
      );
      if (state.selectedTemplate) {
        const currentTemplateType = templateType.value;
        const perModeKey =
          currentTemplateType === "text2imageOptimize"
            ? IMAGE_MODE_KEYS.SELECTED_TEMPLATE_TEXT2IMAGE
            : IMAGE_MODE_KEYS.SELECTED_TEMPLATE_IMAGE2IMAGE;
        await setPreference(perModeKey, state.selectedTemplate.id);
      }
      if (state.selectedIterateTemplate) {
        await setPreference(
          IMAGE_MODE_KEYS.SELECTED_ITERATE_TEMPLATE,
          state.selectedIterateTemplate.id,
        );
      }
    } catch (error) {
      console.warn("Failed to save selections:", error);
    }
  };

  // 恢复图像迭代模板选择
  const restoreImageIterateTemplateSelection = async () => {
    if (!templateManager.value) return;
    try {
      const iterateTemplates = await templateManager.value.listTemplatesByType(
        "imageIterate",
      );
      if (iterateTemplates.length === 0) {
        console.warn("[useImageWorkspace] No imageIterate templates available");
        state.selectedIterateTemplate = null;
        return;
      }
      const savedIterateId = await getPreference(
        IMAGE_MODE_KEYS.SELECTED_ITERATE_TEMPLATE,
        "",
      );
      if (savedIterateId) {
        const found = iterateTemplates.find((t) => t.id === savedIterateId);
        state.selectedIterateTemplate = found || iterateTemplates[0];
      } else {
        state.selectedIterateTemplate = iterateTemplates[0];
      }
    } catch (error) {
      console.error(
        "[useImageWorkspace] Failed to restore image iterate template:",
        error,
      );
    }
  };

  // 文件上传处理
  const handleUploadChange = async (data: ImageUploadChangePayload) => {
    const fileEntry = data.file ?? null;
    const file = fileEntry?.file ?? null;

    if (!file) {
      state.inputImageB64 = null;
      state.inputImageMime = "image/png"; // 重置为默认值，防止undefined错误
      state.uploadStatus = "idle";
      return;
    }

    // 验证文件类型
    if (!/image\/(png|jpeg)/.test(file.type)) {
      toast.error("仅支持 PNG/JPEG 格式");
      state.uploadStatus = "error";
      return;
    }

    // 验证文件大小
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过 10MB");
      state.uploadStatus = "error";
      return;
    }

    state.uploadStatus = "uploading";
    state.uploadProgress = 0;

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      state.inputImageB64 = base64;
      state.inputImageMime = file.type;
      state.uploadStatus = "success";
      state.uploadProgress = 100;
      toast.success("图片上传成功");
    };

    reader.onerror = () => {
      toast.error("文件读取失败，请重试");
      state.uploadStatus = "error";
    };

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        state.uploadProgress = Math.round((e.loaded / e.total) * 100);
      }
    };

    reader.readAsDataURL(file);
  };

  // 优化提示词
  const handleOptimizePrompt = async () => {
    if (!state.originalPrompt.trim() || state.isOptimizing) return;

    if (!state.selectedTemplate) {
      toast.error("请选择优化模板");
      return;
    }

    if (!state.selectedTextModelKey) {
      toast.error("请选择文本模型");
      return;
    }

    // 保存当前选择
    await saveSelections();

    state.isOptimizing = true;
    state.optimizedPrompt = "";
    state.optimizedReasoning = "";

    await nextTick();

    try {
      const request: OptimizationRequest = {
        optimizationMode: "user" as const, // 图像优化使用用户模式
        targetPrompt: state.originalPrompt,
        templateId: state.selectedTemplate.id,
        modelKey: state.selectedTextModelKey,
      };

      await promptService.value!.optimizePromptStream(request, {
        onToken: (token: string) => {
          state.optimizedPrompt += token;
        },
        onReasoningToken: (reasoningToken: string) => {
          state.optimizedReasoning += reasoningToken;
        },
        onComplete: async () => {
          await createHistoryRecord();
          toast.success("提示词优化完成");
        },
        onError: (error: Error) => {
          throw error;
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error("优化失败：" + err.message);
    } finally {
      state.isOptimizing = false;
    }
  };

  // 创建历史记录 - 现在通过 usePromptHistory 的监听机制自动处理
  const createHistoryRecord = async () => {
    if (!state.selectedTemplate || !historyManager.value) {
      return;
    }

    try {
      const recordData = {
        id: uuidv4(),
        originalPrompt: state.originalPrompt,
        optimizedPrompt: state.optimizedPrompt,
        type: templateType.value as PromptRecordType, // 直接使用已有的 templateType 计算属性
        modelKey: state.selectedTextModelKey,
        templateId: state.selectedTemplate.id,
        timestamp: Date.now(),
        metadata: {
          optimizationMode: "user" as OptimizationMode,
          functionMode: "image",
          imageModelKey: state.selectedImageModelKey,
          hasInputImage: !!state.inputImageB64,
          compareMode: state.isCompareMode,
        },
      };

      const newRecord = await historyManager.value.createNewChain(recordData);

      // 🆕 更新历史管理 ref 会自动触发 usePromptHistory 的监听器，刷新全局历史
      currentChainId.value = newRecord.chainId;
      currentVersions.value = newRecord.versions;
      currentVersionId.value = newRecord.currentRecord.id;

      // 广播全局历史刷新事件，触发 App 级历史抽屉刷新
      window.dispatchEvent(new CustomEvent("prompt-optimizer:history-refresh"));
    } catch (error) {
      console.error("创建历史记录失败:", error);
      toast.warning("历史记录保存失败，但优化结果已生成");
    }
  };

  // 生成图像
  const handleGenerateImage = async () => {
    if (!state.selectedImageModelKey || !currentPrompt.value.trim()) {
      toast.error("请选择图像模型并确保有有效的提示词");
      return;
    }

    // 保存当前选择
    await saveSelections();

    const imageRequest: ImageRequest = {
      prompt: currentPrompt.value,
      configId: state.selectedImageModelKey, // 使用选择的模型配置ID
      count: 1,
      inputImage: state.inputImageB64
        ? {
            b64: state.inputImageB64,
            mimeType: state.inputImageMime,
          }
        : undefined,
      paramOverrides: { outputMimeType: "image/png" },
    };

    try {
      if (state.isCompareMode) {
        // 对比模式：生成原始和优化版本
        if (state.originalPrompt.trim()) {
          const originalRequest: ImageRequest = {
            ...imageRequest,
            prompt: state.originalPrompt,
          };
          await generateImage(originalRequest);
          state.originalImageResult = imageResult.value;
        }

        if (state.optimizedPrompt.trim()) {
          const optimizedRequest: ImageRequest = {
            ...imageRequest,
            prompt: state.optimizedPrompt,
          };
          await generateImage(optimizedRequest);
          state.optimizedImageResult = imageResult.value;
        }
      } else {
        // 单一模式：生成当前提示词图像
        await generateImage(imageRequest);
        // 单一模式下按基础模式语义展示"优化后的测试结果"
        if (state.optimizedPrompt.trim()) {
          state.optimizedImageResult = imageResult.value;
        } else if (state.originalPrompt.trim()) {
          // 若尚未有优化内容，则临时作为原始结果
          state.originalImageResult = imageResult.value;
        }
        // 兼容旧UI：仍保留 currentImageResult 赋值
        state.currentImageResult = imageResult.value;
      }

      toast.success("图像生成完成");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error("生成失败：" + err.message);
    }
  };

  // 使用优化后提示词
  const useOptimizedPrompt = () => {
    toast.success("已应用优化后的提示词");
  };

  // 复制优化后提示词
  const copyOptimizedPrompt = async () => {
    try {
      await navigator.clipboard.writeText(state.optimizedPrompt);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  };

  // 切换版本
  const handleSwitchVersion = async (
    version: PromptRecordChain["versions"][number],
  ) => {
    state.optimizedPrompt = version.optimizedPrompt;
    currentVersionId.value = version.id;
    await nextTick();
  };

  // 获取图像显示源地址
  const getImageSrc = (imageItem: ImageResultItem | null | undefined) => {
    if (!imageItem) return "";
    if (imageItem.url) {
      return imageItem.url;
    }
    if (imageItem.b64) {
      const mime = imageItem.mimeType ?? "image/png";
      return `data:${mime};base64,${imageItem.b64}`;
    }
    return "";
  };

  // 下载图像
  const downloadImageFromResult = async (
    imageItem: ImageResultItem | null | undefined,
    prefix: string,
  ) => {
    if (!imageItem) return;
    if (imageItem.url) {
      try {
        const response = await fetch(imageItem.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${prefix}-image.png`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        toast.error("下载失败");
      }
    } else if (imageItem.b64) {
      const a = document.createElement("a");
      const mime = imageItem.mimeType ?? "image/png";
      a.href = `data:${mime};base64,${imageItem.b64}`;
      a.download = `${prefix}-image.png`;
      a.click();
    }
  };

  // 迭代优化处理
  const handleIteratePrompt = async (payload: {
    originalPrompt: string;
    optimizedPrompt: string;
    iterateInput: string;
  }) => {
    if (
      !state.selectedIterateTemplate ||
      !templateManager.value ||
      !promptService.value
    ) {
      console.error("Missing dependencies for iteration");
      return;
    }

    state.isIterating = true;

    // 清空当前内容，准备接收新的流式内容
    const previousOptimizedPrompt = state.optimizedPrompt;
    state.optimizedPrompt = "";
    state.optimizedReasoning = "";

    try {
      await promptService.value.iteratePromptStream(
        payload.originalPrompt,
        payload.optimizedPrompt,
        payload.iterateInput,
        state.selectedTextModelKey,
        {
          onToken: (token: string) => {
            state.optimizedPrompt += token;
          },
          onReasoningToken: (reasoningToken: string) => {
            state.optimizedReasoning += reasoningToken;
          },
          onComplete: async () => {
            try {
              if (historyManager.value && currentChainId.value) {
                const updatedChain = await historyManager.value.addIteration({
                  chainId: currentChainId.value,
                  originalPrompt: payload.originalPrompt,
                  optimizedPrompt: state.optimizedPrompt,
                  iterationNote: payload.iterateInput,
                  modelKey: state.selectedTextModelKey,
                  templateId: state.selectedIterateTemplate!.id,
                });
                // 🆕 更新历史管理 ref 会自动触发 usePromptHistory 的监听器，刷新全局历史
                currentVersions.value = updatedChain.versions;
                currentVersionId.value = updatedChain.currentRecord.id;

                // 广播全局历史刷新事件，触发 App 级历史抽屉刷新
                window.dispatchEvent(
                  new CustomEvent("prompt-optimizer:history-refresh"),
                );
              } else {
                await createHistoryRecord();
              }
              toast.success("提示词迭代优化完成");
            } catch (e) {
              console.error(
                "[useImageWorkspace] Failed to persist iteration:",
                e,
              );
              toast.warning("迭代结果已生成，但历史记录保存失败");
            }
          },
          onError: (error: Error) => {
            throw error;
          },
        },
        state.selectedIterateTemplate.id,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error("迭代优化失败：" + err.message);
      // 恢复之前的内容
      state.optimizedPrompt = previousOptimizedPrompt;
    } finally {
      state.isIterating = false;
    }
  };

  // 复制图像数据
  const copyImageFromResult = async (
    imageItem: ImageResultItem | null | undefined,
  ) => {
    if (!imageItem) return;
    if (imageItem.b64) {
      try {
        await navigator.clipboard.writeText(imageItem.b64);
        toast.success("Base64已复制");
      } catch {
        toast.error("复制失败");
      }
    } else if (imageItem.url) {
      try {
        const response = await fetch(imageItem.url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          try {
            await navigator.clipboard.writeText(base64);
            toast.success("Base64已复制");
          } catch {
            toast.error("复制失败");
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        toast.error("获取图像数据失败");
      }
    }
  };

  // 🆕 处理历史记录恢复
  const handleHistoryRestore = async (event: Event) => {
    const customEvent = event as CustomEvent;
    try {
      const historyData = customEvent.detail;
      console.log("[useImageWorkspace] Restoring history data:", historyData);

      // 恢复基础数据
      state.originalPrompt = historyData.originalPrompt || "";
      state.optimizedPrompt = historyData.optimizedPrompt || "";

      // 恢复版本信息
      currentChainId.value = historyData.chainId || "";
      currentVersions.value = historyData.versions || [];
      currentVersionId.value = historyData.currentVersionId || "";

      // 恢复模型选择（如果历史记录中有保存）
      if (historyData.metadata) {
        if (historyData.metadata.imageModelKey) {
          state.selectedImageModelKey = historyData.metadata.imageModelKey;
        }
        if (historyData.metadata.compareMode !== undefined) {
          state.isCompareMode = historyData.metadata.compareMode;
        }
      }

      // 恢复模板选择（根据历史记录中的templateId）
      if (historyData.templateId && templateManager.value) {
        try {
          // 直接通过ID获取模板，避免类型不匹配导致恢复失败
          const template = await templateManager.value.getTemplate(
            historyData.templateId,
          );
          if (template) {
            state.selectedTemplate = template;
          }
        } catch (error) {
          console.warn(
            "[useImageWorkspace] Failed to restore template by id, fallback to type search:",
            error,
          );
          try {
            // 兼容旧记录：根据当前模式的类型尝试列表查找
            const type = templateType.value;
            const list = await templateManager.value.listTemplatesByType(type);
            const t = list.find((t) => t.id === historyData.templateId);
            if (t) state.selectedTemplate = t;
          } catch (err) {
            console.warn(
              "[useImageWorkspace] Fallback template restore failed:",
              err,
            );
          }
        }
      }

      // 保存恢复的选择
      await saveSelections();

      console.log("[useImageWorkspace] History data restored successfully");
    } catch (error) {
      console.error(
        "[useImageWorkspace] Failed to restore history data:",
        error,
      );
    }
  };

  // 图像模式切换处理
  const handleImageModeChange = async (mode: "text2image" | "image2image") => {
    if (state.imageMode === mode) return;

    // 在切换前保存当前模式的模板选择
    console.log(
      "[handleImageModeChange] Before switch - Current mode:",
      state.imageMode,
      "Current template:",
      state.selectedTemplate?.id,
      state.selectedTemplate?.name,
    );
    if (state.selectedTemplate) {
      const currentTemplateType = templateType.value;
      const currentPerModeKey =
        currentTemplateType === "text2imageOptimize"
          ? IMAGE_MODE_KEYS.SELECTED_TEMPLATE_TEXT2IMAGE
          : IMAGE_MODE_KEYS.SELECTED_TEMPLATE_IMAGE2IMAGE;
      console.log(
        "[handleImageModeChange] Saving current template to key:",
        currentPerModeKey,
        "template:",
        state.selectedTemplate.id,
      );
      await setPreference(currentPerModeKey, state.selectedTemplate.id);
    }

    state.imageMode = mode;
    console.log("[handleImageModeChange] Switched to mode:", mode);

    // 如果切换到文生图模式，清除上传的图片
    if (mode === "text2image" && state.inputImageB64) {
      state.inputImageB64 = null;
    }

    // 恢复新模式的模板（restoreTemplateSelection 内部已处理所有逻辑）
    console.log(
      "[handleImageModeChange] About to restore template for new mode...",
    );
    await restoreTemplateSelection();

    console.log(
      "[handleImageModeChange] After switch - New mode:",
      mode,
      "Restored template:",
      state.selectedTemplate?.id,
      state.selectedTemplate?.name,
    );
  };

  // 打开模板管理器
  const handleOpenTemplateManager = (type?: WorkspaceTemplateType) => {
    let target: WorkspaceTemplateType | undefined = type;
    if (target === 'iterate') {
      target = 'imageIterate';
    }
    if (!target) {
      target = state.imageMode === 'text2image' ? 'text2imageOptimize' : 'image2imageOptimize';
    }
    templateManagerState.currentType = target;
    templateManagerState.showTemplates = true;
  };

  // 🆕 清理事件监听器
  const cleanup = () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "image-workspace-restore",
        handleHistoryRestore as EventListener,
      );
    }
  };

  // 🆕 在 composable 创建时立即注册事件监听器（在函数定义之后）
  if (typeof window !== "undefined") {
    window.addEventListener(
      "image-workspace-restore",
      handleHistoryRestore as EventListener,
    );
    console.log(
      "[useImageWorkspace] Event listener registered immediately on composable creation",
    );
  }

  // 🆕 评估处理器
  const evaluationHandler = useEvaluationHandler({
    services,
    originalPrompt: toRef(state, "originalPrompt"),
    optimizedPrompt: toRef(state, "optimizedPrompt"),
    testContent: computed(() => ""),
    testResults: ref(null),
    evaluationModelKey: toRef(state, "selectedTextModelKey"),
    functionMode: computed(() => "image"),
    subMode: computed(() => state.imageMode),
    externalEvaluation,
  });

  /**
   * 分析功能：清空版本链，创建 V0（原始版本）
   * - 不写入历史记录
   * - 只创建内存中的虚拟 V0 版本
   */
  const handleAnalyze = () => {
    if (!state.originalPrompt.trim()) return

    // 生成虚拟的 V0 版本记录（不写入历史）
    const virtualV0Id = uuidv4()
    const virtualV0: PromptRecordChain["versions"][number] = {
      id: virtualV0Id,
      chainId: '', // 虚拟链，不关联真实历史
      version: 0,
      originalPrompt: state.originalPrompt,
      optimizedPrompt: state.originalPrompt, // V0 的优化内容就是原始内容
      type: 'imageOptimize',
      timestamp: Date.now(),
      modelKey: '',
      templateId: '',
    }

    // 清空旧链条，设置新的 V0
    currentChainId.value = ''
    currentVersions.value = [virtualV0]
    currentVersionId.value = virtualV0Id
    state.optimizedPrompt = state.originalPrompt
  }

  return {
    // 状态 - 使用 toRefs 保持响应式
    originalPrompt: toRef(state, "originalPrompt"),
    optimizedPrompt: toRef(state, "optimizedPrompt"),
    optimizedReasoning: toRef(state, "optimizedReasoning"),
    isOptimizing: toRef(state, "isOptimizing"),
    isIterating: toRef(state, "isIterating"),
    imageMode: toRef(state, "imageMode"),
    selectedTextModelKey: toRef(state, "selectedTextModelKey"),
    selectedImageModelKey: toRef(state, "selectedImageModelKey"),
    selectedTemplate: toRef(state, "selectedTemplate"),
    selectedIterateTemplate: toRef(state, "selectedIterateTemplate"),
    inputImageB64: toRef(state, "inputImageB64"),
    isCompareMode: toRef(state, "isCompareMode"),
    originalImageResult: toRef(state, "originalImageResult"),
    optimizedImageResult: toRef(state, "optimizedImageResult"),
    currentImageResult: toRef(state, "currentImageResult"),
    // 🆕 使用历史管理专用的 ref
    currentVersions,
    currentVersionId,
    uploadStatus: toRef(state, "uploadStatus"),
    uploadProgress: toRef(state, "uploadProgress"),

    // 计算属性
    currentPrompt,
    previewImageUrl,
    templateType,
    textModelOptions,
    imageModelOptions,
    optimizationMode,
    advancedModeEnabled,
    selectedImageModelCapabilities,
    selectedImageModelInfo,

    // 图像生成状态
    isGenerating,
    generationProgress,
    generationError,

    // 方法
    initialize,
    handleUploadChange,
    handleOptimizePrompt,
    handleIteratePrompt,
    handleGenerateImage,
    handleImageModeChange,
    // 暴露模板恢复方法，便于在外层在列表加载后再次对齐选择
    restoreTemplateSelection,
    handleOpenTemplateManager,
    useOptimizedPrompt,
    copyOptimizedPrompt,
    handleSwitchVersion,
    getImageSrc,
    downloadImageFromResult,
    copyImageFromResult,
    saveSelections,
    cleanup,
    refreshTextModels,
    refreshImageModels,
    templateManagerState,

    // 🆕 评估处理器
    evaluationHandler,

    // 🆕 分析功能
    handleAnalyze,
  };
}
