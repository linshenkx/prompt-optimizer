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
                                    v-model:value="isCompareMode"
                                    :disabled="isGenerating"
                                />
                                <n-text depth="3">{{
                                    t("imageWorkspace.generation.compareMode")
                                }}</n-text>
                                <n-button
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
                    :original-title="
                        t('imageWorkspace.results.originalPromptResult')
                    "
                    :optimized-title="
                        t('imageWorkspace.results.optimizedPromptResult')
                    "
                    :single-result-title="
                        t('imageWorkspace.results.optimizedPromptResult')
                    "
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
                                            @click="
                                                downloadImageFromResult(
                                                    originalImageResult
                                                        .images[0],
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
                                                t(
                                                    "imageWorkspace.results.download",
                                                )
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
                                                t(
                                                    "imageWorkspace.results.copyText",
                                                )
                                            }}
                                        </NButton>
                                    </NSpace>
                                </NSpace>
                            </template>
                            <NEmpty
                                v-else
                                :description="
                                    t(
                                        'imageWorkspace.results.noGenerationResult',
                                    )
                                "
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
import { onMounted, onUnmounted, inject, ref, computed, watch, nextTick, type Ref } from 'vue'

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
import { DataTransformer, OptionAccessors } from "../../utils/data-transformer";
import type { AppServices } from "../../types/services";
import { useFullscreen } from "../../composables/ui/useFullscreen";
import FullscreenDialog from "../FullscreenDialog.vue";
import type { ModelSelectOption, SelectOption, TemplateSelectOption } from "../../types/select-options";
import { useToast } from "../../composables/ui/useToast";
import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageGeneration } from '../../composables/image/useImageGeneration'
import { useEvaluationHandler } from '../../composables/prompt/useEvaluationHandler'
import {
    type ImageModelConfig,
    type ImageRequest,
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
    generate: generateImage,
    loadImageModels,
} = useImageGeneration()

// 服务引用
const modelManager = computed(() => services.value?.modelManager)
const templateManager = computed(() => services.value?.templateManager)
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

const selectedTextModelKey = computed<string>({
    get: () => session.selectedTextModelKey || '',
    set: (value) => session.updateTextModel(value || ''),
})

const selectedImageModelKey = computed<string>({
    get: () => session.selectedImageModelKey || '',
    set: (value) => session.updateImageModel(value || ''),
})

const selectedTemplateId = computed<string>({
    get: () => session.selectedTemplateId || '',
    set: (value) => session.updateTemplate(value || null),
})

const selectedIterateTemplateId = computed<string>({
    get: () => session.selectedIterateTemplateId || '',
    set: (value) => session.updateIterateTemplate(value || null),
})

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
const templateType = computed<Template['metadata']['templateType']>(() => 'text2imageOptimize')

// 图像模式统一使用 user 模式
const optimizationMode = 'user' as OptimizationMode
const advancedModeEnabled = false

// ========== 模板对象派生（防竞态） ==========
const selectedTemplateRef = ref<Template | null>(null)
const selectedIterateTemplateRef = ref<Template | null>(null)

let templateResolveToken = 0
watch(
    [selectedTemplateId, templateManager],
    async ([templateId, manager]) => {
        const token = ++templateResolveToken
        if (!manager) {
            selectedTemplateRef.value = null
            return
        }

        try {
            const templates = await manager.listTemplatesByType('text2imageOptimize')
            if (token !== templateResolveToken) return

            const selected = templateId ? templates.find(t => t.id === templateId) || null : null
            selectedTemplateRef.value = selected
        } catch (e) {
            if (token !== templateResolveToken) return
            console.warn('[ImageText2ImageWorkspace] Failed to resolve optimize template:', e)
            selectedTemplateRef.value = null
        }
    },
    { immediate: true },
)

let iterateResolveToken = 0
watch(
    [selectedIterateTemplateId, templateManager],
    async ([iterateId, manager]) => {
        const token = ++iterateResolveToken
        if (!manager) {
            selectedIterateTemplateRef.value = null
            return
        }

        try {
            const templates = await manager.listTemplatesByType('imageIterate')
            if (token !== iterateResolveToken) return
            const selected = iterateId ? templates.find(t => t.id === iterateId) || null : null
            selectedIterateTemplateRef.value = selected
        } catch (e) {
            if (token !== iterateResolveToken) return
            console.warn('[ImageText2ImageWorkspace] Failed to resolve iterate template:', e)
            selectedIterateTemplateRef.value = null
        }
    },
    { immediate: true },
)

const selectedTemplate = computed<Template | null>({
    get: () => selectedTemplateRef.value,
    set: (template) => {
        selectedTemplateId.value = template?.id || ''
    },
})

const selectedIterateTemplate = computed<Template | null>({
    get: () => selectedIterateTemplateRef.value,
    set: (template) => {
        selectedIterateTemplateId.value = template?.id || ''
    },
})

// 模型选项
const textModelOptions = ref<ModelSelectOption[]>([])
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
    originalPrompt: originalPrompt as any,
    optimizedPrompt: optimizedPrompt as any,
    testContent: computed(() => ''),
    testResults: ref(null),
    evaluationModelKey: selectedTextModelKey as any,
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
        type === "iterate" ? "imageIterate" : type;
    appOpenTemplateManager?.(target);
};

// 模板列表
const templateOptions = ref<TemplateSelectOption[]>([]);

const loadTemplateList = async () => {
    try {
        if (services?.value?.templateManager) {
            const list =
                await services.value.templateManager.listTemplatesByType(
                    'text2imageOptimize',
                );
            templateOptions.value = DataTransformer.templatesToSelectOptions(
                list || [],
            );
        } else {
            templateOptions.value = [];
        }
    } catch (e) {
        console.warn("[ImageText2ImageWorkspace] Failed to load template list:", e);
        templateOptions.value = [];
    }
};

watch(templateType, async () => {
    await loadTemplateList();
    await nextTick();
    try {
        await restoreTemplateSelection();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to restore template after list load:",
            e,
        );
    }
});

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

// 在组件创建时立即注册收藏回填事件监听器
if (typeof window !== "undefined") {
    window.addEventListener(
        "image-workspace-restore-favorite",
        handleRestoreFavorite as EventListener,
    );
    console.log(
        "[ImageText2ImageWorkspace] Favorite restore event listener registered immediately on component creation",
    );
}

const refreshTextModels = async () => {
    if (!modelManager.value) {
        textModelOptions.value = []
        return
    }

    try {
        const manager = modelManager.value
        await manager.ensureInitialized()

        const textModels = await manager.getEnabledModels()
        textModelOptions.value = textModels.map(m => ({
            label: `${m.name} (${m.providerMeta.name})`,
            primary: m.name,
            secondary: m.providerMeta.name ?? 'Unknown',
            value: m.id,
            raw: m,
        }))

        if (!textModels.length) {
            return
        }

        const currentKey = selectedTextModelKey.value
        const keys = new Set(textModels.map(m => m.id))
        const fallback = textModels[0]?.id || ''

        const needsFallback = (!currentKey && fallback) || (currentKey && !keys.has(currentKey))
        if (needsFallback) {
            selectedTextModelKey.value = fallback
        }
    } catch (error) {
        console.error('[ImageText2ImageWorkspace] Failed to refresh text models:', error)
        textModelOptions.value = []
    }
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

const restoreTemplateSelection = async () => {
    const manager = templateManager.value
    if (!manager) return

    try {
        const templates = await manager.listTemplatesByType('text2imageOptimize')
        if (!templates.length) {
            selectedTemplateRef.value = null
            selectedTemplateId.value = ''
            return
        }

        const currentId = selectedTemplateId.value
        const found = currentId ? templates.find(t => t.id === currentId) || null : null
        if (found) {
            selectedTemplateRef.value = found
            return
        }

        // 无选择或已失效：设置默认模板
        const fallback =
            templates.find(t => t.id === 'image-chinese-optimize') ||
            templates.find(t => t.id === 'image-dalle-optimize') ||
            templates.find(t => t.name.includes('通用')) ||
            templates[0]

        if (fallback) {
            selectedTemplateId.value = fallback.id
            selectedTemplateRef.value = fallback
        }
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to restore template selection:', e)
        selectedTemplateRef.value = null
    }
}

const restoreImageIterateTemplateSelection = async () => {
    const manager = templateManager.value
    if (!manager) return

    try {
        const templates = await manager.listTemplatesByType('imageIterate')
        if (!templates.length) {
            selectedIterateTemplateRef.value = null
            selectedIterateTemplateId.value = ''
            return
        }

        const currentId = selectedIterateTemplateId.value
        const found = currentId ? templates.find(t => t.id === currentId) || null : null
        if (found) {
            selectedIterateTemplateRef.value = found
            return
        }

        const fallback = templates[0]
        selectedIterateTemplateId.value = fallback?.id || ''
        selectedIterateTemplateRef.value = fallback || null
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to restore iterate template selection:', e)
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
        toast.warning('历史记录保存失败，但优化结果已生成')
    }
}

// 优化提示词（流式写入 store.state）
const handleOptimizePrompt = async () => {
    if (!originalPrompt.value.trim() || isOptimizing.value) return
    if (!selectedTemplate.value) {
        toast.error('请选择优化模板')
        return
    }
    if (!selectedTextModelKey.value) {
        toast.error('请选择文本模型')
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
                toast.success('提示词优化完成')
            },
            onError: (error: Error) => {
                throw error
            },
        })
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        toast.error('优化失败：' + err.message)
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
                        toast.success('提示词迭代优化完成')
                    } catch (e) {
                        console.error('[ImageText2ImageWorkspace] Failed to persist iteration:', e)
                        toast.warning('迭代结果已生成，但历史记录保存失败')
                    }
                },
                onError: (error: Error) => {
                    throw error
                },
            },
            selectedIterateTemplate.value.id,
        )
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        toast.error('迭代优化失败：' + err.message)
        optimizedPrompt.value = previousOptimizedPrompt
    } finally {
        isIterating.value = false
    }
}

// 生成图像（结果写入 session store）
const handleGenerateImage = async () => {
    if (!selectedImageModelKey.value || !currentPrompt.value.trim()) {
        toast.error('请选择图像模型并确保有有效的提示词')
        return
    }

    const imageRequest: ImageRequest = {
        prompt: currentPrompt.value,
        configId: selectedImageModelKey.value,
        count: 1,
        paramOverrides: { outputMimeType: 'image/png' },
    }

    try {
        if (isCompareMode.value) {
            if (originalPrompt.value.trim()) {
                await generateImage({ ...imageRequest, prompt: originalPrompt.value })
                originalImageResult.value = imageResult.value
            }
            if (optimizedPrompt.value.trim()) {
                await generateImage({ ...imageRequest, prompt: optimizedPrompt.value })
                optimizedImageResult.value = imageResult.value
            }
        } else {
            await generateImage(imageRequest)
            if (optimizedPrompt.value.trim()) {
                optimizedImageResult.value = imageResult.value
            } else if (originalPrompt.value.trim()) {
                originalImageResult.value = imageResult.value
            }
        }
        toast.success('图像生成完成')
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        toast.error('生成失败：' + err.message)
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
            toast.error('下载失败')
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
        await refreshTextModels()
        await refreshImageModels()
        await restoreTemplateSelection()
        await restoreImageIterateTemplateSelection()
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to initialize:', e)
    }
}

// 初始化和语言切换事件处理器
const refreshIterateHandler = () => {
    promptPanelRef.value?.refreshIterateTemplateSelect?.();
};

// 文本模型刷新事件处理器（模型管理器关闭后同步刷新）
const refreshTextModelsHandler = async () => {
    try {
        await refreshTextModels();
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
        await loadTemplateList();
        await nextTick();
        await restoreTemplateSelection();
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

    // 加载模板列表
    await loadTemplateList();
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
    }
});
</script>

<style scoped>
/* Text2Image 模式没有缩略图样式 */
</style>
