const messages = {
  "imageMode": {
    "text2image": "文生图",
    "image2image": "图生图",
    "multiimage": "多图生图",
    "text2imageDescription": "从文本描述生成图像",
    "image2imageDescription": "基于现有图像进行修改",
    "multiimageDescription": "基于多张图片和提示词生成新图像",
    "uploadRequired": "图生图模式需要先上传参考图片"
  },
  "imageWorkspace": {
    "usage": {
      "tokens": "Token 用量",
      "promptTokens": "输入",
      "imageTokens": "输出",
      "totalTokens": "合计",
      "input": "输入",
      "output": "输出",
      "image": "图片",
      "aspect": "比例",
      "tier": "尺寸档位",
      "thinkingTokens": "思考 Token",
      "inference": "耗时"
    },
    "input": {
      "originalPrompt": "原始提示词",
      "originalPromptPlaceholder": "请输入需要优化的图像生成提示词",
      "multiImagePromptPlaceholder": "请使用图1 / 图2 / 图3 来描述图片关系和生成目标",
      "image": "图片",
      "imageAlt": "图{index}",
      "imageLabel": "图{index}",
      "removeImageAriaLabel": "删除图{index}",
      "reorderImageAriaLabel": "拖动调整图{index}顺序",
      "multiImageHint": "拖动卡片可调整图1 / 图2 / 图3 的顺序语义",
      "multiImageMinHint": "再添加一张图片后即可开始多图生图",
      "multiImageReadyHint": "请至少上传两张图片，再开始多图生图",
      "selectImage": "选择",
      "optimizeTemplate": "优化模板",
      "templatePlaceholder": "请选择模板",
      "textModel": "文本模型",
      "modelPlaceholder": "选择模型",
      "optimizing": "优化中...",
      "optimizePrompt": "优化提示词",
      "extractFromImage": "参考图",
      "extracting": "提取中",
      "extractCompleted": "图片提取完成",
      "extractCompletedWithVariables": "图片提取完成，已识别 {count} 个本地变量并填入初始值",
      "extractFailed": "图片提取失败"
    },
    "referenceImage": {
      "replicateAction": "复刻",
      "replicateActionDescription": "忽略当前提示词，以参考图为主反推提示词和变量",
      "styleLearnAction": "风格学习",
      "styleLearnActionDescription": "保留当前提示词主体，只学习参考图的风格、构图和色彩",
      "styleLearnDisabledHint": "请先输入你想画什么",
      "processingStatus": "处理中",
      "readyStatus": "已生成",
      "errorStatus": "失败",
      "resultTitle": "参考图结果",
      "thumbnailAlt": "参考图缩略图",
      "generatedPrompt": "生成后的提示词",
      "variablePreview": "提取到的变量",
      "noVariables": "当前还没有提取到变量",
      "applyToPrompt": "应用到当前提示词",
      "applySuccess": "已写入当前提示词"
    },
    "generation": {
      "imageModel": "图像模型",
      "imageModelPlaceholder": "请选择图像模型",
      "compareMode": "对比模式",
      "generating": "生成中...",
      "generateImage": "生成图像",
      "processing": "处理中",
      "validationFailed": "当前配置或模型不支持该操作",
      "generateFailed": "图像生成失败",
      "missingRequiredFields": "请选择图像模型并确保有有效的提示词",
      "missingVariables": "检测到缺失或未填变量：{vars}",
      "forbiddenTemplateSyntax": "不支持使用未转义 Mustache 语法（如三花括号或 & 标签），请使用普通变量占位符",
      "inputImageRequired": "请先上传输入图像（图生图模式需要输入图）",
      "multiImageUnsupported": "当前模型不支持多图输入，请切换到支持多图输入的图像模型",
      "generationCompleted": "图像生成完成"
    },
    "results": {
      "originalPromptResult": "原始提示词",
      "optimizedPromptResult": "优化提示词",
      "testResult": "测试结果",
      "download": "下载",
      "downloadFailed": "下载失败",
      "copyBase64": "复制Base64",
      "copyText": "复制文本",
      "copySuccess": "复制成功",
      "copyError": "复制失败",
      "textOutput": "文本输出",
      "noOriginalResult": "暂无原始结果",
      "noOptimizedResult": "暂无优化结果",
      "noGenerationResult": "暂无生成结果"
    },
    "upload": {
      "title": "上传参考图片",
      "dragText": "点击或拖拽上传图片",
      "fileRequirements": "支持最大 50MB 的 PNG/JPEG，大图会自动预处理",
      "uploadFailed": "上传失败",
      "uploadSuccess": "上传成功",
      "preparedSuccess": "图片已完成模型兼容性处理：{before} → {after}",
      "preparedBatchSuccess": "已为模型兼容性处理 {count} 张图片",
      "processingFailed": "图片处理失败，请尝试更小的图片",
      "confirmTitle": "确认处理图片",
      "confirmDescription": "为满足模型输入限制，将调整 {count} 张图片的尺寸或重新编码；处理后的文件大小可能略有增加。",
      "confirmItem": "{name}：{beforeSize}，{beforeDimensions} → {afterSize}，{afterDimensions}",
      "confirmAction": "处理并继续",
      "fileTypeNotSupported": "仅支持 PNG/JPEG 格式",
      "fileTooLarge": "所选图片不能超过 50MB",
      "readFailed": "文件读取失败，请重试"
    }
  },
  "image": {
    "capability": {
      "text2image": "文生图",
      "image2image": "图生图",
      "multiImage": "多图生成",
      "highResolution": "高分辨率"
    },
    "step": {
      "basic": "基本信息",
      "provider": "选择提供商",
      "connection": "连接配置",
      "model": "模型选择",
      "parameters": "参数设置"
    },
    "config": {
      "basic": {
        "title": "基本配置"
      },
      "name": {
        "label": "配置名称",
        "placeholder": "请输入配置名称"
      },
      "displayName": {
        "label": "显示名称",
        "placeholder": "请输入显示名称"
      },
      "enabled": {
        "label": "启用状态"
      },
      "enabledStatus": {
        "label": "启用状态"
      },
      "updateSuccess": "配置已更新",
      "createSuccess": "配置已创建",
      "saveFailed": "保存配置失败",
      "loadFailed": "加载配置失败"
    },
    "provider": {
      "title": "提供商选择",
      "section": "提供商配置",
      "label": "图像提供商",
      "placeholder": "请选择提供商",
      "loadFailed": "加载提供商失败"
    },
    "connection": {
      "title": "连接配置",
      "test": "测试连接",
      "testing": "正在测试连接...",
      "testSuccess": "功能测试成功",
      "testFailed": "连接测试失败",
      "testError": "连接测试错误",
      "functionTestTextToImage": "文生图测试",
      "functionTestImageToImage": "图生图测试",
      "testImagePreview": "测试图像预览",
      "downloadSuccess": "图像下载成功",
      "downloadFailed": "图像下载失败",
      "apiKey": {
        "label": "API 密钥",
        "description": "用于认证的密钥",
        "placeholder": "请输入 API Key"
      },
      "baseURL": {
        "label": "API 地址",
        "description": "服务端点的基础地址",
        "placeholder": "https://api.example.com/v1"
      },
      "accountId": {
        "label": "账户 ID",
        "description": "Cloudflare 账户 ID",
        "placeholder": "请输入 Cloudflare Account ID"
      },
      "organization": {
        "label": "组织标识（可选）",
        "description": "OpenAI 组织 ID（如适用）",
        "placeholder": "org_xxx"
      },
      "validation": {
        "missing": "缺少必填字段：{fields}",
        "invalidType": "{field} 类型应为 {expected}，实际为 {actual}"
      }
    },
    "model": {
      "section": "模型配置",
      "label": "选择模型",
      "placeholder": "请选择模型",
      "loading": "正在加载模型...",
      "refreshTooltip": "刷新模型列表",
      "refreshDisabledTooltip": {
        "dynamicNotSupported": "当前提供商不支持动态获取模型",
        "connectionRequired": "需要有效的连接配置才能刷新模型"
      },
      "refreshSuccess": "模型列表已刷新",
      "refreshError": "刷新模型列表失败",
      "selectRequired": "请选择一个模型进行测试",
      "count": "共 {count} 个模型",
      "capabilities": "模型能力",
      "empty": "暂无图像模型配置",
      "addFirst": "添加第一个图像模型",
      "staticLoaded": "已加载静态模型",
      "noStaticModels": "没有静态模型",
      "staticLoadFailed": "加载静态模型失败",
      "dynamicLoaded": "已加载动态模型",
      "dynamicFailed": "加载动态模型失败，已回退静态列表",
      "connectionRequired": "请先填写并校验连接信息",
      "refreshFailed": "刷新模型失败",
      "quickSwitch": {
        "title": "切换当前图像模型",
        "placeholder": "选择图像模型",
        "modelTagTitle": "点击切换当前图像配置的模型",
        "fetchFailed": "获取在线图像模型列表失败：{error}，可继续选择本地默认模型。",
        "updateSuccess": "已切换为 {model}",
        "updateFailed": "切换图像模型失败：{error}"
      }
    },
    "parameters": {
      "noParameters": "该模型暂无可配置参数",
      "advancedConfig": "高级参数配置",
      "advancedConfigDescription": "可选，用于覆盖默认模型参数"
    },
    "params": {
      "size": {
        "label": "图像尺寸",
        "description": "生成图像的分辨率/尺寸，如 1024x1024"
      },
      "aspect_ratio": {
        "label": "画面比例",
        "description": "生成图像的画面宽高比例"
      },
      "resolution": {
        "label": "分辨率档位",
        "description": "生成图像的分辨率档位"
      },
      "quality": {
        "label": "图像质量",
        "description": "生成图像的质量等级：auto（自动）、high（高质量）、medium（中等）、low（低质量）"
      },
      "background": {
        "label": "背景透明度",
        "description": "设置图像背景：auto（自动）、transparent（透明）、opaque（不透明）"
      },
      "negativePrompt": {
        "label": "负向提示词",
        "description": "指定不希望在生成图像中出现的内容"
      },
      "promptExtend": {
        "label": "提示词扩展",
        "description": "启用后模型会自动扩展和优化提示词以获得更好的效果"
      },
      "watermark": {
        "label": "水印",
        "description": "是否在生成的图像上添加水印"
      },
      "seed": {
        "label": "随机种子",
        "description": "用于生成可复现结果的随机种子，相同种子会生成相似图像"
      },
      "count": {
        "label": "生成数量",
        "description": "一次生成的图像数量"
      },
      "style": {
        "label": "图像风格",
        "description": "生成图像的艺术风格"
      }
    }
  },
  "toolCall": {
    "title": "工具调用",
    "count": "{count} 个调用",
    "arguments": "参数",
    "result": "结果",
    "error": "错误",
    "status": {
      "pending": "处理中",
      "success": "成功",
      "error": "失败"
    }
  },
  "updater": {
    "title": "应用更新",
    "checkForUpdates": "检查更新",
    "currentVersion": "当前版本",
    "versionLoadFailed": "版本获取失败",
    "downloadFailed": "下载失败",
    "dismiss": "关闭",
    "noStableVersionAvailable": "没有可用的正式版本",
    "noPrereleaseVersionAvailable": "没有可用的预览版本",
    "failedToGetStableInfo": "无法获取正式版更新信息",
    "failedToGetPrereleaseInfo": "无法获取预览版更新信息",
    "alreadyLatestStable": "当前已是最新正式版 ({version})",
    "alreadyLatestPrerelease": "当前已是最新预览版 ({version})",
    "stableDownloadFailed": "正式版下载失败: {error}",
    "prereleaseDownloadFailed": "预览版下载失败: {error}",
    "unknownError": "未知错误",
    "stable": "正式版",
    "prerelease": "预览版",
    "downloadFailedGeneric": "{type}下载失败: {error}",
    "warning": "警告",
    "info": "信息",
    "versionIgnored": "版本 {version} 已被忽略",
    "checkFailed": "检查失败",
    "ignored": "已忽略",
    "unignore": "取消忽略",
    "latestVersion": "最新版本",
    "latestStableVersion": "最新正式版",
    "noPrereleaseAvailable": "暂无预览版",
    "latestIsStable": "最新版本为正式版",
    "latestPrereleaseVersion": "最新预览版",
    "viewStable": "查看正式版",
    "viewPrerelease": "查看预览版",
    "allowPrerelease": "接收预览版更新",
    "noUpdatesAvailable": "当前已是最新版本",
    "checkNow": "检查更新",
    "checking": "正在检查更新...",
    "checkingForUpdates": "正在检查更新...",
    "newVersionAvailable": "发现新版本",
    "viewDetails": "查看详情",
    "downloadUpdate": "下载更新",
    "download": "下载",
    "updateAvailable": "有更新",
    "hasUpdate": "有更新",
    "details": "详情",
    "ignore": "忽略",
    "ignoreVersion": "忽略此版本",
    "downloading": "正在下载更新...",
    "downloadingShort": "下载中...",
    "downloadComplete": "下载完成",
    "clickInstallToRestart": "点击下方按钮安装并重启应用",
    "installAndRestart": "安装并重启",
    "updateError": "更新失败",
    "downloadError": "下载失败",
    "installError": "安装失败",
    "upToDate": "已是最新版本",
    "viewOnGitHub": "在 GitHub 上查看",
    "devEnvironment": "开发环境：更新检查已禁用",
    "clickToCheck": "点击检查更新",
    "manualUpdateTitle": "macOS 当前需要手动更新",
    "manualUpdateDescription": "当前 macOS 发布包未使用 Apple Developer ID 签名，无法在应用内完成安装。请前往版本发布页下载适用于本机的 DMG，退出应用后将其拖入“应用程序”并选择替换。若首次打开被拦截，请在“系统设置 → 隐私与安全性”中允许打开。",
    "updatePolicyUnavailableTitle": "当前只能手动更新",
    "updatePolicyUnavailableDescription": "无法确认当前构建是否支持应用内安装。为避免更新失败，请前往版本发布页手动下载安装包。",
    "openReleasePage": "打开 GitHub Release",
    "openReleaseFailed": "无法打开版本发布页，请稍后重试。",
    "releasePageUnavailable": "当前未获取到版本发布页地址，请重新检查更新后再试。",
    "noReleasesFound": "未找到发布版本。此项目可能尚未发布任何版本。",
    "noStableReleasesFound": "未找到稳定版本。可能只有预发布版本可用。"
  }
} as const;

export default messages;
