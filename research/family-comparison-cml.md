# 小粒宝 GranPal（CML）M1 家族结构对比

日期：2026-10-25（Asia/Shanghai）。执行：`gh repo clone`（账号 samqin123）两基准仓到 `/Users/sammini/Downloads/xyb-work/`：

- `cervical-workbench`（移植样板，v0.1.1，HEAD 2026-10-2x 深度 50 拉取）
- `breast-cancer-workbench`（成熟基准，VERSION=0.12.0，即 26 号规则 §3 指定的「默认乳腺 v0.12.0 已装机」口径；HEAD 提交 2026-10-22）

> 「26 号口径」出处：starter `prompts/CANCER-KICKOFF.md:12`「**成熟对比基准固定 breast-cancer-workbench**（26 号 §3 口径，DIFF-MATRIX 用）」；`docs/26-CANCER-FEATURE-LINES.md` §3 原文「拿『成熟癌种（默认乳腺，v0.12.0，已装机）』当基准」。本地 clone 的 breast 仓 VERSION 正是 0.12.0，口径吻合。

---

## 一、两基准仓一级清单（中文页名逐字，来自代码而非二手文档）

### 1.1 cervical-workbench（小莲宝 CerviPal）

一级导航以 `public/app.js:54-59` 的 `PAGES`（与 `prototypes/v0.2/app.js:54` 同源）为准，**12 个一级页 + 设置（弹窗）**：

| # | 页名（逐字） | id | 二级（SUBPAGES 逐字） |
|---|---|---|---|
| 1 | 看板 | dashboard | 单页 |
| 2 | 病情整理 | records | 资料库 / 整理草稿 / 核对 / 病情档案 / 指标检测 / 病情汇总 |
| 3 | 我的分期 | stage | 分期档案 / 病理与分子 / 会诊与二次意见 |
| 4 | 治疗历程 | treatment | 治疗路径 / 手术记录 / 放疗疗程 / 系统治疗 |
| 5 | 性与生育 | fertility | 生育档案 / 生育保留记录 / 卵巢与月经 / 性健康（私密） |
| 6 | 放疗与长期影响 | late | 放疗后事件 / 淋巴水肿 / 阴道与扩张 / 绝经与骨健康 |
| 7 | 检查与指标 | labs | 肿瘤标志物 / 细胞学与 HPV / 影像随访 |
| 8 | 病情一图秀 | timeline | 数值曲线 / 分类与事件 / 数据口径 |
| 9 | 营养支持 | nutrition | 进食量记录 / 补充剂与医嘱 |
| 10 | 心理支持 | mind | 当下感受 / 身体形象与亲密关系 / 母亲身份与家庭沟通 |
| 11 | 复诊准备 | review | 复诊节奏 / 三类随访节点 / 筛查与预防 / 就诊准备 |
| 12 | 临床研究 | trials | 2026 线索 / 已收藏 / 入组问题 |
| + | 设置 | （顶栏弹窗，非侧栏） | 资料目录 / 文档解析 / 临床数据库（`dlgSettings`，public/app.js:1191-1196，cfg-tabs 三签） |

⚠️ 文档与代码的口径差：`docs/SPEC.md` §4 标题写「信息架构（11 个一级页）」，IA 树里**没有**「病情整理」（但 §3 范围表和导航都有）；设置列在 §3 表里（"同骨架"）但以弹窗呈现。**实测导航为 12 条一级页**。对比时以代码 `PAGES` 为准。

### 1.2 breast-cancer-workbench（小粉宝，v0.12.0）

一级导航以 `public/js/pages-basic.js:10-19` 的 `PAGES` 为准，**8 个一级 + 设置（弹窗）**。SPEC §2/§3 均明说「八个一级模块全部进入一期」「八个一级模块不新增（避免导航膨胀）」，与代码一致：

| # | 页名（逐字） | id | 二级（SUBPAGES 逐字，pages-basic.js:21-28） |
|---|---|---|---|
| 1 | 看板 | dashboard | 单页 |
| 2 | 病情整理 | records | 资料库 / 整理草稿 / 核对 / 病情档案 / 指标检测 / 病情汇总 |
| 3 | 病情一图秀 | timeline | 单页（rail 内有时间范围/选择指标/显示内容三组） |
| 4 | 临床 | clinical | 治疗历程 / 病理 / 分子档案 / 试验线索 / 资料对照 / 我的关注 / 数据来源（6 子页） |
| 5 | 营养支持 | nutrition | 当下困扰 / 进食与体重 / 建议与回顾 |
| 6 | 心理支持 | mind | 当下感受 / 我的记录 / 支持资源 / 身体与亲密 |
| 7 | 全程与康复 | care | 近期安排 / 术后恢复 / 上肢与淋巴水肿 / 不适记录 / 就诊准备 / 长期生活 |
| 8 | 收藏与回顾 | review | 问题清单 / 已保留结果 / 报告与任务 |
| + | 设置 | （弹窗 `CFG_TABS`，pages-more.js:404） | 资料目录 / 文档解析 / 关于 |

合计 8 一级 / 27 二级（看板、一图秀各算单页），与 SPEC A19「8 个一级、27 个二级页均可从导航到达」对账一致。

---

## 二、CML 候选一级线 × 两仓一级清单：逐条重名比对

CML 候选 12 条：分子线 / 服药线（用药档案）/ 副作用日志 / 处方变更 / TFR档案 / 费用记录 / 生育计划资料夹 / 复查记录 / 复诊准备 / 资料导入 / 设置 / 临床试验。

规则：同名=1，近义=0.5，无关=0。每条 CML 线取**两基准中较高**的一个匹配。判定依据一律给出一级层出处。

| # | CML 一级线 | 最佳对应（一级层） | 分 | 逐条判定理由 |
|---|---|---|---|---|
| 1 | 分子线 | cerv「检查与指标」/ brst「病情整理→指标检测」(二级) | 0.5 | 同属 26 号 L4 指标分析域，但家族里"分子"只活在**二级**（cerv 我的分期→病理与分子；brst 临床→病理·分子档案）；CML 把分子线提为一级是本病种的正当升格，非同名 |
| 2 | 服药线（用药档案） | cerv「治疗历程→系统治疗」(二级) / brst「临床→治疗历程」(二级，方案与药物) | 0.5 | 家族把用药作**治疗历程的子集**记录（episodic）；CML 的 TKI 每日连续用药档案是形态差异，一级层无同名页 |
| 3 | 副作用日志 | cerv「放疗与长期影响」/ brst「全程与康复→不适记录」(二级) | 0.5 | 近义：cerv 一级页记的就是治疗远期不良事件（放射性肠炎/膀胱炎/淋巴水肿），brst 对应 L5 安全与症状线；命名与病因不同（放化疗 vs TKI 长期毒性），按近义给 0.5 |
| 4 | 处方变更 | 无（cerv 治疗路径"改过的路径留着不覆盖"为治疗历程内行为） | 0 | 两仓一级清单均无处方/剂量变更类线；CML 换药、减量、依从性事件为独有 |
| 5 | TFR档案 | 无 | 0 | 停药尝试（treatment-free remission）是 CML 特有决策与监测线，家族无对应一级页；brst「长期生活」为二级话题页，域不同 |
| 6 | 费用记录 | 无 | 0 | 两仓均无任何费用/医保一级页（TKI 长期费用是 CML 真实痛点，家族空位） |
| 7 | 生育计划资料夹 | cerv「性与生育」 | 0.5 | 近义：域重叠（生育档案、生育保留记录），但 cerv 页含性健康私密等更广内容且命名不同；brst 只有二级「长期生活」话题 |
| 8 | 复查记录 | cerv「检查与指标→影像随访」(二级) | 0.5 | 近义：复查=随访间隔+当次结果，家族拆在两处（cerv 复诊准备→三类随访节点 + 检查与指标）；一级层无同名 |
| 9 | 复诊准备 | cerv「复诊准备」**逐字同名** | 1 | brst 侧对应一级「收藏与回顾」+二级「就诊准备」，非同字 |
| 10 | 资料导入 | cerv「病情整理」/ brst「病情整理」 | 0.5 | 近义：「病情整理」= 上传→解析→候选→核对→入库 全管线（SUBTITLES 原话），导入是其中第一段；CML 若只做导入命名与家族管线域不完全同宽 |
| 11 | 设置 | cerv「设置」(弹窗) / brst「设置」(弹窗 CFG_TABS)**逐字同名** | 1 | 两仓一致：侧栏不设一级页，顶栏/头像入口开设置弹窗（资料目录 / 文档解析 / 临床数据库|关于 三签） |
| 12 | 临床试验 | cerv「临床研究」 | 0.5 | 「试验」vs「研究」一字之差、同域（2026 线索/已收藏/入组问题）；brst 为二级「试验线索」。非逐字同名，给 0.5 |

### 计算

- Σ匹配分 = 0.5×7（#1,2,3,7,8,10,12） + 1×2（#9,11） + 0×3（#4,5,6） = 3.5 + 2 + 0 = **5.5**
- CML 一级条数 = **12**
- **一级重名率 = 5.5 / 12 = 45.8%**

### 敏感性（口径摆动验证）

- 从严（把 #1 分子线、#2 服药线、#8 复查记录按"域不完全对等"降为 0）：**4.0/12 = 33.3%**
- 从宽（#10 资料导入按"26 号 L9 资料线同域"给 1；#12 临床试验按近义族给 1）：**7.5/12 = 62.5%**

### 判据结论

**45.8% ≤ 70%，家族判据合格**。且从严/从宽两种口径（33.3%–62.5%）区间上限仍 ≤70%，结论对口径选择稳健。CML 的差异化主要由处方变更、TFR档案、费用记录三条家族空位线 + 分子线/服药线两条升格线撑起。

### 顺带的一条 26 号结构提醒

26 号 §1 的经验阈值写「一级（功能线）数量级 8–10」。CML 候选 12 条略超上限（乳腺基准刻意停在 8 防"导航膨胀"）。两条可考虑的合并预案（M2 前定夺）：① 处方变更并入服药线作二级（与乳腺"计划 vs 实际"同构）；② 复查记录与分子线合并为「复查与分子」双二级。合并后 10 条，重名率仍 ≤70%（分子线域不变，复查记录 0.5 分移入同一条，Σ 少 0.5、条数少 1~2 → 5.0/11≈45.5% 或 5.0/10=50%）。

---

## 三、两基准仓可复用结构事实（供 M2）

### 3.1 cervical 的 client 链路（src → build → lib）

- **源文件**：`src/client.js`（482 行，客户端入口源码，人改这里）。
- **生成器**：`scripts/build-client.mjs` —— 官方要求客户端必须是"已构建好的单文件"（workbench-standard §3.5，Desktop 不代打包）。项目 UI 本是零依赖原生 ESM，所以"构建"只做**常量注入的字符串替换**：包名/仓库 ← `package.json`，面板参数 ← `lib/layout.js`（`PANEL`/`AGENT_PANE` + `assertPanelConfig`），接口前缀 `API_PREFIX`/`UI_PREFIX` ← `dsh/routes.js`，版本 ← `lib/version.js`。参数唯一来源、生成而非手抄，避免漂移。
- **产物**：`lib/client.js`（488 行，顶部横幅注明"由 build-client.mjs 生成，请勿手改"）。`package.json` 的 `exports["./client"] = "./lib/client.js"`，`files` 白名单含 `dsh lib public schema assets`。
- **防漂移兜底**：`npm run build:client -- --check`（内容不一致退出码 1），已串进 `npm run check` 全链（build-version → build-demo-data → check-version → check-syntax → check-schema → check-wording → check-demo-columns → **build-client --check** → node --test → check-workbench-package）。
- **面板形态 customFrame**：0.1.0 装标准分栏后业务区被拉满、右侧会话不可调 → 改 `customFrame=true`，宿主把原生会话节点作为 `conversation` prop 交给应用排版；顶栏「AI 对话」按钮、splitter 鼠标/键盘（←/→ 步进 2%，Home/End）拖 25%–45%（默认 35%）、收起**不结束会话**、宽度存 localStorage、容器 <760px 变覆盖式抽屉。根节点首子元素必须是语义 `<header>` 并用 `--dsh-frame-leading-clearance` 避让。三条硬约束注释就在 `lib/client.js` 头部，CML 直接照搬这套 layout 契约。
- lib 目录其余成员：`layout.js`（面板参数唯一来源，132 行）、`version.js`（build-version.mjs 生成，含提交 hash）、`zip.js`（导出打包）。
- demo 数据链：`demo/build-demo-data.mjs` 生成 `public/demo-data.js`；`app.js` 读 `window.DEMO_DATA` 并在 111-113 行做 `[日期,名称]→{d,label}` 字段适配，"改数据请改生成器重跑"。`public/app.js`(1562 行) 与 `prototypes/v0.2/app.js`(1393 行) 已分叉（public 为接入真实 API 的演进版）。

### 3.2 breast 的治疗线 / 折叠卡实现位置

**治疗线（临床→治疗历程）**：
- 导航与子页注册：`public/js/pages-basic.js:10-28`（`PAGES`/`SUBPAGES`，`clinical: ['治疗历程','病理 / 分子档案','试验线索','资料对照','我的关注','数据来源']`）。
- 子页分发 map：`public/js/pages-more.js:276-288`（`clinicalPage()` 里 `治疗历程: clinicalTreatments, '病理 / 分子档案': clinicalPathology, 试验线索: clinicalTrials…`，`head()+subnav()+map[sub]?.()` 三件套）。
- 治疗列表本体：`public/js/pages-more.js:219-227` `clinicalTreatments()`——**计划与实际分别保存**（`isActual` 标志，完成待办不自动生成实际治疗）、每条渲染 `kindLabel：name + 起止日期 + 腋窝处理/放疗野`、状态 pill（ongoing→green）、`＋ 补录一次治疗` 按钮、无来源条目自动标"本人补录"。空态文案直接指路导入管线。CML 服药线（每日 TKI）可借"计划 vs 实际分列 + 补录来源标注"两个合同。
- 数据层对账：`docs/PARITY.md:22`「临床：治疗历程、病理分子、虚构试验、对照、关注、来源 → 6 个子页渲染 → 已实现（开发版）」。

**折叠卡**：
- 统一用原生 `<details>`，无 JS 开关：
  - 一图秀左侧指标选择：`public/js/pages-basic.js:628` `<details class="pick" open>`（summary 带"最多 4 个 · 已选 N"实时计数，按 categoryLabel 分组 checkbox）；窄屏折叠指示为 A33 五档宽度实测项（DEV-PLAN.md:26,139）。
  - 解析失败技术细节：pages-basic.js:298 `<details class="fault-detail"><summary>技术信息（排查用）`；style.css:119 注释「默认折叠，不占视觉，但要能展开对照原文」。
  - 指南原文对照：pages-basic.js:489/493/556（"看这 N 项的指南原文位置"/"这几项指南怎么写"——**只折叠原文、不转产品语句**，GUIDELINE-BRIDGE.md:30 禁止层）。
  - 导出范围说明：pages-basic.js:597。
- 指标卡另有 3D 翻面形态（cervical `flipCard()` public/app.js:204-232，`data-flipped` 唯一视觉开关，分类记录不翻面不连线），breast 同名 `metricCard` 在 `ui.js`。界面状态（折叠/Tab/缩放）**不入库**（G3-REVIEW §5.6）。
- breast lib 链路与 cervical 同构：`src/client.js → scripts/build-client.mjs → lib/client.js`，lib 多一个 `identity.js`；public 拆为模块化 ES module（`pages-basic/pages-more/state/ui/api/agent/parse-fault.js`），CML 二选一即可。

### 3.3 两仓一级页面里 CML 可直接借鉴的通用形态

| 形态 | 出处 | CML 落点建议 |
|---|---|---|
| **趋势 tab（病情一图秀）** | cerv SUBPAGES `数值曲线/分类与事件/数据口径`；brst rail：时间范围 chips(3m/6m/12m/all) + 指标多选≤4 + 显示内容开关(治疗节点/关键点数值/变化≥20%) + 缩放 slider | BCR-ABL 对数曲线 + 减量/换药/TFR 试停事件条；「数据口径」页正好承载 IS% 换算与 PCR 实验室间差异说明 |
| **资料导入管线（病情整理）** | cerv SUBTITLES.records 原话「上传→解析→确认指标→入库；原件永远保留，接受之前都只是候选」；brst 资料库行带 sha256 前 16 位/大小/页数/导入时间，parse-fault.js 把 `NO_TOKEN：…` 翻成人话 + 「去填 MinerU Token」按钮 | 血常规/骨髓报告/购药凭证走同一"候选→逐项核对→入库"合同，禁止自动判读 |
| **设置弹窗（不进一级导航）** | 两仓同构三签：资料目录（绝对路径、拒根/主目录、占用、备份恢复二次确认）/ 文档解析（MinerU 隐私勾选门+Token 掩码只显示后 4 位+无降级不假成功）/ 第三签（cerv 临床数据库 sqlite、brst 关于） | CML 第三签可放"费用数据开关"或"随访节奏来源"；customFrame 参数唯一来源 `lib/layout.js` 照搬 |
| **复诊准备双区导出** | cerv `dlgExport()`：事实区（已核对）+「想问的事/我的看法（不是医生结论）」永远带标注，私密条目不进导出，Markdown 可编辑+服务端完整版 `GET /api/cervical/export/:profile.md`；brst 收藏与回顾：问题版本/快照/过时提醒 | 复诊准备直接套"事实/看法分区 + 私密不进导出"合同；TFR 讨论清单可做成快照版本 |
| **导航骨架** | 侧栏 `PAGES` 常量 + `subnav()` role=tablist aria-selected + 面包屑 + 页头 `head(标题, 副题, 动作按钮)`；演示档案切换（cerv 2 套 / brst 5 套含冲突画像） | 档案切换器对 M1 走查（空态/极少数据）很值钱，建议 CML 至少配"新诊断/服药期/TFR 试停"三套画像 |
| **话术红线** | 两仓 SUBTITLES/SPEC 一致的家族立场：「线索不是推荐」「生育是记录不是承诺」「只记录不重算分期」「看法恒不为结论」 | CML 对偶句：「TFR 成功率是统计不是承诺」「试验线索不是推荐」「费用只记录不测算报销」 |

---

## 四、结论速览

| 项 | 值 |
|---|---|
| cervical 一级条数 | **12**（导航实测；SPEC §4 写 11，文档-代码口径差已标注）+ 设置弹窗 |
| breast 一级条数 | **8**（27 个二级；SPEC 与代码一致）+ 设置弹窗 |
| CML 一级条数 | **12** |
| Σ匹配分 | 5.5（同名 2 × 1 + 近义 7 × 0.5 + 无关 3 × 0） |
| **一级重名率（实测）** | **5.5 / 12 = 45.8%** |
| 敏感性区间 | 33.3%（从严）– 62.5%（从宽） |
| 家族判据 ≤70% | **✅ 合格**（三种口径全部通过） |
