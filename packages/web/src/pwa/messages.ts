const en = {
  install: 'Install app', installTitle: 'Keep your workspace on your home screen', later: 'Not now', close: 'Close',
  update: 'Update available', apply: 'Save and update', applying: 'Saving…',
  offline: 'Offline · Local editing is available',
  offlineUnavailable: 'Offline · Some pages need a connection to open',
  iosTitle: 'Add to Home Screen',
  iosBody: 'In Safari, open Share, choose Add to Home Screen, then tap Add. Open the app from its new home-screen icon.',
  busy: 'Finish the current operation, then update.',
  'save-failed': 'Your workspace could not be saved. Keep this page open and try again.',
  'other-tabs': 'Close the other windows of this app before updating. Their work has not been interrupted.',
  unavailable: 'No update is waiting. You can continue working.',
  failed: 'The update could not be applied. Your current page is unchanged; try again later.',
}
type PwaMessages = typeof en
const zhCN: PwaMessages = {
  install: '安装应用', installTitle: '从手机桌面打开工作区', later: '稍后', close: '关闭',
  update: '有新版本', apply: '保存并更新', applying: '正在保存…',
  offline: '离线 · 可继续编辑本地内容',
  offlineUnavailable: '已离线 · 部分页面需要联网打开',
  iosTitle: '添加到主屏幕',
  iosBody: '在 Safari 中打开分享菜单，选择“添加到主屏幕”，然后点“添加”。之后可从手机桌面的图标打开。',
  busy: '请完成当前操作后再更新。',
  'save-failed': '工作区未能保存，请保留当前页面后重试。',
  'other-tabs': '请先关闭此应用的其他窗口再更新，其他窗口的操作未被打断。',
  unavailable: '当前没有待更新版本，可以继续使用。',
  failed: '未能完成更新，当前页面已保留，请稍后重试。',
}
const zhTW: PwaMessages = {
  install: '安裝應用', installTitle: '從手機桌面開啟工作區', later: '稍後', close: '關閉',
  update: '有新版本', apply: '儲存並更新', applying: '正在儲存…',
  offline: '離線 · 可繼續編輯本機內容',
  offlineUnavailable: '已離線 · 部分頁面需要連線開啟',
  iosTitle: '加入主畫面',
  iosBody: '在 Safari 中開啟分享選單，選擇「加入主畫面」，然後點「新增」。之後可從手機桌面的圖示開啟。',
  busy: '請完成目前操作後再更新。',
  'save-failed': '工作區未能儲存，請保留目前頁面後重試。',
  'other-tabs': '請先關閉此應用的其他視窗再更新，其他視窗的操作未被打斷。',
  unavailable: '目前沒有待更新版本，可以繼續使用。',
  failed: '未能完成更新，目前頁面已保留，請稍後重試。',
}

export function pwaMessages(locale: string): PwaMessages {
  if (locale === 'zh-TW' || locale === 'zh-Hant') return zhTW
  return locale.startsWith('zh') ? zhCN : en
}
