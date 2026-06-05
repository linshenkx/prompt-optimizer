# 分析 / 评估 / 对比评估模板与评分规范

> 本文档定义下一阶段评估模板应遵循的统一写法与评分规则。
> 它服务于：
> - core 评估模板重写
> - UI 评估输入组包
> - 后续测试断言与文案对齐

## 1. 为什么需要单独这份规范

当前问题不是只有接口冗余，还包括：

- 三类任务的系统提示词结构不统一
- 三类任务的评分维度边界不清楚
- `focus` 出现时，系统提示词没有把任务目标真正切换掉
- compare 中“跨模型同提示词对比”缺少显式分析规则

因此需要一份单独规范，约束：

1. 模板框架长什么样
2. 三类任务分别用什么 rubric
3. `focus` 应如何改变任务目标
4. compare 的跨模型分支应如何切换

## 2. 统一模板框架

三类任务的系统提示词统一采用下面结构，保持和优化模板同类的可读性与约束感：

```md
# Role: <Role_Name>

## Profile
- Author: GlobalCloud XiaoC
- Version: <version>
- Language: zh-CN
- Description: <角色描述>

## Goal
- Outcome: <本次任务的核心输出目标>
- Done Criteria: <完成标准>
- Non-Goals: <明确不做什么>

## Skills
### Skill-1
1. <能力描述>
2. <能力描述>

## Rules
1. <硬规则>
2. <硬规则>

## Workflow
1. <步骤 1>
2. <步骤 2>
3. <步骤 3>

## Output Contract
- score
- improvements
- patchPlan
- summary

## Initialization
As <Role>, you must follow the <Rules>, complete the task according to <Workflow>, and output valid JSON only.
```

### 2.1 统一要求

所有评估模板都必须满足：

1. 角色必须明确是“评估者”，不是任务执行者。
2. 目标必须明确 patchPlan 只允许修改当前工作区提示词。
3. 规则必须明确：证据不足时返回空 patchPlan，不得臆造不存在的 prompt 片段。
4. 工作流必须先分析，再评分，再建议，再映射 patchPlan。
5. 输出契约统一为 JSON，不输出额外解释。

## 3. 模板条件块使用规范

建议充分使用模板语法，而不是为每种细分情况单独复制一套模板文件。

优先使用这些条件信号：

- `hasFocus`
- `hasReferencePrompt`
- `hasDesignContext`
- `hasCrossModelComparison`
- `hasSharedTestCases`

### 3.1 `focus` 不是补充文案，而是任务模式切换

因此：

- `hasFocus = false` 时，模板执行默认分析 / 评估目标
- `hasFocus = true` 时，模板中的 `Goal / Rules / Workflow / Output Requirements` 都应切换到“用户优先问题驱动”

### 3.2 `hasCrossModelComparison` 是 compare 的增强分支

它仍属于 compare，但要求系统提示词额外强调：

- 同 prompt 同输入跨模型差异
- 不要只总结模型强弱
- 要找出 prompt 对弱模型不够清晰的地方

## 4. 三类任务的 Role 建议

### 4.1 分析 Analysis

建议角色名：

- `Prompt_Design_Analysis_Expert`

角色目标：

- 专注提示词设计质量
- 不看执行输出
- 识别结构问题、歧义、约束缺失、稳健性问题

### 4.2 单结果评估 Single Result Evaluation

建议角色名：

- `Prompt_Execution_Evaluation_Expert`

角色目标：

- 基于一次执行快照评估提示词表现
- 看 prompt、输入、输出之间的匹配关系
- 分析结果质量与提示词设计之间的因果

### 4.3 对比评估 Compare Evaluation

建议角色名：

- `Prompt_Compare_Evaluation_Expert`

角色目标：

- 基于多个执行快照提炼规律
- 判断哪些模式值得吸收到当前工作区提示词
- 不能把 compare 误解为简单 A/B 输赢总结

## 5. 三类任务的评分维度应彻底拆开

## 5.1 分析 Analysis Rubric

分析不依赖输出，建议维度偏设计态：

1. `goalClarity`
   - 目标清晰度
   - 任务目标是否明确、边界是否清楚
2. `instructionCompleteness`
   - 指令完备度
   - 是否覆盖必要要求、约束、输入边界
3. `structuralExecutability`
   - 结构可执行性
   - 模型是否容易按结构理解并执行
4. `ambiguityControl`
   - 歧义控制
   - 是否存在容易产生不同理解的表达
5. `robustness`
   - 稳健性
   - 是否更可能在不同输入下稳定工作

### 不适合放进分析的维度

- 输出质量
- 单次结果达成度
- 跨快照稳定性

这些都是右侧评估语义，不应混进左侧分析。

## 5.2 单结果评估 Single Result Rubric

单结果评估依赖执行结果，建议维度偏执行态：

1. `goalAchievement`
   - 目标达成度
   - 这次输出是否完成任务
2. `outputQuality`
   - 输出质量
   - 内容质量、准确性、表达质量
3. `constraintCompliance`
   - 约束符合度
   - 输出是否遵守格式、限制、风格等要求
4. `promptEffectiveness`
   - 提示词引导有效性
   - 该提示词是否足以稳定地引导出当前结果

### 不适合放进单结果评估的维度

- 跨快照鲁棒性
- 多方案规律收敛能力

## 5.3 对比评估 Compare Rubric

对比评估依赖多个执行快照，建议维度偏证据归纳与迁移：

1. `goalAchievementRobustness`
   - 目标达成稳定性
   - 多快照下是否都能较稳定地达到目标
2. `outputQualityCeiling`
   - 输出质量上限
   - 更优快照体现出的质量上限是否足够高
3. `promptPatternQuality`
   - 提示词模式质量
   - 哪些 prompt 写法明显更好、更差
4. `crossSnapshotRobustness`
   - 跨快照鲁棒性
   - 同类条件下结果是否稳定
5. `workspaceTransferability`
   - 对工作区的可迁移性
   - 这些证据是否能可靠收敛成对当前工作区的修改建议

### 不适合放进 compare 的维度

- 单次输出细节得分导向过强的维度
- 纯设计态、不看结果的维度

## 6. `focus` 分支规范

## 6.1 核心原则

只要存在 `focus`，它就是本次任务的最高优先级目标。

这条规则必须同时体现在：

- `Goal`
- `Rules`
- `Workflow`
- `Output Requirements`

### 6.2 系统提示词中的条件块建议

```md
{{#hasFocus}}
## Goal
- Outcome: 优先判断并回应用户指定的聚焦问题
- Done Criteria: summary / improvements / patchPlan 必须直接回应 focus
- Non-Goals: 不要用泛泛而谈的全面总结回避 focus
{{/hasFocus}}

{{^hasFocus}}
## Goal
- Outcome: 按默认 rubric 完成全面分析 / 评估
- Done Criteria: 覆盖标准维度并给出可执行建议
- Non-Goals: 不要脱离当前证据做泛化猜测
{{/hasFocus}}
```

```md
{{#hasFocus}}
## Rules
1. Focus Brief 是本次任务最高优先级输入。
2. 你必须优先围绕 Focus Brief 组织判断、评分解释、改进建议和 patchPlan。
3. 如果证据不足以支持 Focus Brief 指向的问题，必须明确说明。
4. 默认 rubric 仍需完成，但不得掩盖 Focus Brief。
{{/hasFocus}}
```

### 6.3 输出约束

只要 `hasFocus = true`，就必须满足：

1. `summary` 明确回应 focus
2. `improvements` 至少 1 条直接回应 focus
3. `patchPlan` 若非空，至少 1 条直接回应 focus

## 7. compare 的跨模型分支规范

## 7.1 使用条件

建议在 compare 模板中使用：

```md
{{#hasCrossModelComparison}}
...
{{/hasCrossModelComparison}}
```

该条件只应在下面场景触发：

- 同一测试用例
- 相同或等价 prompt
- 模型不同
- 输出有明显差异

### 7.2 目标切换

这时 compare 的额外目标应变成：

- 识别提示词对不同模型的理解门槛
- 发现哪些表达对强模型足够、对弱模型不够清晰
- 优先改进跨模型可理解性与一致性

### 7.3 推荐条件块

```md
{{#hasCrossModelComparison}}
## Additional Goal
- 本次快照中存在“相同提示词 + 相同输入 + 不同模型”的对比组。
- 你必须重点分析不同模型为何对同一提示词产生不同理解和不同输出。
- 你的结论应优先帮助当前工作区提示词提升跨模型清晰度与稳健性。
{{/hasCrossModelComparison}}
```

```md
{{#hasCrossModelComparison}}
## Cross-Model Rules
1. 不要只总结哪个模型更强，要解释提示词为何导致不同模型产生不同理解。
2. 优先识别歧义、弱约束、结构松散、缺少示例、格式要求不刚性等问题。
3. 若差异主要来自模型能力边界而非提示词表达，应明确说明。
4. patchPlan 应优先提升跨模型可理解性，而不是对某个模型做特化。
{{/hasCrossModelComparison}}
```

### 7.4 工作流增强

```md
{{#hasCrossModelComparison}}
## Workflow Addition
1. 先识别哪些 snapshot 属于同 prompt 同输入跨模型对比。
2. 比较不同模型在哪些要求上分歧最大。
3. 判断分歧更像提示词表达问题，还是模型能力边界问题。
4. 只把可通过提示词改写改善的部分收敛进 patchPlan。
{{/hasCrossModelComparison}}
```

## 8. 用户提示词（user message）规范

system prompt 决定任务规则；user message 则负责清晰传入证据。

### 8.1 分析

建议 user message 包含：

- 当前工作区提示词
- 可选参考 prompt
- 设计态上下文
- 可选 focus

### 8.2 单结果评估

建议 user message 包含：

- 当前工作区提示词
- 当前执行 prompt
- 当前测试输入
- 当前输出
- 可选 focus

### 8.3 对比评估

建议 user message 结构为：

1. 当前工作区提示词
2. 公共测试用例
3. 快照列表
4. 可选 compare hints
5. 可选 focus

重点：

- 公共测试输入尽量放公共区域，不重复塞入每个 snapshot
- snapshot 只写其独有信息

## 9. 输出 contract 保持统一

三类任务虽然 rubric 不同，但输出结构尽量保持统一：

```json
{
  "score": {
    "overall": 0,
    "dimensions": [
      { "key": "dimensionKey", "label": "维度名称", "score": 0 }
    ]
  },
  "improvements": [],
  "patchPlan": [],
  "summary": ""
}
```

### 统一约束

1. `score.dimensions` 的 key 集合由任务类型决定
2. `improvements` 应是可复用方向，不是样本复述
3. `patchPlan` 只允许修改当前工作区提示词
4. `summary` 应最短表达关键判断

## 10. 实施建议

建议不要一次性先改所有模板文件，而是先定这一层规范，再按顺序落地：

1. 先改 core 类型与模板渲染上下文
2. 再改三类模板主骨架
3. 再给不同模式接入各自上下文
4. 最后补测试和 i18n 文案

## 11. 本文档的最终结论

一句话总结：

- 下一阶段模板重写不应只是“改措辞”，而应建立统一的结构化系统提示词框架，并让 `分析 / 单结果评估 / 对比评估` 拥有不同的任务目标和评分 rubric；同时必须用模板条件语法正式支持 `focus` 高优先级任务模式，以及 compare 中的“同提示词跨模型差异分析”分支。
