export default {
  browserBridge: {
    title: 'Codex 連線',
    connecting: '正在連線…',
    connected: '本頁面已授權並連線',
    disconnected: '本頁面未連線',
    context: '只共用目前頁面及此瀏覽器設定檔中的產品資料。關閉頁面或撤銷授權會中斷 Codex；不會讀取瀏覽器設定檔檔案。',
    label: '來源名稱（例如 Firefox — 工作）',
    readScope: '授權讀取已儲存模型的說明、收藏與已儲存比較；不會共用模型金鑰。',
    compareScope: '授權讀取與編輯收藏、使用已設定的文字模型最佳化提示詞和測試，以及儲存、檢視與刪除比較結果。模型金鑰留在本頁面。',
    charges: '最佳化和測試會向已設定的服務商傳送提示詞，可能產生費用；請求使用目前瀏覽器的網路設定。',
    authorize: '授權此頁面',
    revoke: '立即撤銷授權',
    instructions: '在 Codex 中讓 Prompt Optimizer MCP 使用 po_sources_authorize 為實際產品網址產生授權連結，再於目標瀏覽器設定檔開啟該一次性連結。',
    failure: '連線未能保持。請檢查瀏覽器的本機網路權限、頁面策略，以及本機 MCP 是否執行。授權失敗或過期後，請讓 Codex 產生新連結。',
  },
}
