const messages = {
  "history": {
    "title": "歷史紀錄",
    "iterationNote": "迭代說明",
    "optimizedPrompt": "優化後",
    "searchPlaceholder": "搜尋歷史紀錄...",
    "confirmClear": "確定要清空所有歷史紀錄嗎？此操作無法復原。",
    "confirmDeleteChain": "確定要刪除此條歷史紀錄嗎？此操作無法復原。",
    "cleared": "歷史紀錄已清空",
    "chainDeleted": "歷史紀錄已刪除",
    "useThisVersion": "使用此版本",
    "noHistory": "暫無歷史紀錄"
  },
  "test": {
    "title": "測試",
    "areaTitle": "測試區域",
    "content": "測試內容",
    "placeholder": "請輸入要測試的內容...",
    "modes": {
      "simple": "簡單模式",
      "conversation": "對話模式"
    },
    "simpleMode": {
      "label": "測試內容",
      "placeholder": "輸入要測試的內容...",
      "help": ""
    },
    "image": {
      "attach": "新增測試圖片",
      "replace": "替換測試圖片",
      "remove": "刪除測試圖片",
      "previewAlt": "已附加的測試圖片",
      "unsupportedFormat": "僅支援 PNG 或 JPEG 圖片",
      "tooLarge": "圖片不能超過 5 MiB",
      "readFailed": "無法讀取所選圖片",
      "visionHint": "所選模型需支援圖片輸入",
      "evaluationLabel": "測試圖片"
    },
    "model": "測試模型",
    "startTest": "測試",
    "startCompare": "測試",
    "testing": "測試中...",
    "toggleCompare": {
      "enable": "開啟對比",
      "disable": "關閉對比"
    },
    "compareMode": "對比模式",
    "layout": {
      "columns": "列數",
      "workspace": "工作區",
      "previous": "上一版",
      "original": "原始",
      "previousHelp": {
        "dynamic": "",
        "currentBase": "目前工作區有未保存修改，所以這裡用目前保存版。",
        "earlierSaved": "目前工作區是已保存版本，所以這裡用它的上一版。",
        "originalFallback": "目前沒有更早版本，所以這裡用原始版本。",
        "sameAsWorkspace": "它目前和工作區相同，對比時會按複測來看。"
      },
      "latest": "最新",
      "runAll": "測試全部",
      "runThisColumn": "測試此列",
      "stale": "配置已變更"
    },
    "originalResult": "結果 A",
    "optimizedResult": "結果 B",
    "compareResultA": "結果 A",
    "compareResultB": "結果 B",
    "testResult": "測試結果",
    "userPromptTest": "使用者提示詞測試",
    "advanced": {
      "startTest": "測試",
      "result": "測試結果",
      "messageCount": "{count} 則訊息",
      "missingVariables": "缺少 {count} 個變數"
    },
    "error": {
      "failed": "測試失敗",
      "noModel": "請先選擇測試模型",
      "noTestContent": "請輸入測試內容",
      "noWorkspacePrompt": "工作區為空，請先在下方工作區輸入或生成提示詞",
      "noOriginalPrompt": "請先輸入原始提示詞",
      "noOptimizedPrompt": "請先生成優化後的提示詞",
      "missingVariables": "偵測到缺失或未填變數：{vars}",
      "forbiddenTemplateSyntax": "不支援使用未轉義 Mustache 語法（如三花括號或 & 標籤），請使用一般變數占位符",
      "originalTestFailed": "原始提示詞測試失敗",
      "optimizedTestFailed": "優化提示詞測試失敗",
      "saveToGlobalFailed": "儲存變數 {name} 到全域失敗"
    },
    "enableMarkdown": "啟用Markdown渲染",
    "disableMarkdown": "關閉Markdown渲染",
    "thinking": "思考過程",
    "variables": {
      "detected": "偵測到變數",
      "manageVariables": "管理變數",
      "viewPreview": "查看預覽",
      "title": "變數",
      "formTitle": "臨時變數",
      "variablesCount": "個變數",
      "clearAll": "清空全部",
      "inputPlaceholder": "請輸入變數值",
      "overridesGlobal": "覆蓋全域",
      "noVariables": "未偵測到變數",
      "previewTitle": "預覽結果",
      "firstRound": "第一輪替換（內建變數）",
      "secondRound": "第二輪替換（自訂變數）",
      "builtinVars": "內建變數",
      "customVars": "自訂變數",
      "finalPreview": "最終預覽",
      "missingVars": "缺失的變數",
      "saveToGlobal": "儲存到全域變數",
      "savedToGlobal": "已儲存到全域變數",
      "emptyValueWarning": "變數值為空，無法儲存",
      "tempCount": "{count} 個臨時變數",
      "addVariable": "新增變數",
      "nameRequired": "變數名稱不能為空",
      "addSuccess": "變數新增成功",
      "clearAllConfirm": "確定清空所有臨時變數（{count} 個）？",
      "renameSuccess": "變數名稱已從 {oldName} 更名為 {newName}",
      "renameNotSupported": "此檢視不支援重新命名變數",
      "deleteSuccess": "變數 {name} 已刪除",
      "clearSuccess": "已清空所有臨時變數",
      "delete": "刪除此變數",
      "fullscreenEdit": "全螢幕編輯變數值"
    },
    "variableValueGeneration": {
      "generateButton": "智慧填充變數值",
      "generating": "智慧生成中...",
      "dialogTitle": "預覽生成的變數值",
      "variableName": "變數名稱",
      "generatedValue": "生成的值",
      "valuePlaceholder": "請輸入變數值",
      "reason": "生成理由",
      "confidence": "置信度",
      "selected": "已選擇",
      "batchApply": "批次應用 ({count})",
      "noVariablesToGenerate": "沒有需要生成值的變數",
      "generateFailed": "變數值生成失敗",
      "applySuccess": "成功應用 {count} 個變數值",
      "noPrompt": "請先輸入或生成優化後的提示詞",
      "noMissingVariables": "所有變數均已填充",
      "serviceNotReady": "變數值生成服務未就緒",
      "noValues": "未生成任何變數值"
    },
    "invalidVariables": "變數資料無效",
    "getVariablesFailed": "取得變數失敗"
  },
  "evaluation": {
    "button": "評估",
    "evaluate": "評估",
    "reEvaluate": "重新評估",
    "compareEvaluate": "對比評估",
    "loading": "正在評估中...",
    "analyzing": "正在分析...",
    "overallScore": "總分",
    "dimensions": "維度評分",
    "issues": "問題",
    "improvements": "改進建議",
    "applyToIterate": "迭代優化",
    "rewriteFromEvaluation": "智慧重寫",
    "rewriteSkipped": "目前評估建議保持提示詞不變，暫不發起智慧重寫。",
    "applySuccess": "正在應用改進建議...",
    "noResult": "暫無評估結果，點擊評估按鈕開始評估",
    "viewDetails": "檢視詳情",
    "feedbackAnalyze": "聚焦",
    "feedbackTitle": "聚焦點",
    "optional": "可選",
    "feedbackPlaceholder": "請輸入你希望評估重點關注的面向或意見，分析將優先圍繞該點展開",
    "feedbackHint": "Esc 取消 · Ctrl/⌘ + Enter 提交",
    "feedbackSubmit": "提交並開始分析",
    "focus": "聚焦",
    "focusTitle": "聚焦點",
    "focusPlaceholder": "可選：輸入你希望評估重點關注的面向/意見（例如輸出結構、約束遺漏、示例長度等）",
    "focusHint": "不填也可以直接開始（等同預設智慧評估）",
    "stale": {
      "default": "結果基於舊內容，建議重新評估。",
      "promptOnly": "提示詞已變更，建議重新分析。",
      "promptIterate": "提示詞或迭代要求已變更，建議重新分析。",
      "result": "測試或工作區已變更，建議重新評估。",
      "compare": "測試或工作區已變更，建議重新對比。"
    },
    "title": {
      "default": "評估結果",
      "result": "測試結果評估",
      "compare": "對比評估",
      "promptOnly": "提示詞品質分析",
      "promptIterate": "迭代優化分析"
    },
    "type": {
      "result": "評估該結果",
      "compare": "對比評估"
    },
    "compareConfig": {
      "button": "比較設定",
      "dialogTitle": "比較設定",
      "helper": "先確認每列測試分別扮演什麼角色；如果系統建議合理，直接確認即可。",
      "helperSummary": "先確認優化目標；上一版會跟隨目前工作區自動變化。",
      "summaryTitle": "本次比較方案",
      "currentTargetLabel": "目前優化目標",
      "currentTargetMissing": "尚未選擇",
      "summaryUnassigned": "暫未指定",
      "summaryUnused": "本輪不使用",
      "summaryNeedTarget": "需要指定優化目標",
      "summaryAssigned": "已就緒",
      "summaryRequired": "必填",
      "summaryOptional": "可選",
      "summaryStructured": "將使用智慧比較，優先判斷優化目標是否進步、是否能向教師學習，以及結論是否穩定。",
      "summaryGeneric": "目前配置更適合普通比較，不會進入逐組智慧比較。",
      "summaryPairs": "本次會重點比較：{pairs}",
      "summaryHints": {
        "target": "選擇你現在真正想優化、想判斷是否變好的那一列。",
        "baseline": "通常就是目前工作區的上一版，用來判斷這次改寫是否真的更好。",
        "reference": "通常選擇更強模型或更穩定的一列，作為教師來提煉可學習的做法。",
        "replica": "用來看這次結論穩不穩；如果上一版和工作區相同，也會在這裡出現。",
        "referenceBaseline": "只在需要判斷教師側前後變化時使用，預設不用設定。"
      },
      "assignedHints": {
        "baselineDynamic": "跟隨目前工作區自動解析。",
        "replicaFromPrevious": "和目前工作區內容相同，所以這次按複測處理。"
      },
      "requireTarget": "偵測到多個工作區測試，請先明確哪一個是優化目標。",
      "targetRequired": "請先指定一個優化目標。",
      "targetNeededShort": "請先選擇優化目標",
      "reviewNeededShort": "請重新確認",
      "autoDetected": "系統建議",
      "manualAssigned": "手動指定",
      "selectRolePlaceholder": "選擇角色",
      "restoreSuggested": "恢復建議",
      "suggestedRoleTag": "系統建議：{role}",
      "unassignedTag": "未明確",
      "unresolvedHint": "這一列角色暫未明確，目前不會進入核心智慧比較。",
      "unresolvedFallbackSummary": "{entries} 列角色未明確，這次將退回為普通比較。",
      "expiredManualTag": "需重新確認",
      "expiredManualSummary": "有 {count} 筆舊的手動設定已失效，系統已回退到目前建議。",
      "workspaceChangedTag": "需重新確認",
      "workspaceChangedSummary": "有 {count} 筆工作區角色對應的提示詞已變化，請重新確認這些設定。",
      "keepAuto": "保持系統建議",
      "keepAutoWithRole": "保持系統建議（目前：{role}）",
      "useInferred": "使用系統建議",
      "clearManual": "移除手動設定",
      "slotSectionTitle": "逐列設定",
      "slotSectionSummary": "系統已先給出建議；只有在你覺得不對時，才需要手動修改。",
      "currentRoleLabel": "目前角色",
      "rolePickerLabel": "這一列扮演什麼角色",
      "suggestedRoleLabel": "系統建議",
      "workspaceChangedInline": "這一列對應的工作區提示詞變了，建議重新確認。",
      "planStructuredSummaryDynamic": "這次會圍繞目前優化目標做智慧比較，重點判斷{focuses}。",
      "planGenericSummary": "目前測試列還不能組成穩定的智慧比較，因此這次會退回為普通比較。",
      "structuredFocusJoiner": "、",
      "structuredFocusFinalJoiner": "，以及",
      "structuredFocus": {
        "targetBaseline": "它相對上一版是否進步",
        "targetReference": "和教師還有多大差距",
        "referenceBaseline": "同類改動在教師側是否也成立",
        "targetReplica": "目前結論是否穩定"
      },
      "previewModeLabel": "比較方式",
      "previewPairsLabel": "逐組比較",
      "previewReasonsLabel": "系統說明",
      "previewModeStructured": "智慧比較",
      "previewModeGeneric": "普通比較",
      "genericFallbackSummary": "目前配置會走普通比較，而不是逐組智慧比較。",
      "confirmDisabled": "存在衝突，暫時無法確認",
      "noVersionLabel": "未指定版本",
      "noModel": "未指定模型",
      "blockingSummary": "目前角色配置有衝突，請先調整後再確認。",
      "advancedSectionTitle": "高級細節",
      "advancedSectionSummary": "這裡會說明系統會怎麼比較，以及為什麼會這樣判斷。",
      "showAdvancedRoles": "顯示高級角色",
      "hideAdvancedRoles": "隱藏高級角色",
      "showAdvancedDetails": "查看高級細節",
      "hideAdvancedDetails": "收起高級細節",
      "advancedConflictTitle": "需要先解決的問題",
      "pairValues": {
        "targetBaseline": "優化目標 vs 上一版",
        "targetReference": "優化目標 vs 教師",
        "referenceBaseline": "教師 vs 教師的上一版",
        "targetReplica": "優化目標 vs 複測"
      },
      "reasonValues": {
        "duplicateTarget": "目前有多個「優化目標」，系統無法判斷你真正要優化的是哪一列。",
        "duplicateBaseline": "目前有多個「上一版」，系統無法判斷該拿哪一列作為回退基線。",
        "duplicateReference": "目前有多個「教師」，系統無法判斷該向哪一列學習。",
        "duplicateReferenceBaseline": "目前有多個「教師的上一版」，系統無法判斷哪一列屬於教師側基線。",
        "hasAuxiliarySnapshot": "有些測試不適合做逐組比較，所以這次會退回普通比較。",
        "missingTarget": "目前沒有可用的「優化目標」，因此無法進入智慧比較。",
        "missingStructuredCompanion": "優化目標缺少關鍵搭配（上一版 / 教師 / 複測），暫時無法進行核心逐組比較。",
        "referenceBaselineWithoutReference": "存在「教師的上一版」，但沒有對應的「教師」，這組證據不會參與智慧比較。"
      },
      "roleValues": {
        "target": "優化目標",
        "baseline": "上一版",
        "reference": "教師",
        "referenceBaseline": "教師的上一版",
        "replica": "複測",
        "auxiliary": "其他測試"
      },
      "suggestionReasons": {
        "default": "系統會根據目前版本、模型與提示詞關係給出這個建議。",
        "target": {
          "uniqueWorkspace": "這是目前唯一的工作區，所以建議作為優化目標。",
          "workspace": "這是目前工作區列，所以建議作為優化目標。"
        },
        "baseline": {
          "dynamicPrevious": "這是目前工作區的上一版，所以建議作為上一版。",
          "sameModelDifferentPrompt": "它與優化目標模型相同、提示詞不同，所以建議作為上一版。"
        },
        "reference": {
          "samePromptDifferentModel": "這是不同模型的工作區結果，所以建議作為教師。",
          "differentModel": "它與優化目標使用不同模型，所以建議作為教師。"
        },
        "referenceBaseline": {
          "sameModelDifferentPrompt": "它與教師模型相同、提示詞不同，所以建議作為教師的上一版。"
        },
        "replica": {
          "previousMatchesWorkspace": "它和工作區目前內容相同，所以建議按複測處理。",
          "samePromptAsTarget": "它與優化目標使用相同提示詞，所以建議作為複測。"
        },
        "auxiliary": {
          "default": "這一列不會進入核心逐組比較，所以保留為其他測試。"
        }
      }
    },
    "compareShared": {
      "status": {
        "needTarget": "請先選擇優化目標",
        "needReview": "設定已變化，請重新確認"
      },
      "roleValues": {
        "target": "優化目標",
        "baseline": "上一版",
        "reference": "教師",
        "referenceBaseline": "教師的上一版",
        "replica": "複測",
        "auxiliary": "其他測試"
      },
      "roleDescriptions": {
        "target": "這是你現在真正想優化、想判斷是否變好的那一列，也是本輪比較的主角。",
        "baseline": "這是目前工作區的上一版，用來判斷這次改寫是否真的有進步。",
        "reference": "這是教師結果，通常來自更強模型或更穩定的輸出，用來幫助你學習更好的結構策略。",
        "referenceBaseline": "這是教師側的上一版，只會出現在高級細節裡，用來判斷同一類改動在教師側是否也成立。",
        "replica": "這是用來檢查結論是否穩定的複測；如果上一版和工作區相同，也會在這裡出現。",
        "auxiliary": "這類測試仍然可以參與普通比較，但不會成為智慧比較裡的核心逐組對象。"
      },
      "roleSource": {
        "manual": "這是你手動確認的角色。",
        "auto": "這是系統自動建議的角色。"
      },
      "unresolved": {
        "label": "未明確",
        "description": "這一列還沒有被明確歸到核心比較角色裡。",
        "source": "系統暫時無法把它判斷為優化目標、上一版、教師或複測。"
      },
      "review": {
        "workspaceChanged": "對應的工作區提示詞已經變化，請重新確認這個角色。",
        "staleManual": "舊的手動設定已不再適配目前比較方案。"
      },
      "roleAction": "點擊這個標籤即可修改比較角色。",
      "assignment": {
        "unassigned": "還沒有分配角色。",
        "manual": "你手動選擇了：{role}",
        "auto": "系統建議：{role}"
      },
      "modeValues": {
        "structured": "智慧比較",
        "generic": "普通比較"
      },
      "recommendationValues": {
        "continue": "繼續改",
        "stop": "可以先停",
        "review": "需要人工確認"
      }
    },
    "compareHelp": {
      "title": "對比評估教學",
      "tooltip": "什麼是對比評估？"
    },
    "compareUnavailable": {
      "missingWorkspace": "對比評估至少需要一個工作區測試結果，因為系統會圍繞目前工作區提示詞給出改進建議。請先執行工作區欄位後再進行對比。"
    },
    "compareSummary": {
      "decision": {
        "title": "迭代建議"
      },
      "reusableImprovements": "可直接採用的改進方向",
      "rewriteButton": "根據本次評估改寫",
      "rewriteSkipHint": "目前建議先保持不變，除非你已經確認還有明確且可複用的改進空間。",
      "rewriteMinorHint": "目前更適合小範圍修正，而不是繼續大幅重寫。",
      "compactSignals": {
        "targetVsBaseline": "上一版",
        "targetVsReferenceGap": "教師差距",
        "improvementHeadroom": "空間",
        "overfitRisk": "過擬合"
      },
      "reasonTitles": {
        "progress": "上一版",
        "reference": "教師",
        "stability": "穩定性"
      },
      "reasonBodies": {
        "progress": {
          "improved": "目前優化目標相對上一版是進步的，但還要繼續確認哪些提升是真正可複用的。",
          "flat": "目前優化目標和上一版差異不大，需要結合教師與穩定性證據再決定下一步。",
          "regressed": "目前優化目標相對上一版出現退步，應先找出回退原因。"
        },
        "reference": {
          "none": "目前優化目標和教師結果已經很接近，繼續改寫的收益可能有限。",
          "minor": "目前優化目標與教師之間還有一些可學習的結構差距。",
          "major": "目前優化目標與教師之間仍有明顯差距，下一輪應優先學習教師側更強的策略。"
        },
        "stability": {
          "high": "目前收益可能包含較強的樣例擬合風險，繼續改寫前應先過濾過擬合規則。",
          "medium": "目前還存在一定的過擬合風險，下一輪應更保守地保留通用規則。",
          "low": "目前整體已較接近收斂，繼續疊加規則前要先確認是否還有真實改進空間。",
          "default": "還需要結合更多共享輸入確認目前結論是否穩定。"
        }
      },
      "advanced": {
        "show": "查看高級細節",
        "hide": "收起高級細節",
        "title": "比較詳情",
        "mode": "比較方式",
        "roles": "比較對象",
        "stopSignals": "風險與收斂信號",
        "insights": "關鍵發現",
        "focusSummaries": "聚焦結論",
        "pairHighlights": "逐組亮點",
        "evidence": "原始證據摘錄",
        "learnableSignals": "可學習信號",
        "overfit": "過擬合風險",
        "conflicts": "需要人工確認",
        "judgements": "逐組比較"
      }
    },
    "compareMetadata": {
      "title": "高級比較資訊",
      "insights": "關鍵發現",
      "decision": {
        "title": "比較結論",
        "keyEvidence": "關鍵依據",
        "nextActions": "下一步建議",
        "headlines": {
          "continue": "目前優化目標方向是對的，但仍然存在可執行的改進空間。",
          "stop": "目前結果已接近收斂，繼續自動改寫的收益可能有限。",
          "review": "目前對比結果建議先人工複核，再決定是否繼續改寫。",
          "regressed": "目前優化目標相較上一版出現退步，暫時不應直接接受這次改寫。"
        },
        "actions": {
          "inspectRegression": "先檢查新版本刪掉了什麼、削弱了什麼，再決定是否繼續改寫。",
          "reviewBeforeRewrite": "先複核證據衝突點，再決定是繼續改寫還是保留目前版本。",
          "reviewPromptValidity": "先檢查這次 prompt 改動是否真的可遷移，因為參考側暫時並不支持它。",
          "learnFromReference": "下一輪優先學習教師側更強的結構策略，而不是做大範圍改動。",
          "filterOverfit": "過濾掉只適配目前樣例的規則，保留可複用的通用約束。",
          "continueTargetedRewrite": "如果繼續改寫，只聚焦最高訊號差距，不要同時做大範圍重寫。",
          "acceptCurrent": "可以把目前工作區視為接近收斂，除非有新證據，否則不要繼續疊加規則。",
          "verifyStability": "如果目前判斷仍然臨界，建議再用一個共享輸入驗證穩定性。"
        }
      },
      "focusSummaries": "聚焦結論",
      "mode": "比較方式",
      "roles": "比較對象",
      "judgements": "逐組比較",
      "pairHighlights": "逐組亮點",
      "progressSummary": "相比上一版",
      "referenceGapSummary": "相比教師",
      "promptChangeSummary": "改動有效性",
      "stabilitySummary": "穩定性",
      "stopSignals": "風險與收斂信號",
      "evidence": "證據",
      "evidenceHighlights": "證據摘錄",
      "learnableSignals": "可學習信號",
      "overfitWarnings": "過擬合警告",
      "conflictSignals": "需要人工確認",
      "targetVsBaseline": "優化目標 vs 上一版",
      "targetVsReferenceGap": "優化目標 vs 教師差距",
      "improvementHeadroom": "改進空間",
      "overfitRisk": "過擬合風險",
      "stopRecommendation": "建議結論",
      "stopReasons": "判斷依據",
      "modeValues": {
        "structured": "智慧比較",
        "generic": "普通比較"
      },
      "roleValues": {
        "target": "優化目標",
        "baseline": "上一版",
        "reference": "教師",
        "referenceBaseline": "教師的上一版",
        "replica": "複測",
        "auxiliary": "其他測試"
      },
      "verdictValues": {
        "left-better": "左側更優",
        "right-better": "右側更優",
        "mixed": "各有優劣",
        "similar": "基本接近"
      },
      "confidenceValues": {
        "low": "低置信",
        "medium": "中置信",
        "high": "高置信"
      },
      "conflictSignalValues": {
        "improvementNotSupportedOnReference": "目前優化目標雖然比上一版更好，但同一改動沒有得到教師側支持。",
        "improvementUnstableAcrossReplicas": "目前目標雖然有提升，但複測證據提示收益可能不穩定。",
        "regressionOutweighsCosmeticGains": "相對上一版的退步應優先於其他表面優化。",
        "sampleOverfitRiskVisible": "目前同時存在可複用收益與樣例擬合風險，應保持保守判斷。"
      },
      "signalValues": {
        "targetVsBaseline": {
          "improved": "有進步",
          "flat": "基本持平",
          "regressed": "有退步"
        },
        "targetVsReferenceGap": {
          "none": "差距很小",
          "minor": "還有一點差距",
          "major": "差距明顯"
        },
        "improvementHeadroom": {
          "none": "幾乎沒有",
          "low": "較小",
          "medium": "還有一些",
          "high": "仍然很大"
        },
        "overfitRisk": {
          "low": "較低",
          "medium": "中等",
          "high": "較高"
        },
        "stopRecommendation": {
          "continue": "繼續改",
          "stop": "可以先停",
          "review": "需要人工確認"
        }
      }
    },
    "level": {
      "excellent": "優秀",
      "good": "良好",
      "acceptable": "合格",
      "poor": "較差",
      "veryPoor": "很差"
    },
    "dimension": {
      "goalAchievement": "目標達成度",
      "outputQuality": "輸出品質",
      "formatCompliance": "格式規範性",
      "relevance": "相關性"
    },
    "optimizedBetter": "優化後效果更好",
    "originalBetter": "原始效果更好",
    "syntheticInput": {
      "noExplicitText": "沒有額外測試輸入，輸出會直接基於目前提示詞生成。",
      "noExplicitVariables": "沒有額外變數輸入。"
    },
    "error": {
      "title": "評估失敗",
      "serviceNotReady": "評估服務未就緒，請稍後再試",
      "failed": "評估失敗：{error}",
      "noOptimizedPrompt": "沒有可優化的提示詞"
    },
    "designContext": {
      "basic": "設計上下文",
      "advanced": "設計上下文"
    },
    "variableExtraction": {
      "extractButton": "自動提取變數",
      "extracting": "自動提取中...",
      "dialogTitle": "自動提取結果",
      "variableName": "變數名稱",
      "variableValue": "變數值",
      "reason": "提取理由",
      "category": "分類",
      "selected": "已選擇",
      "batchCreate": "批次建立",
      "noVariables": "未識別到可提取的變數",
      "extractFailed": "自動提取失敗",
      "staleResult": "提示詞或變數已變更，請重新提取。",
      "createSuccess": "成功建立 {count} 個變數",
      "summary": "總結",
      "workspaceNotReady": "無法存取工作區狀態",
      "noPromptContent": "請先輸入提示詞內容",
      "noEvaluationModel": "請先選擇評估模型",
      "serviceNotReady": "變數提取服務未就緒",
      "invalidVariableNames": "以下變數名稱不合法（不能以數字或 # / ^ ! > & 開頭，且不能包含空白/花括號，最長 {max} 個字元）：{names}"
    },
    "diagnose": {
      "title": "診斷分析",
      "confidence": "置信度",
      "findings": "發現問題",
      "patchPlan": "修復計畫",
      "noFindings": "未發現問題",
      "noPatchPlan": "無修復計畫",
      "applyFix": "應用修復",
      "replaceNow": "立即替換",
      "invariantsWarning": "受限於不可改變項約束",
      "changeBudgetWarning": "受限於變更預算限制",
      "status": {
        "ok": "診斷正常",
        "degraded": "部分降級",
        "failed": "診斷失敗"
      },
      "severity": {
        "critical": "嚴重",
        "major": "重要",
        "minor": "次要",
        "suggestion": "建議",
        "unknown": "未知"
      },
      "anchorType": {
        "text": "文本",
        "section": "段落",
        "pattern": "正則"
      },
      "operation": {
        "insert": "插入",
        "replace": "替換",
        "delete": "刪除"
      },
      "anchorPosition": {
        "before": "之前",
        "after": "之後",
        "replace": "替換"
      },
      "invariantsRisks": "約束衝突風險"
    }
  }
} as const;

export default messages;
