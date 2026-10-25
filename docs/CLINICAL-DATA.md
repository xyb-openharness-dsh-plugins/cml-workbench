# CLINICAL-DATA · CML 临床试验与参考数据包（🔧 M0 骨架，M4 落地）

> 四件套：`research/cml/` = manifest.json + trials.jsonl + trials.sqlite + README.md。
> manifest=jsonl=sqlite 行数断言；FAILED 通道如实记「未查过」。

## 检索窗口
最近 9 个月为默认窗口（starter 01 号 §4）；仅当覆盖不足且有业务理由时扩至 12 个月。

## 检索口径（CML 特有）
- 疾病面：Chronic Myeloid Leukemia / CML / 慢性粒细胞白血病
- 药物面：BCR-ABL tyrosine kinase inhibitor（imatinib / nilotinib / dasatinib / bosutinib / ponatinib / asciminib；中文通用名 NMPA 口径）
- 场景面：TFR（treatment-free remission）/ 耐药与突变（T315I）/ 妊娠与 TKI / 老年与合并症
- 分期限定：chronic phase（与加速期/急变期分开计数，不混池）

## 四通道（MCP stdio）
| 通道 | 状态 | 备注 |
| --- | --- | --- |
| ClinicalTrials.gov API | ⏳ 未查过 | M4 实跑 |
| CDE（药审中心） | ⏳ 未查过 | 中文试验 |
| 权威指南附表 | ⏳ 未查过 | 仅范围参照，不复制临床内容 |
| 平台失败记录 | ⏳ | FAILED 必须留 error 原文 |

## 字段（入库最小集）
登记号 / 标题原文 / 申办方 / 分期 / 药物 / 入排摘要原文 / 起止 / 来源与抓取时间戳 / 状态（active/recruiting/unknown 照抄平台值，不自译）。

## 红线
搜索结果不是医学建议；试验包只做"有哪些在招、原话怎么讲"的整理与就诊问题输入。
