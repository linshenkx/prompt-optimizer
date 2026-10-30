const messages = {
  "imageMode": {
    "text2image": "文生圖",
    "image2image": "圖生圖",
    "multiimage": "多圖生圖",
    "text2imageDescription": "從文字描述生成圖像",
    "image2imageDescription": "基於現有圖像進行修改",
    "multiimageDescription": "基於多張圖片和提示詞生成新圖像",
    "uploadRequired": "圖生圖模式需要先上傳參考圖片"
  },
  "imageWorkspace": {
    "usage": {
      "tokens": "Token 用量",
      "promptTokens": "輸入",
      "imageTokens": "輸出",
      "totalTokens": "合計",
      "input": "輸入",
      "output": "輸出",
      "image": "圖片",
      "aspect": "比例",
      "tier": "尺寸級別",
      "thinkingTokens": "思考 Token",
      "inference": "耗時"
    },
    "input": {
      "originalPrompt": "原始提示詞",
      "originalPromptPlaceholder": "請輸入需要優化的圖像生成提示詞",
      "multiImagePromptPlaceholder": "請使用圖1 / 圖2 / 圖3 來描述圖片關係和生成目標",
      "image": "圖片",
      "imageAlt": "圖{index}",
      "imageLabel": "圖{index}",
      "removeImageAriaLabel": "刪除圖{index}",
      "reorderImageAriaLabel": "拖動調整圖{index}順序",
      "multiImageHint": "拖動卡片可調整圖1 / 圖2 / 圖3 的順序語義",
      "multiImageMinHint": "再新增一張圖片後即可開始多圖生圖",
      "multiImageReadyHint": "請至少上傳兩張圖片，再開始多圖生圖",
      "selectImage": "選擇",
      "optimizeTemplate": "優化範本",
      "templatePlaceholder": "請選擇範本",
      "textModel": "文字模型",
      "modelPlaceholder": "選擇模型",
      "optimizing": "優化中...",
      "optimizePrompt": "優化提示詞",
      "extractFromImage": "參考圖",
      "extracting": "提取中",
      "extractCompleted": "圖片提取完成",
      "extractCompletedWithVariables": "圖片提取完成，已識別 {count} 個本地變數並填入初始值",
      "extractFailed": "圖片提取失敗"
    },
    "referenceImage": {
      "replicateAction": "復刻",
      "replicateActionDescription": "忽略目前提示詞，以參考圖為主反推提示詞與變數",
      "styleLearnAction": "風格學習",
      "styleLearnActionDescription": "保留目前提示詞主體，只學習圖片的風格、構圖與色彩",
      "styleLearnDisabledHint": "請先輸入你想畫什麼",
      "processingStatus": "處理中",
      "readyStatus": "已生成",
      "errorStatus": "失敗",
      "resultTitle": "參考圖結果",
      "thumbnailAlt": "參考圖縮圖",
      "generatedPrompt": "生成後的提示詞",
      "variablePreview": "提取到的變數",
      "noVariables": "目前還沒有提取到變數",
      "applyToPrompt": "套用到目前提示詞",
      "applySuccess": "已寫入目前提示詞"
    },
    "generation": {
      "imageModel": "圖像模型",
      "imageModelPlaceholder": "請選擇圖像模型",
      "compareMode": "對比模式",
      "generating": "生成中...",
      "generateImage": "生成圖像",
      "processing": "處理中",
      "validationFailed": "目前設定或模型不支援此操作",
      "generateFailed": "圖像生成失敗",
      "missingRequiredFields": "請選擇圖像模型並確保有有效的提示詞",
      "missingVariables": "偵測到缺失或未填變數：{vars}",
      "forbiddenTemplateSyntax": "不支援使用未轉義 Mustache 語法（如三花括號或 & 標籤），請使用一般變數占位符",
      "inputImageRequired": "請先上傳輸入圖像（圖生圖模式需要輸入圖）",
      "multiImageUnsupported": "目前模型不支援多圖輸入，請切換到支援多圖輸入的圖像模型",
      "generationCompleted": "圖像生成完成"
    },
    "results": {
      "originalPromptResult": "原始提示詞",
      "optimizedPromptResult": "優化提示詞",
      "testResult": "測試結果",
      "download": "下載",
      "downloadFailed": "下載失敗",
      "copyBase64": "複製Base64",
      "copyText": "複製文字",
      "copySuccess": "複製成功",
      "copyError": "複製失敗",
      "textOutput": "文字輸出",
      "noOriginalResult": "暫無原始結果",
      "noOptimizedResult": "暫無優化結果",
      "noGenerationResult": "暫無生成結果"
    },
    "upload": {
      "title": "上傳參考圖片",
      "dragText": "點選或拖拽上傳圖片",
      "fileRequirements": "支援最大 50MB 的 PNG/JPEG，大圖會自動預處理",
      "uploadFailed": "上傳失敗",
      "uploadSuccess": "上傳成功",
      "preparedSuccess": "圖片已完成模型相容性處理：{before} → {after}",
      "preparedBatchSuccess": "已為模型相容性處理 {count} 張圖片",
      "processingFailed": "圖片處理失敗，請嘗試較小的圖片",
      "confirmTitle": "確認處理圖片",
      "confirmDescription": "為滿足模型輸入限制，將調整 {count} 張圖片的尺寸或重新編碼；處理後的檔案大小可能略有增加。",
      "confirmItem": "{name}：{beforeSize}，{beforeDimensions} → {afterSize}，{afterDimensions}",
      "confirmAction": "處理並繼續",
      "fileTypeNotSupported": "僅支援 PNG/JPEG 格式",
      "fileTooLarge": "所選圖片不能超過 50MB",
      "readFailed": "檔案讀取失敗，請重試"
    }
  },
  "image": {
    "capability": {
      "text2image": "文生圖",
      "image2image": "圖生圖",
      "multiImage": "多圖生成",
      "highResolution": "高解析度"
    },
    "step": {
      "basic": "基本資訊",
      "provider": "選擇提供商",
      "connection": "連線配置",
      "model": "模型選擇",
      "parameters": "參數設定"
    },
    "config": {
      "basic": {
        "title": "基本配置"
      },
      "name": {
        "label": "配置名稱",
        "placeholder": "請輸入配置名稱"
      },
      "displayName": {
        "label": "顯示名稱",
        "placeholder": "請輸入顯示名稱"
      },
      "enabled": {
        "label": "啟用狀態"
      },
      "enabledStatus": {
        "label": "啟用狀態"
      },
      "updateSuccess": "配置已更新",
      "createSuccess": "配置已建立",
      "saveFailed": "儲存配置失敗",
      "loadFailed": "載入配置失敗"
    },
    "provider": {
      "title": "提供商選擇",
      "section": "提供商配置",
      "label": "圖像提供商",
      "placeholder": "請選擇提供商",
      "loadFailed": "載入提供商失敗"
    },
    "connection": {
      "title": "連線配置",
      "test": "測試連線",
      "testing": "正在測試連線...",
      "testSuccess": "功能測試成功",
      "testFailed": "連線測試失敗",
      "testError": "連線測試錯誤",
      "functionTestTextToImage": "文生圖測試",
      "functionTestImageToImage": "圖生圖測試",
      "testImagePreview": "測試圖像預覽",
      "downloadSuccess": "圖像下載成功",
      "downloadFailed": "圖像下載失敗",
      "apiKey": {
        "label": "API 金鑰",
        "description": "用於認證的金鑰",
        "placeholder": "請輸入 API Key"
      },
      "baseURL": {
        "label": "API 位址",
        "description": "服務端點的基礎位址",
        "placeholder": "https://api.example.com/v1"
      },
      "accountId": {
        "label": "帳戶 ID",
        "description": "Cloudflare 帳戶 ID",
        "placeholder": "請輸入 Cloudflare Account ID"
      },
      "organization": {
        "label": "組織標識（選填）",
        "description": "OpenAI 組織 ID（如適用）",
        "placeholder": "org_xxx"
      },
      "validation": {
        "missing": "缺少必填欄位：{fields}",
        "invalidType": "{field} 類型應為 {expected}，實際為 {actual}"
      }
    },
    "model": {
      "section": "模型配置",
      "label": "選擇模型",
      "placeholder": "請選擇模型",
      "loading": "正在載入模型...",
      "refreshTooltip": "重新整理模型清單",
      "refreshDisabledTooltip": {
        "dynamicNotSupported": "目前提供商不支援動態取得模型",
        "connectionRequired": "需要有效的連線配置才能重新整理模型"
      },
      "refreshSuccess": "模型清單已重新整理",
      "refreshError": "重新整理模型清單失敗",
      "selectRequired": "請選擇一個模型進行測試",
      "count": "共 {count} 個模型",
      "capabilities": "模型能力",
      "empty": "暫無圖像模型配置",
      "addFirst": "新增第一個圖像模型",
      "staticLoaded": "已載入靜態模型",
      "noStaticModels": "沒有靜態模型",
      "staticLoadFailed": "載入靜態模型失敗",
      "dynamicLoaded": "已載入動態模型",
      "dynamicFailed": "載入動態模型失敗，已回退靜態清單",
      "connectionRequired": "請先填寫並校驗連線資訊",
      "refreshFailed": "重新整理模型失敗",
      "quickSwitch": {
        "title": "切換目前圖像模型",
        "placeholder": "選擇圖像模型",
        "modelTagTitle": "點擊切換目前圖像配置的模型",
        "fetchFailed": "取得線上圖像模型列表失敗：{error}，可繼續選擇本地預設模型。",
        "updateSuccess": "已切換為 {model}",
        "updateFailed": "切換圖像模型失敗：{error}"
      }
    },
    "parameters": {
      "noParameters": "該模型暫無可配置參數",
      "advancedConfig": "進階參數配置",
      "advancedConfigDescription": "選填，用於覆蓋預設模型參數"
    },
    "params": {
      "size": {
        "label": "圖像尺寸",
        "description": "生成圖像的解析度/尺寸，如 1024x1024"
      },
      "aspect_ratio": {
        "label": "畫面比例",
        "description": "生成圖像的畫面寬高比例"
      },
      "resolution": {
        "label": "解析度檔位",
        "description": "生成圖像的解析度檔位"
      },
      "quality": {
        "label": "圖像品質",
        "description": "生成圖像的品質等級：auto（自動）、high（高品質）、medium（中等）、low（低品質）"
      },
      "background": {
        "label": "背景透明度",
        "description": "設定圖像背景：auto（自動）、transparent（透明）、opaque（不透明）"
      },
      "negativePrompt": {
        "label": "負向提示詞",
        "description": "指定不希望在生成圖像中出現的內容"
      },
      "promptExtend": {
        "label": "提示詞擴展",
        "description": "啟用後模型會自動擴展和最佳化提示詞以獲得更好的效果"
      },
      "watermark": {
        "label": "浮水印",
        "description": "是否在生成的圖像上新增浮水印"
      },
      "seed": {
        "label": "隨機種子",
        "description": "用於生成可複現結果的隨機種子，相同種子會生成相似圖像"
      },
      "count": {
        "label": "生成數量",
        "description": "一次生成的圖像數量"
      },
      "style": {
        "label": "圖像風格",
        "description": "生成圖像的藝術風格"
      }
    }
  },
  "toolCall": {
    "title": "工具呼叫",
    "count": "{count} 個呼叫",
    "arguments": "參數",
    "result": "結果",
    "error": "錯誤",
    "status": {
      "pending": "處理中",
      "success": "成功",
      "error": "失敗"
    }
  },
  "updater": {
    "title": "應用程式更新",
    "checkForUpdates": "檢查更新",
    "currentVersion": "目前版本",
    "versionLoadFailed": "版本取得失敗",
    "downloadFailed": "下載失敗",
    "dismiss": "關閉",
    "noStableVersionAvailable": "沒有可用的正式版本",
    "noPrereleaseVersionAvailable": "沒有可用的預覽版本",
    "failedToGetStableInfo": "無法取得正式版更新資訊",
    "failedToGetPrereleaseInfo": "無法取得預覽版更新資訊",
    "alreadyLatestStable": "目前已是最新正式版 ({version})",
    "alreadyLatestPrerelease": "目前已是最新預覽版 ({version})",
    "stableDownloadFailed": "正式版下載失敗: {error}",
    "prereleaseDownloadFailed": "預覽版下載失敗: {error}",
    "unknownError": "未知錯誤",
    "stable": "正式版",
    "prerelease": "預覽版",
    "downloadFailedGeneric": "{type}下載失敗: {error}",
    "warning": "警告",
    "info": "資訊",
    "versionIgnored": "版本 {version} 已被忽略",
    "checkFailed": "檢查失敗",
    "ignored": "已忽略",
    "unignore": "取消忽略",
    "latestVersion": "最新版本",
    "latestStableVersion": "最新正式版",
    "noPrereleaseAvailable": "暫無預覽版",
    "latestIsStable": "最新版本為正式版",
    "latestPrereleaseVersion": "最新預覽版",
    "viewStable": "檢視正式版",
    "viewPrerelease": "檢視預覽版",
    "allowPrerelease": "接收預覽版更新",
    "noUpdatesAvailable": "目前已是最新版本",
    "checkNow": "檢查更新",
    "checking": "正在檢查更新...",
    "checkingForUpdates": "正在檢查更新...",
    "newVersionAvailable": "發現新版本",
    "viewDetails": "檢視詳情",
    "downloadUpdate": "下載更新",
    "download": "下載",
    "updateAvailable": "有更新",
    "hasUpdate": "有更新",
    "details": "詳情",
    "ignore": "忽略",
    "ignoreVersion": "忽略此版本",
    "downloading": "正在下載更新...",
    "downloadingShort": "下載中...",
    "downloadComplete": "下載完成",
    "clickInstallToRestart": "點選下方按鈕安裝並重新啟動應用程式",
    "installAndRestart": "安裝並重新啟動",
    "updateError": "更新失敗",
    "downloadError": "下載失敗",
    "installError": "安裝失敗",
    "upToDate": "已是最新版本",
    "viewOnGitHub": "在 GitHub 上檢視",
    "devEnvironment": "開發環境：更新檢查已停用",
    "clickToCheck": "點選檢查更新",
    "manualUpdateTitle": "macOS 目前需要手動更新",
    "manualUpdateDescription": "目前的 macOS 發布套件未使用 Apple Developer ID 簽署，無法在應用程式內完成安裝。請前往版本發布頁下載適用於本機的 DMG，結束應用程式後將其拖入「應用程式」並選擇取代。若首次開啟遭到阻擋，請在「系統設定 → 隱私權與安全性」中允許開啟。",
    "updatePolicyUnavailableTitle": "目前只能手動更新",
    "updatePolicyUnavailableDescription": "無法確認目前的建置是否支援應用程式內安裝。為避免更新失敗，請前往版本發布頁手動下載安裝套件。",
    "openReleasePage": "開啟 GitHub Release",
    "openReleaseFailed": "無法開啟版本發布頁，請稍後再試。",
    "releasePageUnavailable": "目前未取得版本發布頁位址，請重新檢查更新後再試。",
    "noReleasesFound": "未找到發布版本。此專案可能尚未發布任何版本。",
    "noStableReleasesFound": "未找到穩定版本。可能只有預發布版本可用。"
  }
} as const;

export default messages;
