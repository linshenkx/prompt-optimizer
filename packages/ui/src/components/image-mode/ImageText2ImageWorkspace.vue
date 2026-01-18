<template>
    <!-- 使用NFlex实现水平左右布局，参考App.vue的实现 -->
    <NFlex
        data-testid="workspace"
        data-mode="image-text2image"
        justify="space-between"
        :style="{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '100%',
            gap: '16px',
            overflow: 'hidden',
        }"
    >
        <!-- 左侧：提示词优化区域（文本模型） -->
        <NFlex
            vertical
            :style="{ flex: 1, overflow: 'auto', height: '100%' }"
            size="medium"
        >
            <!-- 输入控制区域 - 对齐InputPanel布局 -->
            <NCard :style="{ flexShrink: 0 }">
                <!-- 折叠态：只显示标题栏 -->
                <NFlex
                    v-if="isInputPanelCollapsed"
                    justify="space-between"
                    align="center"
                >
                    <NFlex align="center" :size="8">
                        <NText :depth="1" style="font-size: 18px; font-weight: 500">
                            {{ t('imageWorkspace.input.originalPrompt') }}
                        </NText>
                        <NText
                            v-if="originalPrompt"
                            depth="3"
                            style="font-size: 12px;"
                        >
                            {{ promptSummary }}
                        </NText>
                    </NFlex>
                    <NButton
                        type="tertiary"
                        size="small"
                        ghost
                        round
                        @click="isInputPanelCollapsed = false"
                        :title="t('common.expand')"
                    >
                        <template #icon>
                            <NIcon>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </NIcon>
                        </template>
                    </NButton>
                </NFlex>

                <!-- 展开态：完整输入面板 -->
                <NSpace v-else vertical :size="16">
                    <!-- 标题区域 -->
                    <NFlex justify="space-between" align="center" :wrap="false">
                        <NText
                            :depth="1"
                            style="font-size: 18px; font-weight: 500"
                            >{{
                                t("imageWorkspace.input.originalPrompt")
                            }}</NText
                        >
                        <NFlex align="center" :size="12">
                            <NButton
                                type="tertiary"
                                size="small"
                                @click="openFullscreen"
                                :title="t('common.expand')"
                                ghost
                                round
                            >
                                <template #icon>
                                    <NIcon>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            stroke-width="2"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                            />
                                        </svg>
                                    </NIcon>
                                </template>
                            </NButton>
                            <!-- 折叠按钮 -->
                            <NButton
                                type="tertiary"
                                size="small"
                                ghost
                                round
                                @click="isInputPanelCollapsed = true"
                                :title="t('common.collapse')"
                            >
                                <template #icon>
                                    <NIcon>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                                        </svg>
                                    </NIcon>
                                </template>
                            </NButton>
                        </NFlex>
                    </NFlex>

                    <!-- 输入框 -->
                    <NInput
                        v-model:value="originalPrompt"
                        type="textarea"
                        data-testid="image-text2image-input"
                        :placeholder="
                            t('imageWorkspace.input.originalPromptPlaceholder')
                        "
                        :rows="4"
                        :autosize="{ minRows: 4, maxRows: 12 }"
                        clearable
                        :disabled="isOptimizing"
                    />

                    <!-- 控制面板 - 使用网格布局 -->
                    <NGrid :cols="24" :x-gap="8" responsive="screen">
                        <!-- 文本模型选择 -->
                        <NGridItem :span="7" :xs="24" :sm="7">
                            <NSpace vertical :size="8">
                                <NText
                                    :depth="2"
                                    style="font-size: 14px; font-weight: 500"
                                    >{{
                                        t("imageWorkspace.input.textModel")
                                    }}</NText
                                >
                                <template v-if="appOpenModelManager">
                                    <SelectWithConfig
                                        v-model="selectedTextModelKey"
                                        :options="textModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.modelPlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="handleTextModelSelectFocus"
                                        @config="
                                            () =>
                                                appOpenModelManager &&
                                                appOpenModelManager('text')
                                        "
                                    />
                                </template>
                                <template v-else>
                                    <SelectWithConfig
                                        v-model="selectedTextModelKey"
                                        :options="textModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.modelPlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        @focus="handleTextModelSelectFocus"
                                    />
                                </template>
                            </NSpace>
                        </NGridItem>

                        <!-- 优化模板选择 -->
                        <NGridItem :span="11" :xs="24" :sm="11">
                            <NSpace vertical :size="8">
                                <NText
                                    :depth="2"
                                    style="font-size: 14px; font-weight: 500"
                                    >{{
                                        t(
                                            "imageWorkspace.input.optimizeTemplate",
                                        )
                                    }}</NText
                                >
                                <template
                                    v-if="services && services.templateManager"
                                >
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdForSelect"
                                        :options="templateOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.templatePlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="handleTemplateSelectFocus"
                                        @config="
                                            () =>
                                                onOpenTemplateManager(
                                                    templateType,
                                                )
                                        "
                                    />
                                </template>
                                <NText
                                    v-else
                                    depth="3"
                                    style="padding: 0; font-size: 14px"
                                >
                                    {{ t("common.loading") }}
                                </NText>
                            </NSpace>
                        </NGridItem>

                        <!-- 分析与优化按钮 -->
                        <NGridItem :span="6" :xs="24" :sm="6" class="flex items-end justify-end">
                            <NSpace :size="8">
                                <!-- 分析按钮（与优化同级） -->
                                <NButton
                                    type="default"
                                    size="medium"
                                    data-testid="image-text2image-analyze-button"
                                    :loading="isAnalyzing"
                                    @click="handleAnalyze"
                                    :disabled="
                                        isAnalyzing ||
                                        isOptimizing ||
                                        !originalPrompt.trim()
                                    "
                                >
                                    {{
                                        isAnalyzing
                                            ? t('promptOptimizer.analyzing')
                                            : t('promptOptimizer.analyze')
                                    }}
                                </NButton>
                                <!-- 优化按钮 -->
                                <NButton
                                    type="primary"
                                    size="medium"
                                    data-testid="image-text2image-optimize-button"
                                    :loading="isOptimizing"
                                    @click="handleOptimizePrompt"
                                    :disabled="
                                        isAnalyzing ||
                                        isOptimizing ||
                                        !originalPrompt.trim() ||
                                        !selectedTextModelKey ||
                                        !selectedTemplate
                                    "
                                >
                                    {{
                                        isOptimizing
                                            ? t("common.loading")
                                            : t("promptOptimizer.optimize")
                                    }}
                                </NButton>
                            </NSpace>
                        </NGridItem>
                    </NGrid>
                </NSpace>
            </NCard>

            <!-- 优化结果区域 - 使用与基础模式一致的卡片容器 -->
            <NCard
                :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <PromptPanelUI
                    v-if="services && services.templateManager"
                    test-id="image-text2image"
                    ref="promptPanelRef"
                    v-model:optimized-prompt="optimizedPrompt"
                    :reasoning="optimizedReasoning"
                    :original-prompt="originalPrompt"
                    :is-optimizing="isOptimizing"
                    :is-iterating="isIterating"
                    v-model:selected-iterate-template="selectedIterateTemplate"
                    :versions="currentVersions"
                    :current-version-id="currentVersionId"
                    :optimization-mode="optimizationMode"
                    :advanced-mode-enabled="advancedModeEnabled"
                    iterate-template-type="imageIterate"
                    @iterate="handleIteratePrompt"
                    @openTemplateManager="onOpenTemplateManager"
                    @switchVersion="handleSwitchVersion"
                    @save-favorite="handleSaveFavorite"
                />
            </NCard>
        </NFlex>

        <!-- 右侧：图像生成测试区域（图像模型） -->
        <NFlex
            vertical
            :style="{
                flex: 1,
                overflow: 'auto',
                height: '100%',
                gap: '12px',
            }"
        >
            <!-- 测试控制栏 -->
            <NCard :style="{ flexShrink: 0 }" size="small">
                    <n-form label-placement="left" size="medium">
                        <n-form-item
                            :label="t('imageWorkspace.generation.imageModel')"
                        >
                            <n-space align="center" :size="12">
                                <template v-if="appOpenModelManager">
                                    <SelectWithConfig
                                        data-testid="image-text2image-image-model-select"
                                        v-model="selectedImageModelKey"
                                        :options="imageModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.generation.imageModelPlaceholder',
                                            )
                                        "
                                        style="
                                            min-width: 200px;
                                            max-width: 100%;
                                        "
                                        :disabled="isGenerating"
                                        filterable
                                        @config="
                                            () =>
                                                appOpenModelManager &&
                                                appOpenModelManager('image')
                                        "
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                    />
                                </template>
                                <template v-else>
                                    <SelectWithConfig
                                        data-testid="image-text2image-image-model-select"
                                        v-model="selectedImageModelKey"
                                        :options="imageModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.generation.imageModelPlaceholder',
                                            )
                                        "
                                        style="
                                            min-width: 200px;
                                            max-width: 100%;
                                        "
                                        :disabled="isGenerating"
                                        filterable
                                    />
                                </template>
                                <!-- 当前选中模型名称标签 -->
                                <n-tag
                                    v-if="selectedImageModelInfo?.model"
                                    size="small"
                                    type="primary"
                                    :bordered="false"
                                >
                                    {{ selectedImageModelInfo.model }}
                                </n-tag>
                            </n-space>
                        </n-form-item>
                        <n-form-item>
                            <n-space align="center" wrap>
                                <n-switch
                                    data-testid="image-text2image-generate-compare-toggle"
                                    v-model:value="isCompareMode"
                                    :disabled="isGenerating"
                                />
                                <n-text depth="3">{{
                                    t("imageWorkspace.generation.compareMode")
                                }}</n-text>
                                <n-button
                                    data-testid="image-text2image-generate-button"
                                    type="primary"
                                    :loading="isGenerating"
                                    @click="handleGenerateImage"
                                    :disabled="
                                        !currentPrompt.trim() ||
                                        !selectedImageModelKey
                                    "
                                >
                                    {{
                                        isGenerating
                                            ? t(
                                                  "imageWorkspace.generation.generating",
                                              )
                                            : t(
                                                  "imageWorkspace.generation.generateImage",
                                              )
                                    }}
                                </n-button>
                            </n-space>
                        </n-form-item>
                    </n-form>
            </NCard>

            <!-- 图像结果展示区域（使用统一的 TestResultSection 布局） -->
            <TestResultSection
                :is-compare-mode="isCompareMode"
                :style="{ flex: 1, minHeight: 0 }"
                :original-title="t('imageWorkspace.results.originalPromptResult')"
                :optimized-title="t('imageWorkspace.results.optimizedPromptResult')"
                :single-result-title="t('imageWorkspace.results.optimizedPromptResult')"
            >
                 <template #original-result>
                     <template
                            v-if="
                                originalImageResult &&
                                originalImageResult.images.length > 0
                            "
                        >
                            <!-- 多模态结果显示：图像 + 文本（使用Naive UI组件） -->
                            <NSpace vertical :size="12">
                                <!-- 图像显示 -->
                                <NImage
                                    data-testid="image-text2image-original-image"
                                    :src="
                                        getImageSrc(
                                            originalImageResult.images[0],
                                        )
                                    "
                                    object-fit="contain"
                                    :img-props="{
                                        style: {
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                        },
                                    }"
                                />

                                <!-- 文本输出显示（如果存在） -->
                                <template v-if="originalImageResult.text">
                                    <NCard
                                        size="small"
                                        :title="
                                            t(
                                                'imageWorkspace.results.textOutput',
                                            )
                                        "
                                        style="margin-top: 8px"
                                    >
                                        <NText
                                            :depth="2"
                                            style="
                                                white-space: pre-wrap;
                                                line-height: 1.5;
                                            "
                                        >
                                            {{ originalImageResult.text }}
                                        </NText>
                                    </NCard>
                                </template>

                                <!-- 操作按钮 -->
                                <NSpace justify="center" :size="8">
                                    <NButton
                                        size="small"
                                        @click="
                                            downloadImageFromResult(
                                                originalImageResult.images[0],
                                                'original',
                                            )
                                        "
                                    >
                                        <template #icon>
                                            <NIcon>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                >
                                                    <path
                                                        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                                                    />
                                                </svg>
                                            </NIcon>
                                        </template>
                                        {{
                                            t("imageWorkspace.results.download")
                                        }}
                                    </NButton>

                                    <NButton
                                        v-if="originalImageResult.text"
                                        size="small"
                                        secondary
                                        @click="
                                            copyImageText(
                                                originalImageResult.text,
                                            )
                                        "
                                    >
                                        <template #icon>
                                            <NIcon>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                >
                                                    <rect
                                                        x="9"
                                                        y="9"
                                                        width="13"
                                                        height="13"
                                                        rx="2"
                                                        ry="2"
                                                    />
                                                    <path
                                                        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                                                    />
                                                </svg>
                                            </NIcon>
                                        </template>
                                        {{
                                            t("imageWorkspace.results.copyText")
                                        }}
                                    </NButton>
                                </NSpace>
                            </NSpace>
                        </template>
                        <template v-else>
                            <NEmpty
                                :description="
                                    t('imageWorkspace.results.noOriginalResult')
                                "
                            />
                        </template>
                    </template>

                    <template #optimized-result>
                        <template
                            v-if="
                                optimizedImageResult &&
                                optimizedImageResult.images.length > 0
                            "
                        >
                            <!-- 多模态结果显示：图像 + 文本（使用Naive UI组件） -->
                            <NSpace vertical :size="12">
                                <!-- 图像显示 -->
                                <NImage
                                    data-testid="image-text2image-optimized-image"
                                    :src="
                                        getImageSrc(
                                            optimizedImageResult.images[0],
                                        )
                                    "
                                    object-fit="contain"
                                    :img-props="{
                                        style: {
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                        },
                                    }"
                                />

                                <!-- 文本输出显示（如果存在） -->
                                <template v-if="optimizedImageResult.text">
                                    <NCard
                                        size="small"
                                        :title="
                                            t(
                                                'imageWorkspace.results.textOutput',
                                            )
                                        "
                                        style="margin-top: 8px"
                                    >
                                        <NText
                                            :depth="2"
                                            style="
                                                white-space: pre-wrap;
                                                line-height: 1.5;
                                            "
                                        >
                                            {{ optimizedImageResult.text }}
                                        </NText>
                                    </NCard>
                                </template>

                                <!-- 操作按钮 -->
                                <NSpace justify="center" :size="8">
                                    <NButton
                                        size="small"
                                        @click="
                                            downloadImageFromResult(
                                                optimizedImageResult.images[0],
                                                'optimized',
                                            )
                                        "
                                    >
                                        <template #icon>
                                            <NIcon>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                >
                                                    <path
                                                        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                                                    />
                                                </svg>
                                            </NIcon>
                                        </template>
                                        {{
                                            t("imageWorkspace.results.download")
                                        }}
                                    </NButton>

                                    <NButton
                                        v-if="optimizedImageResult.text"
                                        size="small"
                                        secondary
                                        @click="
                                            copyImageText(
                                                optimizedImageResult.text,
                                            )
                                        "
                                    >
                                        <template #icon>
                                            <NIcon>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                >
                                                    <rect
                                                        x="9"
                                                        y="9"
                                                        width="13"
                                                        height="13"
                                                        rx="2"
                                                        ry="2"
                                                    />
                                                    <path
                                                        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                                                    />
                                                </svg>
                                            </NIcon>
                                        </template>
                                        {{
                                            t("imageWorkspace.results.copyText")
                                        }}
                                    </NButton>
                                </NSpace>
                            </NSpace>
                        </template>
                        <template v-else>
                            <NEmpty
                                :description="
                                    t(
                                        'imageWorkspace.results.noOptimizedResult',
                                    )
                                "
                            />
                        </template>
                    </template>

                    <template #single-result>
                        <template
                            v-if="
                                optimizedImageResult &&
                                optimizedImageResult.images.length > 0
                            "
                        >
                            <!-- 多模态结果显示：图像 + 文本（使用Naive UI组件） -->
                            <NSpace vertical :size="12">
                                <!-- 图像显示 -->
                                <NImage
                                    data-testid="image-text2image-single-image"
                                    :src="
                                        getImageSrc(
                                            optimizedImageResult.images[0],
                                        )
                                    "
                                    object-fit="contain"
                                    :img-props="{
                                        style: {
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                        },
                                    }"
                                />

                                <!-- 文本输出显示（如果存在） -->
                                <template v-if="optimizedImageResult.text">
                                    <NCard
                                        size="small"
                                        :title="
                                            t(
                                                'imageWorkspace.results.textOutput',
                                            )
                                        "
                                        style="margin-top: 8px"
                                    >
                                        <NText
                                            :depth="2"
                                            style="
                                                white-space: pre-wrap;
                                                line-height: 1.5;
                                            "
                                        >
                                            {{ optimizedImageResult.text }}
                                        </NText>
                                    </NCard>
                                </template>

                                <!-- 操作按钮 -->
                                <NSpace justify="center" :size="8">
                                    <NButton
                                        @click="
                                            downloadImageFromResult(
                                                optimizedImageResult.images[0],
                                                'optimized',
                                            )
                                        "
                                    >
                                        <template #icon>
                                            <NIcon>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                >
                                                    <path
                                                        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                                                    />
                                                </svg>
                                            </NIcon>
                                        </template>
                                        {{
                                            t("imageWorkspace.results.download")
                                        }}
                                    </NButton>

                                    <NButton
                                        v-if="optimizedImageResult.text"
                                        size="small"
                                        secondary
                                        @click="
                                            copyImageText(
                                                optimizedImageResult.text,
                                            )
                                        "
                                    >
                                        <template #icon>
                                            <NIcon>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="2"
                                                >
                                                    <rect
                                                        x="9"
                                                        y="9"
                                                        width="13"
                                                        height="13"
                                                        rx="2"
                                                        ry="2"
                                                    />
                                                    <path
                                                        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                                                    />
                                                </svg>
                                            </NIcon>
                                        </template>
                                        {{
                                            t("imageWorkspace.results.copyText")
                                        }}
                                    </NButton>
                                </NSpace>
                            </NSpace>
                        </template>
                        <template v-else>
                            <NEmpty
                                :description="t('imageWorkspace.results.noGenerationResult')"
                            />
                        </template>
                    </template>
                </TestResultSection>
        </NFlex>
    </NFlex>

    <!-- 原始提示词 - 全屏编辑器 -->
    <FullscreenDialog
        v-model="isFullscreen"
        :title="t('imageWorkspace.input.originalPrompt')"
    >
        <NInput
            v-model:value="fullscreenValue"
            type="textarea"
            :placeholder="t('imageWorkspace.input.originalPromptPlaceholder')"
            :autosize="{ minRows: 20 }"
            clearable
            show-count
            :disabled="isOptimizing"
        />
    </FullscreenDialog>

    <!-- 模板管理器由 App 统一管理，这里不再渲染 -->
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, inject, ref, computed, nextTick, type Ref } from 'vue'

import {
    NCard,
    NButton,
    NInput,
    NEmpty,
    NFormItem,
    NForm,
    NSpace,
    NImage,
    NText,
    NSwitch,
    NFlex,
    NGrid,
    NGridItem,
    NIcon,
    NTag,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import PromptPanelUI from "../PromptPanel.vue";
import TestResultSection from "../TestResultSection.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import { provideEvaluation, useEvaluationContextOptional } from '../../composables/prompt/useEvaluationContext';
import { OptionAccessors } from "../../utils/data-transformer";
import type { AppServices } from "../../types/services";
import { useFullscreen } from "../../composables/ui/useFullscreen";
import FullscreenDialog from "../FullscreenDialog.vue";
import type { SelectOption } from "../../types/select-options";
import { useToast } from "../../composables/ui/useToast";
import { getI18nErrorMessage } from '../../utils/error'
import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageGeneration } from '../../composables/image/useImageGeneration'
import { useEvaluationHandler, type TestResultsData } from '../../composables/prompt/useEvaluationHandler'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useWorkspaceTextModelSelection } from '../../composables/workspaces/useWorkspaceTextModelSelection'
import {
    type ImageModelConfig,
    type Text2ImageRequest,
    type ImageResult,
    type ImageResultItem,
    type OptimizationMode,
    type OptimizationRequest,
    type PromptRecordChain,
    type PromptRecordType,
    type Template,
} from '@prompt-optimizer/core'
import { v4 as uuidv4 } from 'uuid'

// 国际化
const { t } = useI18n();

// Toast
const toast = useToast();

// 服务注入
const services = inject<Ref<AppServices | null>>("services", ref(null));

// 获取全局评估实例（如果存在，由 App 层 provideEvaluation 注入）
const globalEvaluation = useEvaluationContextOptional();

// Session store（单一真源）
const session = useImageText2ImageSession()

// 图像生成相关
const {
    imageModels,
    generating: isGenerating,
    result: imageResult,
    generateText2Image,
    validateText2ImageRequest,
    loadImageModels,
} = useImageGeneration()

// 服务引用
const historyManager = computed(() => services.value?.historyManager)
const promptService = computed(() => services.value?.promptService)

// 过程态（本地，不持久化）
const isOptimizing = ref(false)
const isIterating = ref(false)

// 历史管理专用 ref（不写入 session store）
const currentChainId = ref('')
const currentVersions = ref<PromptRecordChain['versions']>([])
const currentVersionId = ref('')

// 字段级访问器（从 session state）
const originalPrompt = computed<string>({
    get: () => session.originalPrompt || '',
    set: (value) => session.updatePrompt(value || ''),
})

const optimizedPrompt = computed<string>({
    get: () => session.optimizedPrompt || '',
    set: (value) => {
        session.updateOptimizedResult({
            optimizedPrompt: value || '',
            reasoning: session.reasoning || '',
            chainId: session.chainId || '',
            versionId: session.versionId || '',
        })
    },
})

const optimizedReasoning = computed<string>({
    get: () => session.reasoning || '',
    set: (value) => {
        session.updateOptimizedResult({
            optimizedPrompt: session.optimizedPrompt || '',
            reasoning: value || '',
            chainId: session.chainId || '',
            versionId: session.versionId || '',
        })
    },
})

// Text 模型选择（与模板选择对齐：自动刷新 + 兜底写回 session store）
const modelSelection = useWorkspaceTextModelSelection(services, session)
const selectedTextModelKey = modelSelection.selectedTextModelKey

const selectedImageModelKey = computed<string>({
    get: () => session.selectedImageModelKey || '',
    set: (value) => session.updateImageModel(value || ''),
})

const templateSelection = useWorkspaceTemplateSelection(
    services,
    session,
    'text2imageOptimize',
    'imageIterate',
)

const selectedTemplateId = templateSelection.selectedTemplateId
const templateOptions = templateSelection.templateOptions

const isCompareMode = computed<boolean>({
    get: () => !!session.isCompareMode,
    set: (value) => session.toggleCompareMode(!!value),
})

const originalImageResult = computed<ImageResult | null>({
    get: () => session.originalImageResult || null,
    set: (value) => session.updateOriginalImageResult(value || null),
})

const optimizedImageResult = computed<ImageResult | null>({
    get: () => session.optimizedImageResult || null,
    set: (value) => session.updateOptimizedImageResult(value || null),
})

// 当前提示词（用于生成图像）
const currentPrompt = computed(() => optimizedPrompt.value || originalPrompt.value)

// 固定模板类型
const templateType = computed(() => "text2imageOptimize" as const)

// 图像模式统一使用 user 模式
const optimizationMode = 'user' as OptimizationMode
const advancedModeEnabled = false

const selectedTemplate = templateSelection.selectedTemplate

// PromptPanel 需要 Template 对象的 v-model；用 wrapper 同步写回 iterateTemplateId
const selectedIterateTemplate = computed<Template | null>({
    get: () => templateSelection.selectedIterateTemplate.value,
    set: (template) => {
        templateSelection.selectedIterateTemplateId.value = template?.id ?? ''
        templateSelection.selectedIterateTemplate.value = template ?? null
    },
})

// 模型选项
const textModelOptions = modelSelection.textModelOptions
const imageModelOptions = ref<SelectOption<ImageModelConfig>[]>([])

// 选中图像模型的Provider/Model信息
const selectedImageModelInfo = computed(() => {
    if (!selectedImageModelKey.value) return null
    const selectedConfig = imageModels.value.find(m => m.id === selectedImageModelKey.value)
    if (!selectedConfig) return null

    return {
        provider: selectedConfig.provider?.name || selectedConfig.providerId || 'Unknown',
        model: selectedConfig.model?.name || selectedConfig.modelId || 'Unknown',
    }
})

// 评估处理器（图像模式专用：testResults 不参与）
const evaluationHandler = useEvaluationHandler({
    services,
    originalPrompt,
    optimizedPrompt,
    testContent: computed(() => ''),
    testResults: ref<TestResultsData | null>(null),
    evaluationModelKey: selectedTextModelKey,
    functionMode: computed(() => 'image'),
    subMode: computed(() => 'text2image'),
    externalEvaluation: globalEvaluation || undefined,
})

// 提供评估上下文给 PromptPanel（优先复用全局 evaluation，避免与 App 的 EvaluationPanel 分裂）
provideEvaluation(evaluationHandler.evaluation)

// PromptPanel 引用，用于在语言切换后刷新迭代模板选择
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

// 输入区折叠状态（初始展开）
const isInputPanelCollapsed = ref(false);

// 提示词摘要（折叠态显示）
const promptSummary = computed(() => {
    if (!originalPrompt.value) return '';
    return originalPrompt.value.length > 50
        ? originalPrompt.value.slice(0, 50) + '...'
        : originalPrompt.value;
});

/** 是否正在执行分析 */
const isAnalyzing = ref(false);

/**
 * 处理分析操作
 */
const handleAnalyze = async () => {
    if (!originalPrompt.value?.trim()) return;
    if (isOptimizing.value) return;

    isAnalyzing.value = true;

    // 1. 清空版本链，创建虚拟 V0
    const virtualV0Id = uuidv4()
    const virtualV0: PromptRecordChain['versions'][number] = {
        id: virtualV0Id,
        chainId: '',
        version: 0,
        originalPrompt: originalPrompt.value,
        optimizedPrompt: originalPrompt.value,
        type: 'imageOptimize',
        timestamp: Date.now(),
        modelKey: '',
        templateId: '',
    }

    currentChainId.value = ''
    currentVersions.value = [virtualV0]
    currentVersionId.value = virtualV0Id
    optimizedPrompt.value = originalPrompt.value
    session.updateOptimizedResult({
        optimizedPrompt: originalPrompt.value,
        reasoning: '',
        chainId: '',
        versionId: '',
    })

    // 2. 清理旧的提示词评估结果，避免跨提示词残留
    evaluationHandler.evaluation.clearResult('prompt-only');
    evaluationHandler.evaluation.clearResult('prompt-iterate');

    // 3. 收起输入区域
    isInputPanelCollapsed.value = true;

    await nextTick();

    // 4. 触发 prompt-only 评估
    try {
        await evaluationHandler.handleEvaluate('prompt-only');
    } finally {
        isAnalyzing.value = false;
    }
};

// 注入 App 层统一的 openTemplateManager / openModelManager / handleSaveFavorite 接口
type TemplateEntryType =
    | "optimize"
    | "userOptimize"
    | "iterate"
    | "contextIterate"
    | "text2imageOptimize"
    | "image2imageOptimize"
    | "imageIterate";

const appOpenTemplateManager = inject<
    ((type?: TemplateEntryType) => void) | null
>("openTemplateManager", null);
const appOpenModelManager = inject<
    ((tab?: "text" | "image" | "function") => void) | null
>("openModelManager", null);
const appHandleSaveFavorite = inject<
    ((data: { content: string; originalContent?: string }) => void) | null
>("handleSaveFavorite", null);

// 将迭代类型映射为图像迭代，并调用 App 入口
const onOpenTemplateManager = (type: TemplateEntryType) => {
    const target: TemplateEntryType =
        type === "iterate" || type === "contextIterate" ? "imageIterate" : type;
    appOpenTemplateManager?.(target);
};

// 全屏编辑：复用 useFullscreen 模式，编辑 originalPrompt
const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
    computed(() => originalPrompt.value),
    (value) => {
        originalPrompt.value = value;
    },
);

// ========== 模板 SelectWithConfig 选中绑定 ==========
const selectedTemplateIdForSelect = computed<string>({
    get() {
        const id = selectedTemplateId.value || "";
        if (!id) return "";
        const existsInList = (templateOptions.value || []).some(
            (opt) => opt.value === id,
        );
        return existsInList ? id : "";
    },
    set(id: string) {
        selectedTemplateId.value = id || "";
    },
});

// 处理收藏保存请求 - 调用 App.vue 提供的统一接口
const handleSaveFavorite = (data: {
    content: string;
    originalContent?: string;
}) => {
    console.log("[ImageText2ImageWorkspace] handleSaveFavorite triggered:", data);

    if (appHandleSaveFavorite) {
        appHandleSaveFavorite(data);
    } else {
        console.warn(
            "[ImageText2ImageWorkspace] handleSaveFavorite not available from App.vue",
        );
    }
};

// 复制图像文本输出
const copyImageText = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(t("imageWorkspace.results.copySuccess"));
    } catch (error) {
        console.error("Failed to copy text:", error);
        toast.error(t("imageWorkspace.results.copyError"));
    }
};

// 处理收藏回填 - 从收藏夹恢复提示词到图像工作区
interface RestoreFavoriteDetail {
    content: string;
    imageSubMode?: "text2image" | "image2image";
}

const handleRestoreFavorite = async (event: Event) => {
    if (!(event instanceof CustomEvent)) {
        return;
    }
    console.log(
        "[ImageText2ImageWorkspace] handleRestoreFavorite triggered:",
        event.detail,
    );
    const { content } = event.detail as RestoreFavoriteDetail;

    // 设置原始提示词
    originalPrompt.value = content;

    console.log("[ImageText2ImageWorkspace] Favorite restored successfully");
};

type ImageWorkspaceRestoreDetail = {
    originalPrompt?: unknown;
    optimizedPrompt?: unknown;
    metadata?: unknown;
    chainId?: unknown;
    versions?: unknown;
    currentVersionId?: unknown;
    imageMode?: unknown;
    templateId?: unknown;
};

const handleRestoreHistory = async (event: Event) => {
    if (!(event instanceof CustomEvent)) {
        return;
    }

    const detail = event.detail as ImageWorkspaceRestoreDetail;
    if (detail?.imageMode !== "text2image") return;

    const versions = Array.isArray(detail.versions)
        ? (detail.versions as PromptRecordChain["versions"])
        : [];

    const requestedVersionId =
        typeof detail.currentVersionId === "string" ? detail.currentVersionId : "";
    const record =
        (requestedVersionId &&
            versions.find((v) => v.id === requestedVersionId)) ||
        versions[versions.length - 1] ||
        null;

    const original =
        (record?.originalPrompt && record.originalPrompt) ||
        (typeof detail.originalPrompt === "string" ? detail.originalPrompt : "");
    const optimized =
        (record?.optimizedPrompt && record.optimizedPrompt) ||
        (typeof detail.optimizedPrompt === "string" ? detail.optimizedPrompt : "");

    // 1) Restore local history refs (PromptPanel versions list)
    currentChainId.value = typeof detail.chainId === "string" ? detail.chainId : "";
    currentVersions.value = versions;
    currentVersionId.value = record?.id || requestedVersionId || "";

    // 2) Restore session store (single source of truth for fields)
    originalPrompt.value = original;
    session.updateOptimizedResult({
        optimizedPrompt: optimized,
        reasoning: "",
        chainId: currentChainId.value || session.chainId || "",
        versionId: currentVersionId.value || session.versionId || "",
    });

    if (record?.modelKey) {
        session.updateTextModel(record.modelKey);
    }

    if (record?.templateId) {
        session.updateTemplate(record.templateId);
    } else if (typeof detail.templateId === "string") {
        session.updateTemplate(detail.templateId);
    }

    const meta =
        (record?.metadata as unknown as Record<string, unknown> | undefined) ||
        (typeof detail.metadata === "object" && detail.metadata
            ? (detail.metadata as Record<string, unknown>)
            : undefined);

    const imageModelKey = meta?.imageModelKey;
    if (typeof imageModelKey === "string") {
        session.updateImageModel(imageModelKey);
    }

    const compareMode = meta?.compareMode;
    if (typeof compareMode === "boolean") {
        session.toggleCompareMode(compareMode);
    }
};

// 在组件创建时立即注册收藏回填事件监听器
if (typeof window !== "undefined") {
    window.addEventListener(
        "image-workspace-restore-favorite",
        handleRestoreFavorite as EventListener,
    );
    window.addEventListener(
        "image-workspace-restore",
        handleRestoreHistory as EventListener,
    );
    console.log(
        "[ImageText2ImageWorkspace] Favorite restore event listener registered immediately on component creation",
    );
}

const refreshImageModels = async () => {
    try {
        await loadImageModels()
        imageModelOptions.value = imageModels.value.map(m => ({
            label: `${m.name} (${m.provider?.name || m.providerId || 'Unknown'} - ${m.model?.name || m.modelId || 'Unknown'})`,
            primary: m.name,
            secondary: `${m.provider?.name || m.providerId || 'Unknown'} · ${m.model?.name || m.modelId || 'Unknown'}`,
            value: m.id,
            raw: m,
        }))

        if (!imageModels.value.length) {
            return
        }

        const current = selectedImageModelKey.value
        const exists = imageModels.value.some(m => m.id === current)
        if (!exists) {
            selectedImageModelKey.value = imageModels.value[0]?.id || ''
        }
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to refresh image models:', e)
    }
}

// 创建历史记录（并同步 chain/version 到 session store）
const createHistoryRecord = async () => {
    if (!selectedTemplate.value || !historyManager.value) return

    try {
        const recordData = {
            id: uuidv4(),
            originalPrompt: originalPrompt.value,
            optimizedPrompt: optimizedPrompt.value,
            type: 'text2imageOptimize' as PromptRecordType,
            modelKey: selectedTextModelKey.value,
            templateId: selectedTemplate.value.id,
            timestamp: Date.now(),
            metadata: {
                optimizationMode: 'user' as OptimizationMode,
                functionMode: 'image',
                imageModelKey: selectedImageModelKey.value,
                hasInputImage: false,
                compareMode: isCompareMode.value,
            },
        }

        const newRecord = await historyManager.value.createNewChain(recordData)
        currentChainId.value = newRecord.chainId
        currentVersions.value = newRecord.versions
        currentVersionId.value = newRecord.currentRecord.id

        session.updateOptimizedResult({
            optimizedPrompt: optimizedPrompt.value,
            reasoning: optimizedReasoning.value,
            chainId: newRecord.chainId,
            versionId: newRecord.currentRecord.id,
        })

        window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to create history record:', e)
        toast.warning(t('toast.error.optimizeCompleteButHistoryFailed'))
    }
}

// 优化提示词（流式写入 store.state）
const handleOptimizePrompt = async () => {
    if (!originalPrompt.value.trim() || isOptimizing.value) return
    if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
        return
    }
    if (!selectedTextModelKey.value) {
        toast.error(t('toast.error.noOptimizeModel'))
        return
    }
    if (!promptService.value) {
        toast.error(t('toast.error.serviceInit'))
        return
    }

    isOptimizing.value = true
    session.optimizedPrompt = ''
    session.reasoning = ''

    await nextTick()

    try {
        const request: OptimizationRequest = {
            optimizationMode: 'user',
            targetPrompt: originalPrompt.value,
            templateId: selectedTemplate.value.id,
            modelKey: selectedTextModelKey.value,
        }

        await promptService.value.optimizePromptStream(request, {
            onToken: token => {
                session.optimizedPrompt += token
            },
            onReasoningToken: token => {
                session.reasoning += token
            },
            onComplete: async () => {
                await createHistoryRecord()
                        toast.success(t('toast.success.optimizeSuccess'))
            },
            onError: (error: Error) => {
                throw error
            },
        })
    } catch (error) {
        toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
    } finally {
        isOptimizing.value = false
    }
}

// 迭代优化（流式写入 store.state）
const handleIteratePrompt = async (payload: {
    originalPrompt: string
    optimizedPrompt: string
    iterateInput: string
}) => {
    if (!selectedIterateTemplate.value || !promptService.value) {
        console.error('[ImageText2ImageWorkspace] Missing iterate dependencies')
        return
    }

    isIterating.value = true
    const previousOptimizedPrompt = optimizedPrompt.value

    session.optimizedPrompt = ''
    session.reasoning = ''

    try {
        await promptService.value.iteratePromptStream(
            payload.originalPrompt,
            payload.optimizedPrompt,
            payload.iterateInput,
            selectedTextModelKey.value,
            {
                onToken: token => {
                    session.optimizedPrompt += token
                },
                onReasoningToken: token => {
                    session.reasoning += token
                },
                onComplete: async () => {
                    try {
                        if (historyManager.value && currentChainId.value) {
                            const updatedChain = await historyManager.value.addIteration({
                                chainId: currentChainId.value,
                                originalPrompt: payload.originalPrompt,
                                optimizedPrompt: optimizedPrompt.value,
                                iterationNote: payload.iterateInput,
                                modelKey: selectedTextModelKey.value,
                                templateId: selectedIterateTemplate.value!.id,
                            })
                            currentVersions.value = updatedChain.versions
                            currentVersionId.value = updatedChain.currentRecord.id
                            session.updateOptimizedResult({
                                optimizedPrompt: optimizedPrompt.value,
                                reasoning: optimizedReasoning.value,
                                chainId: updatedChain.chainId,
                                versionId: updatedChain.currentRecord.id,
                            })
                            window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
                        } else {
                            await createHistoryRecord()
                        }
                        toast.success(t('toast.success.iterateComplete'))
                    } catch (e) {
                        console.error('[ImageText2ImageWorkspace] Failed to persist iteration:', e)
                        toast.warning(t('toast.error.iterateCompleteButHistoryFailed'))
                    }
                },
                onError: (error: Error) => {
                    throw error
                },
            },
            selectedIterateTemplate.value.id,
        )
    } catch (error) {
        toast.error(getI18nErrorMessage(error, t('toast.error.iterateFailed')))
        optimizedPrompt.value = previousOptimizedPrompt
    } finally {
        isIterating.value = false
    }
}

// 生成图像（结果写入 session store）
const handleGenerateImage = async () => {
    if (!selectedImageModelKey.value || !currentPrompt.value.trim()) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        return
    }

        const imageRequest: Text2ImageRequest = {
            prompt: currentPrompt.value,
            configId: selectedImageModelKey.value,
            count: 1,
            paramOverrides: { outputMimeType: 'image/png' },
        }

        // 显式文生图：避免把仅支持图生图的模型误用于此模式
        try {
            await validateText2ImageRequest(imageRequest)
        } catch (e) {
            toast.error(getI18nErrorMessage(e, t('imageWorkspace.generation.validationFailed')))
            return
        }


    try {
        if (isCompareMode.value) {
            if (originalPrompt.value.trim()) {
                await generateText2Image({ ...imageRequest, prompt: originalPrompt.value })
                originalImageResult.value = imageResult.value
            }
            if (optimizedPrompt.value.trim()) {
                await generateText2Image({ ...imageRequest, prompt: optimizedPrompt.value })
                optimizedImageResult.value = imageResult.value
            }
        } else {
            await generateText2Image(imageRequest)
            if (optimizedPrompt.value.trim()) {
                optimizedImageResult.value = imageResult.value
            } else if (originalPrompt.value.trim()) {
                originalImageResult.value = imageResult.value
            }
        }
        toast.success(t('imageWorkspace.generation.generationCompleted'))
    } catch (error) {
        toast.error(getI18nErrorMessage(error, t('imageWorkspace.generation.generateFailed')))
    }
}

// 切换版本（仅影响当前 UI 展示，不持久化 versions）
const handleSwitchVersion = async (version: PromptRecordChain['versions'][number]) => {
    optimizedPrompt.value = version.optimizedPrompt
    currentVersionId.value = version.id
    session.updateOptimizedResult({
        optimizedPrompt: version.optimizedPrompt || '',
        reasoning: optimizedReasoning.value || '',
        chainId: currentChainId.value || session.chainId || '',
        versionId: version.id || '',
    })
    await nextTick()
}

// 获取图像显示源地址
const getImageSrc = (imageItem: ImageResultItem | null | undefined) => {
    if (!imageItem) return ''
    if (imageItem.url) return imageItem.url
    if (imageItem.b64) {
        const mime = imageItem.mimeType ?? 'image/png'
        return `data:${mime};base64,${imageItem.b64}`
    }
    return ''
}

// 下载图像
const downloadImageFromResult = async (imageItem: ImageResultItem | null | undefined, prefix: string) => {
    if (!imageItem) return

    if (imageItem.url) {
        try {
            const response = await fetch(imageItem.url)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${prefix}-image.png`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch {
            toast.error(t('imageWorkspace.results.downloadFailed'))
        }
        return
    }

    if (imageItem.b64) {
        const a = document.createElement('a')
        const mime = imageItem.mimeType ?? 'image/png'
        a.href = `data:${mime};base64,${imageItem.b64}`
        a.download = `${prefix}-image.png`
        a.click()
    }
}

// 初始化
const initialize = async () => {
    try {
        await modelSelection.refreshTextModels()
        await refreshImageModels()
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to initialize:', e)
    }
}

// 初始化和语言切换事件处理器
const refreshIterateHandler = async () => {
    await templateSelection.refreshIterateTemplates()
    promptPanelRef.value?.refreshIterateTemplateSelect?.();
};

// 文本模型刷新事件处理器（模型管理器关闭后同步刷新）
const refreshTextModelsHandler = async () => {
    try {
        await modelSelection.refreshTextModels();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh text models after manager close:",
            e,
        );
    }
};

// 图像模型刷新事件处理器（模型管理器关闭后同步刷新）
const refreshImageModelsHandler = async () => {
    try {
        await refreshImageModels();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh image models after manager close:",
            e,
        );
    }
};

// 模板管理器关闭后刷新当前模板列表（并尽量保持当前选择）
const refreshTemplatesHandler = async () => {
    try {
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
        await nextTick();
        promptPanelRef.value?.refreshIterateTemplateSelect?.();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh template list after manager close:",
            e,
        );
    }
};

// 下拉获得焦点时，主动刷新模板列表，确保新建/编辑后的模板可见
const handleTemplateSelectFocus = async () => {
    await refreshTemplatesHandler();
};

// 文本模型下拉获得焦点时刷新，确保新建/编辑后的模型立即可用
const handleTextModelSelectFocus = async () => {
    await refreshTextModelsHandler();
};

onMounted(async () => {
    console.log("[ImageText2ImageWorkspace] Starting initialization...");
    console.log("[ImageText2ImageWorkspace] Services available:", !!services?.value);
    try {
        await initialize();
        console.log("[ImageText2ImageWorkspace] Initialization completed successfully");
    } catch (error) {
        console.error("[ImageText2ImageWorkspace] Initialization failed:", error);
    }

    // 监听模板语言切换事件，刷新迭代模板选择
    if (typeof window !== "undefined") {
        window.addEventListener(
            "image-workspace-refresh-iterate-select",
            refreshIterateHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-text-models",
            refreshTextModelsHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-image-models",
            refreshImageModelsHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-templates",
            refreshTemplatesHandler,
        );
    }

    await templateSelection.refreshOptimizeTemplates()
    await templateSelection.refreshIterateTemplates()
});

// 清理
onUnmounted(() => {
    console.log("[ImageText2ImageWorkspace] Cleaning up...");
    if (typeof window !== "undefined") {
        window.removeEventListener(
            "image-workspace-refresh-iterate-select",
            refreshIterateHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-text-models",
            refreshTextModelsHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-image-models",
            refreshImageModelsHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-templates",
            refreshTemplatesHandler,
        );
        window.removeEventListener(
            "image-workspace-restore-favorite",
            handleRestoreFavorite as EventListener,
        );
        window.removeEventListener(
            "image-workspace-restore",
            handleRestoreHistory as EventListener,
        );
    }
});
</script>

<style scoped>
/* Text2Image 模式没有缩略图样式 */
</style>
