# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.1.1 — 2026-10-27

- 36 号 v2 补齐（指南可点 + 状态卡）：从零引入疾病概要三件套（`primer.js` / `primer.css` / `primer-data.js`），顶栏「?」与看板首卡副按钮打开整页浮窗；四段固定 `定义 → 医学资料规范和指南情况 → 目前治疗全景概要 → 发展趋势`。
- 指南链接（`primer-data.js`）：ELN 2025 PMC 全文（验链 OK，`kind: fulltext`）、NCCN CML 官方入口（验链 OK，`entry: true`；临床版需自行注册）；中国 CML 指南（2025）与 ICC 2022 未取得可验证原件，如实 `nolink` + note 说明（PMC 203/0 chars、DOI 403 或 JS 渲染）。
- 看板首卡新增状态卡四件（§2.6）：eyebrow / 锚点派生「第 N 天」/ 现状行（阶段原文 + 状态 + 下次日期与事项）/ 出口按钮排（主按钮进当前阶段核心页 + 副按钮打开疾病概要）；天数由首剂 TKI 日期派生，不手填，无锚点时显示「待初始化」并指向三步向导。
- 闸门：新增 `scripts/check-primer-links.mjs`（接入 `npm run check`）与 `scripts/probe-disease-primer.mjs`；原型与 `public/` 装机页探针均 10/10。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 (1541b8a) 初始化，仅有注册骨架与健康接口，无业务功能。
