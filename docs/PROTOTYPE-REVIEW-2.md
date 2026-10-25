# CML 患者工作台原型 v0.2 —— 第二轮独立复审

> 复审员：独立第三方，未参与构建。只读仓库，仅新增本文件。
> 判据：**患者能不能真的操作并看到结果**，不接受源码字符串、不接受修复方自述。
> 全部结论来自本机 Chrome + Playwright 实跑（`channel="chrome"`，本地 http server），探针自写，未采信 `scripts/probe-*.py`。

---

## §0 冻结快照核对

复审开始前实测（`shasum -a 256`，工作目录 `/Users/sammini/Downloads/cml-workbench`）：

| 文件 | 委托方给定前缀 | 实测 sha256（全） | 行数 | 核对 |
| --- | --- | --- | --- | --- |
| `prototypes/v0.2/app.js` | `d025378d15146ff3` | `d025378d15146ff302d298e1ff0d116a2fa4a134460538fab7eeb9a1ba396cc4` | 2116 | ✅ 相符 |
| `prototypes/v0.2/index.html` | `7ec65de3759f60a6` | `7ec65de3759f60a6d6c572088f96f3a0590134a23c9570a51c46e5d98f3728b4` | 258 | ✅ 相符 |
| `prototypes/v0.2/style.css` | `bb8ea5fff4e725f4` | `bb8ea5fff4e725f410046c2a91fdf68847346e362f2f86f10c2f5944ffd3e772` | 304 | ✅ 相符 |
| `prototypes/v0.2/demo-data.js` | `efef460e…`（未改） | `efef460e816caa485ab9d77d47b5fd13ca9649f21bda2cf2b5fbcccc2b6dac33` | 2 | ✅ 未改 |

四文件与冻结快照**逐字符相符**，本轮复审对象即该快照。`VERSION` = `0.1.0`，`git log` HEAD = `1e4e9d8`。

**已发现一处自述与实物不符（不属冻结项，但影响可信度）**：
`docs/PROTOTYPE-FIXES.md:5` 声称"修复后 `style.css` sha256 前缀 `93654520…`、296 行"；实测 `style.css` 为 `bb8ea5ff…`、**304 行**。修复方自述的文件指纹与实际被审文件对不上——**自述文件本身不可作为证据**，本轮全部结论另起探针。

服务：`http://127.0.0.1:8991/index.html`，cwd = `prototypes/v0.2`。起服务后用 `curl` 校验 `<title>` = `小粒宝 GranPal · CML 患者工作台 v0.1.0（M2 原型）`，确认是被审页面而非端口上别的项目（首轮曾因 8931 端口被另一项目占用而误连，已排除）。

---

## §1 结论

**P0 剩余 2 条**（均为"部分修"，未闭合）：**P0-1（打印）、P0-11（双主体建模）**。
其余 9 条实测已修，且给了产品级数字（不是源码字符串）。

**能否签 G2：不可签。**

理由（三条，任一独立成立即不可签）：

1. **P0-1 未闭合**：折叠卡的 5 块内容在 DOM 层确实展开了，但真出 PDF **只 1 页**（A `pages=1 / 412903 B`，B `pages=1 / 414296 B`）。打印是四块固定顺序 + 打印规则在 `32-TREATMENT-PATHWAY-FOLDOUT.md §3.4/§5` 里写死的验收项，患者按 Ctrl+P 拿到的仍是第一屏，等于"打印后折叠卡内容全丢"这条原始缺陷**换了个形式继续存在**。
2. **P0-11 未闭合且是原缺陷本身**：两个档案仍是**两位不同患者**（A 周建国 / 男 46 / e14a2；B 林雨桐 / 女 31 / e13a2），而界面 `index.html:17,20` 明写"双主体＝记录视角，不是两位患者"。这是上一轮 P0-11 的**原始指控原句**，没有被修掉，只是把"记录者落到条目级"和"切档案清草稿"两个子项修好了。
3. **X2 = 0、X3 = 0**：G2 走查要求按场景 ID 逐条断言（`INTERACTION-DESIGN.md §五`）。S7（停药尝试准备，产物＝核对清单 PDF）与 S9（我要问的，AI 起草 + 手工增删）入口能点但**没有产物**；IP6「每页显式编辑 ≤1」在 5 个页面仍违反。X 层不达标时 G2 无签字依据。

---

## §2 十一条 P0 逐条复核

判据：患者能不能真的操作并看到结果。每条给实测数字 / 复现步骤 / 差什么。

### P0-1 打印折叠卡内容全丢 —— **部分修（未闭合）**

- **DOM 层已修（真数字）**：`emulate_media(print)` 后 A 档案 `cards=4 open=4`，每卡 `section.pd-block` 5 块、`offsetHeight>0` 计数 `vis=5`；`detailH` = 805 / 859 / 879 / 725，对应 `sumH` = 45 / 45 / 74 / 45，即卡体确实撑开而非只有标题行。B 档案 `cards=3 open=3`，3×5=15 块同判 `vis=5`（`detailH` 802 / 899 / 1119）。回 `screen` 后 `details.phase-fold[open]` 归 0，默认闭合（`[open]=0`）也过。
- **但真出 PDF 失败（决定性）**：`page.pdf(format="A4")` → A `pages=1, bytes=412903`；B `pages=1, bytes=414296`。内容长度 7091/6833 px 被压成一页。
- **根因实测**：打印媒体下 `#view.offsetHeight=7091`，而 `document.documentElement.scrollHeight=900`、`clientHeight=900`，`getComputedStyle(document.body).overflow = "hidden"`。即应用外壳在打印时仍按"视口高度 100% + 隐藏溢出"裁剪：`style.css:22` `html{...height:100%}`、`style.css:25` `body{height:100%}`、`style.css:29` `body{overflow:hidden}`、`style.css:82` `.app{...overflow:hidden}`。JS 把 `details` 打开是对的，但打开的**内容根本没被排版进打印流**。
- **对照实验证明这是唯一原因**：同一页面再注入
  `@media print{html,body{height:auto!important;min-height:0!important;overflow:visible!important;display:block!important} .app{display:block!important;height:auto!important;overflow:visible!important} .main-col,#view,.panel{overflow:visible!important;height:auto!important;max-height:none!important}}`
  → **pages=1 → pages=11，bytes=1000335**。等待 1500ms 复测仍 11 页，排除渲染未稳定。
- **复现步骤**：起 server → 打开 `#mol` → `page.emulate_media(media="print")` → `page.pdf(format="A4")` → 用 pypdf 读 `len(reader.pages)`，得 1。
- **差什么**：`@media print` 里补上述解除高度/溢出约束的规则（或打印时改用 `.app{display:block;height:auto}` 布局），并**以 PDF 页数为验收**，而不是以 `offsetHeight>0` 为验收。
- **附注（未验证边界）**：Chromium 打的 PDF 文本层是 Type3 字体、无 ToUnicode，`extract_text()` 取不到中文，因此本报告**只用页数/字节数**作证据，不用 PDF 文本。

### P0-2 费用「记一笔」入口与 5 字段表单不存在 —— **已修**

- 入口 `data-act="cost-new"` 可点，表单 5 字段全部存在：`#cost-drug / #cost-spec / #cost-amount / #cost-insured / #cost-date`（=5 ≤6）。
- 提交「伊马替尼 / 88 元 / 2026-10-25」后：`costRows()` **7 → 8**；页面当月聚合「当月（2026-10）自费合计」**620 → 708 元**；`state.extra.A.cost` 增 1；新记录进表格且页面出现"当月自费合计变为 708 元（当前 8 条）"。
- 产物真的变了（聚合金额变、行数变），不是只弹提示。

### P0-3 副作用「记一次不舒服」入口与表单不存在 —— **已修**

- 入口 `data-act="ae-new"` 可点，5 字段：`#ae-w / #ae-d / #ae-drug / #ae-desc / #ae-doc`（=5 ≤6）。
- 提交「下午有点乏力」后 `aeRows()` **5 → 6**，时间线追加该条，页面提示"时间线新增 1 条"。

### P0-4 「⋯ 更多→换药/调剂量了」入口与 6 字段表单不存在 —— **已修**

- `med/calendar` 页 `details.more > summary` 的内文**逐字**等于 `⋯ 更多→换药/调剂量了`（字符串完全匹配，非包含）。
- 展开后 `data-act="rx-new"` 可点，6 字段：`#rx-drug / #rx-dose / #rx-freq / #rx-start / #rx-stop / #rx-reason`（=6，正好卡在上限）。
- 提交后 `rxRows()` **3 → 4**，页面"处方变更线新增 1 段"。

### P0-5 mol「保存」/ docs「接受」不产生任何记录 —— **已修**

- mol：填 `#f-d=2026-10-20 / #f-v=0.0123 / #f-lab=本机自建实验室` → 点 `mol-save` → `metricByKey('pcr').points` **4 → 5**；末点带 `recorder:"本人"`、`is_std:1`、`local:true`；趋势图 `svg.chart` outerHTML **2795 → 3077**，即**图真的重绘**（数字变、图变）。
- docs：点某行 `docs-accept`（待确认行）→ `#docsAcceptedLine` 由 `已接受：A-C3（共 1 条，本机内存态）` → `已接受：A-C1、A-C3（共 2 条，本机内存态）`，徽标 `已接受 1/3 → 2/3`。
- 拒收通道零副作用：`mol-reject` 后 `pcr` 保持 **4 → 4**，不乱写。

### P0-6 复诊资料包导出的是费用明细 / 计数不一致 —— **已修**

- 点 `prep-export` 后导出文本三块齐全，条目分布 `{事实区: 6, 看法区: 2, 问题清单: 2}`，合计 **10 条**。
- 页面「保留」实测 `#prepExportKept = 10`，与导出条目数 **10 一致**（不再出现"页面说保留 12、实际导出 7"）。
- 费用明细**零泄漏**：导出全文不含 `达沙替尼 / 伊马替尼 / 自费 / 费用明细 / 金额`。
- 区间真的影响取数：`range-3m → 10 条`、`range-6m → 11 条`、`all → 13 条`（三档互不相同，说明不是写死的常量文本）。

### P0-7 十条逐字入口只有 1 条可点 —— **已修**

A、B 双档案各跑一遍，**18/18 可点**（每个入口 `offsetHeight=44`、且带 `data-act` / `href` / 为 `summary`）：

| 场景 | 逐字入口 | 所在页 | 承载 |
| --- | --- | --- | --- |
| S1 | `记一笔复查` | dash | `data-act=mol-new` |
| S2 | `今天吃了吗` | dash | `data-act=today-taken` |
| S3 | `记一次不舒服` | ae | `data-act=ae-new` |
| S4 | `⋯ 更多→换药/调剂量了` | med/calendar | `details.more>summary` |
| S5 | `准备复诊（生成资料包与问题清单）` | dash | `a[href="#prep"]` |
| S6 | `BCR::ABL1（IS%）` 等 | mol | 5 个 `data-act=gloss` 角标 |
| S7 | `⋯ 更多→停药尝试准备` | mol | `details.more>summary` |
| S8 | `记一笔` | cost | `data-act=cost-new` |
| S9 | `我要问的` | fert | `data-act=fert-ask` |

（S10 `⋯ 更多` 为通用收口，另计。）入口不是摆设：S1 点开确实落到 mol 表单、S2 点后 `state.checkin` 变 `taken`、S6 点后 `#glossCard` 渲染"词表卡 + 来源版本 + 不做判读"。

### P0-8 孤儿页 2 个 + CML-LAB 二级页缺失 —— **已修**

- 从 13 个 `(view,sub)` 逐一收集站内可达集合，覆盖 `dash/mol/mol/lab/med/{checkin,calendar,rx}/ae/tfr/cost/fert/prep/docs/trial`，**孤儿 = `[]`**（0 个）。`docs` 由 S5「准备复诊」路径进入，`trial` 由 S6 词表路径进入，两者在场景路径上（`pageTrial` 自身还带"从哪里进来（场景路径）"段）。
- `mol` 页存在 `data-act="mol-lab"` 入口，点击后 `location.hash = #mol/lab`，页面含 `CML-LAB`、`血常规密测`，`innerText` 长度 979 —— **二级页存在且可达**。

### P0-9 K1 禁词「复发」在 `q` 外渲染 —— **已修（K1 面）／自检声明仍不实**

- 全站普查（A+B × 13 页，展开全部 `details`，区分 `q` 内外）：命中 **7 处 = 6 处 inQuote + 1 处 outside**。
- `q` 外命中中**没有任何 K1 判读词**；唯一 1 处 outside 是 `A/mol/lab` 表格 `TD`（第 3 列，列头「报告字段（照抄）」）里的 `未见额外染色体异常（ACA）` —— 属**报告原文照抄**，不是判读，K1 面放行。
- K1 六词（`建议治疗/可能复发/可以停药/无需就医/治愈率/达标了没有`）全站 **0 命中**；扩展词 `达标/未达标/满足/未满足/正常/风险/在线/建议停药` 亦 **0**。
- `q` 内 6 处全部带 `.src` 来源（患者原话 / 医生原话 / 报告原文 + 日期 + 文件号），是合规引用。
- **但**：`index.html:230` 自检写「复·发 0」，实际 `B/mol` 折叠卡内 `<q>` 渲染了「紧张：停药第一周总觉得自己会复发，半夜会醒」—— 渲染态**有**"复发"。`index.html:231` 写「异·常 1 处（B/mol…）」，实测 **2 处**（另一处在 `A/mol/lab` 的 `TD`）。自检数字与实测不符，见 §4。

### P0-10 TFR 页自作达标判读 + B 档案渲染停药方向文案 —— **已修**

- A、B 两档案、展开全部折叠卡后，判读词 `满足 / 未满足 / 达标 / 未达标 / 未达 MR4 / MMR 达成 / 已达成` **全部 0 命中**。
- 三态渲染为 `已抄录 / 未抄录 / 待补`（三个都实际出现在页面）。
- 医生原话带来源：A → `"先把 MMR 稳住"` + `src="来源：医生原话 · 血液科门诊 2026-10-12"`；B → `"DMR 超过 2 年、TKI 用了 6 年，达到书面条件，可以谈停药；停药后前半年每 1–2 个月抽一次"` + `src="来源：血液科门诊 2026-04-09 · 文件 B-D5"`。
- B 档案里的"停药方向"表述**只出现在带来源的 `q` 内**，属医生原话引用（K3 合规），不再是原型的自撰方向性建议。

### P0-11 双主体建模错 + 跨患者草稿泄漏 —— **部分修（未闭合）**

**已修的两个子项：**

- 记录者落到**条目级**：B 档案新写一条副作用，末条 `recorder = "家属代记"`，未误标"本人自述"。B 的生育三行分别为 `本人 / 家属代记 / 母子共同记录`，标注正确。
- 跨档案草稿**不再泄漏**：A 在 cost 页填 `草稿药A` → 页内重进仍回显 `草稿药A` → 切到 B → B 的 cost 输入框 = `''`，`state.drafts` 变 `{"A":{},"B":{}}`（切档案整体清空）。上一轮 P0-11 的"跨患者泄漏"确实关掉了。

**仍成立（原缺陷原句）：**

- 两个档案仍是**两位不同患者**。实测看板：A = `姓名 周建国` / `e14a2（典型）` / `46 岁`；B = `姓名 林雨桐（家属代记：母亲）` / `e13a2（典型）` / `31 岁`。`demo-data.js` 里 A 男·46·设备售后工程师·2026-01 确诊，B 女·31·小学教师·2020-03 确诊 —— 性别、年龄、转录本、职业、确诊年份、用药史全部不同，是两个人。
- 而界面声明 `index.html:17` `aria-label="档案切换（双主体：同一患者的两个记录视角）"`、`index.html:20` "双主体＝记录视角，不是两位患者"。**代码与声明直接矛盾**，且 `index.html:248` 自检自己又写「A（患者本人 46 岁男性…）/ B（家属代记 31 岁女性…）」—— 自检内部就承认是两个人。
- **复现步骤**：切 A → `#dash` 读看板"档案"块 → `姓名 周建国`；切 B → `#dash` → `姓名 林雨桐（家属代记：母亲）`；对照 `index.html:17,20` 的声明。
- **差什么**：要么让 A/B 共享同一患者身份、只切"记录视角"，要么把 UI/`aria-label`/自检里的"同一患者"表述改掉并说明演示数据是两位患者。当前状态是"声明一种模型、实现另一种"。

---

## §3 X1–X4（本 harness 自测数字）

自写 harness：`chrome` + `playwright` 无头实跑，共 **62 条断言**，**失败 5 条**，`pageerror` 捕获 **0** 条（无 JS 运行期报错）。

| 项 | 断言条数 | 失败 | 判 | 依据 / 失败点 |
| --- | --- | --- | --- | --- |
| X1 路径覆盖 | 3 | 0 | **1** | 一级页 10/10 有内容；`(view,sub)` 13/13 有内容；孤儿页 0 |
| X2 逐字入口 + 产物 | 10 | 2 | **0** | S1 pcr 5→6 ✓ / S2 状态 `taken` ✓ / S3 aeRows 6→7 ✓ / S4 rxRows 4→5 ✓ / S5 三块齐 ✓ / S6 含来源版本 ✓ / S8 当月合计 708→785 ✓ / 一步回首页 `hash=#dash` ✓；**S7 ✗** 入口可点但 TFR 页 `PDF/导出/下载/打印` 控件 `[]`（文档要求产物＝核对清单 PDF）；**S9 ✗** 入口可点但问题清单增删控件 `0`（文档要求「AI 起草 + 手工增删」，现仅做 `ask-hi` 高亮） |
| X3 CRUD 双通道 | 4 | 1 | **0** | 双通道 7 实体 ✓；表单字段 `{qPCR:6, 副作用:5, 处方:6, 费用:5}` 全 ≤6 ✓；裸删除 0 ✓；**每页显式编辑 ≤1 ✗** |
| X4 无头出数字 | 1 | 0 | **1** | 本 harness 全部断言逐条 pass/fail + 计数，可复跑 |

**X3 违反页明细（实测，A/B 两档案一致）**：

| 页面 | 显式编辑入口数 | 具体 |
| --- | --- | --- |
| `docs` | **6** | 三行各「接受」+「更正」→ `app.js:1645-1646` |
| `mol` | **2** | 「保存（写入本机内存态）」+「改这一条（更正，不删除）」→ `app.js:1166-1167` |
| `prep` | **2** | 「导出资料包」+「生成摘要」→ `app.js:1592-1593` |
| `dash` | **2** | 「一键已服」+「标记漏服」→ `app.js:884-885` |
| `med/checkin` | **2** | 「一键已服」+「标记漏服」→ `app.js:1229-1230` |

**补充（不属 X 层，但 G2 关注）—— 窄宽横向溢出**：1440 / 1024 / 800 / 420 四档 × 13 页（折叠卡展开）共 **52 例**，`documentElement.scrollWidth - clientWidth` **全为 0**，`overflowX` 超标元素 0 个。420 档 dash/mol/cost 的 `svg` 有子元素 `right=586 > 420`，但被 `.chart-wrap{overflow-x:auto}` 的图内滚动吸收，页面级不溢出（设计内行为，不计缺陷）。

---

## §4 新发现的问题

### P0（阻塞）

**N-P0-1 双主体声明与实现不一致——两个档案是两位患者**
`index.html:17` / `index.html:20` 声明"同一患者的两个记录视角"，`demo-data.js` 的 `profiles.A`（周建国 / 男 / 46 / e14a2）与 `profiles.B`（林雨桐 / 女 / 31 / e13a2）是两位不同患者；`index.html:248` 自检又自述为两人。与 §2 P0-11 同源，单列以免被"已修 2 个子项"掩盖。

**N-P0-2 打印只输出 1 页，折叠卡内容不进 PDF**
`style.css:22`（`html{height:100%}`）、`style.css:25`（`body{height:100%}`）、`style.css:29`（`body{overflow:hidden}`）、`style.css:82`（`.app{…overflow:hidden}`）在 `@media print` 下未解除；`style.css:237` 的打印规则只处理了 `details` 的展开，没处理**排版容器的高度/溢出**。实测 A 1 页 / B 1 页，注入解除规则后 11 页。与 §2 P0-1 同源。

### P1（应修）

**N-P1-1 `index.html` 自检清单的行号引用全部过期**
`index.html:206` 称打印规则在 `style.css L204`（实测在 `style.css:237`）；`:221` 称 `buildAiContext` 在 `app.js L421`（实测 709）；`:222` 称 `exportBundle` 在 `L1176`（实测 1756）；`:223` 称 `buildSummary` 在 `L1183`（实测 1767）。自检声称"逐字符"，但指向的行不是那段代码。

**N-P1-2 自检的禁词数字与渲染态不符**
`index.html:230` 写「复·发 0」，实测 `B/mol` 折叠卡内 `<q>` 渲染了「…总觉得自己会复发，半夜会醒」（带来源，K1 合规，但自检数字假）。`index.html:231` 写「异·常 1 处」，实测 **2 处**（多在 `A/mol/lab` 的 `TD`「未见额外染色体异常（ACA）」，列头「报告字段（照抄）」）。

**N-P1-3 自检称敏感原话"不在界面渲染"，实测已渲染**
`index.html:235` 称 `demo-data.js` 中 B 档案 `viewpoints 2026-05-20` 那条"按禁词规则不在界面渲染，仅在数据层保留"；实测该条**已渲染**在 `B/mol` 折叠卡的「效果（本人原话）」列，形态 `q + span.src`（来源 `患者原话 · 家属代记 2026-05-20`）。该渲染本身是**合规**的（带来源的本人原话），问题在于自检描述与实际行为相反。

**N-P1-4 自检的 TFR 三态名与实现不符，且"0 处停药方向性文案"不实**
`index.html:246` 写"状态（已确认/未确认/不适用）"，实现是 `已抄录/未抄录/待补`（`app.js` `TFR_STATES`）；同句写"全页 0 处停药方向性文案"，但 B 档案 TFR 页 `<q>` 内有"可以谈停药"（带来源，合规引用）。自检未随实现更新。

**N-P1-5 自检的字号统计与实际不符**
`index.html:240` 写"`12.5px(29 处) / 13px(5 处) / 15px(5 处)`"；实测 `style.css` 内 `font-size:12.5px` **33 处**、`font-size:13px` **6 处**、`font-size:15px` **5 处**。（渲染态 computed `font-size` 越界 0 个这一半结论成立。）

**N-P1-6 `docs/PROTOTYPE-FIXES.md` 自述的 `style.css` 指纹与实物不符**
`docs/PROTOTYPE-FIXES.md:5` 写 `style.css` `93654520…` / 296 行；实测 `bb8ea5ff…` / 304 行。修复方的"证据文件"本身与看板文件对不上，削弱整份自述的可采信度。

**N-P1-7 S7 产物缺失（核对清单 PDF）**
`mol` 页 `⋯ 更多→停药尝试准备` 可点、能到 `tfr`，但 `tfr` 页 `PDF / 导出 / 下载 / 打印` 类控件 `[]`。`INTERACTION-DESIGN.md §二` S7 要求产物为核对清单 PDF。相关渲染在 `app.js` `pageTfr` 区段。

**N-P1-8 S9 问题清单不可增删（AI 起草未落地为闭环）**
`fert` 页 `我要问的`（`app.js:1536` `data-act="fert-ask"`）只给 `#fertAskList` 加 `ask-hi` 高亮，问题清单的增/删控件 `0` 个。`INTERACTION-DESIGN.md §三` 要求生育问题清单「AI 起草 + 手工增删」。

**N-P1-9 IP6「每页显式编辑 ≤1」5 页违反**
`docs` 6（`app.js:1645-1646`）、`mol` 2（`app.js:1166-1167`）、`prep` 2（`app.js:1592-1593`）、`dash` 2（`app.js:884-885`）、`med/checkin` 2（`app.js:1229-1230`）。`INTERACTION-DESIGN.md:9` / `IP6` 与 `28-INTERACTION-PATH-DESIGN.md:63` 均要求 ≤1。

### P2（可改）

**N-P2-1 `docs` 页每行的「接受 / 更正」是成对入口**
`app.js:1645-1646` 三行各一对，计 6。若产品意图是"每行一个决策点"，应在设计文档里把这豁免写清；否则按 IP6 字面就是违反（本报告按字面计 6）。

**N-P2-2 `INTERACTION-DESIGN.md §四` IP1–IP10 结果列仍全部为「待填」**
`docs/INTERACTION-DESIGN.md:64-71` 十条 IP 的结果列无一条填了实测值，而本轮实测已有 X1–X4 与 IP 对应数字可回填。

**N-P2-3 420px 图内横向滚动无提示**
`.chart-wrap{overflow-x:auto}` 在 420 档会有图内横向滚动，但无"可左右滑动"的可见提示，触屏用户可能不知道图超宽。

---

## §5 未验证项（如实）

1. **PDF 文本层内容**：Chromium 导出的 PDF 用 Type3 字体且无 ToUnicode，`extract_text()` 取不到中文。本报告只能用**页数 / 字节数**证明打印裁剪，未能逐字校验 PDF 内的五块文本。若要逐字校验，需换 PDF 引擎或改用视觉比对。
2. **视觉/排版正确性**：未做像素级截图比对（分页处断行、页眉页脚重叠、卡片跨页断裂等）。`break-inside:avoid` 是否真生效未被验证。
3. **大字缩放 / 系统字号放大（如 200% zoom、OS 缩放）**：未测。
4. **真实触屏设备与移动浏览器**：未测（仅桌面 Chrome 的窄视口模拟）。窄宽只验证了横向溢出，未验证触摸目标尺寸与手势。
5. **持久化**：原型为内存态，刷新即回演示数据。未验证任何落盘/多标签页一致性（设计即如此，非缺陷）。
6. **无障碍**：仅抽查 `aria-label` 与焦点可达性中的入口可点性，未做屏幕阅读器实跑或完整 keyboard-tab 序验证。
7. **`docs/trial` 二级页的深层内容完整性**：只验证"存在且可达 + 有内容"，未逐条核对内容是否符合 `32-TREATMENT-PATHWAY-FOLDOUT.md` 的字段要求。
8. **`46-*.md` 之外的其它规范文档**：本轮必读清单为 `PROTOTYPE-REVIEW.md` / `INTERACTION-DESIGN.md` / `DEV-REQUIREMENTS-2026-10-25.md` / `32-TREATMENT-PATHWAY-FOLDOUT.md`，其余文档未纳入判据。
9. **K6 医学来源版本完整性**：抽查了词表卡的"来源版本：GL-CN-2025"，未全站逐条核验每条医学断言是否都标了来源版本/未核实。
10. **修复方三套检查器（`scripts/probe-*.py`、`check-prototype.mjs`）**：按委托要求未采信、也未逐条复跑，其结论不在本报告任何一处作为依据。

---

## 附：复核方法与可复现性

- 服务：`python3 -m http.server 8991 --bind 127.0.0.1`，cwd = `prototypes/v0.2`；打开前校验 `<title>`。
- 浏览器：本机 Chrome，Playwright `channel="chrome"`，`viewport 1280×900`（窄宽用例另设 1440/1024/800/420）。
- 断言口径：**产物变化**（行数 / 聚合金额 / 图表 SVG 重绘 / 导出文本分块计数 / hash 变化），不是 DOM 里有没有某字符串。
- 打印口径：`emulate_media(media="print")` → `page.pdf(format="A4")` → pypdf 读页数；另做"注入解除高度/溢出规则"的对照实验定位根因。
- 探针全部自写，置于 `/tmp`（`common.py` / `audit.py` / `final_census.py` / `printfix.py` / `ip6.py` 等），未写入仓库。
- 主 harness 结果：`total=62, fail=5`，失败 5 条即 §3 中列出的 P0-1×2、X2-S7、X2-S9、X3-IP6。
