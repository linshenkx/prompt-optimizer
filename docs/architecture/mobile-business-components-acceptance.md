# 移动端业务组件验收记录

日期：2026-10-22。对应 [业务组件设计与架构边界](mobile-business-components-design.md)。本记录列出开发侧已执行的闭环，不表示用户已验收，也不代表全部机型、工作区或异常路径均已覆盖。

## 环境与证据

- 实施工作树：`feature/mobile-workspace-adaptation`，呈现层整理基线 `bcf84153`。本轮改动提交号由最终提交记录确认。
- 原测试手机：PKX110 / Android 16，物理分辨率 1080×2344，DPR 3，浏览器实际 CSS 视口约 360×669；键盘展开后可见高度为 299 或 363。
- 新测试手机：Xiaomi 12X（2112123AG）/ Android 13，物理分辨率 1080×2400，density 440，DPR 2.75，浏览器实际 CSS 视口约 392×769；键盘展开后可见高度约为 417.8 或 481.8。已进入应用并执行下述补充流程。
- 补充检查：内置浏览器 393×852、430×932 和桌面 1440×900；分类弹层另在桌面 1280×720 检查。模拟视口结果与真机结果分别记录。
- 本地证据目录：`.codex-run/mobile-business-20261022/`。截图和执行日志为本地验收产物，不将图片、导出包、模型凭据提交到仓库；导出包未作为远程传输测试使用。

## 已执行的真机操作

| 功能 | 已执行与观察 | 主要证据 |
| --- | --- | --- |
| 文本模型 | 克隆 QA 模型、连接测试、编辑保存、重新打开；键盘展开时保存可达；未保存确认可取消并继续编辑。选入工作区后完成真实优化与 A/B 测试，两列正文末尾可读到 | `phone-text-keyboard.png`、`phone-text-provider-keyboard.png`、`phone-optimize-qa-model.png`、`phone-ab-results-final.png`、`phone-ab-end-final.png` |
| 图像模型 | 克隆 QA 配置，真实连接测试返回加载成功的 1254×1254 图像，保存后列表可见；未重复生成以替代页面检查 | `phone-image-test-success.png`、`phone-image-keyboard.png` |
| 历史 | 打开优化链、读取完整正文直到末尾、确认恢复目标为系统模式并恢复到工作区 | `phone-history-detail.png` |
| 功能提示词 | 复制、编辑并保存，键盘展开时保存可达；重新打开、应用后工作区选择同步 | `phone-template-keyboard.png` |
| 变量 | 新增多行值并保存、返回列表；CSV 导入成功并关闭导入页，列表出现新变量 | `phone-variable-list.png`；变量导入联动另有真实父子组件自动化测试 |
| 收藏 | 新增正文、键盘展开时保存、详情读取及应用到工作区；JSON 导入；分类长名称新增；标签新增与重命名 | `phone-favorite-editor.png`、`phone-favorite-detail-final.png`、`phone-favorite-import-keyboard.png`、`phone-categories.png` |
| 数据 | 进入四个任务；本地导出约 24.7 MB 备份包；读取存储占用；远程配置在任务切换后保留草稿 | `phone-data-home.png`；导出包保留在本地测试设备 |

A/B 正文末尾检查时，最后一行底部约为 617 CSS px，底部切换栏顶部约为 619 CSS px。该证据确认当次结果末尾可以读到，不推断所有长文本、键盘状态或工作区都具有相同边界。

真机发现的可搜索模型菜单键盘遮挡问题已补充 `visualViewport` 适配，并验证工作区模型选择可完成。图像编辑的供应商选择、真实生成、预览及保存链路已在新手机补充验证。

### 新手机补充流程

| 功能 | 已执行与观察 | 主要证据 |
| --- | --- | --- |
| 收藏 → 优化 → 对比测试 | 新建 QA 收藏、键盘展开时保存、查看详情并立即使用；经真实 Magpie Gemini 优化得到 V1，再完成真实 A/B 测试，两列说明末尾均可读，横向溢出为 0；完成分类管理并返回原工作区后 A/B 状态仍保留，两列末尾可见 | `newphone-favorite-keyboard.png`、`newphone-favorite-detail.png`、`newphone-optimize.png`、`newphone-ab-results.png`、`newphone-ab-delivery.png` |
| 图像模型 | 克隆既有预览配置，重选当前 OpenAI 后模型、凭据及同源网关保持；真实测试生成 1254×1254 图像，打开完整图片预览后关闭，保存 QA 配置并重新编辑复核模型及凭据 | `newphone-image-test-success.png`、`newphone-image-preview.png` |
| 标签 | 打开管理页不会自动弹出键盘，可见高度保持 769；新增输入时键盘可见高度约 481.8，确认后列表保存正常。刷新后空态显示既有中文“暂无内容” | `newphone-tag-created.png`、`newphone-tags-empty-localized.png` |
| 分类 | 弹层宿主修正后在真机占满约 392.7×769 可见区域；新增 QA 长名称分类时键盘可见高度约 481.8，底部保存可达并成功。列表触摸更多 → 编辑 → 取消 → 关闭分类 → 返回收藏 → 返回原工作区均完成 | `newphone-categories-final.png`、`newphone-category-keyboard.png` |
| 数据管理 | 四个任务入口及导出页重复标题修复已在真机复验 | `newphone-data-home.png` |

新机 A/B 结果末行底部：A 为 676.24 CSS px、B 为 583.86 CSS px，均在底部切换栏顶部 706.36 CSS px 以上。键盘测试中观察到 `visualViewport.offsetTop` 为 261.09；控件可见性检查先用元素坐标减去该偏移，再与可见视口高度比较，避免把布局视口坐标误当成屏幕坐标。

新机发现移动供应商菜单重复选择当前值会清空连接和模型。已增加仅 compact 生效的同值保护，并通过上述图像配置、真实测试、完整预览、保存和重开流程验证；原模型、凭据及同源网关配置保持。

## 补充视口与桌面检查

| 检查 | 结果与证据 |
| --- | --- |
| 393×852 模板列表 | 无横向溢出，见 `393-template-list.png` |
| 430×932 模板编辑 | 无横向溢出，见 `430-template-draft.png` |
| 编辑中从移动宽度切到 1440×900 | 模板名称及正文草稿保留，没有因呈现切换重建草稿 |
| 桌面模型、功能模型、历史、模板、变量 | 检查原有布局与正常入口；见 `desktop-models-final.png`、`desktop-function-after.png`、`desktop-history-final.png`、`desktop-variables-final.png`。这不是逐像素对照或桌面所有业务的完整回归 |
| 桌面数据管理 | 正常桌面视口检查通过，原有同页布局保留，见 `desktop-data-final.png` |
| 桌面分类弹层 | 1280×720 视口下，仍为 `n-card n-modal`，没有移动适配根类；弹层 800×576，位置 x=240、y=72，保持原 `min(600px, 80vh)` 高度、工具栏及 hover 编辑结构。见 `desktop-category-final.png`；仅记录此正常布局检查，不作为全部桌面页面的逐像素对比 |

## 自动化与构建

- 供应商修复后的完整业务组件定向测试：16 个文件、101 个测试通过，见 `confirmed-business-tests.log`。覆盖单份草稿、宽窄切换、未保存退出、失败保存、导入父子联动、任务切换、选择菜单视口计算及供应商同值保护等风险。上一轮 99 项记录 `business-tests-final.log` 和两个模型编辑组件 20 项定向记录 `provider-reselect-tests.log` 保留作为过程证据，三轮数量不相加。
- 同轮 UI lint 与 UI / Web / Extension 类型检查均以退出码 0 完成，见 `confirmed-lint-ui.log`、`confirmed-typecheck-ui.log`、`confirmed-typecheck-web.log`、`confirmed-typecheck-extension.log`。
- 同轮 `pnpm build:ui` → `pnpm build:parallel` 均以退出码 0 完成，覆盖 UI 以及 Web / Extension 构建，见 `confirmed-build-ui.log`、`confirmed-build-apps.log`。命令、起止时间及退出码统一记录于 `confirmed-status.json`。
- 收尾补充 `TagManager` 的 compact 空态描述并修正分类弹层宿主后，源码已冻结。相关 3 个文件的 8 项已有用例复验通过，两个收尾组件的 lint 退出码为 0，见 `confirmed-final-focused-tests.log`、`confirmed-final-lint.log`；这 8 项复验不与前述 101 项相加。空态翻译的早期单文件检查另保留于 `confirmed-lint-tag-final.log`，真机已刷新确认中文显示。
- 源码冻结后的 `pnpm build:ui` → `pnpm build:parallel` 已重新完成，退出码均为 0，覆盖上述两项收尾改动，见 `confirmed-final-build-ui.log`、`confirmed-final-build-apps.log`。最后一轮命令状态已追加至 `confirmed-status.json`。
- 上一轮检查日志保留：`lint-ui-final.log`、`typecheck-ui-final.log`、`typecheck-web.log`、`typecheck-extension.log`、`build-ui-final.log`、`build-apps-final.log`；最新验证状态以上述 `confirmed-*` 记录为准。
- locale 结构及禁止运行时中文检查通过，见 `check-locale.log`、`check-runtime.log`。
- 提交前差异检查由最终收尾流程复核；已列出的证据文件均已核对在本地证据目录中存在。

共享失败路径例外：图像配置存储失败时，现在返回明确的失败结果并保留编辑器；桌面也得到此修复。自动化以失败的存储边界验证，未在用户真实数据上人为制造存储损坏。

## 待验与边界

- 新手机已完成上述收藏、优化、A/B 对比、图像模型、分类、标签与数据页面检查；此处记录开发侧实际操作范围，不替代用户体验确认。
- 未在上表列出的补充页面和状态仍需继续检查，不将原手机的验收结果自动算作新手机结果。
- 未执行真实远程上传、覆盖恢复或清理用户数据；当前缺少对应测试服务配置，不把任务表单可操作等同于远程业务成功。
- 本轮围绕管理组件闭环验证。使用已有模型执行的优化、A/B 测试和图像连接测试，不等于七种工作区的全部流程已重新验收。
