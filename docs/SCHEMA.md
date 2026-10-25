# 数据主体—关系—表（CML 草案 · G1 包 → G3 冻结）

状态：**草案**（G3 前不建表、不写迁移）。判读红线：**无 diagnosis / risk_level / prognosis / recommendation 类列**（M3 断言）。

## 通用约定（全表适用）
- 每表 `id INTEGER PRIMARY KEY`、`created_at`/`updated_at` TEXT(ISO8601)、`rowid` 排序为默认读序（`ORDER BY rowid`）。
- **显式 null**：所有可空列显式写入 NULL，不用空串代替。
- `in_use INTEGER NOT NULL DEFAULT 1`：软删除/更正链用，不物理删。
- `*_title TEXT`：分节标题列（如 `section_title`），分节渲染用。
- `author_role TEXT CHECK(author_role IN ('self','caregiver'))` + `visibility TEXT CHECK(visibility IN ('private','normal'))`：双主体与三出口过滤依据。
- `source_text TEXT`：报告/医嘱**原文摘录**（照抄），与结构化值并存；`source_doc_id` 关联原始文件。
- 单位：数值一律 `value_text TEXT` 存原文 + `value_num REAL` + `unit TEXT`；**不做跨单位换算**。
- **分类值不进趋势**：`category/kind/phase` 类列不进曲线数据源。

## 主体与文件
| 实体 | 表 | 核心字段 | 约束 |
| --- | --- | --- | --- |
| 主体 | `subject` | name_text, birth_year INTEGER, sex TEXT, role TEXT | 单库单主体（本人）+ 可挂 caregiver |
| 文档 | `document` | relative_path, sha256, mime, byte_size, imported_at, parse_status | relative_path 校验在资料根内；sha256 唯一 |
| 待核对候选 | `candidate` | doc_id, payload_json, state('pending'/'accepted'/'rejected'), reviewed_at | 拒收即 state='rejected'，零副作用 |

## 分子线（HVT-01/02/07/08）
| 表 | 字段 | 说明 |
| --- | --- | --- |
| `dx_profile` | transcript_type TEXT(e13a2/e14a2/非典型/未知), ph_status TEXT, dx_date, phase TEXT(CP/AP/BP), phase_scheme TEXT('ICC2022'), vitals_json | ★HVT-01 转录本类型与分期**分列**，不分期混存 |
| `mol_result` | draw_date, value_num REAL, value_text TEXT, **unit TEXT('IS%')**, **lab_name TEXT**, **is_standardized INTEGER**, sensitivity TEXT(如 MR4.5), assay_method TEXT, source_doc_id, source_text | ★HVT-07 可比性四要素：单位/实验室/IS标化/灵敏度；缺一即在图上标记"不可比" |
| `mol_milestone` | mol_result_id, milestone_code TEXT(MMR/MR4/MR4.5/MR5/CMR), definition_text, source_version | 词表随点存**定义来源**；不含"是否达标"列 |
| `cbc_result` | draw_date, wbc, hgb, plt, anc, unit_json, source_doc_id | ★HVT-06 前 2 月密测轨道数据源 |
| `bm_result` | exam_date, blast_pct REAL, cytogenetics_text, fish_text, source_text | 原文摘录 |
| `tfr_record` | start_date, condition_json(必备5/最低5/最佳3 逐条 状态+字段原文), stop_date, monitor_plan_json, restart_flag INTEGER, restart_date | ★HVT-08 只存"字段是否照抄到"，不存"是否满足"结论；restart 由用户按医嘱记录 |

## 服药线（HVT-03/04/09）
| 表 | 字段 | 说明 |
| --- | --- | --- |
| `med_drug` | drug_name TEXT, generic_name, dose_text, **frequency TEXT('daily'/'qod'/'intermittent')**, route | ★HVT-03 频次是独立列（隔日/间歇是 2025 指南剂量优化的现实形态） |
| `med_period` | drug_id, start_date, end_date, reason_text(医嘱原文), reason_doc_id, change_kind('start'/'switch'/'dose'/'hold'/'resume') | 处方变更线；只新增版本 |
| `med_log` | date, drug_id, state('taken'/'missed'/'partial'), note_text | ★HVT-04 每日打卡；漏服不评判（无 severity 列） |
| `ae_event` | onset_date, term_code, term_text(人话词), drug_id, note_text, source_type('self'/'clinician_note') | ★HVT-05 按药归属；词表按当前用药过滤 |
| `withdrawal_sx` | date, term_text(肌骨痛/瘙痒/其他), note_text | ★HVT-09 TFR 停药综合征记录 |

## 档案与生活线（HVT-10 + 通用）
| 表 | 字段 | 说明 |
| --- | --- | --- |
| `cost_record` | month TEXT(YYYY-MM), drug_id, amount_cents INTEGER, self_pay INTEGER, insurance_tag TEXT, note | 按月聚合；**不跨药混算** |
| `fertility_plan` | topic_code, question_text, source_version, visibility('private' 默认) | ★HVT-10 纯问题清单 + 事实卡引用；零处置 |
| `visit_prep` | visit_date, facts_md TEXT, views_md TEXT, questions_md TEXT, exported_at | 事实区/看法区分列导出 |
| `guideline_ref` | key TEXT, url, version, fetched_at, level('A'/'B'/'C') | 词表与事实卡来源可追溯 |
| `settings` | key, value_json | 资料根、凭据状态（**不存明文**）、面板宽度偏好 |

实体图：`subject 1—n document`；`document 1—n candidate`；`mol_result/cbc_result/bm_result/med_period/ae_event/cost_record 1—1 source_doc?`；`med_drug 1—n med_period / med_log / ae_event`；`mol_result 1—n mol_milestone`。

## 迁移与冻结（G3 执行）
- `schema/0001_initial.sql` 一次成文 → `schema/freeze-contract.md` 记 sha256；此后**只增不改**。
- 旧库兼容：新列走 `ALTER TABLE ADD COLUMN`（带默认），破坏性变更走新表 + 迁移脚本。
- 备份/回滚：迁移前复制 `workbench.db` 为 `workbench.db.bak-<ts>`；失败即回滚并保留日志。

## 扩展策略
- 新增指标定义走 `metric_definition` 目录（数据），不改结构；新增**关系**才走迁移。
- 读模型：各页只读统一视图 `v_*`，不在页面层拼 SQL；跨页一致性由同一视图保证（ACC-08）。
