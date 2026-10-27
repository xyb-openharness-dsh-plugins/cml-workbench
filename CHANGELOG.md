# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.1.1 — 2026-10-27

- 36 号 v2 补齐（指南可点 + 状态卡）：从零引入疾病概要三件套（`primer.js` / `primer.css` / `primer-data.js`），顶栏「?」与看板首卡副按钮打开整页浮窗；四段固定 `定义 → 医学资料规范和指南情况 → 目前治疗全景概要 → 发展趋势`。
- 指南链接（`primer-data.js`）：3 条实测 OK——ELN 2025 全文（Europe PMC fullTextXML，`kind: fulltext`）、ELN CML 官网项目页（`entry: true`）、NCCN CML 官方入口（`entry: true`，临床版需自行注册）；中国 CML 指南（2025）与 ICC 2022 未取得可验证原件，如实 `nolink` + note 说明（PMC 203/0 chars、DOI 403 或 JS 渲染）。
- 看板首卡新增状态卡四件（§2.6）：eyebrow / 锚点派生「第 N 天」/ 现状行（阶段原文 + 状态 + 下次日期与事项）/ 出口按钮排（主按钮进当前阶段核心页 + 副按钮打开疾病概要）；天数由首剂 TKI 日期派生，不手填，无锚点时显示「待初始化」并指向三步向导。
- AI 对话集成（评审反馈，scripts 34 号 §2b）：删掉页面自建的「AI 会话区」（splitter + 右侧面板 + 提示词输入框 + 该面板里的 demo 说明），顶栏改成一个「对话」按钮，点了只 `postMessage({type:'cml:agent-open'})` 请宿主把原生会话叫到前台；`和 AI 讨论`/`AI 协助` 仍只派发 `cml:agent-draft`，由这次补上的 `public/index.html → bridge.js` 转给外框写进原生草稿（此前 bridge.js 从未被加载，装机版里按钮点了没反应）。页面反馈从 `#aiHint` 改为底部 `#pageFlash` 短提示，`btn-ai` 改为实心底色；宿主顶栏的「收起/打开 AI 对话」也改成实心底色，与「重新加载界面」区分。
- 闸门：新增 `scripts/check-primer-links.mjs`（接入 `npm run check`）与 `scripts/probe-disease-primer.mjs`；原型与 `public/` 装机页探针均 10/10。
- 顶栏瘦身（评审反馈）：移除品牌与档案 chip 之间那条灰字长句「示例档案 A（周建国…）与 B（林雨桐…）是两位不同患者…；「双主体」指…；切档案清空未提交草稿。」——它是 demo 页面说明，装机应用里不需要；`nav.profiles` 的 aria-label 同步简化为「档案切换（A：患者本人视角 / B：家属代记视角）」。档案 A/B 的差异改由两个 chip 的字面（患者本人视角 / 家属代记视角）与条目级「记录者」标记承担；「切档案清空未提交草稿」是实现行为，未改（断言仍为 A 填「草稿药A」→ 切 B 后值 = 空）。`public/` 与 `prototypes/v0.2/` 两处同步，`.subj-note` 样式规则一并删除。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 (1541b8a) 初始化，仅有注册骨架与健康接口，无业务功能。
