# 互动设计记录 · 小粒宝 GranPal（CML）

状态：**G1 待签**（业务流程与功能签认）。已继承用户 4 项明确决定（DESIGN-01–04，2026-10-25 AskUserQuestion 全部选推荐项）；未核实的配置素材不自动视为设计确认。
当前阶段：research → scenarios → specification 已完成，**停在 G1**。后续：independent-review → prototype(M2) → implementation。
设计提示词：docs/DESIGN-PROMPT.md；设计者章程：docs/DESIGNER-BRIEF.md；独立审查：docs/DESIGN-REVIEW.md（M2 前执行）。
权威内容：docs/SPEC.md、docs/SCENARIOS.md；UI 与数据：docs/UI-DESIGN.md、docs/SCHEMA.md（草案）。

| 决策 ID | 待解决的问题 | 用户已确认内容/来源 | Agent 建议及原因 | 待确认项 | 确认人/日期 | 影响功能 ID |
| --- | --- | --- | --- | --- | --- | --- |
| DESIGN-01 | 服务主体 | **患者本人 + 家属代记双主体**（用户选推荐项） | `author_role`+`visibility` 已入 SCHEMA；代记条目带来源标记 | — | samqin123 / 2026-10-25 | CML-DASH/MED/PREP |
| DESIGN-02 | 病程覆盖 | **慢性期全程 + TFR**（换线/副作用/费用；进展期仅资料归档） | 与 2025 指南 TFR 书面条件对齐（HVT-08） | — | samqin123 / 2026-10-25 | CML-TFR/RX |
| DESIGN-03 | MinerU 接入 | **接入六部件**（报告 PDF→候选→核对） | 18 号 v2；解析失败降手工（§四） | 实解析待 M5 | samqin123 / 2026-10-25 | CML-DOC |
| DESIGN-04 | 品牌占位名 | **小粒宝 GranPal** | 可全局替换脚本回退 | — | samqin123 / 2026-10-25 | 全站 |
| DESIGN-05 | 一级页数量（12 vs 26 号建议 8–10） | **待用户裁决** | 建议采纳合并预案：处方变更→服药线二级、复查记录→分子线二级 ⇒ 10 条，重名率 50.0% 仍 ≤70% | ⬜ 本闸口 | — | 导航结构 |

## G1 签认包（请确认）

| 项 | 内容 | 状态 |
| --- | --- | --- |
| 业务流程与功能线 | docs/SCENARIOS.md（S1–S9 + HVT-01–11 + 通用能力分离） | 🔧 待签 |
| 交互路径文档（28 号 IP1） | docs/INTERACTION-DESIGN.md（S1–S9 路径 + CRUD 双通道矩阵） | 🔧 待签 |
| HVT 需求审核 | docs/HVT-REVIEW.md：**B=0**、G=0、W=0、U=2（不阻塞） | ✅ 已出报告 |
| 医学约束 | docs/SPEC.md §医学约束（M1–M9，A 级来源） | ✅ 已落 |
| 家族差异 | 一级重名率 **45.8%** 实测 ≤70% | ✅ 已实测 |
| 强约束默认值 | docs/DEV-REQUIREMENTS-2026-10-25.md §五（4 项默认，可回退） | ✅ 已落 |
| 用户研究 | 一手访谈 **0**（如实声明）；E2/E3 分层 51 条 | ✅ 已如实 |

## 本轮已写入的章节
SPEC（定位 + 医学约束）、SCENARIOS（HVT/通用能力）、USER-RESEARCH（M1 全量）、INTERACTION-DESIGN（S1–S9）、UI-DESIGN（页面树与状态）、SCHEMA（草案表）、ACCEPTANCE（ACC-H01–H13）、HVT-REVIEW（B=0）、DIFF-MATRIX（45.8%）、DEV-PLAN（判据）。

## 下一轮最关键的问题（G1 签认时回答）
1. 一级页采纳 12 条原案，还是合并预案（10 条：处方变更/复查记录降二级）？
2. HVT-11「值得报告的信号」卡是否进一期（U 级：需临床/合规口径确认）？
3. 一手访谈招募是否优先「生育叙事 / 家属代记」两题（证据最薄处）？

## 确认时展示的产物
原型版本/hash：⏳ M2；本闸口展示文档包（SPEC/SCENARIOS/INTERACTION-DESIGN/HVT-REVIEW）。

## 变更记录
| 日期 | 变更 | 原因 | 受影响 |
| --- | --- | --- | --- |
| 2026-10-25 | M0 骨架 → M1 全量（含 HVT 补丁） | 三路调研合流 | SPEC/SCENARIOS/UI-DESIGN/SCHEMA/ACCEPTANCE/HVT-REVIEW |

HTML 原型关口：⏳ M2（G2 前不得声称已确认）。
数据演进关口：SCHEMA 草案已出，**G3 前不建表**；冻结与迁移策略见 docs/SCHEMA.md §迁移与冻结。
