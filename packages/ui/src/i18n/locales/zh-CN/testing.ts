const messages = {
  "history": {
    "title": "历史记录",
    "iterationNote": "迭代说明",
    "optimizedPrompt": "优化后",
    "searchPlaceholder": "搜索历史记录...",
    "confirmClear": "确定要清空所有历史记录吗？此操作不可恢复。",
    "confirmDeleteChain": "确定要删除此条历史记录吗？此操作不可恢复。",
    "cleared": "历史记录已清空",
    "chainDeleted": "历史记录已删除",
    "useThisVersion": "使用此版本",
    "noHistory": "暂无历史记录"
  },
  "test": {
    "title": "测试",
    "areaTitle": "测试区域",
    "content": "测试内容",
    "placeholder": "请输入要测试的内容...",
    "modes": {
      "simple": "简单模式",
      "conversation": "会话模式"
    },
    "simpleMode": {
      "label": "测试内容",
      "placeholder": "输入要测试的内容...",
      "help": ""
    },
    "image": {
      "attach": "添加测试图片",
      "replace": "替换测试图片",
      "remove": "删除测试图片",
      "previewAlt": "已附加的测试图片",
      "unsupportedFormat": "仅支持 PNG 或 JPEG 图片",
      "tooLarge": "图片不能超过 5 MiB",
      "readFailed": "无法读取所选图片",
      "visionHint": "所选模型需支持图片输入",
      "evaluationLabel": "测试图片"
    },
    "model": "测试模型",
    "startTest": "测试",
    "startCompare": "测试",
    "testing": "测试中...",
    "toggleCompare": {
      "enable": "开启对比",
      "disable": "关闭对比"
    },
    "compareMode": "对比模式",
    "layout": {
      "columns": "列数",
      "workspace": "工作区",
      "previous": "上一版",
      "original": "原始",
      "previousHelp": {
        "dynamic": "",
        "currentBase": "当前工作区有未保存修改，所以这里用当前保存版。",
        "earlierSaved": "当前工作区是已保存版本，所以这里用它的上一版。",
        "originalFallback": "当前没有更早版本，所以这里用原始版本。",
        "sameAsWorkspace": "它当前和工作区相同，对比时会按复测来看。"
      },
      "latest": "最新",
      "runAll": "测试全部",
      "runThisColumn": "测试此列",
      "stale": "配置已变更"
    },
    "originalResult": "结果 A",
    "optimizedResult": "结果 B",
    "compareResultA": "结果 A",
    "compareResultB": "结果 B",
    "testResult": "测试结果",
    "userPromptTest": "用户提示词测试",
    "advanced": {
      "startTest": "测试",
      "result": "测试结果",
      "messageCount": "{count} 条消息",
      "missingVariables": "缺少 {count} 个变量"
    },
    "error": {
      "failed": "测试失败",
      "noModel": "请先选择测试模型",
      "noTestContent": "请输入测试内容",
      "noWorkspacePrompt": "工作区为空，请先在下方工作区输入或生成提示词",
      "noOriginalPrompt": "请先输入原始提示词",
      "noOptimizedPrompt": "请先生成优化后的提示词",
      "missingVariables": "检测到缺失或未填变量：{vars}",
      "forbiddenTemplateSyntax": "不支持使用未转义 Mustache 语法（如三花括号或 & 标签），请使用普通变量占位符",
      "originalTestFailed": "原始提示词测试失败",
      "optimizedTestFailed": "优化提示词测试失败",
      "saveToGlobalFailed": "保存变量 {name} 到全局失败"
    },
    "enableMarkdown": "启用Markdown渲染",
    "disableMarkdown": "关闭Markdown渲染",
    "thinking": "思考过程",
    "variables": {
      "detected": "检测到变量",
      "manageVariables": "管理变量",
      "viewPreview": "查看预览",
      "title": "变量",
      "formTitle": "临时变量",
      "variablesCount": "个变量",
      "clearAll": "清空全部",
      "inputPlaceholder": "请输入变量值",
      "overridesGlobal": "覆盖全局",
      "noVariables": "未检测到变量",
      "previewTitle": "预览结果",
      "firstRound": "第一轮替换(内置变量)",
      "secondRound": "第二轮替换(自定义变量)",
      "builtinVars": "内置变量",
      "customVars": "自定义变量",
      "finalPreview": "最终预览",
      "missingVars": "缺失的变量",
      "saveToGlobal": "保存到全局变量",
      "savedToGlobal": "已保存到全局变量",
      "emptyValueWarning": "变量值为空,无法保存",
      "tempCount": "{count} 个临时变量",
      "addVariable": "添加变量",
      "nameRequired": "变量名不能为空",
      "addSuccess": "变量添加成功",
      "clearAllConfirm": "确定清空全部临时变量（{count} 个）？",
      "renameSuccess": "变量名已从 {oldName} 修改为 {newName}",
      "renameNotSupported": "当前视图不支持重命名变量",
      "deleteSuccess": "变量 {name} 已删除",
      "clearSuccess": "已清空所有临时变量",
      "delete": "删除此变量",
      "fullscreenEdit": "全屏编辑变量值"
    },
    "variableValueGeneration": {
      "generateButton": "智能填充变量值",
      "generating": "智能生成中...",
      "dialogTitle": "预览生成的变量值",
      "variableName": "变量名",
      "generatedValue": "生成的值",
      "valuePlaceholder": "请输入变量值",
      "reason": "生成理由",
      "confidence": "置信度",
      "selected": "已选择",
      "batchApply": "批量应用 ({count})",
      "noVariablesToGenerate": "没有需要生成值的变量",
      "generateFailed": "变量值生成失败",
      "applySuccess": "成功应用 {count} 个变量值",
      "noPrompt": "请先输入或生成优化后的提示词",
      "noMissingVariables": "所有变量均已填充",
      "serviceNotReady": "变量值生成服务未就绪",
      "noValues": "未生成任何变量值"
    },
    "invalidVariables": "变量数据无效",
    "getVariablesFailed": "获取变量失败"
  },
  "evaluation": {
    "button": "评估",
    "evaluate": "评估",
    "reEvaluate": "重新评估",
    "compareEvaluate": "对比评估",
    "loading": "正在评估中...",
    "analyzing": "正在分析...",
    "overallScore": "总分",
    "dimensions": "维度评分",
    "issues": "问题",
    "improvements": "改进建议",
    "applyToIterate": "迭代优化",
    "rewriteFromEvaluation": "智能重写",
    "rewriteSkipped": "当前评估建议保持提示词不变，暂不发起智能重写。",
    "applySuccess": "正在应用改进建议...",
    "noResult": "暂无评估结果，点击评估按钮开始评估",
    "viewDetails": "查看详情",
    "feedbackAnalyze": "聚焦",
    "feedbackTitle": "聚焦点",
    "optional": "可选",
    "feedbackPlaceholder": "请输入你希望评估重点关注的方面或意见，分析将优先围绕该点展开",
    "feedbackHint": "Esc 取消 · Ctrl/⌘ + Enter 提交",
    "feedbackSubmit": "提交并开始分析",
    "focus": "聚焦",
    "focusTitle": "聚焦点",
    "focusPlaceholder": "可选：输入你希望评估重点关注的方面/意见（例如输出结构、约束遗漏、示例长度等）",
    "focusHint": "不填写也可以直接开始（等同默认智能评估）",
    "stale": {
      "default": "结果基于旧内容，建议重新评估。",
      "promptOnly": "提示词已变更，建议重新分析。",
      "promptIterate": "提示词或迭代要求已变更，建议重新分析。",
      "result": "测试或工作区已变更，建议重新评估。",
      "compare": "测试或工作区已变更，建议重新对比。"
    },
    "title": {
      "default": "评估结果",
      "result": "测试结果评估",
      "compare": "对比评估",
      "promptOnly": "提示词质量分析",
      "promptIterate": "迭代优化分析"
    },
    "type": {
      "result": "评估该结果",
      "compare": "对比评估"
    },
    "compareConfig": {
      "button": "比较设置",
      "dialogTitle": "比较设置",
      "helper": "先确认每列测试分别扮演什么角色；如果系统建议合理，直接确认即可。",
      "helperSummary": "先确认优化目标；上一版会跟随当前工作区自动变化。",
      "summaryTitle": "本次比较方案",
      "currentTargetLabel": "当前优化目标",
      "currentTargetMissing": "尚未选择",
      "summaryUnassigned": "暂未指定",
      "summaryUnused": "本轮不使用",
      "summaryNeedTarget": "需要指定优化目标",
      "summaryAssigned": "已就绪",
      "summaryRequired": "必填",
      "summaryOptional": "可选",
      "summaryStructured": "将使用智能比较，优先判断优化目标是否进步、是否能向教师学习，以及结论是否稳定。",
      "summaryGeneric": "当前配置更适合普通比较，不会进入逐组智能比较。",
      "summaryPairs": "本次会重点比较：{pairs}",
      "summaryHints": {
        "target": "选择你现在真正想优化、想判断是否变好的那一列。",
        "baseline": "通常就是当前工作区的上一版，用来判断这次改写是否真的更好。",
        "reference": "通常选择更强模型或更稳定的一列，作为教师来提炼可学习的做法。",
        "replica": "用来看这次结论稳不稳；如果上一版和工作区相同，也会在这里出现。",
        "referenceBaseline": "只在需要判断教师侧前后变化时使用，默认不用设置。"
      },
      "assignedHints": {
        "baselineDynamic": "跟随当前工作区自动解析。",
        "replicaFromPrevious": "和当前工作区内容相同，所以这次按复测处理。"
      },
      "requireTarget": "检测到多个工作区测试，请先明确哪个是优化目标。",
      "targetRequired": "请先指定一个优化目标。",
      "targetNeededShort": "请先选择优化目标",
      "reviewNeededShort": "请重新确认",
      "autoDetected": "系统建议",
      "manualAssigned": "手动指定",
      "selectRolePlaceholder": "选择角色",
      "restoreSuggested": "恢复建议",
      "suggestedRoleTag": "系统建议：{role}",
      "unassignedTag": "未明确",
      "unresolvedHint": "这列角色暂未明确，当前不会进入核心智能比较。",
      "unresolvedFallbackSummary": "{entries} 列角色未明确，本次将回退为普通比较。",
      "expiredManualTag": "需重新确认",
      "expiredManualSummary": "有 {count} 条旧的手动设置已经失效，系统已回退到当前建议。",
      "workspaceChangedTag": "需重新确认",
      "workspaceChangedSummary": "有 {count} 条工作区角色对应的提示词已经变化，请重新确认这些设置。",
      "keepAuto": "保持系统建议",
      "keepAutoWithRole": "保持系统建议（当前：{role}）",
      "useInferred": "使用系统建议",
      "clearManual": "移除手动设置",
      "slotSectionTitle": "逐列设置",
      "slotSectionSummary": "系统已经先给出建议；只有在你觉得不对时，才需要手动改。",
      "currentRoleLabel": "当前角色",
      "rolePickerLabel": "这列扮演什么角色",
      "suggestedRoleLabel": "系统建议",
      "workspaceChangedInline": "这列对应的工作区提示词变了，建议重新确认。",
      "planStructuredSummaryDynamic": "这次会围绕当前优化目标做智能比较，重点判断{focuses}。",
      "planGenericSummary": "当前测试列还不能组成稳定的智能比较，因此这次会回退为普通比较。",
      "structuredFocusJoiner": "、",
      "structuredFocusFinalJoiner": "，以及",
      "structuredFocus": {
        "targetBaseline": "它相对上一版是否进步",
        "targetReference": "和教师还有多大差距",
        "referenceBaseline": "同类改动在教师侧是否也成立",
        "targetReplica": "当前结论是否稳定"
      },
      "previewModeLabel": "比较方式",
      "previewPairsLabel": "逐组比较",
      "previewReasonsLabel": "系统说明",
      "previewModeStructured": "智能比较",
      "previewModeGeneric": "普通比较",
      "genericFallbackSummary": "当前配置会走普通比较，而不是逐组智能比较。",
      "confirmDisabled": "存在冲突，暂时无法确认",
      "noVersionLabel": "未指定版本",
      "noModel": "未指定模型",
      "blockingSummary": "当前角色配置有冲突，请先调整后再确认。",
      "advancedSectionTitle": "高级细节",
      "advancedSectionSummary": "这里只解释系统会怎么比较，以及为什么会这样判断。",
      "showAdvancedRoles": "显示高级角色",
      "hideAdvancedRoles": "隐藏高级角色",
      "showAdvancedDetails": "查看高级细节",
      "hideAdvancedDetails": "收起高级细节",
      "advancedConflictTitle": "需要先解决的问题",
      "pairValues": {
        "targetBaseline": "优化目标 vs 上一版",
        "targetReference": "优化目标 vs 教师",
        "referenceBaseline": "教师 vs 教师的上一版",
        "targetReplica": "优化目标 vs 复测"
      },
      "reasonValues": {
        "duplicateTarget": "当前有多个“优化目标”，系统无法判断你真正要优化的是哪一列。",
        "duplicateBaseline": "当前有多个“上一版”，系统无法判断该拿哪一列作为回退基线。",
        "duplicateReference": "当前有多个“教师”，系统无法判断该向哪一列学习。",
        "duplicateReferenceBaseline": "当前有多个“教师的上一版”，系统无法判断哪一列属于教师侧基线。",
        "hasAuxiliarySnapshot": "有些测试不适合做逐组比较，所以这次会退回普通比较。",
        "missingTarget": "当前没有可用的“优化目标”，因此无法进入智能比较。",
        "missingStructuredCompanion": "优化目标缺少关键搭配（上一版 / 教师 / 复测），暂时无法进行核心逐组比较。",
        "referenceBaselineWithoutReference": "存在“教师的上一版”，但没有对应的“教师”，这组证据不会参与智能比较。"
      },
      "roleValues": {
        "target": "优化目标",
        "baseline": "上一版",
        "reference": "教师",
        "referenceBaseline": "教师的上一版",
        "replica": "复测",
        "auxiliary": "其他测试"
      },
      "suggestionReasons": {
        "default": "系统根据当前版本、模型和提示词关系给出这个建议。",
        "target": {
          "uniqueWorkspace": "这是当前唯一的工作区，所以建议作为优化目标。",
          "workspace": "这是当前工作区列，所以建议作为优化目标。"
        },
        "baseline": {
          "dynamicPrevious": "这是当前工作区的上一版，所以建议作为上一版。",
          "sameModelDifferentPrompt": "它与优化目标模型相同、提示词不同，所以建议作为上一版。"
        },
        "reference": {
          "samePromptDifferentModel": "这是不同模型的工作区结果，所以建议作为教师。",
          "differentModel": "它与优化目标使用不同模型，所以建议作为教师。"
        },
        "referenceBaseline": {
          "sameModelDifferentPrompt": "它与教师模型相同、提示词不同，所以建议作为教师的上一版。"
        },
        "replica": {
          "previousMatchesWorkspace": "它和工作区当前内容相同，所以建议按复测处理。",
          "samePromptAsTarget": "它与优化目标使用相同提示词，所以建议作为复测。"
        },
        "auxiliary": {
          "default": "这列不会进入核心逐组比较，所以保留为其他测试。"
        }
      }
    },
    "compareShared": {
      "status": {
        "needTarget": "请先选择优化目标",
        "needReview": "设置已变化，请重新确认"
      },
      "roleValues": {
        "target": "优化目标",
        "baseline": "上一版",
        "reference": "教师",
        "referenceBaseline": "教师的上一版",
        "replica": "复测",
        "auxiliary": "其他测试"
      },
      "roleDescriptions": {
        "target": "这是你当前真正想优化、想判断是否变好的那一列，也是本轮比较的主角。",
        "baseline": "这是当前工作区的上一版，用来判断这次改写是否真的有进步。",
        "reference": "这是教师结果，通常来自更强模型或更稳定的输出，用来帮助你学习更好的结构策略。",
        "referenceBaseline": "这是教师侧的上一版，只会出现在高级细节里，用来判断同一类改动在教师侧是否也成立。",
        "replica": "这是用来检查结论是否稳定的复测；如果上一版和工作区相同，也会在这里出现。",
        "auxiliary": "这类测试仍然可以参与普通比较，但不会成为智能比较里的核心逐组对象。"
      },
      "roleSource": {
        "manual": "这是你手动确认的角色。",
        "auto": "这是系统自动建议的角色。"
      },
      "unresolved": {
        "label": "未明确",
        "description": "这列还没有被明确归到核心比较角色里。",
        "source": "系统暂时无法把它判断为优化目标、上一版、教师或复测。"
      },
      "review": {
        "workspaceChanged": "对应的工作区提示词已经变化，请重新确认这个角色。",
        "staleManual": "旧的手动设置已经不再适配当前比较方案。"
      },
      "roleAction": "点击这个标签即可修改比较角色。",
      "assignment": {
        "unassigned": "还没有分配角色。",
        "manual": "你手动选择了：{role}",
        "auto": "系统建议：{role}"
      },
      "modeValues": {
        "structured": "智能比较",
        "generic": "普通比较"
      },
      "recommendationValues": {
        "continue": "继续改",
        "stop": "可以先停",
        "review": "需要人工确认"
      }
    },
    "compareHelp": {
      "title": "对比评估教程",
      "tooltip": "什么是对比评估？"
    },
    "compareUnavailable": {
      "missingWorkspace": "对比评估至少需要一个工作区测试结果，因为系统会围绕当前工作区提示词给出改进建议。请先运行工作区列后再对比。"
    },
    "compareSummary": {
      "decision": {
        "title": "迭代建议"
      },
      "reusableImprovements": "可直接采用的改进方向",
      "rewriteButton": "根据本次评估改写",
      "rewriteSkipHint": "当前建议先保持不变，除非你已经确认还有明确且可复用的改进空间。",
      "rewriteMinorHint": "当前更适合小范围修正，而不是继续大幅重写。",
      "compactSignals": {
        "targetVsBaseline": "上一版",
        "targetVsReferenceGap": "教师差距",
        "improvementHeadroom": "空间",
        "overfitRisk": "过拟合"
      },
      "reasonTitles": {
        "progress": "上一版",
        "reference": "教师",
        "stability": "稳定性"
      },
      "reasonBodies": {
        "progress": {
          "improved": "当前优化目标相对上一版是进步的，但还要继续确认哪些提升是真正可复用的。",
          "flat": "当前优化目标和上一版差异不大，需要结合教师与稳定性证据再决定下一步。",
          "regressed": "当前优化目标相对上一版出现退步，应先找出回退原因。"
        },
        "reference": {
          "none": "当前优化目标和教师结果已经很接近，继续改写的收益可能有限。",
          "minor": "当前优化目标与教师之间还有一些可学习的结构差距。",
          "major": "当前优化目标与教师之间仍有明显差距，下一轮应优先学习教师侧更强的策略。"
        },
        "stability": {
          "high": "当前收益可能包含较强的样例拟合风险，继续改写前应先过滤过拟合规则。",
          "medium": "当前还存在一定的过拟合风险，下一轮应更保守地保留通用规则。",
          "low": "当前整体已经比较接近收敛，继续叠加规则前要先确认还有没有真实改进空间。",
          "default": "还需要结合更多共享输入确认当前结论是否稳定。"
        }
      },
      "advanced": {
        "show": "查看高级细节",
        "hide": "收起高级细节",
        "title": "比较详情",
        "mode": "比较方式",
        "roles": "比较对象",
        "stopSignals": "风险与收敛信号",
        "insights": "关键发现",
        "focusSummaries": "聚焦结论",
        "pairHighlights": "逐组亮点",
        "evidence": "原始证据摘录",
        "learnableSignals": "可学习信号",
        "overfit": "过拟合风险",
        "conflicts": "需要人工确认",
        "judgements": "逐组比较"
      }
    },
    "compareMetadata": {
      "title": "高级比较信息",
      "insights": "关键发现",
      "decision": {
        "title": "比较结论",
        "keyEvidence": "关键依据",
        "nextActions": "下一步建议",
        "headlines": {
          "continue": "当前优化目标方向是对的，但仍然存在可执行的改进空间。",
          "stop": "当前结果已经接近收敛，继续自动改写的收益可能有限。",
          "review": "当前对比结果建议先人工复核，再决定是否继续改写。",
          "regressed": "当前优化目标相较上一版出现退步，暂时不应直接接受这次改写。"
        },
        "actions": {
          "inspectRegression": "先检查新版本删掉了什么、削弱了什么，再决定是否继续改写。",
          "reviewBeforeRewrite": "先复核证据冲突点，再决定是继续改写还是保留当前版本。",
          "reviewPromptValidity": "先检查这次 prompt 改动是否真的可迁移，因为参考侧暂时并不支持它。",
          "learnFromReference": "下一轮优先学习教师侧更强的结构策略，而不是做大范围改动。",
          "filterOverfit": "过滤掉只适配当前样例的规则，保留可复用的通用约束。",
          "continueTargetedRewrite": "如果继续改写，只聚焦最高信号差距，不要同时做大范围重写。",
          "acceptCurrent": "可以把当前工作区视为接近收敛，除非有新证据，否则不要继续叠加规则。",
          "verifyStability": "如果当前判断仍然临界，建议再用一个共享输入验证稳定性。"
        }
      },
      "focusSummaries": "聚焦结论",
      "mode": "比较方式",
      "roles": "比较对象",
      "judgements": "逐组比较",
      "pairHighlights": "逐组亮点",
      "progressSummary": "相比上一版",
      "referenceGapSummary": "相比教师",
      "promptChangeSummary": "改动有效性",
      "stabilitySummary": "稳定性",
      "stopSignals": "风险与收敛信号",
      "evidence": "证据",
      "evidenceHighlights": "证据摘录",
      "learnableSignals": "可学习信号",
      "overfitWarnings": "过拟合警告",
      "conflictSignals": "需要人工确认",
      "targetVsBaseline": "优化目标 vs 上一版",
      "targetVsReferenceGap": "优化目标 vs 教师差距",
      "improvementHeadroom": "改进空间",
      "overfitRisk": "过拟合风险",
      "stopRecommendation": "建议结论",
      "stopReasons": "判断依据",
      "modeValues": {
        "structured": "智能比较",
        "generic": "普通比较"
      },
      "roleValues": {
        "target": "优化目标",
        "baseline": "上一版",
        "reference": "教师",
        "referenceBaseline": "教师的上一版",
        "replica": "复测",
        "auxiliary": "其他测试"
      },
      "verdictValues": {
        "left-better": "左侧更优",
        "right-better": "右侧更优",
        "mixed": "各有优劣",
        "similar": "基本接近"
      },
      "confidenceValues": {
        "low": "低置信",
        "medium": "中置信",
        "high": "高置信"
      },
      "conflictSignalValues": {
        "improvementNotSupportedOnReference": "当前优化目标虽然比上一版更好，但同一改动没有得到教师侧支持。",
        "improvementUnstableAcrossReplicas": "当前目标虽然有提升，但复测证据提示收益可能不稳定。",
        "regressionOutweighsCosmeticGains": "相对上一版的退步应优先于其他表面优化。",
        "sampleOverfitRiskVisible": "当前同时存在可复用收益和样例拟合风险，应保持保守判断。"
      },
      "signalValues": {
        "targetVsBaseline": {
          "improved": "有进步",
          "flat": "基本持平",
          "regressed": "有退步"
        },
        "targetVsReferenceGap": {
          "none": "差距很小",
          "minor": "还有一点差距",
          "major": "差距明显"
        },
        "improvementHeadroom": {
          "none": "几乎没有",
          "low": "较小",
          "medium": "还有一些",
          "high": "仍然很大"
        },
        "overfitRisk": {
          "low": "较低",
          "medium": "中等",
          "high": "较高"
        },
        "stopRecommendation": {
          "continue": "继续改",
          "stop": "可以先停",
          "review": "需要人工确认"
        }
      }
    },
    "level": {
      "excellent": "优秀",
      "good": "良好",
      "acceptable": "合格",
      "poor": "较差",
      "veryPoor": "很差"
    },
    "dimension": {
      "goalAchievement": "目标达成度",
      "outputQuality": "输出质量",
      "formatCompliance": "格式规范性",
      "relevance": "相关性"
    },
    "optimizedBetter": "优化后效果更好",
    "originalBetter": "原始效果更好",
    "syntheticInput": {
      "noExplicitText": "无额外测试输入，输出直接基于当前提示词生成。",
      "noExplicitVariables": "无额外变量输入。"
    },
    "error": {
      "title": "评估失败",
      "serviceNotReady": "评估服务未就绪，请稍后再试",
      "failed": "评估失败：{error}",
      "noOptimizedPrompt": "没有可优化的提示词"
    },
    "designContext": {
      "basic": "设计上下文",
      "advanced": "设计上下文"
    },
    "variableExtraction": {
      "extractButton": "自动提取变量",
      "extracting": "自动提取中...",
      "dialogTitle": "自动提取结果",
      "variableName": "变量名",
      "variableValue": "变量值",
      "reason": "提取理由",
      "category": "分类",
      "selected": "已选择",
      "batchCreate": "批量创建",
      "noVariables": "未识别到可提取的变量",
      "extractFailed": "自动提取失败",
      "staleResult": "提示词或变量已更改，请重新提取。",
      "createSuccess": "成功创建 {count} 个变量",
      "summary": "总结",
      "workspaceNotReady": "无法访问工作区状态",
      "noPromptContent": "请先输入提示词内容",
      "noEvaluationModel": "请先选择评估模型",
      "serviceNotReady": "变量提取服务未就绪",
      "invalidVariableNames": "以下变量名不合法（不能以数字或 # / ^ ! > & 开头，且不能包含空白/花括号，最长 {max} 个字符）：{names}"
    },
    "diagnose": {
      "title": "诊断分析",
      "confidence": "置信度",
      "findings": "发现问题",
      "patchPlan": "修复计划",
      "noFindings": "未发现问题",
      "noPatchPlan": "无修复计划",
      "applyFix": "应用修复",
      "replaceNow": "立即替换",
      "invariantsWarning": "受限于不可改变项约束",
      "changeBudgetWarning": "受限于变更预算限制",
      "status": {
        "ok": "诊断正常",
        "degraded": "部分降级",
        "failed": "诊断失败"
      },
      "severity": {
        "critical": "严重",
        "major": "重要",
        "minor": "次要",
        "suggestion": "建议",
        "unknown": "未知"
      },
      "anchorType": {
        "text": "文本",
        "section": "段落",
        "pattern": "正则"
      },
      "operation": {
        "insert": "插入",
        "replace": "替换",
        "delete": "删除"
      },
      "anchorPosition": {
        "before": "之前",
        "after": "之后",
        "replace": "替换"
      },
      "invariantsRisks": "约束冲突风险"
    }
  }
} as const;

export default messages;
