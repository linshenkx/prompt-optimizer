const messages = {
  "modelManager": {
    "title": "模型管理",
    "textModels": "文字模型",
    "imageModels": "圖像模型",
    "functionModels": "功能模型",
    "modelList": "模型清單",
    "testConnection": "測試連線",
    "editModel": "編輯",
    "deleteModel": "刪除",
    "displayName": "顯示名稱",
    "enabled": "啟用",
    "enabledStatus": "啟用狀態",
    "modelKey": "模型標識",
    "apiUrl": "API位址",
    "apiUrlHint": "範例：https://api.example.com/v1；多數提供商位址通常以 /v1 結尾",
    "apiUrlHintAriaLabel": "顯示 API 位址說明",
    "defaultModel": "預設模型",
    "clickToFetchModels": "點選箭頭取得模型清單",
    "apiKey": "API金鑰",
    "getApiKey": "獲取API金鑰",
    "addModel": "新增",
    "addImageModel": "新增圖像模型",
    "provider": {
      "section": "提供商配置",
      "label": "提供商",
      "placeholder": "選擇提供商",
      "openaiHint": "這是官方 OpenAI API 入口。如果你想接入自訂 Base URL、第三方相容服務或本地模型，請選擇「Custom API (OpenAI Compatible)」。",
      "customApiHint": "用於接入自訂 OpenAI 相容接口。你可以配置 Base URL、自訂模型名稱，並選擇 Chat Completions 或 Responses 請求風格。",
      "dashscopeHint": "阿里百鍊已支援 OpenAI 相容的 Chat Completions 與 Responses 接口，目前可直接在這裡切換請求風格使用。",
      "minimaxHint": "預設位址是 MiniMax 海外 OpenAI 相容接口。中國大陸用戶請將 API 位址改為 https://api.minimaxi.com/v1；這裡不要使用 MiniMax 的 Anthropic 格式位址。"
    },
    "connection": {
      "accountId": "帳戶 ID",
      "requestStyle": "請求風格",
      "requestStyleOptions": {
        "chatCompletions": "Chat Completions",
        "responses": "Responses"
      }
    },
    "model": {
      "section": "模型配置"
    },
    "advancedParameters": {
      "title": "進階參數",
      "noParamsConfigured": "未配置進階參數",
      "customParam": "自訂",
      "advancedTag": "進階",
      "add": "新增參數",
      "select": "選擇參數",
      "selectTitle": "新增進階參數",
      "custom": "自訂參數",
      "customKeyPlaceholder": "輸入參數名稱",
      "customValuePlaceholder": "輸入參數值",
      "stopSequencesPlaceholder": "輸入停止序列（逗號分隔）",
      "unitLabel": "單位",
      "currentProvider": "目前提供商",
      "customProvider": "自訂",
      "availableParams": "個可選參數",
      "noAvailableParams": "無可選參數",
      "validation": {
        "unknownParam": "參數定義不存在",
        "customKeyRequired": "參數名稱不能為空",
        "customValueRequired": "參數值不能為空",
        "duplicateParam": "參數已存在",
        "dangerousParam": "此參數名稱包含潛在危險字元，不允許使用",
        "invalidNumber": "參數值必須是有效的{type}",
        "belowMin": "參數值不能小於 {min}",
        "aboveMax": "參數值不能大於 {max}",
        "mustBeInteger": "參數值必須是整數"
      },
      "formatJson": "JSON",
      "formatString": "字串",
      "parsedAsObject": "已解析為 Object ✓",
      "invalidJson": "無效 JSON，將作為字串發送"
    },
    "modelKeyPlaceholder": "請輸入模型標識",
    "displayNamePlaceholder": "請輸入顯示名稱",
    "apiUrlPlaceholder": "https://api.example.com/v1",
    "defaultModelPlaceholder": "輸入或選擇模型名稱",
    "apiKeyPlaceholder": "請輸入API金鑰（選填）",
    "modelKeyRequired": "模型標識不能為空",
    "modelKeyReserved": "模型標識「{id}」與內建配置衝突，請更換標識，或直接編輯對應的內建模型配置",
    "modelKeyAlreadyExists": "模型標識「{id}」已存在，請更換標識",
    "modelIdGenerateFailed": "生成唯一的模型標識失敗，請重試",
    "deleteConfirm": "確定要刪除此模型嗎？此操作無法復原。",
    "testing": "正在測試連線...",
    "testSuccess": "{provider}連線測試成功",
    "testFailed": "{provider}連線測試失敗：{error}",
    "updateSuccess": "更新成功",
    "updateFailed": "更新失敗：{error}",
    "addSuccess": "新增成功",
    "addFailed": "新增失敗：{error}",
    "createSuccess": "建立成功",
    "createFailed": "建立失敗：{error}",
    "enableSuccess": "啟用成功",
    "enableFailed": "啟用失敗：{error}",
    "disableSuccess": "停用成功",
    "disableFailed": "停用失敗：{error}",
    "cloneModel": "克隆",
    "cloneSuccess": "模型克隆成功",
    "cloneFailed": "模型克隆失敗",
    "deleteSuccess": "刪除成功",
    "deleteFailed": "刪除失敗：{error}",
    "toggleFailed": "切換失敗：{error}",
    "fetchModelsSuccess": "成功取得 {count} 個模型",
    "loadingModels": "正在載入模型選項...",
    "noModelsAvailable": "沒有可用模型",
    "selectModel": "選擇一個模型",
    "fetchModelsFailed": "取得模型清單失敗：{error}",
    "fetchModelsFallback": "取得模型清單失敗：{error}（已回退到預設的 {count} 個模型）",
    "needApiKeyAndBaseUrl": "請先填寫API位址和金鑰",
    "needBaseUrl": "請先填寫API位址",
    "corsRestrictedTag": "CORS受限",
    "corsRestrictedConfirm": "{provider} 存在瀏覽器CORS跨域限制，Web端連線測試可能會失敗。\n\n這不代表API Key有問題，而是瀏覽器安全策略阻止了請求。\n建議下載桌面版APP使用，或確保該提供商支援瀏覽器直連。\n\n是否繼續測試？",
    "errors": {
      "crossOriginConnectionFailed": "跨域連線失敗，請檢查網路連線",
      "connectionFailed": "連線失敗，請檢查API位址和網路連線",
      "missingV1Suffix": "API位址格式錯誤，OpenAI相容API需要包含\"/v1\"後綴",
      "invalidResponseFormat": "API回應格式不相容，請檢查API服務是否為OpenAI相容格式",
      "emptyModelList": "API回應空的模型清單，該服務可能沒有可用模型",
      "apiError": "API錯誤：{error}"
    },
    "capabilities": {
      "tools": "工具呼叫",
      "reasoning": "推理模式",
      "vision": "視覺理解"
    },
    "disabled": "已停用",
    "testConnectionAriaLabel": "測試連線到{name}",
    "editModelAriaLabel": "編輯模型{name}",
    "enableModelAriaLabel": "啟用模型{name}",
    "disableModelAriaLabel": "停用模型{name}",
    "deleteModelAriaLabel": "刪除模型{name}",
    "displayNameAriaLabel": "模型顯示名稱",
    "apiUrlAriaLabel": "模型API位址",
    "defaultModelAriaLabel": "預設模型名稱",
    "apiKeyAriaLabel": "API金鑰",
    "cancelEditAriaLabel": "取消編輯模型",
    "saveEditAriaLabel": "儲存模型修改",
    "cancelAddAriaLabel": "取消新增模型",
    "confirmAddAriaLabel": "確認新增模型"
  },
  "functionModel": {
    "evaluationModel": "評估模型",
    "evaluationModelHint": "用於智慧評估和變數提取，預設使用全域優化模型",
    "imageRecognitionModel": "圖像識別模型",
    "imageRecognitionModelHint": "用於從圖片提取 JSON 提示詞和變數初始值，需單獨設定",
    "noImageRecognitionModel": "請先在功能模型中設定圖像識別模型",
    "unsupportedImageRecognitionModel": "目前圖像識別模型暫不支援圖片提取：{provider}"
  },
  "model": {
    "select": {
      "placeholder": "請選擇模型",
      "configure": "配置模型",
      "noModels": "請配置模型",
      "noAvailableModels": "暫無可用模型"
    },
    "manager": {
      "displayName": "例如: 自訂模型",
      "apiUrl": "API 位址",
      "defaultModel": "預設模型名稱",
      "modelNamePlaceholder": "例如: gpt-3.5-turbo"
    }
  },
  "params": {
    "temperature": {
      "label": "溫度 (Temperature)",
      "description": "控制隨機性：較低的值（例如0.2）使輸出更集中和確定，較高的值（例如0.8）使其更隨機。"
    },
    "top_p": {
      "label": "Top P (核心取樣)",
      "description": "核心取樣。僅考慮累積機率達到Top P閾值的Token。例如，0.1表示僅考慮構成最高10%機率質量的Token。"
    },
    "max_tokens": {
      "label": "最大Token數",
      "description": "在補全中生成的最大Token數量。"
    },
    "presence_penalty": {
      "label": "存在懲罰 (Presence Penalty)",
      "description": "介於-2.0和2.0之間的數字。正值會根據新Token是否已在文字中出現來懲罰它們，增加模型談論新主題的可能性。"
    },
    "frequency_penalty": {
      "label": "頻率懲罰 (Frequency Penalty)",
      "description": "介於-2.0和2.0之間的數字。正值會根據新Token在文字中已出現的頻率來懲罰它們，降低模型逐字重複相同行的可能性。"
    },
    "timeout": {
      "label": "逾時時間 (毫秒)",
      "description_openai": "OpenAI用戶端連線的請求逾時時間（毫秒）。"
    },
    "maxOutputTokens": {
      "label": "最大輸出Token數",
      "description": "模型在單個回應中可以輸出的最大Token數。"
    },
    "top_k": {
      "label": "Top K (K選頂)",
      "description": "將下一個Token的選擇範圍限制為K個最可能的Token。有助於減少無意義Token的生成。"
    },
    "candidateCount": {
      "label": "候選數量",
      "description": "回應的生成回應數量。必須介於1和8之間。"
    },
    "stopSequences": {
      "label": "停止序列",
      "description": "遇到時將停止輸出生成的自訂字串。用逗號分隔多個序列。"
    },
    "thinkingBudget": {
      "label": "思考預算",
      "description": "分配給模型思考過程的最大令牌數（僅 Gemini 2.5+）。範圍：1-8192 令牌。"
    },
    "includeThoughts": {
      "label": "包含思考過程",
      "description": "是否在回應中包含模型的思考過程（僅 Gemini 2.5+）。啟用後可以看到模型的推理步驟。"
    },
    "reasoning_effort": {
      "label": "推理強度",
      "description": "控制支援思考模式的模型投入的推理強度。"
    },
    "deepseek": {
      "thinking_type": {
        "label": "思考模式",
        "description": "控制 DeepSeek 思考模式，會作為 thinking.type 傳送到 API 請求中。",
        "disabled": "關閉",
        "enabled": "開啟"
      }
    },
    "tokens": {
      "unit": "令牌"
    },
    "size": {
      "label": "圖像尺寸",
      "description": "生成圖像的解析度/尺寸，如 1024x1024"
    },
    "quality": {
      "label": "圖像品質",
      "description": "生成圖像的品質等級：auto（自動）、high（高品質）、medium（中等）、low（低品質）"
    },
    "background": {
      "label": "背景透明度",
      "description": "設定圖像背景：auto（自動）、transparent（透明）、opaque（不透明）"
    },
    "imageSize": {
      "label": "圖像尺寸",
      "description": "生成圖像的解析度/尺寸，如 1024x1024"
    },
    "steps": {
      "label": "迭代步數",
      "description": "擴散/推理迭代次數，步數越多通常品質越高但更慢"
    },
    "guidance": {
      "label": "引導強度",
      "description": "提示詞遵循強度，值越大越貼近提示"
    },
    "cfg": {
      "label": "CFG強度",
      "description": "無分類器引導強度，用於控制生成圖像與提示詞的匹配程度（僅Qwen-Image模型）"
    },
    "negativePrompt": {
      "label": "負向提示詞",
      "description": "不希望圖像出現的內容或風格"
    },
    "responseFormat": {
      "label": "回應格式",
      "description": "回應圖片的格式（URL 或 Base64 編碼）"
    },
    "outputFormat": {
      "label": "輸出格式",
      "description": "指定生成圖像的檔案格式（如 PNG、JPEG 或 WebP）"
    },
    "watermark": {
      "label": "浮水印",
      "description": "是否在生成的圖像上新增浮水印"
    },
    "sequentialGeneration": {
      "label": "序列生成",
      "description": "控制序列圖像生成模式（支援的模型）"
    },
    "tools": {
      "label": "工具",
      "description": "5.0 系列擴充工具列表，每行一個工具名稱"
    },
    "seed": {
      "label": "隨機種子",
      "description": "用於控制生成結果的隨機數種子，相同種子產生相同結果"
    },
    "enable_thinking": {
      "label": "啟用思考",
      "description": "啟用思考模式，讓模型進行推理（僅支援部分模型）"
    },
    "thinking_budget": {
      "label": "思考Token預算",
      "description": "分配給思考過程的最大Token數，用於限制推理長度"
    },
    "enable_search": {
      "label": "啟用聯網搜尋",
      "description": "啟用聯網搜尋功能，讓模型獲取即時資訊（僅支援部分模型）"
    },
    "max_completion_tokens": {
      "label": "最大補全Token數",
      "description": "在補全中生成的最大Token數量（推薦使用，替代 max_tokens）。範圍：1-1,000,000。"
    },
    "logprobs": {
      "label": "返回對數概率",
      "description": "是否在回應中返回輸出Token的對數概率資訊。啟用後可以看到模型對每個Token的置信度。"
    },
    "top_logprobs": {
      "label": "Top對數概率數量",
      "description": "返回每個Token位置上概率最高的N個備選Token及其對數概率。範圍：0-20。需要先啟用 logprobs。"
    },
    "n": {
      "label": "生成數量",
      "description": "為每個輸入生成多少個補全結果。範圍：1-128。注意：生成多個結果會消耗更多Token配額。"
    }
  }
} as const;

export default messages;
