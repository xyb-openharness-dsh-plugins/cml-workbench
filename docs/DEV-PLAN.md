# DEV-PLAN · 小粒宝 GranPal（cml-workbench）

> 本文件是里程碑状态的**唯一判据源**；进度汇报（prompts/PROGRESS-REPORT.md）照抄本表判据列，不临场改写。
> 三态：✅实测 / 🔧骨架 / ⏳未实现。状态变更必须附可验证证据（命令输出/文件/截图）。

## 认领与基线
- 认领 Issue：[.github#31](https://github.com/xyb-openharness-dsh-plugins/.github/issues/31)（claim/claimed/triage，2026-10-25）
- 仓库：`xyb-openharness-dsh-plugins/cml-workbench`（private）
- 目录：`~/Downloads/cml-workbench`
- 品牌：小粒宝 GranPal（占位名，可回退）

## 里程碑

| 阶段 | 判据（可验证） | 状态 | 证据 |
| --- | --- | --- | --- |
| M0 骨架 | `npm run check` staticPass=true；9 件文档在位；cordis.patch.yml 有 config.root | ✅ | 2026-10-25 `npm run check` 输出 staticPass:true；docs/ 9 件；patch root 行 |
| M1 调研SPEC | DIFF-MATRIX 重名率实测数字；三路调研引用带来源+日期；G1 签认留痕 | ✅ | 重名率 45.8%（合并后 50.0%）；三路调研 3 文件；**G1 签认 2026-10-25**（合并预案10条 + HVT-11进一期标U + 访谈优先依从/副作用） | 重名率 **45.8%**（research/family-comparison-cml.md）；医学 10 主题 A/C 级核数（research/medical-cml-10-topics.md）；用户线 0 访谈声明 + 51 条分层（research/user-cml-narratives.md）；SPEC §医学约束 9 条；INTERACTION-DESIGN S1–S9 已铺行 |
| M2 原型 | prototypes/v0.2 四件套；32 折叠卡；X1–X4 走查计数；独立评审 P0=0；README ≥4 实渲截图；G2 签认 | 🔧 首评 P0=11 → 已修 11 条（`docs/PROTOTYPE-FIXES.md`，含实测数字）；**待第二轮独立复审**（`docs/PROTOTYPE-REVIEW-2.md`）| ✅ 四件套 + 折叠卡 4×5 块 + README 7 图；首评 P0=11（X1=X2=X3=0,X4=1）→ 11 条全修；四套检查器全绿（static/ip-matrix/write-paths/page-view）；**G2 待复审结论** |
| M3 数据模型 | schema/0001_initial.sql；freeze-contract sha256；判读列断言用例过；G3 签认 | ⏳ | — |
| M4 临床库 | fetch-cml-trials 脚本；research/cml 四件套；manifest=jsonl=sqlite；FAILED 如实 | ⏳ | — |
| M5 开发版 | 七步移植；MinerU 六部件；apiBase 契约回归；test 五套；check+audit 全绿；V1 | ⏳ | — |
| M6 装机 | tgz 四要素对照；bundles 登记；真机走查；真机截图 README；V2/V3 用户确认 | ⏳ | — |
| M7 发布 | tag + Release（tgz+sha256）+ CHANGELOG 发版段 | ⏳ | — |
| M8 回填 | BACKLOG #20 行状态列（🔵 版本+日期+依据）；PR 合并 | ⏳ | — |
| M9 回流 | 新坑入 DEV-REQUIREMENTS；通用坑入 starter LESSONS；≥1 条下一轮直接受益；check-starter+npm test | ⏳ | — |

## 闸口
| 闸口 | 内容 | 签认 |
| --- | --- | --- |
| G1 | 业务流程/场景/功能线 + INTERACTION-DESIGN（28 号 IP1）+ DEV-REQUIREMENTS §五默认值 | ✅ 2026-10-25 已签（用户原话见 DESIGN-SESSION） |
| G2 | HTML 原型（版本+范围）+ X1–X4 一致性 + P1 发布可见性 | ⛔ 未过（P0=11，等修复后重评） |
| G3 | 数据模型与数据流 | 待 |

## 并行写同仓约定
以 `npm run check` + `npm run audit` 为准合流，合流后立即提交。
