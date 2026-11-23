export default {
  browserBridge: {
    title: '允許 MCP 連線到此網頁？',
    connection: 'MCP 連線',
    connected: 'MCP 已連線',
    lifetime: '關閉此分頁即會中斷連線。',
    label: '為這份資料命名（選填）',
    readScope: '允許讀取這份資料及已儲存的結果。查詢會隱藏模型金鑰。',
    businessScope: '允許管理這份資料、匯入匯出備份及呼叫已設定的模型。模型呼叫會將提示詞傳送給服務商，可能產生費用。匯出含憑證的備份會包含已儲存的金鑰。',
    compareScope: '允許編輯收藏、最佳化和測試提示詞，以及管理比較結果。模型呼叫會將提示詞傳送給服務商，可能產生費用。',
    authorize: '允許連線',
    revoke: '中斷連線',
    failure: '連線失敗。請確認本機 MCP 正在執行、瀏覽器允許此網頁存取區域網路，再向助理取得新的連結。',
  },
}
