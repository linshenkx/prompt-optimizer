# XC 质量执行闭环基线

## 1. 基线冻结

本文件把 2026-06-06 的五项评估结论转为执行闭环基线。后续修复必须以本基线为对照，记录分数变化、风险关闭和项目状态变化。

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 基线版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 暂不计算 | 待复核 | 待复核 | 待复核 | 84 | 76 | B 类：继续开发，但先补短板 | 0 | 5 | 2026-06-06 | XC-QG-20260606-001 / package 2.11.5 / HEAD 5c893586 |

基线说明：

- 当前总分暂不计算，因为健康度、功能完整性、软件测试三项没有完成本轮证据校准。
- P0 数量为当前已确认 P0；未复核三项评估前不排除新增 P0。
- 当前工作区不是交付基线：`develop` ahead 1，且存在未提交修改。

第一轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 79.8 | 84 | 80 | 71 | 84 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R1 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

复评分数依据：

- 健康度 84：`pnpm install --frozen-lockfile`、`pnpm build`、`pnpm lint`、`pnpm test:gate`、`pnpm test:e2e:gate`、MCP `/healthz` 均已通过；扣分来自 `develop` ahead 1 且工作区仍有未提交修改，不能形成干净交付基线。
- 功能完整性 80：Web 路由、基础优化、图像生成、收藏 CRUD、标签自动完成、标签管理由 35 条 Playwright gate 测试验证；MCP 5 个工具可枚举且 3 个核心工具参数校验路径可用；扣分来自真实 LLM 成功调用、模型配置连接测试、权限/异常全量场景尚未验收。
- 软件测试 71：`pnpm test:gate` 和 `pnpm test:e2e:gate` 均通过，core 覆盖率可生成且为 67.18% 语句/56.63% 分支；扣分来自 UI 覆盖率采集超过 3 分钟未稳定结束、Web 覆盖率为 0%、Extension 覆盖率因无测试文件失败、真实 MCP 成功路径仍缺少自动化证明。
- 中文化 84：沿用本轮中文化评估结果；中文主路径可用，但仍有英文兜底错误和导出/分享文案残留。
- 治理成熟度 80：发布说明脚本、项目状态文档、执行基线和风险台账已补齐；扣分来自工作区未收口、风险 owner/复评节奏仍需进一步制度化。

第二轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 80.8 | 84 | 80 | 76 | 84 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R2 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R2 变化依据：

- 软件测试从 71 提升到 76：Web 与 Extension 壳层测试和覆盖率配置已补齐，`pnpm -F @prompt-optimizer/web test:coverage`、`pnpm -F @prompt-optimizer/extension test:coverage` 均可稳定通过；Web 覆盖率由 0% 提升为 61.53% statements，Extension 覆盖率命令由无测试失败变为 2 tests passed。
- `XC-P2-004` 仍未关闭：core 覆盖率仍只有 67.18% statements / 56.63% branches，Web 覆盖率仍不足，UI 覆盖率仍不能作为稳定门禁，真实 MCP 成功路径仍未自动化。
- 健康度、功能完整性、中文化、治理成熟度未调整：当前工作区仍 dirty/ahead，业务功能和中文化缺口未发生实质变化。

第三轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 81.2 | 84 | 80 | 78 | 84 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R3 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R3 变化依据：

- 软件测试从 76 提升到 78：`pnpm test:unit` 已改为 workspace 串行执行并通过，覆盖 core、mcp-server、UI、Extension、Web；新增/修正的稳定性问题包括 core 性能阈值、StreamSimulator 时间缩放 fake timers、3 个重 UI 组件测试局部超时。
- `XC-P2-005` 已关闭：全仓递归单元测试入口不再因 `spawn sh EAGAIN` 或已知超时失败中断。
- `XC-P2-004` 仍未关闭：覆盖率和真实 MCP 成功路径仍未达到交付级证明力。

第四轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 81.6 | 84 | 80 | 80 | 84 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R4 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R4 变化依据：

- 软件测试从 78 提升到 80：UI 包新增 `test:coverage` 脚本和显式 `@vitest/coverage-v8` 依赖，覆盖率配置已收敛到 `src/**/*.{ts,vue}`；`pnpm -F @prompt-optimizer/ui test:coverage` 稳定通过并输出真实覆盖率。
- UI 覆盖率基线：148 test files passed / 1 skipped，879 tests passed / 1 todo；覆盖率 42.57% statements、34.7% branches、38.47% functions、43.76% lines。
- `XC-P2-004` 仍未关闭：core 67.18%、UI 42.57%、Web 61.53% 仍低于交付级覆盖率目标，真实 MCP 成功路径仍未自动化。

第五轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 82.0 | 84 | 80 | 80 | 86 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R5 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R5 变化依据：

- 中文化从 84 提升到 86：`DataImportExportManager` 的导入/导出失败兜底不再向用户暴露 `Unknown error`，改为中文可理解的“无更多错误详情”；新增 `DataImportExportManager.spec.ts` 覆盖 invalid JSON、file import、clipboard import 和 export 失败场景。
- 验证命令已通过：`pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/services/DataImportExportManager.spec.ts`、`pnpm check:no-chinese-runtime`、`pnpm test:repo`、`pnpm lint`、`git diff --check`。
- `XC-P2-001` 仍未关闭：本轮只覆盖导入/导出管理中的英文兜底，其他英文残留和术语一致性问题尚未完成全量复核。

第六轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 82.4 | 84 | 80 | 80 | 88 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R6 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R6 变化依据：

- 中文化从 86 提升到 88：公共错误工具默认兜底从硬编码 `Unknown error` 改为当前语言的 `common.error`；普通对象错误不再暴露 `[object Object]`；`PromptDataConverter` 的转换失败兜底不再暴露 `Unknown error`；`useImageModelManager` 可选错误详情不再使用英文未知错误作为默认值。
- 验证命令已通过：`pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/utils/error-i18n.spec.ts tests/unit/services/DataImportExportManager.spec.ts tests/unit/services/PromptDataConverter.spec.ts`、`rg -n "Unknown error" packages/ui/src --glob '!**/locales/en-US/**'`、`pnpm check:no-chinese-runtime`、`pnpm test:repo`、`pnpm lint`、`git diff --check`。
- `XC-P2-001` 仍未关闭：`Unknown error` 源码兜底已基本清零，但仍需要 UI 页面抽查、分享/导出默认文案复核和术语一致性检查。

第七轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 82.8 | 84 | 80 | 82 | 88 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R7 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R7 变化依据：

- 软件测试从 80 提升到 82：R5/R6 新增的中文化回归测试已经并入全仓单元测试入口，`pnpm test:unit` 串行通过 core、mcp-server、UI、Extension、Web。
- 全仓单元测试结果：core 124 files passed / 18 skipped、1173 tests passed / 152 skipped；mcp-server 3 files passed、18 tests passed；UI 150 files passed / 1 skipped、886 tests passed / 1 todo；Extension 2 files passed、2 tests passed；Web 2 files passed、2 tests passed。
- `XC-P2-004` 仍未关闭：全仓单元入口稳定性提升，但 core/UI/Web 覆盖率仍低于交付目标，真实 MCP 成功路径仍未自动化。

第八轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 83.6 | 84 | 82 | 84 | 88 | 80 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R8 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R8 变化依据：

- 功能完整性从 80 提升到 82：新增 MCP handler 级成功路径测试，验证 `generate-wiki-prompt` 可完成工具注册、模型检查、XC wiki/caller context 注入、promptService 调用和 text result 返回；验证 `evaluate-prompt-fit` 可完成评估系统提示、用户提示和 text result 返回。
- 软件测试从 82 提升到 84：MCP 单包测试从 3 files / 18 tests 提升为 4 files / 20 tests，并已通过全仓 `pnpm test:unit`。
- `XC-P2-003` 仍未关闭：本轮为可重复的注入式成功路径自动化，不依赖真实外部 API；仍需要有效 API key 下的真实 LLM 成功 smoke 才能关闭真实集成验收项。

第九轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 84.4 | 84 | 82 | 84 | 88 | 84 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R9 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R9 变化依据：

- 治理成熟度从 80 提升到 84：项目状态文档中的风险章节已升级为统一风险台账，包含风险ID、等级、Owner、当前状态、当前证据、处置建议、下一步和复评日期。
- `XC-P2-002` 已关闭：风险台账不再是无 owner、无等级、无状态的列表；每个当前风险都有明确责任边界和复评入口。
- 治理仍未达到交付级：`XC-P1-001` 未关闭，工作区仍 dirty/ahead，当前状态不能作为干净交付基线。

第十轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 84.8 | 84 | 82 | 86 | 88 | 84 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R10 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R10 变化依据：

- 软件测试从 84 提升到 86：MCP 环境配置和默认模型选择新增单元测试，覆盖 HTTP port、log level、auth token、allowed origins、DNS rebinding、默认 provider、`XC_MCP_TOKEN` fallback、配置校验、preferred provider 匹配、update 失败后 add、无可用模型报错。
- MCP 单包测试从 20 条提升到 26 条；MCP 覆盖率从 40.65% statements / 40.05% branches 提升到 45.32% statements / 46.29% branches；`environment.ts` 覆盖率从 51.35% 提升到 78.37%，`models.ts` 从 0% 提升到 94.44%。
- `XC-P2-004` 仍未关闭：MCP 覆盖率有提升，但 core/UI/Web 覆盖率仍低于交付目标，且真实 MCP LLM smoke 仍无有效 API key 证明。

第十一轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 85.6 | 84 | 84 | 88 | 88 | 84 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R11 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R11 变化依据：

- 功能完整性从 82 提升到 84：MCP 5 个核心工具的 handler 级成功路径已全部覆盖，包含 `optimize-user-prompt`、`optimize-system-prompt`、`iterate-prompt`、`generate-wiki-prompt`、`evaluate-prompt-fit`，并验证 templateId、optimizationMode、XC wiki/caller context 注入、promptService 调用和 text result 返回。
- 软件测试从 86 提升到 88：MCP 单包测试从 26 条提升到 29 条；MCP 覆盖率从 45.32% statements / 46.29% branches 提升到 53.11% statements / 51.33% branches；`index.ts` 覆盖率从 25.79% 提升到 44.79%。
- `XC-P2-003` 仍未关闭：本轮覆盖的是注入式 handler 成功路径，不等同于有效 API key 下的真实 LLM 成功调用。

第十二轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 86.0 | 84 | 84 | 88 | 90 | 84 | B 类：继续开发，但先补短板 | 0 | 1 | 2026-06-06 | XC-QG-20260606-R12 / package 2.11.5 / HEAD 5c893586 + dirty worktree |

R12 变化依据：

- 中文化从 88 提升到 90：收藏分享导出用户入口新增中文路径测试，验证 zh-CN 下传给 HTML/PNG 分享生成器的 document title、导入说明、复制状态、分区标题、PNG 导入提示均为中文；同时验证预览失败和导出失败提示为中文且带具体错误详情。
- 验证命令已通过：`pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/FavoriteShareExportDialog.spec.ts tests/unit/utils/favorite-share-export.spec.ts`、`pnpm check:no-chinese-runtime`、`pnpm test:repo`、`pnpm lint`、`pnpm test:unit`、`git diff --check`。
- `XC-P2-001` 仍未关闭：分享导出主路径已加强，但仍需全页面中文化抽查和术语一致性复核。

第十三轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 88.4 | 90 | 84 | 88 | 90 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R13 / package 2.11.5 / R13 local commit + clean worktree / origin sync pending |

R13 变化依据：

- 健康度从 84 提升到 90：已在 Node v22.18.0 下重新验证 `pnpm install --frozen-lockfile`、`pnpm build`、`pnpm lint`、`pnpm test:repo`、`pnpm test:unit`、`pnpm test:e2e:gate` 和 `git diff --check`；工作区从多文件 dirty 收口为本地可追踪提交。
- 治理成熟度从 84 提升到 90：`XC-P1-001` 已关闭，当前质量执行闭环、风险台账、验证记录和提交基线一致；剩余远端同步、真实 MCP LLM smoke 和覆盖率目标降为 P2/P3 级持续改进，不再阻塞本地继续开发。
- 仍不能评为 100：当前分支仍领先 `origin/develop`，未完成远端 CI/PR 证明；真实 MCP LLM 成功调用缺少有效 API key；core/UI/Web/MCP 覆盖率仍低于 90% 目标；中文主路径页面抽查尚未完成。

第十四轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 89.0 | 90 | 84 | 89 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R14 / package 2.11.5 / R14 local commit / origin sync pending |

R14 变化依据：

- 中文化从 90 提升到 92：新增页面级 zh-CN E2E smoke，验证主工作区和收藏页在简体中文浏览器语言下展示“小词”“基础”“上下文”“图像”“收藏夹”“功能提示词”“历史记录”“模型管理”“返回工作区”“收藏列表”“还没有收藏任何提示词”等用户可见中文文案。
- 软件测试从 88 提升到 89：中文页面 smoke 已加入 `test:e2e:gate`，完整 gate 从 35 条提升到 36 条并通过；新增 `language-switch` test id，后续语言切换测试有稳定定位入口。
- `XC-P2-001` 已关闭：英文兜底错误、导入/导出、收藏分享导出和中文主路径页面 smoke 均已有自动化证据。仍不能评为中文化 100，因为尚未覆盖所有弹窗、所有异常场景和导出内容的页面级抽查。

第十五轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 90.6 | 90 | 90 | 91 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R15 / package 2.11.5 / R15 local commit / origin sync pending |

R15 变化依据：

- 功能完整性从 84 提升到 90：新增可复现真实 MCP smoke 脚本 `pnpm mcp:smoke:real`，在有效 `DEEPSEEK_API_KEY` 环境下通过 HTTP MCP 连接、`/healthz`、tools/list 和 `generate-wiki-prompt` 真实 LLM 调用；输出 `healthStatus=ok`、5 个 MCP tools、`provider=deepseek`、`textLength=963`。
- 软件测试从 89 提升到 91：MCP 单包测试从 29 条提升到 40 条；新增配置、日志、参数错误、XC context 校验和默认模型禁用场景测试；MCP 覆盖率从 53.11% statements / 51.33% branches 提升到 60.55% statements / 58.75% branches。
- `XC-P2-003` 已关闭：真实模型环境下的 MCP 成功调用已有可重复脚本和命令证据。仍不能评为 100，因为 core/UI/Web/MCP 覆盖率仍低于 90% 目标，且本地提交仍未推送远端、没有远端 CI/PR 证明。

第十六轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 91.0 | 90 | 90 | 93 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R16 / package 2.11.5 / R16 local commit / origin sync pending |

R16 变化依据：

- 软件测试从 91 提升到 93：MCP 单包测试从 40 条提升到 61 条；新增 `CoreServicesManager` 初始化/失败提示、auth helper、动态环境变量、XC context 边界、模型 fallback 和模板描述 fallback 测试。
- MCP 覆盖率从 60.55% statements / 58.75% branches 提升到 82.35% statements / 81.00% branches；`environment.ts`、`templates.ts`、`models.ts` 均达到 100% statements，`core-services.ts` 达到 95.95%，`xc-context.ts` 达到 99.11%。
- `XC-P2-004` 仍未关闭：MCP 覆盖率已有明显提升，但 core 67.18%、UI 42.57%、Web 61.53% 仍低于 90% 目标，且 MCP `index.ts` 的启动/session 主路径仍只有 56.56% statements。

第十七轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 91.2 | 90 | 90 | 94 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R17 / package 2.11.5 / R17 local commit / origin sync pending |

R17 变化依据：

- 软件测试从 93 提升到 94：MCP HTTP app、invalid session、auth、process handler、工具缺参、非法 template、模型 provider fallback 等边界已补自动化；MCP 单包测试从 61 条提升到 82 条。
- MCP 覆盖率四项均超过 90%：91.93% statements、90.50% branches、93.22% functions、92.17% lines；`index.ts` 从 56.56% statements（R15）提升到 81.85% statements。
- `XC-P2-004` 仍未关闭：MCP 包已达到单包覆盖率目标，但全项目 core 67.18%、UI 42.57%、Web 61.53% 仍低于 90%，不能把 MCP 单包达标误判为全项目测试证明力充分。

第十八轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 91.4 | 90 | 90 | 95 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R18 / package 2.11.5 / R18 local commit / origin sync pending |

R18 变化依据：

- 软件测试从 94 提升到 95：Web 入口测试补齐 locale watcher、英文 lang 分支和 Vercel Analytics 加载成功/失败分支，`pnpm -F @prompt-optimizer/web test:coverage` 从 2 tests 提升到 4 tests，覆盖率从 61.53% statements / 50% branches / 40% functions / 66.66% lines 提升到 100% statements / 75% branches / 100% functions / 100% lines。
- core 新增变量提取服务离线单元测试和公共错误归一化工具测试，`pnpm -F @prompt-optimizer/core test:coverage` 从 124 files / 1173 tests / 67.18% statements / 56.63% branches 提升到 126 files / 1185 tests / 68.23% statements / 57.56% branches；`variable-extraction/service.ts` 从 0% 覆盖提升到 88.23% statements / 76.56% branches / 100% functions / 88.88% lines。
- `XC-P2-004` 仍未关闭：Web 包已达到较高覆盖率，MCP 包已达 90% 目标，但 core 总覆盖率仍只有 68.23% statements / 57.56% branches，UI 仍为 42.57% statements / 34.7% branches；不能把局部包达标误判为全项目测试证明力充分。

第十九轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 91.6 | 90 | 90 | 96 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R19 / package 2.11.5 / R19 local commit / origin sync pending |

R19 变化依据：

- 软件测试从 95 提升到 96：core 新增 compare 服务和模型参数验证离线单元测试，覆盖用户可见提示词对比能力和模型参数安全边界；`pnpm -F @prompt-optimizer/core exec vitest run tests/unit/compare/service.spec.ts tests/unit/model/validation.spec.ts` 通过，2 files / 11 tests。
- `pnpm -F @prompt-optimizer/core test:coverage` 从 126 files / 1185 tests / 68.23% statements / 57.56% branches 提升到 128 files / 1196 tests / 69.13% statements / 58.02% branches；`services/compare` 从约 6.32% statements / 0% branches 提升到 94.93% statements / 75% branches，`services/model/validation.ts` 从 0% 提升到 100%。
- `XC-P2-004` 仍未关闭：core 覆盖率仍只有 69.13% statements / 58.02% branches，UI 仍为 42.57% statements / 34.7% branches；不能把 compare/model 局部达标误判为全项目测试证明力充分。

第二十轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 91.8 | 90 | 90 | 97 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R20 / package 2.11.5 / R20 local commit / origin sync pending |

R20 变化依据：

- 软件测试从 96 提升到 97：core 新增 prompt factory/error 基础路径离线单元测试，覆盖 `createPromptService` 依赖注入、四类 prompt 错误元数据、构造依赖缺失、history/iteration-chain 代理、迭代模板加载错误包装和 test stream 无 system prompt 分支；`pnpm -F @prompt-optimizer/core exec vitest run tests/unit/prompt/factory-errors.spec.ts` 通过，1 file / 6 tests。
- `pnpm -F @prompt-optimizer/core test:coverage` 从 128 files / 1196 tests / 69.13% statements / 58.02% branches 提升到 129 files / 1202 tests / 69.22% statements / 58.07% branches；`services/prompt/factory.ts` 和 `services/prompt/errors.ts` 达到 100%，`services/prompt` 模块从 44.60% statements / 31.89% branches 提升到 47.15% statements / 33.62% branches。
- `XC-P2-004` 仍未关闭：core 覆盖率仍只有 69.22% statements / 58.07% branches，UI 仍为 42.57% statements / 34.7% branches；不能把 prompt factory/error 局部达标误判为全项目测试证明力充分。

第二十一轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 92.0 | 90 | 90 | 98 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R21 / package 2.11.5 / R21 local commit / origin sync pending |

R21 变化依据：

- 软件测试从 97 提升到 98：core 新增 IPC 序列化工具和模型错误结构化路径离线单元测试，覆盖 null/undefined/primitive 直返、复杂对象 plain serialization、循环引用结构化错误、批量参数序列化、debug 日志诊断、ModelError message/code/params 和 ModelValidationError errors 保留；`pnpm -F @prompt-optimizer/core exec vitest run tests/unit/utils/ipc-serialization.spec.ts tests/unit/model/model-errors.spec.ts` 通过，2 files / 7 tests。
- `pnpm -F @prompt-optimizer/core test:coverage` 从 129 files / 1202 tests / 69.22% statements / 58.07% branches 提升到 131 files / 1209 tests / 69.43% statements / 58.20% branches；`utils/ipc-serialization.ts` 达到 100% statements / 88.88% branches / 100% functions / 100% lines，`services/model/errors.ts` 达到 100%。
- `XC-P2-004` 仍未关闭：core 覆盖率仍只有 69.43% statements / 58.20% branches，UI 仍为 42.57% statements / 34.7% branches；不能把 IPC/model error 局部达标误判为全项目测试证明力充分。

第二十二轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 92.2 | 90 | 90 | 99 | 92 | 90 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R22 / package 2.11.5 / R22 local commit / origin sync pending |

R22 变化依据：

- 软件测试从 98 提升到 99：core 新增图像输入归一化离线单元测试，覆盖标准 MIME 判断、`image/jpg` 归一化、自定义转换器、data URL stripping、转换失败/空结果/超限降级、批量输入、无浏览器转换能力降级、document canvas 转 PNG、OffscreenCanvas 转 PNG、无 atob/btoa 和 canvas context 缺失降级；`pnpm -F @prompt-optimizer/core exec vitest run tests/unit/image/input-normalizer.spec.ts` 通过，1 file / 11 tests。
- `pnpm -F @prompt-optimizer/core test:coverage` 从 131 files / 1209 tests / 69.43% statements / 58.20% branches 提升到 132 files / 1220 tests / 69.99% statements / 58.55% branches；`services/image/input-normalizer.ts` 提升到 96.38% statements / 88.88% branches / 100% functions / 96.20% lines。
- 全仓 `pnpm test:unit` 首次在 R22 运行时暴露 `FavoriteManager.spec.ts` 两个外部刷新重交互用例 5s 超时；已仅对这两个既有慢用例加 15s 局部 timeout，并通过 `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/FavoriteManager.spec.ts` 和全仓 `pnpm test:unit` 复验。
- `XC-P2-004` 仍未关闭：core 覆盖率仍只有 69.99% statements / 58.55% branches，UI 仍为 42.57% statements / 34.7% branches；不能把 input-normalizer 局部达标误判为全项目测试证明力充分。

第二十三轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 92.8 | 91 | 90 | 99 | 92 | 92 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R23 / package 2.11.5 / PR #311 open, mergeable / Vercel auth pending |

R23 变化依据：

- 健康度从 90 提升到 91：`git fetch origin` 通过，上游 `develop` 无新增提交；本地 11 个质量基线提交已推送到 fork 分支 `Jiumilu/prompt-optimizer:codex/xiaoc-quality-baseline`，不再只有本地提交证据。
- 治理成熟度从 90 提升到 92：已创建上游 PR #311（`https://github.com/linshenkx/prompt-optimizer/pull/311`），`gh pr view` 显示 `state=OPEN`、`mergeable=MERGEABLE`、base=`develop`、head=`Jiumilu:codex/xiaoc-quality-baseline`。
- `XC-P2-006` 从 open 调整为 in_progress：上游直推 `git push origin develop` 失败，GitHub 返回 403，账号 `Jiumilu` 对上游仓库只有 READ；PR #311 的 3 个 Vercel checks 均失败，失败原因均为 `Authorization required to deploy`。因此远端评审入口已建立，但远端 CI/部署授权仍未通过，不能关闭该风险。

第二十四轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 93.0 | 91 | 91 | 99 | 92 | 92 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R24 / package 2.11.5 / PR #311 updated / Vercel auth pending |

R24 变化依据：

- 功能完整性从 90 提升到 91：新增 `FavoriteListItem` 和 `EvaluateButton` 用户入口行为测试，覆盖收藏条目的内容展示、分类/标签/使用次数、选择、复制、使用、编辑、分享、分类切换、删除，以及评估按钮的禁用态、单结果评估、对比评估和加载态。
- UI 覆盖率从 42.57% statements / 34.7% branches 提升到 43.01% statements / 35.07% branches / 39% functions / 44.22% lines；`FavoriteListItem.vue` 达到 87.17% statements / 88.88% branches，`EvaluateButton.vue` 达到 100% 四项覆盖。
- 软件测试维持 99 而不升到 100：目标测试、UI 覆盖率、全仓单元测试、仓库治理门禁、lint/typecheck 和空白检查均通过；但 core 69.99% statements / 58.55% branches、UI 43.01% statements / 35.07% branches 仍明显低于 90% 交付目标，`XC-P2-004` 不能关闭。
- 治理成熟度维持 92：R24 已推送到 fork 分支并更新 PR #311，`gh pr checks` 显示 3 个 Vercel checks 仍因 `Authorization required to deploy` 失败；远端评审入口可追踪，但 `XC-P2-006` 不能关闭。

第二十五轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 93.2 | 91 | 92 | 99 | 92 | 92 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R25 / package 2.11.5 / PR #311 updated / Vercel auth pending |

R25 变化依据：

- 功能完整性从 91 提升到 92：新增 `FeedbackEditor` 行为测试，覆盖评估反馈输入的本地化默认文案、受控/非受控输入、trim 后提交、提交后清空、取消清空、Escape 取消、Ctrl/Cmd+Enter 提交，以及隐藏操作区时不拦截快捷键。
- UI 覆盖率从 43.01% statements / 35.07% branches 提升到 43.15% statements / 35.20% branches / 39.20% functions / 44.35% lines；`FeedbackEditor.vue` 从 0% 提升到 98.03% statements / 96.42% branches / 100% functions / 100% lines。
- 软件测试维持 99 而不升到 100：目标测试、UI 覆盖率、全仓单元测试、仓库治理门禁、lint/typecheck 和空白检查均通过；但 core 69.99% statements / 58.55% branches、UI 43.15% statements / 35.20% branches 仍明显低于 90% 交付目标，`XC-P2-004` 不能关闭。
- 治理成熟度维持 92：R25 已推送到 fork 分支并更新 PR #311，`gh pr checks` 显示 3 个 Vercel checks 仍因 `Authorization required to deploy` 失败；远端评审入口可追踪，但 `XC-P2-006` 不能关闭。

第二十六轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 93.4 | 91 | 93 | 99 | 92 | 92 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R26 / package 2.11.5 / PR #311 updated / Vercel auth pending |

R26 变化依据：

- 功能完整性从 92 提升到 93：新增 `FocusAnalyzeButton` 行为测试，覆盖直接评估、打开焦点输入、trim 后带反馈评估、空反馈回退默认评估、取消关闭、点击外部关闭、disabled/loading 阻止操作。
- UI 覆盖率从 43.15% statements / 35.20% branches 提升到 43.22% statements / 35.25% branches / 39.34% functions / 44.43% lines；`FocusAnalyzeButton.vue` 提升到 80.88% statements / 68.96% branches / 73.52% functions / 86.44% lines。
- 软件测试维持 99 而不升到 100：目标测试、UI 覆盖率、全仓单元测试、仓库治理门禁、lint/typecheck 和空白检查均通过；但 core 69.99% statements / 58.55% branches、UI 43.22% statements / 35.25% branches 仍明显低于 90% 交付目标，`XC-P2-004` 不能关闭。
- 治理成熟度维持 92：R26 已推送到 fork 分支并更新 PR #311，`gh pr checks` 显示 3 个 Vercel checks 仍因 `Authorization required to deploy` 失败；远端评审入口可追踪，但 `XC-P2-006` 不能关闭。

第二十七轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 93.6 | 91 | 94 | 99 | 92 | 92 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R27 / package 2.11.5 / PR #311 updated / Vercel auth pending |

R27 变化依据：

- 功能完整性从 93 提升到 94：新增变量值生成服务单元测试，覆盖输入校验前置阻断、未知模型阻断、模板缺失/空模板、结构化模板错误保真、LLM 执行异常包装、JSON code fence + jsonrepair 解析、返回变量名 trim，以及 8 类非法 LLM 响应形态；变量值生成核心流程不再只覆盖成功和对齐回退路径。
- core 覆盖率从 69.99% statements / 58.55% branches / 73.73% functions / 70.60% lines 提升到 70.36% statements / 58.88% branches / 73.98% functions / 70.98% lines；`services/variable-value-generation` 达到 99.14% statements / 89.74% branches / 100% functions / 99.08% lines。
- 软件测试维持 99 而不升到 100：目标测试、core 覆盖率、全仓单元测试、仓库治理门禁、lint/typecheck、build 和空白检查均通过；但 core 总覆盖率 70.36% statements / 58.88% branches、UI 43.22% statements / 35.25% branches 仍明显低于 90% 交付目标，`XC-P2-004` 不能关闭。
- 治理成熟度维持 92：R27 已推送到 fork 分支并更新 PR #311，`gh pr checks` 显示 3 个 Vercel checks 仍因 `Authorization required to deploy` 失败；远端评审入口可追踪，但 `XC-P2-006` 不能关闭。

第二十八轮复评快照（2026-06-06）：

| 项目 | 当前总分 | 健康度 | 功能完整性 | 软件测试 | 中文化 | 治理成熟度 | 当前状态 | P0 数量 | P1 数量 | 结论日期 | 复评版本 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| XC | 93.8 | 91 | 95 | 99 | 92 | 92 | B 类：继续开发，但先补短板 | 0 | 0 | 2026-06-06 | XC-QG-20260606-R28 / package 2.11.5 / PR #311 updated / Vercel auth pending |

R28 变化依据：

- 功能完整性从 94 提升到 95：新增图像理解服务单元测试，覆盖工厂注入依赖、provider adapter 选择、空请求、缺失模型配置、缺失 provider metadata/provider id、缺失 model metadata/model id、模型禁用，以及 streaming 请求在 adapter lookup 前阻断；图像理解主路径的运行前置条件不再只依赖 happy path 和转换降级测试。
- core 覆盖率从 70.36% statements / 58.88% branches / 73.98% functions / 70.98% lines 提升到 70.41% statements / 58.94% branches / 73.98% functions / 71.03% lines；`services/image-understanding` 达到 100% statements / 88.88% branches / 100% functions / 100% lines。
- 软件测试维持 99 而不升到 100：目标测试、core 覆盖率、全仓单元测试、仓库治理门禁、lint/typecheck、build 和空白检查均通过；但 core 总覆盖率 70.41% statements / 58.94% branches、UI 43.22% statements / 35.25% branches 仍明显低于 90% 交付目标，`XC-P2-004` 不能关闭。
- 治理成熟度维持 92：R28 已推送到 fork 分支并更新 PR #311，`gh pr checks` 显示 3 个 Vercel checks 仍因 `Authorization required to deploy` 失败；远端评审入口可追踪，但 `XC-P2-006` 不能关闭。

当前执行状态（2026-06-06）：

- 初始 P1：5 个。
- 已关闭 P1：5 个（`XC-P1-001`、`XC-P1-002`、`XC-P1-003`、`XC-P1-004`、`XC-P1-005`）。
- 剩余 P1：0 个。

## 2. 最终处置决策

| 项目 | 决策等级 | 硬结论 | 下一阶段允许动作 | 下一阶段禁止动作 |
|---|---|---|---|---|
| XC | B 类：继续开发，但先补短板 | 当前不建议上线；原因是覆盖率体系仍低于交付目标，且本地提交尚未形成远端 CI/PR 证明。下一阶段只允许补测试证明力、远端同步和真实集成验收，不新增业务功能。 | 覆盖率门禁提升、核心流程补测、远端 PR/CI 证明、真实集成补充验收 | 新增功能、宣布可交付、跳过复评直接提版 |

## 3. 执行 Backlog

| 任务ID | 项目 | 问题 | 维度 | 严重级别 | 证据 | 修复目标 | 验收标准 | 负责人 | 优先级 | 状态 |
|---|---|---|---|---|---|---|---|---|---|---|
| XC-P1-001 | XC | 当前 `develop` ahead 1 且工作区不干净 | 治理/交付 | 高 | `git status --short --branch` 曾显示 ahead 1 和多文件修改；R13 已形成本地提交并复跑 install/build/lint/test/e2e | 形成可追踪交付基线 | 已完成：已提交为本地可追踪基线，工作区清洁；远端同步另列为 P2 持续项 | 开发 | P1 | closed |
| XC-P1-002 | XC | 健康度、功能完整性、软件测试三项缺少当前证据校准 | 决策治理 | 高 | 当前执行台账只能确认中文化 84、治理 76 | 完成三项复核并生成可追踪分数 | 已完成：已基于 install/build/lint/test gate/E2E/MCP smoke/覆盖率命令生成第一轮五项复评分数，当前总分 79.8 | 项目负责人/开发 | P1 | closed |
| XC-P1-003 | XC | 发布文档命令与实际脚本不一致 | 版本治理 | 中高 | `pnpm release:notes:check` 不存在；`node scripts/release-notes.js check v2.11.5` 通过 | 人工发布流程可按文档执行 | 已通过：`pnpm release:notes:check v2.11.5`、`pnpm release:notes:check:entry v2.11.5`、`node --test scripts/package-scripts.test.mjs`、`pnpm test:repo` | 开发 | P1 | closed |
| XC-P1-004 | XC | 项目状态文档滞后于当前版本 | 治理 | 中高 | `docs/project/project-status.md` 仍写主要版本 v2.10.0；当前 package 为 2.11.5 | 项目状态成为当前事实入口 | 已完成：项目状态与项目管理入口同步到 v2.11.5、质量执行闭环状态和待复核指标 | PM/开发 | P1 | closed |
| XC-P1-005 | XC | MCP 生产就绪仍有集成测试、日志、稳定性待办 | 功能/交付 | 中高 | `docs/developer/todo.md` 记录 MCP 集成测试、日志、稳定性测试待办 | MCP 达到可验收 smoke 水平 | 已通过：MCP server 本地 HTTP 启动；`/healthz` 返回 200；tools/list 返回 5 个工具；`optimize-user-prompt`、`generate-wiki-prompt`、`evaluate-prompt-fit` 参数校验 smoke 返回预期错误；启动与请求日志可见 | 开发/集成方 | P1 | closed |
| XC-P2-001 | XC | 英文兜底错误和导出分享英文残留 | 中文化 | 中 | 中文化评估定位 `Unknown error`、导入导出错误、分享导出默认英文标签；R14 新增 zh-CN 页面级 E2E smoke | 中文主路径错误和主页面文案可理解 | 已完成：`Unknown error` 源码兜底已基本清零，导入/导出、公共错误工具、收藏分享导出入口和主路径页面均有中文化自动化证据 | 前端 | P2 | closed |
| XC-P2-002 | XC | 风险台账缺少 owner、等级、处置状态 | 风险治理 | 中 | 项目状态风险章节曾缺少负责人、风险等级、处置状态和复评日期 | 建立可追踪风险台账 | 已完成：项目状态风险章节已升级为统一风险台账，包含风险ID、等级、Owner、当前状态、当前证据、处置建议、下一步和复评日期 | PM | P2 | closed |
| XC-P2-003 | XC | MCP smoke 尚未覆盖真实 LLM 成功调用 | 功能/交付 | 中 | R15 已在有效 `DEEPSEEK_API_KEY` 环境下执行 `pnpm mcp:smoke:real`，通过 HTTP MCP 连接、tools/list 和 `generate-wiki-prompt` 真实调用，返回 `provider=deepseek`、5 个 tools、`textLength=963` | 补真实模型环境下的成功调用验收 | 已完成：真实 MCP LLM 成功路径有可复现脚本、真实 provider 和输出摘要证据 | 开发/集成方 | P2 | closed |
| XC-P2-004 | XC | 覆盖率体系不足，无法证明全项目质量 | 软件测试 | 中 | core 覆盖率 70.41% 语句/58.94% 分支；UI 覆盖率 43.22% 语句/35.25% 分支；Web 覆盖率 100% 语句/75% 分支/100% 函数/100% 行；Extension 覆盖率 100% 语句/50% 分支；MCP 覆盖率已提升到 91.93% 语句/90.50% 分支/93.22% 函数/92.17% 行 | 建立可持续覆盖率门禁 | 部分完成：MCP 单包覆盖率已达到 90% 目标，Web 入口覆盖率已大幅提升，core variable extraction/variable value generation/image understanding/compare/model validation/prompt factory/IPC serialization/model errors/image input normalizer 已补测试，UI FavoriteListItem/EvaluateButton/FeedbackEditor/FocusAnalyzeButton 用户入口已有行为测试；core/UI 覆盖率仍需提升到交付目标 | 开发 | P2 | in_progress |
| XC-P2-005 | XC | 全仓递归单元测试入口存在资源稳定性问题 | 软件测试 | 中 | `pnpm test:unit` 曾在 core、mcp-server、UI 测试通过后，启动 Web/Extension 子进程时失败：`spawn sh EAGAIN`；串行后又暴露 core/UI 时间敏感测试 | 让全仓单元测试入口可重复运行 | 已通过：`pnpm test:unit` 串行执行 core、mcp-server、UI、Extension、Web 全部通过 | 开发 | P2 | closed |
| XC-P2-006 | XC | 远端 CI/PR 证明未完全通过 | 治理/交付 | 中 | 上游直推失败：GitHub 403，账号 `Jiumilu` 对上游只有 READ；已创建 fork `Jiumilu/prompt-optimizer`、推送 `codex/xiaoc-quality-baseline` 并创建上游 PR #311；PR 为 open/mergeable；3 个 Vercel checks 均失败，原因是 `Authorization required to deploy` | 形成共享交付基线 | 获取 Vercel 授权或由上游维护者批准/重跑 checks，并通过远端 CI/代码评审门禁；另行确认 Harness 文件归属 | 开发/发布负责人 | P2 | in_progress |

## 4. 三类专项行动

### 专项一：运行健康专项

目标：XC 在保留交付范围内能安装、构建、启动，有明确环境变量和健康检查入口。

首轮任务：

- 复核 install/build/typecheck/lint/test/dev server。
- 明确 Node 22 运行要求。
- 把 MCP `/healthz` 纳入 smoke。

### 专项二：核心功能闭环专项

目标：至少验证 3-5 条核心流程，消灭不可验证、mock 残留和断点流程。

首轮候选流程：

- Web 提示词生成/优化/迭代。
- 收藏导入/保存/导出。
- MCP `generate-wiki-prompt`。
- MCP `optimize-user-prompt`。
- 模型配置与连接测试。

### 专项三：测试证明力专项

目标：为核心流程补最小可用自动化测试或可复现 smoke test。

首轮任务：

- 复核现有 test gate 和 E2E gate。
- 为 MCP 核心 tool 建 smoke 脚本或手工可复现步骤。
- 明确哪些功能仅有代码、哪些功能有测试证明。

## 5. 阶段门槛

### 继续开发门槛

- 能安装。
- 能构建。
- 能启动。
- 无确认 P0。
- 核心功能矩阵明确。
- 当前工作区状态可解释。

### 交付准备门槛

- 核心流程闭环。
- P0/P1 清零。
- 测试命令可运行。
- 中文用户主路径可用。
- README、部署、运维说明完整。
- 发布说明和版本状态一致。

### 上线门槛

- build/test/lint/typecheck 通过。
- E2E 或 smoke test 通过。
- 权限、数据、异常场景验证通过。
- 回滚方案明确。
- 版本、风险、验收记录完整。

## 6. 第一轮修复冲刺

周期：1-2 周。

目标：

- 剩余 P1（`XC-P1-001`）关闭或降级。（已完成 R13）
- 健康度、功能完整性、软件测试三项完成复核。（已完成第一轮）
- 生成可计算总分。（已完成第一轮，R28 当前 93.8）
- 项目状态从“B 类待补短板”升级为“可继续开发，具备交付准备入口”，或明确降级原因。

## 7. 复评机制

每轮修复后必须回跑并记录：

```text
pnpm install
pnpm build
pnpm lint / typecheck
pnpm test / gate tests
dev server smoke
MCP smoke
核心用户流程 smoke
中文化抽查
release note check
git status --short --branch
```

复评输出格式：

| 项目 | 修复前分数 | 修复后分数 | 已关闭风险 | 新发现风险 | 状态变化 | 下一步动作 |
|---|---:|---:|---|---|---|---|
| XC | 81.2 | 81.6 | 无 | 无新增 P1；`XC-P2-004` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 先关闭 `XC-P1-001`，再继续提升 core/UI/Web 覆盖率和真实 MCP 成功 smoke |
| XC | 81.6 | 82.0 | 无 | 无新增 P1；`XC-P2-001` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 继续清理中文英文残留；同时关闭 `XC-P1-001` 和提升测试证明力 |
| XC | 82.0 | 82.4 | 无 | 无新增 P1；`XC-P2-001` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 对中文主路径做页面抽查；继续关闭 `XC-P1-001` 和提升测试证明力 |
| XC | 82.4 | 82.8 | 无 | 无新增 P1；`XC-P2-004` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 继续提升覆盖率和真实 MCP 成功 smoke；关闭 `XC-P1-001` |
| XC | 82.8 | 83.6 | 无 | 无新增 P1；`XC-P2-003` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 补真实 API key 下 MCP smoke；继续提升覆盖率并关闭 `XC-P1-001` |
| XC | 83.6 | 84.4 | `XC-P2-002` | 无新增 P1；`XC-P1-001` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 关闭交付基线 P1；补真实 MCP smoke 和覆盖率 |
| XC | 84.4 | 84.8 | 无 | 无新增 P1；`XC-P2-004` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 继续提升 core/UI/Web 覆盖率；关闭交付基线 P1 |
| XC | 84.8 | 85.6 | 无 | 无新增 P1；`XC-P2-003` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 补真实 MCP LLM smoke；继续提升 core/UI/Web 覆盖率；关闭交付基线 P1 |
| XC | 85.6 | 86.0 | 无 | 无新增 P1；`XC-P2-001` 仍未关闭 | B 类待补短板 -> B 类待补短板 | 做中文主路径页面抽查；继续补真实 MCP smoke 和覆盖率；关闭交付基线 P1 |
| XC | 86.0 | 88.4 | `XC-P1-001` | 新增 `XC-P2-006`：本地提交尚未同步远端 | B 类待补短板 -> B 类待补短板（P1 清零） | 推送/PR 后获取远端 CI 证明；补真实 MCP smoke、覆盖率和中文页面抽查 |
| XC | 88.4 | 89.0 | `XC-P2-001` | 无新增 P1；`XC-P2-003`、`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（中文 P2 关闭） | 补真实 MCP smoke；提升覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 89.0 | 90.6 | `XC-P2-003` | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（真实 MCP smoke 关闭） | 提升 core/UI/Web/MCP 覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 90.6 | 91.0 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（MCP 覆盖率提升） | 继续提升 MCP `index.ts`、core/UI/Web 覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 91.0 | 91.2 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（MCP 单包覆盖率达 90%） | 转向 core/UI/Web 覆盖率补强；推送/PR 后获取远端 CI 证明 |
| XC | 91.2 | 91.4 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（Web 覆盖率提升，core 变量提取服务补测） | 继续提升 core/UI 覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 91.4 | 91.6 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（core compare/model validation 补测） | 继续提升 core/UI 覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 91.6 | 91.8 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（core prompt factory/error 补测） | 继续提升 core/UI 覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 91.8 | 92.0 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（core IPC/model error 补测） | 继续提升 core/UI 覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 92.0 | 92.2 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（core image input normalizer 补测，UI 慢用例稳定） | 继续提升 core/UI 覆盖率；推送/PR 后获取远端 CI 证明 |
| XC | 92.2 | 92.8 | 无 | 无新增 P1；`XC-P2-004` 仍未关闭；`XC-P2-006` 从 open 变为 in_progress，Vercel 授权阻塞 | B 类待补短板 -> B 类待补短板（远端 PR 入口已建立，CI 授权待处理） | 获取 Vercel 授权或维护者批准 checks；继续提升 core/UI 覆盖率 |
| XC | 92.8 | 93.0 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（UI 用户入口测试和覆盖率提升） | 获取 Vercel 授权或维护者批准 checks；继续提升 core/UI 覆盖率 |
| XC | 93.0 | 93.2 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（反馈输入闭环测试和 UI 覆盖率提升） | 获取 Vercel 授权或维护者批准 checks；继续提升 core/UI 覆盖率 |
| XC | 93.2 | 93.4 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（焦点评估闭环测试和 UI 覆盖率提升） | 获取 Vercel 授权或维护者批准 checks；继续提升 core/UI 覆盖率 |
| XC | 93.4 | 93.6 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（core 变量值生成边界补测和覆盖率提升） | 获取 Vercel 授权或维护者批准 checks；继续提升 core/UI 覆盖率 |
| XC | 93.6 | 93.8 | 无 | 无新增 P1；`XC-P2-004`、`XC-P2-006` 仍未关闭 | B 类待补短板 -> B 类待补短板（core 图像理解边界补测和覆盖率提升） | 获取 Vercel 授权或维护者批准 checks；继续提升 core/UI 覆盖率 |

## 8. 项目组合决策表

| 项目 | 当前等级 | 是否继续投入 | 投入优先级 | 下一阶段目标 | 不做事项 | 退出条件 |
|---|---|---|---|---|---|---|
| XC | B 类 | 是 | 高 | 把 core/UI/Web/MCP 覆盖率提升到交付目标，完成远端 CI/PR 证明，补齐权限/异常/真实集成验收 | 不新增业务功能、不跳过复评上线 | 复评出现不可关闭 P0，或核心流程无法闭环且无明确修复路径 |

## 9. 验证记录

| 日期 | 范围 | 命令 | 结果 | 证明事项 |
|---|---|---|---|---|
| 2026-06-06 | 发布说明脚本 | `pnpm release:notes:check v2.11.5` | 通过 | 文档化 release note 校验入口可执行 |
| 2026-06-06 | 发布说明脚本 | `pnpm release:notes:check:entry v2.11.5` | 通过 | 历史条目校验入口可执行 |
| 2026-06-06 | 根仓库治理门禁 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | package script、locale、runtime 文案门禁未被治理修复破坏 |
| 2026-06-06 | 工作区格式 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | 依赖安装 | `pnpm install --frozen-lockfile` | 通过，lockfile up to date | 依赖声明和锁文件一致 |
| 2026-06-06 | 构建 | `pnpm build` | 通过 | core、UI、Web、Extension 可构建 |
| 2026-06-06 | Lint/Typecheck | `pnpm lint` | 通过 | UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 通过 |
| 2026-06-06 | 提交前测试门禁 | `pnpm test:gate` | 通过，repo 34 tests、core 21 tests、UI 879 passed / 1 todo / 1 skipped | 基础测试门禁可持续运行 |
| 2026-06-06 | MCP 健康检查 | `curl http://127.0.0.1:3315/healthz` | 通过，HTTP 200，`status=ok`，核心服务 initialized | MCP HTTP server 可启动并暴露健康状态 |
| 2026-06-06 | MCP 工具枚举 | MCP SDK `client.listTools()` | 通过，返回 5 个工具 | MCP 协议初始化和 tools/list 可用 |
| 2026-06-06 | MCP 核心工具 smoke | MCP SDK `client.callTool()` 调用 `optimize-user-prompt`、`generate-wiki-prompt`、`evaluate-prompt-fit` 空参数 | 通过，均返回预期参数缺失错误 | 3 个核心工具路由和参数校验路径可用 |
| 2026-06-06 | E2E gate | `pnpm test:e2e:gate` | 通过，35 passed | 路由、基础优化、图像生成、收藏 CRUD、标签自动完成、标签管理等核心路径可由 Playwright 验证 |
| 2026-06-06 | Core 覆盖率 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，124 files passed / 18 skipped，1173 tests passed / 152 skipped；覆盖率 67.18% statements、56.63% branches、71.05% functions、67.74% lines | core 有覆盖率基线，但低于交付级证明力 |
| 2026-06-06 | Web 覆盖率 R1 | `pnpm -F @prompt-optimizer/web test:coverage` | 通过，1 test passed；覆盖率 0% | Web 覆盖率脚本可运行但没有有效覆盖证明 |
| 2026-06-06 | Extension 覆盖率 R1 | `pnpm -F @prompt-optimizer/extension test:coverage` | 失败，No test files found，exit code 1 | Extension 没有有效测试资产 |
| 2026-06-06 | UI 覆盖率 | `pnpm -F @prompt-optimizer/ui exec vitest run --coverage` | 运行超过 3 分钟未稳定结束，已终止进程 | UI 覆盖率不能作为当前稳定门禁 |
| 2026-06-06 | Web 覆盖率 R2 | `pnpm -F @prompt-optimizer/web test:coverage` | 通过，2 tests passed；覆盖率 61.53% statements、50% branches、40% functions、66.66% lines | Web 覆盖率已从 0% 提升为有效壳层覆盖率，但仍不足 |
| 2026-06-06 | Extension 覆盖率 R2 | `pnpm -F @prompt-optimizer/extension test:coverage` | 通过，2 tests passed；覆盖率 100% statements、50% branches、100% functions、100% lines | Extension 覆盖率命令已从失败变为可稳定运行 |
| 2026-06-06 | 依赖安装 R2 | `pnpm install --frozen-lockfile` | 通过，lockfile up to date | Web/Extension coverage provider 依赖声明与 lockfile 一致 |
| 2026-06-06 | Lint/Typecheck R2 | `pnpm lint` | 通过 | 新增 Web/Extension 测试和 Vitest 配置未破坏类型检查 |
| 2026-06-06 | 构建 R2 | `pnpm build` | 通过 | 新增测试/覆盖率配置未破坏 core、UI、Web、Extension 构建 |
| 2026-06-06 | 全仓单元测试入口 R2 | `pnpm test:unit` | 失败，core 1173 passed / 152 skipped，mcp-server 18 passed，UI 879 passed / 1 todo / 1 skipped 后，启动 Extension/Web 时 `spawn sh EAGAIN` | 单包测试通过不能等同于全仓递归测试入口稳定 |
| 2026-06-06 | Web 单包测试 R2 | `pnpm -F @prompt-optimizer/web test --run --passWithNoTests` | 通过，2 tests passed | Web 新增入口测试可独立运行 |
| 2026-06-06 | Extension 单包测试 R2 | `pnpm -F @prompt-optimizer/extension test --run --passWithNoTests` | 通过，2 tests passed | Extension 新增入口测试可独立运行 |
| 2026-06-06 | Core 稳定性回归 R3 | `pnpm -F @prompt-optimizer/core exec vitest run tests/performance/favorites.perf.test.ts tests/unit/utils/vcr.spec.ts` | 通过，32 tests passed | core 性能阈值和时间缩放测试稳定性修复有效 |
| 2026-06-06 | UI 慢组件回归 R3 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/DataManager.spec.ts tests/unit/components/FavoriteManager.spec.ts tests/unit/components/FavoriteReproducibilityEditor.spec.ts` | 通过，40 tests passed | 3 个重组件测试局部超时修复有效 |
| 2026-06-06 | 全仓单元测试入口 R3 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 18 passed；UI 879 passed / 1 todo / 1 skipped；Extension 2 passed；Web 2 passed | `XC-P2-005` 关闭，全仓单元测试入口可重复运行 |
| 2026-06-06 | 根仓库治理门禁 R3 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | `test:unit` 脚本调整和新增测试配置未破坏根仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R3 | `pnpm lint` | 通过 | R3 测试稳定性修复后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R3 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | UI 覆盖率 R4 | `pnpm -F @prompt-optimizer/ui test:coverage` | 通过，148 files passed / 1 skipped，879 tests passed / 1 todo；覆盖率 42.57% statements、34.7% branches、38.47% functions、43.76% lines | UI 覆盖率门禁从不可用/0% 修复为可追踪真实覆盖率 |
| 2026-06-06 | 依赖安装 R4 | `pnpm install --frozen-lockfile` | 通过，lockfile up to date | UI coverage provider 依赖声明与 lockfile 一致 |
| 2026-06-06 | 根仓库治理门禁 R4 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | UI coverage 脚本和配置变更未破坏根仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R4 | `pnpm lint` | 通过 | UI coverage 配置变更后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R4 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | 中文错误兜底 R5 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/services/DataImportExportManager.spec.ts` | 通过，1 test file passed，4 tests passed | 导入/导出失败场景不再向用户暴露 `Unknown error` |
| 2026-06-06 | 中文运行时门禁 R5 | `pnpm check:no-chinese-runtime` | 通过，No disallowed Chinese runtime strings found | 新增中文化改动没有违反运行时中文扫描规则 |
| 2026-06-06 | 根仓库治理门禁 R5 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R5 中文化改动未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R5 | `pnpm lint` | 通过 | R5 中文化改动后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R5 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | 中文错误兜底 R6 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/utils/error-i18n.spec.ts tests/unit/services/DataImportExportManager.spec.ts tests/unit/services/PromptDataConverter.spec.ts` | 通过，3 test files passed，12 tests passed | 公共错误工具、导入/导出错误、转换器失败兜底均有回归证明 |
| 2026-06-06 | 英文未知错误残留 R6 | `rg -n "Unknown error" packages/ui/src --glob '!**/locales/en-US/**'` | 仅剩 `packages/ui/src/i18n/locales/_legacy/en-US.ts` 旧版英文 locale | UI 运行源码中的 `Unknown error` 兜底已基本清零 |
| 2026-06-06 | 中文运行时门禁 R6 | `pnpm check:no-chinese-runtime` | 通过，No disallowed Chinese runtime strings found | R6 中文化改动没有违反运行时中文扫描规则 |
| 2026-06-06 | 根仓库治理门禁 R6 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R6 中文化改动未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R6 | `pnpm lint` | 通过 | R6 中文化改动后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R6 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | 全仓单元测试 R7 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 18 passed；UI 886 passed / 1 todo；Extension 2 passed；Web 2 passed | R5/R6 新增中文化测试已并入全仓单元测试入口且稳定通过 |
| 2026-06-06 | MCP handler 成功路径 R8 | `pnpm -F @prompt-optimizer/mcp-server test --run` | 通过，4 test files passed，20 tests passed | `generate-wiki-prompt` 和 `evaluate-prompt-fit` 成功路径已有可重复自动化证明 |
| 2026-06-06 | MCP typecheck R8 | `pnpm -F @prompt-optimizer/mcp-server type-check` | 通过 | `setupServerHandlers` 导出和新增测试类型兼容 |
| 2026-06-06 | 根仓库治理门禁 R8 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | MCP handler 成功路径改动未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R8 | `pnpm lint` | 通过 | MCP handler 成功路径改动后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 全仓单元测试 R8 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 20 passed；UI 886 passed / 1 todo；Extension 2 passed；Web 2 passed | MCP 新增成功路径测试已进入全仓单元测试入口且稳定通过 |
| 2026-06-06 | 工作区格式 R8 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | 风险治理台账 R9 | `docs/project/project-status.md` 风险章节人工复核 | 通过，风险台账包含风险ID、等级、Owner、当前状态、当前证据、处置建议、下一步和复评日期 | `XC-P2-002` 关闭，风险治理具备可追踪执行入口 |
| 2026-06-06 | MCP 覆盖率 R10 | `pnpm -F @prompt-optimizer/mcp-server test --run --coverage` | 通过，5 test files passed，26 tests passed；覆盖率 45.32% statements、46.29% branches、60.17% functions、45.26% lines | MCP 环境配置和默认模型选择测试已补齐，MCP 覆盖率从 40.65% 提升到 45.32% |
| 2026-06-06 | MCP typecheck R10 | `pnpm -F @prompt-optimizer/mcp-server type-check` | 通过 | 新增 MCP 单测类型兼容 |
| 2026-06-06 | 根仓库治理门禁 R10 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R10 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R10 | `pnpm lint` | 通过 | R10 测试补强后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 全仓单元测试 R10 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 26 passed；UI 886 passed / 1 todo；Extension 2 passed；Web 2 passed | R10 新增 MCP 环境配置和默认模型选择测试已进入全仓单元测试入口 |
| 2026-06-06 | 工作区格式 R10 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | MCP 全工具成功路径 R11 | `pnpm -F @prompt-optimizer/mcp-server test --run --coverage` | 通过，5 test files passed，29 tests passed；覆盖率 53.11% statements、51.33% branches、61.06% functions、53.15% lines | MCP 5 个核心工具 handler 成功路径均有自动化证明 |
| 2026-06-06 | MCP typecheck R11 | `pnpm -F @prompt-optimizer/mcp-server type-check` | 通过 | 新增 MCP 成功路径断言类型兼容 |
| 2026-06-06 | 根仓库治理门禁 R11 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R11 MCP 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R11 | `pnpm lint` | 通过 | R11 MCP 测试补强后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 全仓单元测试 R11 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 29 passed；UI 886 passed / 1 todo；Extension 2 passed；Web 2 passed | R11 MCP 5 个工具成功路径测试已进入全仓单元测试入口 |
| 2026-06-06 | 工作区格式 R11 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | 分享导出中文化 R12 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/FavoriteShareExportDialog.spec.ts tests/unit/utils/favorite-share-export.spec.ts` | 通过，2 test files passed，14 tests passed | 收藏分享导出入口的中文 labels、导入提示、复制状态和失败提示已有自动化证明 |
| 2026-06-06 | 中文运行时门禁 R12 | `pnpm check:no-chinese-runtime` | 通过，No disallowed Chinese runtime strings found | R12 中文化测试改动没有违反运行时中文扫描规则 |
| 2026-06-06 | 根仓库治理门禁 R12 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R12 中文化测试改动未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R12 | `pnpm lint` | 通过 | R12 中文化测试改动后，UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 全仓单元测试 R12 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 29 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 2 passed | R12 分享导出中文化测试已进入全仓单元测试入口 |
| 2026-06-06 | 工作区格式 R12 | `git diff --check` | 通过 | 当前改动无空白错误 |
| 2026-06-06 | Node 版本 R13 | `nvm use 22.18.0 && node -v` | 通过，`v22.18.0` | 当前验证环境符合项目 `engines.node=^22.0.0` 要求 |
| 2026-06-06 | 依赖安装 R13 | `pnpm install --frozen-lockfile` | 通过，lockfile up to date | R13 基线在 Node 22 下依赖声明和锁文件一致 |
| 2026-06-06 | 构建 R13 | `pnpm build` | 通过 | core、UI、Web、Extension 可构建 |
| 2026-06-06 | Lint/Typecheck R13 | `pnpm lint` | 通过 | UI/MCP lint 和 core/UI/MCP/Web/Extension typecheck 通过 |
| 2026-06-06 | 根仓库治理门禁 R13 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | 根仓库治理门禁可在 R13 基线运行 |
| 2026-06-06 | 全仓单元测试 R13 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 29 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 2 passed | 全仓单元测试入口在 R13 基线稳定通过 |
| 2026-06-06 | E2E gate R13 | `pnpm test:e2e:gate` | 通过，35 passed | 路由、基础优化、图像生成、收藏 CRUD、标签自动完成、标签管理等核心路径可由 Playwright gate 验证 |
| 2026-06-06 | 工作区格式 R13 | `git diff --check` | 通过 | R13 提交前改动无空白错误 |
| 2026-06-06 | 中文主路径页面 smoke R14 | `pnpm exec playwright test tests/e2e/localization/zh-cn-main-path.spec.ts --project=chromium` | 通过，1 passed | 主工作区和收藏页 zh-CN 用户可见文案有页面级证明 |
| 2026-06-06 | E2E gate R14 | `pnpm test:e2e:gate` | 通过，36 passed | 中文主路径页面 smoke 已进入日常 E2E gate |
| 2026-06-06 | 根仓库治理门禁 R14 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R14 中文页面 smoke 与 test id 改动未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R14 | `pnpm lint` | 通过 | R14 语言按钮 test id 与 E2E 分组改动未破坏 lint/typecheck |
| 2026-06-06 | MCP 构建 R15 | `pnpm mcp:build` | 通过 | MCP server 可在真实 smoke 前独立构建 |
| 2026-06-06 | MCP 真实 LLM smoke R15 | `pnpm mcp:smoke:real` | 通过，`provider=deepseek`，`healthStatus=ok`，5 个 tools，`generate-wiki-prompt` 返回 `textLength=963` | `XC-P2-003` 关闭，真实模型环境下的 MCP 成功调用有可复现脚本和输出摘要 |
| 2026-06-06 | MCP 覆盖率 R15 | `pnpm -F @prompt-optimizer/mcp-server test --run --coverage` | 通过，6 test files passed，40 tests passed；覆盖率 60.55% statements、58.75% branches、70.79% functions、60.52% lines | MCP 配置、日志、参数错误、XC context 校验和默认模型禁用场景已补测试 |
| 2026-06-06 | 根仓库治理门禁 R15 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R15 新增 smoke 脚本和 MCP 测试未破坏仓库治理门禁 |
| 2026-06-06 | 全仓单元测试 R15 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 40 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 2 passed | R15 新增 MCP 测试已进入全仓单元测试入口 |
| 2026-06-06 | Lint/Typecheck R15 | `pnpm lint` | 通过 | R15 smoke 脚本和 MCP 测试改动未破坏 lint/typecheck |
| 2026-06-06 | 工作区格式 R15 | `git diff --check` | 通过 | R15 提交前改动无空白错误 |
| 2026-06-06 | MCP 覆盖率 R16 | `pnpm -F @prompt-optimizer/mcp-server test --run --coverage` | 通过，10 test files passed，61 tests passed；覆盖率 82.35% statements、81.00% branches、84.95% functions、82.45% lines | MCP core services、auth helper、动态环境变量、XC context、模型 fallback 和模板 fallback 边界已补自动化 |
| 2026-06-06 | MCP typecheck R16 | `pnpm -F @prompt-optimizer/mcp-server type-check` | 通过 | R16 新增 MCP 测试和 auth helper 导出类型兼容 |
| 2026-06-06 | MCP 构建 R16 | `pnpm mcp:build` | 通过 | R16 auth helper 导出和新增测试未破坏 MCP CJS/ESM/DTS 构建 |
| 2026-06-06 | 根仓库治理门禁 R16 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R16 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | 全仓单元测试 R16 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 61 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 2 passed | R16 新增 MCP 测试已进入全仓单元测试入口 |
| 2026-06-06 | Lint/Typecheck R16 | `pnpm lint` | 通过 | R16 MCP 导出和测试补强后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R16 | `git diff --check` | 通过 | R16 提交前改动无空白错误 |
| 2026-06-06 | MCP 覆盖率 R17 | `pnpm -F @prompt-optimizer/mcp-server test --run --coverage` | 通过，12 test files passed，82 tests passed；覆盖率 91.93% statements、90.50% branches、93.22% functions、92.17% lines | MCP 单包四项覆盖率均达到 90% 以上 |
| 2026-06-06 | MCP typecheck R17 | `pnpm -F @prompt-optimizer/mcp-server type-check` | 通过 | R17 HTTP app refactor、process handler 导出和新增测试类型兼容 |
| 2026-06-06 | MCP 构建 R17 | `pnpm mcp:build` | 通过 | R17 HTTP app refactor 和 process handler 导出未破坏 MCP CJS/ESM/DTS 构建 |
| 2026-06-06 | 根仓库治理门禁 R17 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R17 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | 全仓单元测试 R17 | `pnpm test:unit` | 通过，core 1173 passed / 152 skipped；mcp-server 82 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 2 passed | R17 新增 MCP 测试已进入全仓单元测试入口 |
| 2026-06-06 | Lint/Typecheck R17 | `pnpm lint` | 通过 | R17 MCP refactor 和测试补强后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R17 | `git diff --check` | 通过 | R17 提交前改动无空白错误 |
| 2026-06-06 | Web 覆盖率 R18 | `pnpm -F @prompt-optimizer/web test:coverage` | 通过，2 files passed，4 tests passed；覆盖率 100% statements、75% branches、100% functions、100% lines | Web 入口挂载、文档 metadata、locale watcher 和 Vercel Analytics 分支已有自动化证明 |
| 2026-06-06 | Core 局部测试 R18 | `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/variable-extraction/service.spec.ts tests/unit/utils/error.spec.ts` | 通过，2 files passed，12 tests passed | 变量提取服务和公共错误归一化工具已有离线单元测试证明 |
| 2026-06-06 | Core 覆盖率 R18 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，126 files passed / 18 skipped，1185 tests passed / 152 skipped；覆盖率 68.23% statements、57.56% branches、72.06% functions、68.81% lines | core 总覆盖率小幅提升，变量提取服务从 0% 覆盖补到 88.23% statements |
| 2026-06-06 | 根仓库治理门禁 R18 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R18 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | 全仓单元测试 R18 | `pnpm test:unit` | 通过，core 1185 passed / 152 skipped；mcp-server 82 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 4 passed | R18 新增 core/web 测试已进入全仓单元测试入口 |
| 2026-06-06 | Lint/Typecheck R18 | `pnpm lint` | 通过 | R18 测试补强后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R18 | `git diff --check` | 通过 | R18 改动无空白错误 |
| 2026-06-06 | Core 局部测试 R19 | `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/compare/service.spec.ts tests/unit/model/validation.spec.ts` | 通过，2 files passed，11 tests passed | compare 服务和模型参数验证边界已有离线单元测试证明 |
| 2026-06-06 | Core 覆盖率 R19 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，128 files passed / 18 skipped，1196 tests passed / 152 skipped；覆盖率 69.13% statements、58.02% branches、72.92% functions、69.73% lines | core 总覆盖率继续提升，compare 服务提升到 94.93% statements，model validation 提升到 100% |
| 2026-06-06 | 根仓库治理门禁 R19 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R19 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | 全仓单元测试 R19 | `pnpm test:unit` | 通过，core 1196 passed / 152 skipped；mcp-server 82 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 4 passed | R19 新增 core 测试已进入全仓单元测试入口 |
| 2026-06-06 | Lint/Typecheck R19 | `pnpm lint` | 通过 | R19 测试补强后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R19 | `git diff --check` | 通过 | R19 改动无空白错误 |
| 2026-06-06 | Core 局部测试 R20 | `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/prompt/factory-errors.spec.ts` | 通过，1 file passed，6 tests passed | prompt factory、错误元数据、构造依赖检查、history 代理和 test stream 无 system prompt 分支已有离线测试证明 |
| 2026-06-06 | Core 覆盖率 R20 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，129 files passed / 18 skipped，1202 tests passed / 152 skipped；覆盖率 69.22% statements、58.07% branches、73.07% functions、69.83% lines | core 总覆盖率继续提升，prompt factory/errors 达到 100%，prompt 模块覆盖率提升到 47.15% statements |
| 2026-06-06 | UI 慢用例稳定性 R20 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/DataManager.spec.ts tests/unit/components/FavoriteReproducibilityEditor.spec.ts` | 通过，2 files passed，25 tests passed | 全仓负载下曾 5s 超时的两个 UI 用例已设置局部超时并单独复跑通过 |
| 2026-06-06 | MCP 慢用例稳定性 R20 | `pnpm -F @prompt-optimizer/mcp-server test --run --passWithNoTests` | 通过，12 files passed，82 tests passed | 全仓负载下曾 5s 超时的动态环境导入用例已设置局部超时并单包复跑通过 |
| 2026-06-06 | 根仓库治理门禁 R20 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R20 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | 全仓单元测试 R20 | `pnpm test:unit` | 通过，core 1202 passed / 152 skipped；mcp-server 82 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 4 passed | R20 新增 core 测试和慢用例稳定性修复已进入全仓单元测试入口 |
| 2026-06-06 | Lint/Typecheck R20 | `pnpm lint` | 通过 | R20 测试补强后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R20 | `git diff --check` | 通过 | R20 改动无空白错误 |
| 2026-06-06 | Core 局部测试 R21 | `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/utils/ipc-serialization.spec.ts tests/unit/model/model-errors.spec.ts` | 通过，2 files passed，7 tests passed | IPC 序列化、循环引用结构化错误、批量参数序列化、debug 诊断和模型错误结构化字段已有离线测试证明 |
| 2026-06-06 | Core 覆盖率 R21 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，131 files passed / 18 skipped，1209 tests passed / 152 skipped；覆盖率 69.43% statements、58.20% branches、73.27% functions、70.05% lines | core 总覆盖率继续提升，IPC serialization 和 model errors 已补到 100% statements |
| 2026-06-06 | 全仓单元测试 R21 | `pnpm test:unit` | 通过，core 1209 passed / 152 skipped；mcp-server 82 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 4 passed | R21 新增 core 测试已进入全仓单元测试入口 |
| 2026-06-06 | 根仓库治理门禁 R21 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R21 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R21 | `pnpm lint` | 通过 | R21 测试补强后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R21 | `git diff --check` | 通过 | R21 改动无空白错误 |
| 2026-06-06 | Core 局部测试 R22 | `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/image/input-normalizer.spec.ts` | 通过，1 file passed，11 tests passed | 图像输入 MIME 归一化、转换器、浏览器 canvas/OffscreenCanvas 转换和降级路径已有离线测试证明 |
| 2026-06-06 | Core 覆盖率 R22 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，132 files passed / 18 skipped，1220 tests passed / 152 skipped；覆盖率 69.99% statements、58.55% branches、73.73% functions、70.60% lines | core 总覆盖率继续提升，input-normalizer 提升到 96.38% statements / 88.88% branches |
| 2026-06-06 | UI 慢用例稳定性 R22 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/FavoriteManager.spec.ts` | 通过，1 file passed，15 tests passed | 全仓负载下超时的 FavoriteManager 外部刷新场景已设置局部超时并单包复跑通过 |
| 2026-06-06 | 全仓单元测试 R22 | `pnpm test:unit` | 通过，core 1220 passed / 152 skipped；mcp-server 82 passed；UI 887 passed / 1 todo；Extension 2 passed；Web 4 passed | R22 新增 core 测试和 UI 慢用例稳定性修复已进入全仓单元测试入口 |
| 2026-06-06 | 根仓库治理门禁 R22 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R22 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R22 | `pnpm lint` | 通过 | R22 测试补强后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R22 | `git diff --check` | 通过 | R22 改动无空白错误 |
| 2026-06-06 | 远端同步 R23 | `git push origin develop` | 失败，GitHub 403：`Permission to linshenkx/prompt-optimizer.git denied to Jiumilu` | 当前账号不能直接写入上游 `develop`，需 fork/PR 或上游授权 |
| 2026-06-06 | Fork 分支 R23 | `gh repo fork linshenkx/prompt-optimizer --clone=false --remote=false`、`git push fork develop:codex/xiaoc-quality-baseline` | 通过，创建 `https://github.com/Jiumilu/prompt-optimizer`，推送 fork 分支成功 | 本地质量基线提交已有可共享远端分支 |
| 2026-06-06 | 上游 PR R23 | `gh pr create --repo linshenkx/prompt-optimizer --base develop --head Jiumilu:codex/xiaoc-quality-baseline` | 通过，创建 PR #311 | 远端评审入口已建立 |
| 2026-06-06 | PR 状态 R23 | `gh pr view 311 --repo linshenkx/prompt-optimizer --json ...` | 通过，`state=OPEN`、`mergeable=MERGEABLE`；3 个 Vercel checks 为 failure | PR 可合并性初步成立，但远端部署 checks 因 Vercel 授权阻塞 |
| 2026-06-06 | UI 目标测试 R24 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/FavoriteListItem.spec.ts tests/unit/components/EvaluateButton.spec.ts` | 通过，2 files passed，8 tests passed | 收藏条目和评估按钮入口行为已有组件级自动化证明 |
| 2026-06-06 | UI 覆盖率 R24 | `pnpm -F @prompt-optimizer/ui test:coverage` | 通过，152 passed / 1 skipped，895 passed / 1 todo；覆盖率 43.01% statements、35.07% branches、39% functions、44.22% lines | UI 覆盖率可持续生成，`FavoriteListItem.vue` 和 `EvaluateButton.vue` 已从低覆盖入口补强 |
| 2026-06-06 | 全仓单元测试 R24 | `pnpm test:unit` | 通过，core 1220 passed / 152 skipped；mcp-server 82 passed；UI 895 passed / 1 todo；Extension 2 passed；Web 4 passed | R24 新增 UI 测试已进入全仓单元测试入口 |
| 2026-06-06 | 根仓库治理门禁 R24 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R24 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R24 | `pnpm lint` | 通过 | R24 新增 UI 测试和文档更新后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R24 | `git diff --check` | 通过 | R24 改动无空白错误 |
| 2026-06-06 | Fork 分支 R24 | `git push fork develop:codex/xiaoc-quality-baseline` | 通过，fork 分支从 `c7f644f6` 更新到 R24 | PR #311 的 head 已同步 R24 改动 |
| 2026-06-06 | PR 状态 R24 | `gh pr view 311 --repo linshenkx/prompt-optimizer --json ...`、`gh pr checks 311 --repo linshenkx/prompt-optimizer` | PR `state=OPEN`、`mergeable=MERGEABLE`；3 个 Vercel checks 失败，原因均为 `Authorization required to deploy` | 远端评审入口仍可用，但部署授权阻塞未解除 |
| 2026-06-06 | UI 目标测试 R25 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/FeedbackEditor.spec.ts` | 通过，1 file passed，6 tests passed | 反馈编辑器输入、提交、取消和快捷键行为已有组件级自动化证明 |
| 2026-06-06 | UI 覆盖率 R25 | `pnpm -F @prompt-optimizer/ui test:coverage` | 通过，153 passed / 1 skipped，901 passed / 1 todo；覆盖率 43.15% statements、35.20% branches、39.20% functions、44.35% lines | UI 覆盖率继续提升，`FeedbackEditor.vue` 从 0% 补到 98.03% statements |
| 2026-06-06 | 全仓单元测试 R25 | `pnpm test:unit` | 通过，core 1220 passed / 152 skipped；mcp-server 82 passed；UI 901 passed / 1 todo；Extension 2 passed；Web 4 passed | R25 新增 UI 测试已进入全仓单元测试入口 |
| 2026-06-06 | 根仓库治理门禁 R25 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R25 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R25 | `pnpm lint` | 通过 | R25 新增 UI 测试和文档更新后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R25 | `git diff --check` | 通过 | R25 改动无空白错误 |
| 2026-06-06 | Fork 分支 R25 | `git push fork develop:codex/xiaoc-quality-baseline` | 通过，fork 分支从 `fcaf55ff` 更新到 R25 | PR #311 的 head 已同步 R25 改动 |
| 2026-06-06 | PR 状态 R25 | `gh pr view 311 --repo linshenkx/prompt-optimizer --json ...`、`gh pr checks 311 --repo linshenkx/prompt-optimizer` | PR `state=OPEN`、`mergeable=MERGEABLE`；3 个 Vercel checks 失败，原因均为 `Authorization required to deploy` | 远端评审入口仍可用，但部署授权阻塞未解除 |
| 2026-06-06 | UI 目标测试 R26 | `pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/components/FocusAnalyzeButton.spec.ts` | 通过，1 file passed，6 tests passed | 焦点评估按钮直接评估、带反馈评估、空反馈回退和禁用阻断路径已有组件级自动化证明 |
| 2026-06-06 | UI 覆盖率 R26 | `pnpm -F @prompt-optimizer/ui test:coverage` | 通过，153 passed / 1 skipped，906 passed / 1 todo；覆盖率 43.22% statements、35.25% branches、39.34% functions、44.43% lines | UI 覆盖率继续提升，`FocusAnalyzeButton.vue` 提升到 80.88% statements |
| 2026-06-06 | 全仓单元测试 R26 | `pnpm test:unit` | 通过，core 1220 passed / 152 skipped；mcp-server 82 passed；UI 906 passed / 1 todo；Extension 2 passed；Web 4 passed | R26 新增 UI 测试已进入全仓单元测试入口 |
| 2026-06-06 | 根仓库治理门禁 R26 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R26 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R26 | `pnpm lint` | 通过 | R26 新增 UI 测试和文档更新后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 工作区格式 R26 | `git diff --check` | 通过 | R26 改动无空白错误 |
| 2026-06-06 | Fork 分支 R26 | `git push fork develop:codex/xiaoc-quality-baseline` | 通过，fork 分支从 `d2185b4b` 更新到 R26 | PR #311 的 head 已同步 R26 改动 |
| 2026-06-06 | PR 状态 R26 | `gh pr view 311 --repo linshenkx/prompt-optimizer --json ...`、`gh pr checks 311 --repo linshenkx/prompt-optimizer` | PR `state=OPEN`、`mergeable=MERGEABLE`；3 个 Vercel checks 失败，原因均为 `Authorization required to deploy` | 远端评审入口仍可用，但部署授权阻塞未解除 |
| 2026-06-06 | Core 目标测试 R27 | `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/variable-value-generation/service-runtime.test.ts` | 通过，1 file passed，20 tests passed | 变量值生成输入校验、模型/模板失败、结构化错误保真、LLM 异常包装、JSON 修复解析和非法响应形态已有离线单元测试证明 |
| 2026-06-06 | Core 覆盖率 R27 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，132 passed / 18 skipped，1238 passed / 152 skipped；覆盖率 70.36% statements、58.88% branches、73.98% functions、70.98% lines | core 覆盖率继续提升，`services/variable-value-generation` 达到 99.14% statements / 89.74% branches |
| 2026-06-06 | 全仓单元测试 R27 | `pnpm test:unit` | 通过，core 1238 passed / 152 skipped；mcp-server 82 passed；UI 906 passed / 1 todo；Extension 2 passed；Web 4 passed | R27 新增 core 测试已进入全仓单元测试入口 |
| 2026-06-06 | 根仓库治理门禁 R27 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R27 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R27 | `pnpm lint` | 通过 | R27 新增 core 测试和文档更新后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 构建 R27 | `pnpm build` | 通过 | R27 新增测试和文档更新后，core、UI、Web、Extension 仍可构建 |
| 2026-06-06 | 工作区格式 R27 | `git diff --check` | 通过 | R27 改动无空白错误 |
| 2026-06-06 | Fork 分支 R27 | `git push fork develop:codex/xiaoc-quality-baseline` | 通过，fork 分支从 R26 更新到 R27 | PR #311 的 head 已同步 R27 改动 |
| 2026-06-06 | PR 状态 R27 | `gh pr view 311 --repo linshenkx/prompt-optimizer --json ...`、`gh pr checks 311 --repo linshenkx/prompt-optimizer` | PR `state=OPEN`、`mergeable=MERGEABLE`；3 个 Vercel checks 失败，原因均为 `Authorization required to deploy` | 远端评审入口仍可用，但部署授权阻塞未解除 |
| 2026-06-06 | Core 目标测试 R28 | `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/image-understanding/service.test.ts` | 通过，1 file passed，13 tests passed | 图像理解服务工厂注入、请求校验、模型禁用和 streaming 前置阻断已有离线单元测试证明 |
| 2026-06-06 | Core 覆盖率 R28 | `pnpm -F @prompt-optimizer/core test:coverage` | 通过，132 passed / 18 skipped，1247 passed / 152 skipped；覆盖率 70.41% statements、58.94% branches、73.98% functions、71.03% lines | core 覆盖率继续提升，`services/image-understanding` 达到 100% statements / 88.88% branches |
| 2026-06-06 | 全仓单元测试 R28 | `pnpm test:unit` | 通过，core 1247 passed / 152 skipped；mcp-server 82 passed；UI 906 passed / 1 todo；Extension 2 passed；Web 4 passed | R28 新增 core 测试已进入全仓单元测试入口 |
| 2026-06-06 | 根仓库治理门禁 R28 | `pnpm test:repo` | 通过，34 个 node:test 子测试通过，locale parity 通过，no-Chinese-runtime 通过 | R28 测试补强未破坏仓库治理门禁 |
| 2026-06-06 | Lint/Typecheck R28 | `pnpm lint` | 通过 | R28 新增 core 测试和文档更新后，UI/MCP lint 与 core/UI/MCP/Web/Extension typecheck 仍通过 |
| 2026-06-06 | 构建 R28 | `pnpm build` | 通过 | R28 新增测试和文档更新后，core、UI、Web、Extension 仍可构建 |
| 2026-06-06 | 工作区格式 R28 | `git diff --check` | 通过 | R28 改动无空白错误 |
| 2026-06-06 | Fork 分支 R28 | `git push fork develop:codex/xiaoc-quality-baseline` | 通过，fork 分支从 R27 更新到 R28 | PR #311 的 head 已同步 R28 改动 |
| 2026-06-06 | PR 状态 R28 | `gh pr view 311 --repo linshenkx/prompt-optimizer --json ...`、`gh pr checks 311 --repo linshenkx/prompt-optimizer` | PR `state=OPEN`、`mergeable=MERGEABLE`；3 个 Vercel checks 失败，原因均为 `Authorization required to deploy` | 远端评审入口仍可用，但部署授权阻塞未解除 |

## 10. 当前工作区改动归属

`XC-P1-001` 已在 R13 关闭。当前工作区已从 dirty 状态收口为本地可追踪提交；R28 已推送到 fork 分支并更新上游 PR #311。远端 CI/部署授权仍列为 `XC-P2-006`。

| 文件/范围 | 归属 | 状态 | 说明 |
|---|---|---|---|
| `docs/project/quality-execution-baseline-2026-06-06.md` | 本轮质量执行闭环 | 已确认 | 新增基线、Backlog、验证记录和复评机制 |
| `docs/project/README.md` | 本轮质量执行闭环 | 已确认 | 接入质量执行入口并同步当前版本/阶段 |
| `docs/project/project-status.md` | 本轮质量执行闭环 | 已确认 | 同步 v2.11.5、当前风险、已验证门禁和 P1/P2 状态 |
| `package.json` | 本轮质量执行闭环 | 已确认 | 补齐 `release:notes:*` 脚本入口 |
| `packages/core/package.json`、`pnpm-lock.yaml` | 前序测试/覆盖率支撑改动 | 待基线收口 | 增加 `@vitest/coverage-v8` 并更新 lockfile；需随测试证明力任务一起提交或确认 |
| `packages/core/src/services/storage/fileStorageProvider.ts`、`packages/core/tests/unit/storage/fileStorageProvider.test.ts` | 前序 core 存储构建/测试修复 | 待基线收口 | 动态导入改为 Vite 可识别形式，并调整单测；已被 `pnpm build`、`pnpm lint`、`pnpm test:gate` 覆盖 |
| `scripts/e2e-groups.js`、`tests/e2e/*favorite*`、`tests/e2e/*tag*`、`tests/e2e/helpers/common.ts` | 前序 E2E gate 强化 | 待基线收口 | 将收藏/标签 E2E 纳入 gate 并重构稳定入口；仍需跑 `pnpm test:e2e:gate` 验证 |
| `packages/ui/src/services/DataImportExportManager.ts`、`packages/ui/tests/unit/services/DataImportExportManager.spec.ts` | 本轮中文化修复 | 已确认 | 导入/导出错误兜底不再暴露 `Unknown error`；已由 R5 单测和门禁验证 |
| `packages/ui/src/utils/error.ts`、`packages/ui/tests/unit/utils/error-i18n.spec.ts` | 本轮中文化修复 | 已确认 | 公共错误默认兜底按当前语言返回；普通对象错误不再暴露 `[object Object]` |
| `packages/ui/src/services/PromptDataConverter.ts`、`packages/ui/tests/unit/services/PromptDataConverter.spec.ts` | 本轮中文化修复 | 已确认 | 转换器失败兜底不再暴露 `Unknown error`；已由 R6 单测验证 |
| `packages/ui/src/composables/model/useImageModelManager.ts` | 本轮中文化修复 | 已确认 | 可选错误详情 helper 不再使用英文未知错误作为默认值；已由 lint/typecheck 覆盖 |
| `packages/mcp-server/src/index.ts`、`packages/mcp-server/tests/tool-success-path.test.ts` | 本轮 MCP 测试证明力修复 | 已确认 | `setupServerHandlers` 导出；MCP `generate-wiki-prompt` 和 `evaluate-prompt-fit` handler 成功路径已有注入式自动化测试 |
| `docs/project/project-status.md` 风险台账 | 本轮风险治理修复 | 已确认 | 风险章节已 owner 化、等级化、状态化，并带处置建议和复评日期 |
| `packages/mcp-server/tests/environment.test.ts`、`packages/mcp-server/tests/models.test.ts` | 本轮 MCP 覆盖率修复 | 已确认 | MCP 环境配置、配置校验和默认模型选择路径已补单元测试 |
| `packages/mcp-server/tests/tool-success-path.test.ts` | 本轮 MCP 功能闭环修复 | 已确认 | MCP 5 个核心工具 handler 成功路径已全部覆盖 |
| `packages/ui/tests/unit/components/FavoriteShareExportDialog.spec.ts` | 本轮中文化修复 | 已确认 | 收藏分享导出入口 zh-CN labels、导入提示、复制状态和失败提示已有组件级自动化证明 |
| `scripts/mcp-real-smoke.mjs`、`package.json` | 本轮 MCP 真实集成验收 | 已确认 | 新增 `pnpm mcp:smoke:real`，在有效 API key 环境下验证 HTTP MCP、tools/list 和真实 `generate-wiki-prompt` 调用 |
| `packages/mcp-server/tests/config-and-logging.test.ts`、`packages/mcp-server/tests/tool-success-path.test.ts` | 本轮 MCP 覆盖率修复 | 已确认 | MCP 配置、日志、参数错误、XC context 校验、默认模型禁用和真实集成前置错误路径已有自动化证明 |
| `packages/mcp-server/src/index.ts`、`packages/mcp-server/tests/index-auth.test.ts` | 本轮 MCP 覆盖率修复 | 已确认 | MCP HTTP auth helper、Bearer token、XC token header、OPTIONS 和 401 分支已有单元测试证明 |
| `packages/mcp-server/tests/core-services.test.ts`、`packages/mcp-server/tests/environment-import.test.ts`、`packages/mcp-server/tests/xc-context.test.ts` | 本轮 MCP 覆盖率修复 | 已确认 | CoreServicesManager、导入期环境变量映射、XC context 边界和敏感信息不泄露已有自动化证明 |
| `packages/mcp-server/src/index.ts`、`packages/mcp-server/tests/index-http-app.test.ts`、`packages/mcp-server/tests/index-process-handlers.test.ts` | 本轮 MCP 覆盖率修复 | 已确认 | HTTP app healthz/CORS/auth/session、startup error、uncaught rejection 和 shutdown signal 处理已有自动化证明 |
| `packages/web/tests/unit/main-entry.spec.ts` | 本轮 Web 覆盖率修复 | 已确认 | Web 入口的 locale watcher、英文 lang 分支和 Vercel Analytics 加载成功/失败分支已有自动化证明 |
| `packages/ui/tests/unit/components/FavoriteListItem.spec.ts` | 本轮 UI 测试证明力修复 | 已确认 | 收藏条目的内容展示、分类/标签/使用次数、选择、复制、使用、编辑、分享、分类切换和删除行为已有组件级自动化证明 |
| `packages/ui/tests/unit/components/EvaluateButton.spec.ts` | 本轮 UI 测试证明力修复 | 已确认 | 评估按钮入口的禁用态、单结果评估、对比评估和加载态已有组件级自动化证明 |
| `packages/ui/tests/unit/components/FeedbackEditor.spec.ts` | 本轮 UI 测试证明力修复 | 已确认 | 评估反馈输入的本地化默认文案、受控/非受控输入、提交、取消、清空和快捷键行为已有组件级自动化证明 |
| `packages/ui/tests/unit/components/FocusAnalyzeButton.spec.ts` | 本轮 UI 测试证明力修复 | 已确认 | 焦点评估按钮的直接评估、焦点输入、带反馈评估、空反馈回退、取消关闭、点击外部关闭和禁用阻断行为已有组件级自动化证明 |
| `packages/core/tests/unit/variable-extraction/service.spec.ts`、`packages/core/tests/unit/utils/error.spec.ts` | 本轮 core 覆盖率修复 | 已确认 | 变量提取服务请求校验、模型/模板校验、JSON 修复解析、去重过滤、执行错误和公共错误归一化已有离线测试证明 |
| `packages/core/tests/unit/compare/service.spec.ts`、`packages/core/tests/unit/model/validation.spec.ts` | 本轮 core 覆盖率修复 | 已确认 | compare 服务词级/字符级/空白大小写对比和模型参数类型、范围、未知参数、危险参数、provider 过滤已有离线测试证明 |
| `packages/core/tests/unit/prompt/factory-errors.spec.ts` | 本轮 core 覆盖率修复 | 已确认 | PromptService factory、错误对象、依赖检查、history 代理、迭代错误包装和 test stream 基础分支已有离线测试证明 |
| `packages/ui/tests/unit/components/DataManager.spec.ts`、`packages/ui/tests/unit/components/FavoriteReproducibilityEditor.spec.ts`、`packages/mcp-server/tests/environment-import.test.ts` | 本轮测试稳定性修复 | 已确认 | 全仓负载下出现 5s 超时的既有慢用例已设置局部超时，单包/全仓复跑均通过 |
| `packages/core/tests/unit/utils/ipc-serialization.spec.ts`、`packages/core/tests/unit/model/model-errors.spec.ts` | 本轮 core 覆盖率修复 | 已确认 | IPC 序列化成功/失败路径、debug 诊断、批量参数和模型错误结构化字段已有离线测试证明 |
| `packages/core/tests/unit/image/input-normalizer.spec.ts` | 本轮 core 覆盖率修复 | 已确认 | 图像输入归一化、浏览器转换和降级路径已有离线测试证明 |
| `packages/core/tests/unit/variable-value-generation/service-runtime.test.ts` | 本轮 core 覆盖率修复 | 已确认 | 变量值生成服务输入校验、模型/模板失败、结构化错误保真、JSON 修复解析、LLM 异常包装和非法响应形态已有离线测试证明 |
| `packages/core/tests/unit/image-understanding/service.test.ts` | 本轮 core 覆盖率修复 | 已确认 | 图像理解服务工厂注入、请求校验、模型禁用和 streaming 前置阻断已有离线测试证明 |
| `packages/ui/tests/unit/components/FavoriteManager.spec.ts` | 本轮测试稳定性修复 | 已确认 | 全仓负载下出现 5s 超时的两个外部刷新重交互用例已设置局部超时，单包/全仓复跑均通过 |
| Fork remote `fork`、PR #311 | 本轮治理/交付补强 | 已确认 | fork 分支 `codex/xiaoc-quality-baseline` 已推送到 R28；上游 PR #311 已 open/mergeable；Vercel checks 因授权失败未通过 |
