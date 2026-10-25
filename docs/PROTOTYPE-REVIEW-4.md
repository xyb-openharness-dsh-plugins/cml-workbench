# 第四轮独立评审（PROTOTYPE-REVIEW-4）

- 评审对象：`/Users/sammini/Downloads/cml-workbench`，原型 `prototypes/v0.2/`
- 评审人：独立评审员，**未参与构建**
- 评审立场：挑错；所有结论只来自本机实测（Playwright `channel="chrome"` / `file://` 直开 / `shasum` / `node` 检查器 / 源码逐行阅读），**不采信任何自述**
- 本轮新增三项能力（此前无人独立评审）：指标卡（分系列·翻面）、一图秀 `#onechart`、临床试验 `#trial` 重做
- 判据：24 号 `24-METRIC-TREND-TAB-DESIGN.md`、16 号 `16-ONE-CHART-SPEC.md`、27 号 `27-TRACKS-AND-METRIC-CARDS.md`、`MATCHING-SPEC.md`

---

## §0 冻结哈希核对

### 0.1 评审起点（git HEAD `ddcbd46`，我自己算的）

| 文件 | 我算的 sha256 前 8 | 行数 | `docs/PROTOTYPE-FIXES.md` 头部表 | 文末表 | 一致？ |
|---|---|---|---|---|---|
| `prototypes/v0.2/app.js` | `e53cbfeb` | 2726 | `e53cbfeb` 2726 | `e53cbfeb` 2726 | ✅ |
| `prototypes/v0.2/index.html` | `3e2fcbbc` | 299 | `3e2fcbbc` 299 | `3e2fcbbc` 299 | ✅ |
| `prototypes/v0.2/style.css` | `4d7f33bc` | 406 | `4d7f33bc` 406 | `4d7f33bc` 406 | ✅ |
| `prototypes/v0.2/demo-data.js` | `d4fbc2b1` | 2（34046 B） | `d4fbc2b1` 2 行 34046 B | 同 | ✅ |

结论：**四处指纹与两处声称表全部对得上，两表彼此也一致**。哈希这一关在 `ddcbd46` 是通过的。

### 0.2 评审期间发生的文件变动（必须记录）

评审进行中构建方提交了 4 个 commit（`7235167` / `418cf56` / `cfd2f89` / `4ea3706`）。我复算当前工作树：

| 文件 | 当前 sha256 前 8 | 行数 | 相对 `ddcbd46` |
|---|---|---|---|
| `app.js` | `e53cbfeb` | 2726 | **未变** |
| `style.css` | `4d7f33bc` | 406 | **未变** |
| `demo-data.js` | `d4fbc2b1` | 2 | **未变** |
| `index.html` | `99f9b62e` | **300** | **变了**（原 `3e2fcbbc` / 299） |

`prototypes/` 的实际净变化只有 1 处 hunk：`index.html` 打印相关注释块被替换为「按路由实测 `#mol` A 9 页 922,333B / B 8 页 902,261B；`#dash` 3 页、`#trial` 4 页、`#onechart` 1 页」这一段。`docs/PROTOTYPE-FIXES.md` 两处指纹表已随之更新为 `99f9b62e` 300。

**对本报告的影响**：所有行为类结论都测在 `app.js e53cbfeb` 上，该文件全程未变，**结论不受影响**。§0.1 与 §0.2 两个快照都在此并列，读者可自行复核。

### 0.3 冻结哈希里发现的缺陷（本轮新证据）

| 声称 | 位置 | 实测 | 判定 |
|---|---|---|---|
| 「当前 sha256 前 8 = `1d38e5e2`（与 docs/PROTOTYPE-FIXES.md 的指纹表一致）」 | `prototypes/v0.2/index.html:236` | 实物 `d4fbc2b1`，34046 B | **假**（见 §7 P1-7） |
| 「重新生成 demo-data.js（sha256 现 `1d38e5e2…`，js_bytes 16574）」 | `docs/PROTOTYPE-FIXES.md:61` | 实物 `d4fbc2b1`，34046 B | **假**（同上一条，同一处陈旧残留） |

第三轮 `PROTOTYPE-REVIEW-3.md`（:19 / :22）记录 `1d38e5e2` 当时**是对的**，本轮已重新生成数据却只更新了表、没更新正文与自检 ⇒ **同类陈述错误复发**。

> 说明：`index.html` 自检清单整体位于 `<!--` 注释块内（起于 `:168` `=== M2 原型自查清单 ===`），**不是用户可见页面文案**。因此这些假陈述按「声明与实现矛盾 / 记录失真」计，不按「判读词出现在页面上」计。

---

## §1 指标卡（对照 24 号 / 27 号）

入口：`#mol` → `[data-act='mol-tab'][data-v='cards']`，viewport 1440×900。

### 1.1 类别分组 —— 通过

实测 4 个 `.mcard-grid`，7 张 `.mcard`，类别标题逐字如下：

```
分子学反应（BCR::ABL1） 1 项 · 有记录 1 项
血象（血常规）        4 项 · 有记录 4 项
副作用（按药归属）     1 项 · 有记录 1 项
费用（月自付）        1 项 · 有记录 1 项
```

- 格式 = 类别名 + 项数 + 有记录项数 ✅（24 号 §2）
- 两个计数**不是同一个数**：我用运行时注入把 2 个无点指标塞进 `window.DEMO_DATA.metrics.A` 后重渲染，标题变成 `血象（血常规） 6 项 · 有记录 5 项`，证明头部是分别算的、不是复制同一个数。
- **唯一数据源确认**：`window.DEMO_DATA.categoryOrder.map(c=>c.cat)` = `["分子学","血象","副作用","费用"]`，该表由 `demo/build-demo-data.mjs` 的 `CATEGORY_ORDER` 导出；页面侧只有 `catOrder()`（`prototypes/v0.2/app.js:1718`）读它。我在 `app.js` 全文搜索未发现第二处硬编码分组。✅（24 号 §2「唯一 metricCatalog/categoryOrder」）

### 1.2 3D 合同 —— 数值全中

第 0 张卡 computed style 实测：

| 合同项 | 24号/27号 要求 | 实测 | 结论 |
|---|---|---|---|
| 外卡高 | 276px | `276px`（rect h = 276） | ✅ |
| 圆角 | 18px | `18px` | ✅ |
| 内边距 | 20px | `20px` | ✅ |
| 卡间距 | 16px | `gap: 16px` | ✅ |
| perspective | 1100px，在外卡 | 外卡 `perspective: 1100px` | ✅ |
| preserve-3d | 在内层 | `.mcard-inner` `transform-style: preserve-3d` | ✅ |
| 两面定位 | `inset: 0` | `.mface` `position: absolute` + `inset: 0px` | ✅ |
| 背面遮挡 | `backface-visibility: hidden` | `hidden`（双面） | ✅ |
| 过渡 | 480ms `cubic-bezier(.2,.7,.2,1)` | `transform 0.48s cubic-bezier(0.2, 0.7, 0.2, 1)` | ✅ |
| 字号 | 数字≈33 / 名 15 / 正文 12.5 | `.mval 33px` / `.mname 15px` / `.eyebrow 12.5px` / `.mmeta 12.5px` | ✅ |

### 1.3 翻转行为 —— 通过

- 翻转前后 rect 完全一致：`[x 164, y 500, w 366, h 276]` → `[164, 500, 366, 276]`，**逐项相同**。
- `scrollY 0 → 0`，`documentHeight 900 → 900 → 900`（翻转中、翻回后都不变）✅（24 号 MT07）
- 内层 transform 含矩阵：过渡 120ms 采样到 `matrix3d(-0.62925, 0, -0.777203, 0, 0, 1, 0, 0, 0.777203, 0, -0.62925, 0, 0, 0, 0, 1)` ⇒ 真 3D，不是高度动画 ✅
- 单卡翻面时其余卡 `aria-pressed` 保持 `false`：`["true","false","false","false","false","false","false"]` ✅
- 再点回正面：class `mcard → mcard flipped → mcard`，`aria-pressed false → true → false` ✅
- 键盘：Enter 翻面、Space 翻回 ✅（24 号 MT08）

### 1.4 不重渲染 —— 通过

点击前后 `isSameNode` = `true`（同一 DOM 节点），状态只体现在 `class` 与 `aria-pressed`；没有 `render()` 重建。✅（27 号 §3「点击只改属性不重绘」）

### 1.5 六段信息层级 —— 通过（7/7 张卡）

正面顺序逐字实测（A 档案第 0 张）：

```
分子学 | BCR::ABL1（IS%） | 0.086IS% | 较前次 ↓ 1.034 IS%（2026-07-18 同实验室同标准化）
| 已记录 5 次 · 最近采样 2026-10-12 · 省血液病医院 | 点卡片翻面看历次记录
```

即 ①类别眉题 ②指标名 ③最近值+单位 ④与前次比较（含可比性限定） ⑤覆盖 ⑥来源与交互提示 ✅（24 号 §3）

### 1.6 无记录 / 单点文案 —— 合同在位，但出厂数据未触达

- 源码在位：`app.js:1739` `<span class="mval mnone">还没有记录</span>`、`:1748` `暂无可比较的前次记录`、`:1766` 背面同文案。
- 注入验证（运行时改内存，不改文件）：空指标正面 = `血象 | ZZZ空指标 | 还没有记录 | 还没有可用于比对的记录`；单点指标正面 = `1.23mg | 暂无可比较的前次记录 | 已记录 1 次`，背面 = `暂无可比较的前次记录（只有 1 次记录，不连线）`。**没有把无记录显示成 0** ✅
- 但 A、B 两档案 7 个指标**每个都 ≥1 个数值点**，所以出厂状态下这两条文案**一次也不会出现**。这不是缺陷，是「数据没覆盖到文案分支」，记入 §9。

### 1.7 隐藏面 a11y —— 通过

- 未翻面的卡：`back[aria-hidden="true"][inert]`，front 不带 inert；翻面后**正好相反**。
- 连按 60 次 Tab：`tab_into_hidden = []`，`backFaceFocusableCount = 0` ⇒ **Tab 停不到看不见的一面** ✅（24 号 §5）
- 每卡 `role="group"` + `tabindex="0"` + 完整 `aria-label`（`BCR::ABL1（IS%），点一次翻面看历次记录，再点返回`）✅

### 1.8 prefers-reduced-motion —— 通过

`transitionDuration: "0s"`、`transitionProperty: "none"`；点击后 +50ms transform 已是终态 `matrix3d(-1,0,0,0, 0,1,0,0, 0,0,-1,0, 0,0,0,1)` ⇒ **直接切终态、无旋转过程** ✅（27 号 §6）

### 1.9 三档宽度 —— 通过

| viewport | 列宽实测 | 列数 | 卡高 | 溢出 |
|---|---|---|---|---|
| 1440 | `366px 366px` | **2** | 276 | 无 |
| 1080 | `249px 249px` | **2** | 276 | 无 |
| 960 | `210px 210px` | 2 | 276 | 无 |
| 860 | `399px` | **1** | 276 | 无 |
| 700 / 620 / 390 | 单列 | 1 | 276 | 无 |

每个宽度都验了 `body.scrollWidth === innerWidth === documentElement.scrollWidth` ⇒ **1440/1080/860 = 2/2/1、卡高恒 276、无横向溢出，全部满足** ✅（27 号 §4.3）
没有出现三列（27 号 §4.1）✅

### 1.10 加总类词 —— 通过

A/B 两档案分别检查 `总分 / 综合评分 / 健康指数 / 综合指数 / 健康评分 / 综合得分`：**全部 false（0 命中）** ✅（27 号 §6）

### 1.11 指标卡唯一的实质缺陷：翻面状态跨档案串档

**见 §7 P0-4。** 其余项全部通过。

---

## §2 一图秀（对照 16 号 R1–R12）

### 2.1 这一节的总判断先说

**一图秀的核心产物——那条「归一化叠看曲线」——在任何状态下都没有被画出来。** 页面上只有散点，没有折线。

DOM 直接证据（默认 `pcr + wbc`）：

```html
<path class="series-line" data-key="pcr" d="" fill="none" stroke="#2f6f66" stroke-width="1.8"></path>
<path class="series-line" data-key="wbc" d="" fill="none" stroke="#2f6f66" stroke-width="1.8"></path>
```

- 两条 path `getTotalLength() = 0`、`getBBox() = 0×0`
- 逐条换了 `pcr / wbc / anc / hgb / plt / ae / cost` 全部指标、`all / 12m / 6m` 全部窗口、A/B 两档案：**每一个 `path.series-line` 的 `d` 长度都是 0**
- 选满 4 条线时：`paths: [0, 0, 0, 0]`

**根因（已定位到行）**：`smoothPath` 期待对象数组，调用方给了数组下标。

- `prototypes/v0.2/app.js:444-472` `function smoothPath(points) { var p = (points || []).filter(function (o) { return o && isFinite(o.x) && isFinite(o.y); }); … }`
- 一图秀调用方 `prototypes/v0.2/app.js:1969-1970` 传的是**数组**：`smoothPath(seg.pts.map(function (q) { return [sx(q.d), sy(q.v)]; }))`
  → 数组没有 `.x` / `.y` → 全部被 `filter` 掉 → 返回 `''`

**对照组（证明是这个 bug，不是我的探针问题）**：分子线趋势页传的是**对象**——`app.js:594` `var screen = seg.pts.map(function (p) { return { x: x(p.d), y: yOf(p.v) }; });`，它渲染出的 `path.line` 的 `d` 长度 **92**、`getTotalLength() 325`、`bbox 275×146`、5 个点。同一份数据、同一个函数，对象进得去就画得出来。

**同一 bug 也打穿了指标卡背面**：`app.js:1795-1797` `var xy = seg.pts.map(function (q) { return [sx(t(q.d)), sy(Number(q.v))]; }); return '<path d="' + smoothPath(xy) + '"…` 同样传数组 → 每张卡背面 `.mini-chart` 的 path 均 `d 长度 0 / totalLength 0 / bbox 0×0`（圆点正常：5、11、11、11…）。

→ 这是 §7 **P0-1**。

### 2.2 R7 指标选择窗口 —— 大部分通过

| 检查 | 实测 | 结论 |
|---|---|---|
| 按类别分组 | 4 组：分子学反应（BCR::ABL1）/ 血象（血常规）/ 副作用（按药归属）/ 费用（月自付） | ✅ |
| 独立滚动容器 | `.metric-list` `max-height: 300px` + `overflow-y: auto`，`scrollHeight 391 > clientHeight 298` | ✅ |
| ≤4 条 | 摘要显示 `已选 2/4`；选满后第 5 个点击**不生效**（计数仍 4） | ✅ |
| 第 5 条被拒**有明确提示** | 提示语写入 `#aiHint`：`最多同时看 4 条线：先去一条再选新的。`，但该提示位于会话侧栏（`ASIDE.session`）；**侧栏收起时 rect 为 w=0 h=0，用户看不到任何反馈** | ⚠ 见 §7 P1-2 |
| `<details>` 默认收起 | `open: false` | ✅ |
| 能展开 | 点 summary 后可见 | ✅ |
| 每项显示最新值 | `分子学反应（BCR::ABL1） BCR::ABL1（IS%） 0.086 IS%` / `血象（血常规） 白细胞 5.0 10⁹/L …` | ✅ |

### 2.3 R1 归一化 + 不可比说明

- **独立归一化：形式上做到了，基准取错**——每条线用**自己窗口内首点**作基准，见 §7 P0-3。
- **不可比说明是否「图上真实可见」**：
  - A 档案选 `pcr` 时 `#chart-panel .note` **有**内容（外院 `is_std=0` 记录触发了 `segmentsOf` 的 gap）✅
  - **B 档案：`.note` = `[]`（空）**。B 的 pcr 是单实验室单单位，客观无 gap，页面不显示说明是**符合规范**的；但 `index.html:274` 声称「B 档案同样命中」为假 → §7 P1-10。
  - 「不可比处是否真的断开而不是跨组连线」：`segmentsOf`（`app.js:476-489`）的 gap 判定逻辑正确，但因为**一条线都没画出来**，这句话在当前实现下**空转**——无所谓断开，因为没有线。

### 2.4 R2 单点不连线 / 空窗口空态

- **单点不连线**：代码路径存在（`pts.length < 2` 不输出 path）。当前出厂数据下**每个指标在每个窗口都 ≥2 点**，无法实测触发。
- **空窗口空态**：`app.js:1935` `var allEmpty = ms.every(function (m) { return !(m.points || []).length; });` 判的是**该指标全部记录**为空，而 16 号 R2 要求「**窗口内**没数据 → 空态」。当前数据跨度下触发不了。

> 对构建方「待修 B」的独立判断：**这是潜伏逻辑错误，定 P1，不升 P0**。理由是它今天不产生任何患者可见的错误结论（没有把无数据画成 0），但它确实**没有实现 R2 描述的那个分支**；一旦档案时间跨度变短（例如只导入近半年的记录），它会在应当给空态时给出一张只有坐标轴的空图。与 P0-3（基准取窗口内首点）是同一个「窗口语义」错位的两面，建议一起修。

### 2.5 R3 治疗条 —— **违反**

关掉/打开治疗条后，**每个数据点的 `cy` 都变了**（不是我要的「完全不变」）：

| 序列 | 日期 | 治疗条关 | 治疗条开 |
|---|---|---|---|
| pcr | 2026-04-20 | cy 184.6 | 202.4 |
| pcr | 2026-07-18 | cy 218.7 | 240.4 |
| pcr | 2026-10-12 | cy 222.0 | 244.0 |
| wbc | … | 137.3 | 149.9 |

根因：`prototypes/v0.2/app.js:1945` `var plotH = H - padT - padB - (treated ? 22 : 0);` —— 治疗条占位直接**压缩绘图区高度**，所有 y 坐标随之缩放。

`d` 属性「逐条不变」这句话在字面上成立，**只因为两条 `d` 永远是空字符串**。`index.html:270` 写「治疗条与数据区分层——关掉治疗条后曲线 d 属性逐条不变（实测 True）」是一句被空字符串骗过的自证。→ §7 **P0-2**。

### 2.6 R4 末点标注 —— 通过

- 只标末点、首点不标 ✅
- 末点 x=620 距右边界 <46px ⇒ `text-anchor="end"` ✅
- 多序列错开：`s2.idx % 2 ? 12 : -4`，实测 y 偏移 218 / 201.03 / 181.90 / 36 ✅

### 2.7 R10 390px —— 通过

- `innerWidth 390` / `documentElement.scrollWidth 390` / `body.scrollWidth 390` ⇒ **相等，页面无横向溢出** ✅
- 横滚只发生在 `.chart-wrap`：`scrollWidth 568 / clientWidth 346 / overflow-x auto` ✅
- 展开 `<details>` 后 `docSW` 仍为 390 ✅

### 2.8 R12 无障碍 —— 通过（数量声称不准）

- `svg` 有 `role="img"` + `aria-label="选中的 2 条指标归一化叠看曲线"` ✅
- 每个点都有 `<title>`（指标/日期/值/单位）✅ —— 默认 2 条线共 16 个 `<title>`，选满 4 条共 **38** 个
- 但 `index.html:271` 声称「26 个」：**两个真实状态（16 / 38）都不是 26**，该数字无法复现 → §7 P2-1

### 2.9 只重绘面板 —— 通过

切换指标/时间窗/图层后 `#chart-panel` 节点同一性保持（`samePanel: true`）；内部 `svg` 重建（`sameSvg: false`）——16 号 §5 把重绘范围定在「图表容器」，容器级重建符合口径 ✅

### 2.10 判读词与加总 —— 通过

- 11 页 × A/B 全量 `document.body.innerText` 扫描：`达标/未达标/可以停药/建议停药/无需就医/治愈率/总分/综合评分/健康指数/综合指数/健康评分/综合得分` **全部 0 命中**
- 一图秀页唯一命中「加总」的地方是**否定句**：`本图不做加总，也不给整体评级` ⇒ 不是违规，是规范要求的显式声明 ✅

### 2.11 一图秀的额外缺陷：分类指标被画成数值序列

把 `副作用记录`（`kind: 'qual'`）单独选中时：

- 图例：`副作用记录（基线 NaN · 全期口径）` —— **`NaN` 直接漏到用户可见文案**
- 4 个圆点 `cy` 全部 `24.0`（绘图区最顶端，视觉上等于「最高/最差」）

违反 27 号 §1 四硬约束之「分类变量只画节点」，也违反 `app.js:1717` 自己的注释与 `demo-data.js` 里 `kind:'qual'` 的声明。→ §7 **P0-5**。

---

## §3 临床试验（对照 MATCHING-SPEC）

### 3.1 完整度 —— 通过

| 档案 | 页面显示 | 我数数据 | 结论 |
|---|---|---|---|
| A | `完整度 14/18` | 18 个字段、14 个 `present: true`、7 组 | ✅ 属实 |
| B | `完整度 13/18` | 18 / 13 / 7 | ✅ 属实 |

- 18 个字段、7 组（基本 / 基因分子 / 病理 / 治疗史 / 体能 / 器官功能 / 其他）**属实**。
- 缺失字段**被逐条列出**：A = `确诊日期 · 激酶区突变 · ECOG 体能评分 · 心电图 QTc`；B 再加 `脂肪酶 / 淀粉酶`（5 个）。与我从 `demo-data.js` 解析出的 `present:false` 集合**完全一致**。
- 页面明写：`完整度是"本档案有记录的字段数 / 本页会用到的字段数"，不是分数、不是匹配度` ✅

### 3.2 铁律：缺失 → 永远「无法判定」 —— 通过（行为级验证）

`demo/build-demo-data.mjs:321-330`：

```js
function evalRule(rule, prof) {
  const get = (k) => (prof.filter((f) => f.k === k && f.present)[0] || {}).v;
  const tier = (v) => {
    if (v === undefined || v === null || v === '') return 'undetermined';
    return rule.test(v) ? 'satisfied' : 'conflict';
  };
```

配合 `demo/build-demo-data.mjs:286,318` 的 `has = (v) => v !== undefined && v !== null && v !== '' && v !== 'unknown'` 与 `present: has(f.v)`：

- 缺失字段取到 `undefined` 或空串 → **只能落进 `undetermined`**；`conflict` 需要 `test(v)` 为 false，`satisfied` 需要 `test(v)` 为 true，二者都需要一个真实值 ⇒ **结构上不可能流向「已满足」** ✅
- 实测数据吻合：A 的 3 条 `无法判定` 全部是 `你的记录：（本档案无此记录）`（ECOG / QTc / T315I），没有一条缺失项出现在 `已满足` 里。
- 页面还有一句显式承诺：`这些条件一律判「无法判定」，不会因为没记录就算满足。` ✅

### 3.3 三档只有三种 —— 通过

`tier()` 只有 `undetermined` / `satisfied` / `conflict` 三个返回值；实测量到的 tier 集合 = `{satisfied, undetermined, conflict}`，无第四种。✅

### 3.4 汇总行与页脚 —— 通过（除档案 rev，见 3.8）

- 汇总：`已满足 7 项 · 可能冲突 0 项 · 无法判定 3 项 · 待确认规则 1 项（汇总只计数，不给匹配度）` —— **只计数、无百分比、无 0–100 分** ✅
- 页脚：`排序按数据来源顺序，不按匹配度（按匹配度排序等于给推荐）。判定是确定性规则求值：同一份档案 + 同一版规则 = 同一结果，不由模型现算。` ✅
- 评估元信息：`规则集 cml-rules-2026.10-1` + `评估生成 2026-10-25` ✅ —— **但缺「档案 rev」**，见 3.8。

### 3.5 §4.4 表达约束 —— 通过（但有口径细节必须说清）

`#trial` 页 A/B 两档案的命中统计：

| 词 | 命中 | 是否违规 |
|---|---|---|
| `匹配度` | 5 | ❌不违规——5 处**全部在否定句里**：`无匹配度百分比` / `不是分数、不是匹配度` / `（汇总只计数，不给匹配度）` / `排序按数据来源顺序，不按匹配度` |
| `推荐` | 1 | ❌不违规——`（按匹配度排序等于给推荐）`，是在解释**为什么不做** |
| `按匹配度排序` | 1 | ❌不违规——同一句否定 |
| `高匹配` / `最适合` / `不符合条件` / `符合入组条件` | **0** | ✅ |
| 绿/红给试验排名 | 无（`redOrGreenColors: []`） | ✅ |

MATCHING-SPEC §4.4 自己推荐的正是「用『无已知冲突』代替『高匹配』」，因此**用被禁词去否定被禁行为**是合规写法，不能算违规。**但这条口径给检查器留了太大口子，见 §5.3 与 §7 P1-8。**

### 3.6 渠道覆盖 —— 通过

`本次检索覆盖 1/1 个渠道（演示渠道 · 就绪）· 未参与：ICTRP（未配置）· ChiCTR 在线（未配置）· chinadrugtrials（未配置）· 小胰宝归档（本癌种无覆盖）`

- 未就绪渠道显示为**「未参与」**而不是「没有试验」✅（§5）
- 4 条试验逐条带 `【演示虚构】` 前缀，且有一段总声明 `以下为演示虚构条目，不是真实临床试验信息；M4 接入 unified-trial-mcp 后整体替换。登记 ≠ 有效 ≠ 安全 ≠ 可入组。` ✅（产物诚实）

### 3.7 待确认规则（pending）—— 通过

- 单列在 `待确认规则（1）` 块里，**不计入三档**（三档合计 7+0+3 = 10 条 judged，pending 1 条独立）
- 并写明 `这些条件原文没能结构化，不参与上面对比，需要你或医生对着原文确认。` ✅（§3.4）

### 3.8 数据层交叉核对 —— 数字属实，元信息缺一项

从 `prototypes/v0.2/demo-data.js` 解析出的 match 块：

| | A | B |
|---|---|---|
| `done` / `conflict` / `undetermined` / `pending` | 7 / 0 / 3 / 1 | 5 / 1 / 4 / 1 |
| tier 计数 | satisfied 7, undetermined 3 | satisfied 5, undetermined 4, conflict 1 |
| `profileRevision` | `demo-v0.2` | `demo-v0.2` |
| `ruleSetVersion` | `cml-rules-2026.10-1` | 同 |
| `generatedAt` | `2026-10-25` | 同 |

页面数字与数据数字**逐项相等** ✅（B 的 conflict 项为 `ALT 62 U/L 高于参考上限`，与数据一致）

**但**：`profileRevision` 在页面中**完全没有渲染**——`document.body.innerText.includes('demo-v0.2')` = **false**，正则 `/档案\s*rev/i` 也 false。MATCHING-SPEC §4.5 要求「每次分析记录 profileRevision / ruleSetVersion / 逐条判定」，当前只做到 2/3，且没有「档案已更新，建议重新评估」横幅 → §7 **P1-3**。

### 3.9 「CML 不做 IHC 标志物筛选」这个取舍 —— **我认为合理，且已说明理由，不是缺陷**

- 页面原文：`CML 的入组条件看的是分期、转录本类型、激酶区突变、既往 TKI 线数与器官功能；本页不做 IHC 标志物筛选（IHC 是实体瘤的分型工具，不适用于 CML）。`
- 构建器也有说明：`demo/build-demo-data.mjs:282` `**不做 IHC 标志物筛选**（IHC 是实体瘤的分型工具）。本文件不把 IHC 塞进 CML 目录。`
- 自检也记了一条：`index.html:279`

**判断依据（不是接受自述，是临床轴线的替换是否成立）**：CML 的分型/预后轴是 `BCR::ABL1` 转录本类型（e14a2 等）、激酶区突变、细胞遗传学（Ph 染色体/附加异常）、TKI 线数、器官功能；IHC 主要是实体瘤的蛋白表达分型。本页把这些轴都换成了上面这组，而不是把 IHC「漏掉」。**同一份理由在三处（数据层、页面、自检）都写了**，属于可复核的取舍说明。

⇒ 这个取舍**成立**，不记缺陷。

---

## §4 上轮（第三轮）两个 P0 复验

### 4.1 P0-R1 跨档案泄漏 —— **已修**

**（a）`tfrOut` / 门诊原话导出不再串档**

| 步骤 | 实测 |
|---|---|
| A 档案导出 `[data-act='tfr-export']` | 20 行；`【门诊原话（带来源）】` 下有 2 条：`白细胞和血小板都低了，先减到 300mg 观察`（来源 血液科门诊 2026-05-08 · 文件 A-D3）、`胸腔积液考虑和伊马替尼无关，换达沙替尼，先用 50mg`（来源 2026-08-15 · 文件 A-D5） |
| 切到 B | `#tfrOut` 重置为 `（尚未导出）` |
| B 导出 | 20 行；2 条**B 自己的**原话（`伊马替尼皮疹腹泻不耐受，换尼洛替尼…` 文件 B-D2；`DMR 超过 2 年、TKI 用了 6 年…` 文件 B-D5），**无一条 A 的话** |
| 切回 A 再导出 | 又是 A 的两条，无 B 混入 |

⇒ 无跨档混入，切换时清空 ✅

**（b）生育问题清单按档案分桶 —— 已修**

- 状态：`state.fertQByProfile: { A: [], B: [] }`（`app.js:59`）
- 读：`app.js:1582` `(state.fertQByProfile[state.profile] || []).map(...)`；导出也走同一桶（`app.js:699`）
- 写：`app.js:2524` `state.fertQByProfile[state.profile] = (… || []).concat([v]);`
- 删：`app.js:2532` 同一桶 filter
- 实测：在 A 输入 `AAA_ONLY_QUESTION` 并加入 → A 列表可见；切到 B → `B_has_marker: false`，B 只显示它自己的 3 条（生育意愿 / 医生谈过什么 / 下次可以问什么，记录者 家属代记）；切回 A → 标记仍在 A 桶里

⇒ **P0-R1 的机制已正确修复。** 但同一类「状态没按档案分桶」的错误**在新能力里又出现了一次**（指标卡翻面），见 §7 P0-4。

### 4.2 P0-R2 S7 导出「门诊原话」 —— **已修**

第三轮 A、B 均为 0 条，本轮 A 2 条、B 2 条，且各自带来源与文件号（见 4.1(a) 表格）。
⇒ **P0-R2 已修复，产物有内容且来源可追。**

---

## §5 回归

### 5.1 打印（Chrome `page.pdf(format="A4", print_background=True)`，页数用 pypdf 数）

| 路由 | A | B |
|---|---|---|
| `#dash` | **3 页 / 615,253 B** | 3 页 / 610,607 B |
| `#mol` | **9 页 / 922,333 B**（6,116 字） | **8 页 / 902,261 B**（5,590 字） |
| `#onechart` | 1 页 / 260,377 B | 1 页 / 255,695 B |
| `#trial` | 4 页 / 615,528 B（2,547 字，第 4 页 0 字） | 4 页 / 612,887 B |

- **结论：没有退回 1 页。** 第三轮记的「A 9 页 / B 8 页」是 `#mol` 的页数，本轮逐字节复现（922,333 B / 902,261 B），加了三个新能力后打印能力未退化 ✅
- `index.html:289` 这段自检数字与我的实测**逐字节吻合**（含 `#dash` 3 页 / `#trial` 4 页 / `#onechart` 1 页）⇒ 该处自检属实
- 一处小瑕疵：`#trial` 的 A 档 4 页中第 4 页正文 0 字（尾页空白）→ §7 P2-2

### 5.2 五个检查器我自己跑的结果

| 检查器 | 结果 |
|---|---|
| `node scripts/check-prototype.mjs` | **pass，fails: []**（27 条 ok，含 `wording: 禁词 0 命中`、`matching/expressions`、`matching/ironlaw`、`color/judgement`、`chart/root: 6 次`） |
| `node scripts/check-demo-data.mjs` | `{"ok":true,"fails":[]}` |
| `python3 scripts/probe-page-view.py` | `pass: true`；`banned_words_rendered: []`；`quotes_without_src_total: 0` |
| `python3 scripts/probe-ip-matrix.py` | `pass: true`；`pages: 11`；X1 `orphans_by_link: []` / `orphans_by_scenario_path: []`；X2 `captions_reachable: 14`；X3 `pages_with_more` 10 页 / `forms_over_6: []`；X4 `assertions: 30, failures: 0` |
| `python3 scripts/probe-write-paths.py` | `pass: true`；`failures: []`；`W6 hits: []` |

### 5.3 **检查器全绿，但有三条口径是错的（这是缺陷，不是绿就是好）**

**口径错误 1 — `chart/root` 用源码字符串计数，且把错误数字锁死成合同**

`scripts/check-prototype.mjs:126` 数的是**源码文本**里 `class="chart` 出现次数并断言 `6`。我自己数：

- `grep -o 'class="chart' prototypes/v0.2/app.js | wc -l` = **9**（含 `chart` 前缀匹配的一批）
- **真实渲染**的 `svg.chart`：`dash` 1、`mol` 1、`onechart` 1、`cost` 1，其余 0 ⇒ 每档案 **4** 个，A+B 共 **8** 个

也就是说检查器里的 `6` 和 `index.html:210` 自检里的 `6` 是**同一个陈旧数字**，而检查器正在**为一条假自检背书**。加了一图秀之后正确值是 8（构建方已在 `7235167` 把需求文档表改成 8，但原型自检注释与检查器没跟上）。→ §7 P1-6

**口径错误 2 — `matching/expressions` 的否定语境放行，永远抓不到 `不符合条件`**

规则：`negCtx = /(不给|不是|不按|不输出|无|不提供|不写|不做)[^。；\n]{0,20}$/`，用来测试禁词**前 28 个字符**。

- `不符合条件` 这个词**自己就含「不」**，所以 `negCtx` 可以匹配它自己的前缀 ⇒ 这条 MATCHING-SPEC §4.4 里最危险的一句**在结构上不可能被这个检查器抓到**
- 同理 `推荐` 只在 `/(首选|建议|强烈)?推荐[^。；\n]{0,10}/` 命中后又被同一个 `negCtx` 过滤，于是「……不推荐盲目换药，但推荐这家试验」这种句子会溜过

我自己的独立扫描证实**当前页面是干净的**（`高匹配/最适合/不符合条件/符合入组条件` = 0），所以这不是产物缺陷，但**这条断言不能当证据用**。→ §7 P1-8

**口径错误 3 — `matching/ironlaw` 是文本存在性检查，不是行为检查**

它取 `demo/build-demo-data.mjs` 里 `const tier =` 之后 300 字符，断言同时出现 `/(undefined|null|''|"")/` 与 `/undetermined/`。只要这两个词出现在那 300 字符窗口内就算过——即使实际执行路径是 `undefined → 'satisfied'`。绿 ≠ 铁律被强制。→ §7 P1-9

（我自己的铁律验证不靠这个检查器：直接读 `tier()` 的返回分支 + 核对 A 档 3 条缺字段全部落在「无法判定」且 `你的记录：（本档案无此记录）`，见 §3.2。）

### 5.4 其它回归面

- 字体：正文 12.5 / 13 / 15 全部在 12.5–15（豁免 `.mval 33px`）✅
- 折叠块默认收起：`foldout/open: 默认全部收起` ✅
- AI 入口覆盖 8 页：`prep,dash,mol,med,ae,cost,docs,trial`；TFR/生育**无** AI 生成入口 ✅（这两页禁止 AI 下结论）
- 写入路径 `probe-write-paths` 全绿，`W6 hits: []` ✅

---

## §6 X1–X4 四轴

### X1 页面覆盖 / 孤儿页

- 一级页 **11 条路由**：`dash, mol, onechart, med, ae, tfr, cost, fert, prep, docs, trial`
- 孤儿页：**按链接可达 `[]`、按场景路径可达 `[]`**（两条判据都空）
- `#onechart` 作为新一级页已接入导航与场景路径（`captions_reachable: 14` 个入口说明全部可达）

⇒ X1 = **11/11，孤儿 0**

### X2 产物可观察

| 产物 | 可观察？ | 证据 |
|---|---|---|
| S7 门诊原话导出 | ✅ **已修** | A 2 条 / B 2 条，带来源与文件号（§4.1） |
| mol 更正版本链 | ✅ | 更正后 `#molWriteMsg` 渲染 `已建立更正版本链：…`（`app.js:1182`） |
| docs 更正后的新值 | ❌ **不可观察** | 见 §7 P1-4 |
| 指标卡翻面状态 | ✅ | class + aria，可见 |

⇒ X2 = **4 个产物中 3 个可观察，1 个（docs 更正）不可观察**

### X3 显式编辑入口每页 ≤1

按 `docs/INTERACTION-DESIGN.md` 的口径（顶层 `data-act` ∈ `*-new/-manual/-pick/-qadd` 且处理函数**不跳页**，排除 `details.more`）逐页实测：

| 页 | 计数 | 说明 |
|---|---|---|
| dash | 3（`mol-new` / `ae-new` / `cost-new`） | **全部是跨页跳转**：`app.js:2463` `if (act === 'mol-new') { goto('mol'); focusFirst('#f-v'); return; }`、`:2472` `ae-new` 同理 ⇒ 按口径排除 |
| onechart | 1（`one-pick`） | |
| ae | 1（`ae-new`） | |
| cost | 1（`cost-new`） | |
| fert | 1（`fert-qadd`） | |
| docs | 1（`docs-pick`） | |
| mol / med / tfr / prep / trial | 0 | |

⇒ X3 = **超限页 0 / 11**（`forms: []`、`forms_over_6: []`）

### X4 一致性

- 检查器侧：`assertions: 30, failures: 0`
- **我自己的一致性核对抓到 4 处矛盾**（都属于「声明 vs 实现」）：

| # | 声称 | 实际 | 位置 |
|---|---|---|---|
| 1 | demo-data sha256 = `1d38e5e2` / 16574 B | `d4fbc2b1` / 34046 B | `index.html:236`、`docs/PROTOTYPE-FIXES.md:61` |
| 2 | 图表 SVG 数 = 6（A/B 各 3） | 每档案 4，共 8 | `index.html:210` |
| 3 | 每点 `<title>` = 26 个 | 2 条线 16 个 / 4 条线 38 个 | `index.html:271` |
| 4 | R1 不可比说明「B 档案同样命中」 | B 实测 `.note = []` | `index.html:274` |

⇒ X4 = **30 条断言全过，但 4 处自述与实物不一致**；一致性判据不能只看断言数。

---

## §7 缺陷清单

分级口径：**P0 = 阻断签 G2**（患者安全红线 / 声明与实现矛盾 / 规范硬合同不满足 / 数据串档 / 产物虚假）。

### P0（阻断签 G2）—— 共 5 条

---

#### P0-1　一图秀的叠看曲线与指标卡背面的迷你折线**一条都没画出来**

**现象（实测）**
- 一图秀 `#chart-panel` 里两条 `<path class="series-line">` 的 `d` 属性都是**空字符串**：
  `<path class="series-line" data-key="pcr" d="" …>`，`getTotalLength() = 0`，`getBBox() = 0×0`
- 穷举 `pcr/wbc/anc/hgb/plt/ae/cost` × `all/12m/6m` × A/B：**每一个 `path.series-line` 的 `d` 长度都是 0**；选满 4 条线时 `paths: [0,0,0,0]`
- 指标卡背面同样：每张 `.mface.back .mini-chart` 的 path `d 长度 0 / totalLength 0 / bbox 0×0`，而圆点正常（5、11、11、11…）
- 页面上**只看得见散点，看不见折线**

**复现步骤**
1. `file:///…/prototypes/v0.2/index.html#onechart`
2. 控制台执行 `[...document.querySelectorAll('#chart-panel path.series-line')].map(p => (p.getAttribute('d')||'').length)` → `[0, 0]`
3. `#mol` → 点任一指标卡翻面 → 背面同样只有点、没有线

**涉及文件与行号**
- `prototypes/v0.2/app.js:444-472` `smoothPath(points)`：`var p = (points || []).filter(function (o) { return o && isFinite(o.x) && isFinite(o.y); });` —— 只接受 `{x, y}` 对象
- `prototypes/v0.2/app.js:1969-1970` 一图秀调用：`smoothPath(seg.pts.map(function (q) { return [sx(q.d), sy(q.v)]; }))` —— **传数组**
- `prototypes/v0.2/app.js:1795-1797` 卡背调用：`var xy = seg.pts.map(function (q) { return [sx(t(q.d)), sy(Number(q.v))]; });` —— **传数组**
- 对照正确写法：`prototypes/v0.2/app.js:594` `var screen = seg.pts.map(function (p) { return { x: x(p.d), y: yOf(p.v) }; });`（趋势页，`d` 长 92、总长 325）

**判据来源**
- 16 号 R1「每条线按自身量纲独立归一化成可叠看的曲线」、R6 `pathLength` 描线动画 —— 没有 path 就无从谈起
- 16 号 §2 指标卡结构：背面须给「最近 N 次迷你折线」
- `prototypes/v0.2/index.html:270` 自证「关掉治疗条后曲线 d 属性逐条不变（实测 True）」—— 该「不变」成立**只是因为 d 恒为空**

---

#### P0-2　一图秀 R3 违反：开关治疗条会让**所有数据点位置改变**

**现象（实测，同一窗口 `all`、同一指标 `pcr`）**

| 日期 | 治疗条关 `cy` | 治疗条开 `cy` |
|---|---|---|
| 2026-04-20 | 184.6 | 202.4 |
| 2026-07-18 | 218.7 | 240.4 |
| 2026-10-12 | 222.0 | 244.0 |

`wbc` 同样：137.3 → 149.9。`R3_points_identical: false`、`R3_circle_equal: false`

**复现步骤**
1. `#onechart`，默认 `pcr + wbc`
2. 记下任一 `circle` 的 `cy`
3. 点 `[data-act='one-toggle']`（治疗条）
4. 再读同一个 `circle` 的 `cy` → 变了

**涉及文件与行号**
- `prototypes/v0.2/app.js:1945` `var plotH = H - padT - padB - (treated ? 22 : 0);` —— 治疗条占位压缩绘图区高度，所有 y 坐标随之缩放

**判据来源**
- 16 号 R3「治疗条固定在绘图区上方独立行；**关掉后数据点坐标与曲线 d 完全不变**」
- `prototypes/v0.2/index.html:270` 声称「治疗条与数据区分层……（实测 True）」与实测相反

---

#### P0-3　归一化基准取的是**窗口内首点**，图例却写「全期口径」（16 号 §0.2 违反 + 图上文案为假）

**现象（实测）**

| 时间窗 | pcr 图例 | wbc 图例 | 同一 BCR 点 2026-07-18 的 `cy` |
|---|---|---|---|
| `all` | `基线 42.600 IS% · 全期口径` | `基线 28.6 10⁹/L · 全期口径` | 218.7 |
| `12m` | 同上（与 `all` 一致） | 同上 | 218.7 |
| `6m` | `基线 8.400 IS% · 全期口径` | `基线 3.1 10⁹/L · 全期口径` | **197.3** |

同一个数据点、同一份档案，只因为切了时间窗就从 `cy 218.7` 跳到 `197.3`；wbc 的 2026-10-12 从 189.0 跳到 24.0。**图例里的「全期口径」四个字是假的。**

**复现步骤**
1. `#onechart`，看 pcr 图例 = `基线 42.600 IS% · 全期口径`
2. 点 `[data-act='one-range'][data-v='6m']`
3. 图例变成 `基线 8.400 IS% · 全期口径`（同一指标、同一「全期口径」，基线却变了）

**涉及文件与行号**
- `prototypes/v0.2/app.js:1941` `var base = pts.length ? Number(pts[0].v) : 0;` —— 在 `inWindow(...)` **之后**取窗口内首点
- `prototypes/v0.2/app.js:1999` 图例文案 `esc(s2.m.name) + '<span class="muted">（基线 ' + fmtVal(s2.m, s2.base) + ' ' + esc(s2.m.unit || '') + ' · 全期口径）</span>'`

**判据来源**
- 16 号 §0.2「基准取**该指标全部记录**的 min/max，**不是当前时间窗**内的 min/max（否则切窗口曲线跳变）」；图例须给「全期 min–max」
- 16 号 R1 独立归一化

---

#### P0-4　指标卡翻面状态**跨档案串档**（24 号 MT13 违反；第三轮 P0-R1 同类错误在新能力复发）

**现象（实测）**
1. A 档案、`#mol` → 指标卡，点第 0 张（`pcr`）翻面 → `aria-pressed = [true,false,false,false,false,false,false]`
2. 切到 B 档案 → 打开指标卡 → `aria-pressed = [true,false,false,false,false,false,false]`，`.mcard.flipped` 数量 = **1**
3. **B 的 pcr 卡一进来就是翻开的**——用户在 B 上看到的是「上一份档案留下的翻面状态」

**复现步骤**
1. `#mol` → `[data-act='mol-tab'][data-v='cards']`，点第 1 张卡
2. 切档案 `[data-act=profile]` 第 2 项（B）
3. 回到指标卡 → 第 1 张卡仍是 `aria-pressed="true"` / `class="mcard flipped"`

**涉及文件与行号**
- `prototypes/v0.2/app.js:27` `molFlipped: new Set(),` —— **单一全局 Set，没有按档案分桶**
- `prototypes/v0.2/app.js:1810` `var flipped = state.molFlipped.has(m.key);`
- `prototypes/v0.2/app.js:2422` `if (on) { state.molFlipped.delete(key); } else { state.molFlipped.add(key); }`
- 对比同文件里**做对了**的：`:59` `fertQByProfile: { A: [], B: [] }`、`:56` `accepted: { A: {}, B: {} }`
- 两档案的指标 key 完全相同（`pcr`,`wbc`,`anc`,`hgb`,`plt`,`ae`,`cost`），所以 key 直接撞车

**判据来源**
- 24 号 MT13「病例切换隔离翻面/筛选/草稿，不串患者信息」
- 27 号 §3「状态存 key」——**但必须是每档案的 key 空间**，否则就是串档
- 与第三轮 P0-R1（`tfrOut` / `fertQ` 串档）同一缺陷类；该轮修了那两处，**新能力又犯一次**

---

#### P0-5　分类指标「副作用记录」（`kind:'qual'`）被画进数值归一化图，图例直接漏出 `NaN`

**现象（实测，A/B 都一样）**

单选中 `副作用记录` 时：

- 图例：`副作用记录（基线 NaN · 全期口径）` —— **`NaN` 出现在用户可见文案里**
- 4 个圆点 `cy` 全部 = `24.0`（绘图区最顶端），视觉上等价于「这条一直最高 / 最差」
- path `d` 长度 0（同 P0-1）

**复现步骤**
1. `#onechart` → 展开 `details.pick`
2. 取消已选项，只勾 `副作用记录`
3. 看图例与点位

**涉及文件与行号**
- `prototypes/v0.2/demo-data.js` 中该指标 `"kind":"qual"`（无数值点）
- `prototypes/v0.2/app.js:1941` `var base = pts.length ? Number(pts[0].v) : 0;` → 对 qual 指标 `Number(undefined)` 得 `NaN`
- `prototypes/v0.2/app.js:1717` 附近的注释自己也声明分类指标不进数值轴

**判据来源**
- 27 号 §1 四硬约束「**分类变量只画节点**」（不得进入数值归一化）
- 16 号 §0.1 可比性：不可比的东西不得叠画
- 产物后果：把「一条副作用记录」画成顶端平线 + `NaN` 文案，属于**用图形给不存在的量级背书**

---

### P1（不阻断 G2，但必须在签前修或书面豁免）—— 共 11 条

---

**P1-1　R2 空窗口空态判的是「全期」而不是「窗口内」（潜伏逻辑错误）**
- 现象：`var allEmpty = ms.every(function (m) { return !(m.points || []).length; });` 判全部记录；16 号 R2 要求**窗口内**无数据就给空态。当前数据每指标每窗口都有点，触发不了；一旦档案只导入近半年记录，会在应当给空态时渲染一张只有坐标轴的空图。
- 复现：读代码即可（`app.js:1935`）；或把某指标全部点改成 2019 年、选 `6m` 窗口观察（我尝试注入时 `window.PROTO` 不可用、注入的指标未进入 picker，未能实机触发，见 §9）。
- 涉及：`prototypes/v0.2/app.js:1935-1936`
- 判据：16 号 R2 / §6 断言 C3
- **级别理由**：今天不产生错误结论（没有把无数据画成 0），故 P1；与 P0-3 是同一「窗口语义」错位的两面，建议同批修。

**P1-2　第 5 条线被拒时，提示只写在会话侧栏；侧栏收起就完全没有反馈**
- 现象：选满 4 条后点第 5 条，计数不变（拒选正确），提示 `最多同时看 4 条线：先去一条再选新的。` 写入 `#aiHint`；该提示位于 `ASIDE.session`，侧栏收起时 rect = w0 h0，用户看不到任何反馈，picker 内只剩静态的 `已选 4/4（最多同时看 4 条线，超过会让图读不清）`。
- 复现：`#onechart` → 选满 4 条 → 点 `[data-act='panel-toggle']` 收起侧栏 → 点第 5 条。
- 涉及：`prototypes/v0.2/app.js`（`one-pick` 处理分支）+ `#aiHint`
- 判据：16 号 R7「第 5 个不可选**或有明确提示**」

**P1-3　`profileRevision` 未渲染（MATCHING-SPEC §4.5 只做到 2/3）**
- 现象：数据里有 `profileRevision: 'demo-v0.2'`，页面只显示 `规则集 cml-rules-2026.10-1` + `评估生成 2026-10-25`；`document.body.innerText.includes('demo-v0.2')` = false；也没有「档案已更新，建议重新评估」横幅。
- 复现：`#trial` 全文搜索 `demo-v0.2` / `档案 rev` → 无。
- 涉及：`prototypes/v0.2/app.js:2088 matchBody()` 的元信息行（`:2093` 附近）；数据在 `demo/build-demo-data.mjs:436`
- 判据：MATCHING-SPEC §4.5「每次分析记录 profileRevision / ruleSetVersion / 逐条判定」

**P1-4　`#docs` 更正后**新值在页面上不可见**（X2 产物不可观察；第三轮 P1-1 复现）**
- 现象：点 `docs-correct`、输入 `424242` 回车后，候选行状态列变成 `已更正 本机改 记录者：本人`，但 `document.body.innerText.includes('424242')` = **false**；版本链写进了 `ex().docVersions` 却从不渲染；`noteWrite('docs', …)` 的回执也没有任何 `lastWrite('docs')` 消费点。`已接受：A-C3（共 1 条，本机内存态）` 保持不变。
- 复现：`#docs` → 点任一 `更正` → prompt 输入 `424242` → 看页面。
- 涉及：`prototypes/v0.2/app.js:2540-2566`；`app.js:60/65/69/70`（`state.writes` 只写不读）
- 判据：X2 产物可观察；`docs/INTERACTION-DESIGN.md` 更正需可见版本链

**P1-5　`#mol` 的 CML-LAB 子页里没有它标题承诺的「录入 / 更正」表单**
- 现象：点 `[data-act='mol-tab'][data-v='lab']` 后，页面上**不存在** `#f-v`、`[data-act='mol-save']`、`[data-act='mol-correct']`（`pg.fill('#f-v')` 30 s 超时；`lab_has_correct: false`）。表单实际只渲染在**趋势 tab**里（`app.js:1179` 属 `molTrendBody()`，`mol-correct` 在 `:1197`）。
- 复现：`#mol` → 点 tab「复查记录 CML-LAB（二级）」→ 找录入表单 → 没有。
- 涉及：`prototypes/v0.2/app.js:1029-1038`（`pageMol()`，`:1036` 走 `molLabBody()`）vs `:1179` / `:1197`
- 判据：声明与实现一致（tab 名与卡片标题均写「二级：录入 / 更正」）

**P1-6　`chart/root` 检查器用源码字符串计数、把错误的「6」锁成合同，替假自检背书**
- 现象：`scripts/check-prototype.mjs:126` 断言源码里 `class="chart` 出现 **6** 次；实际渲染 `svg.chart` 每档案 4 个、A+B 共 **8** 个（`grep -o 'class="chart' app.js | wc -l` = 9）。
- 复现：`node scripts/check-prototype.mjs` → 绿；`#onechart` 里数 `svg.chart` → 每档案 4。
- 涉及：`scripts/check-prototype.mjs:126`、`prototypes/v0.2/index.html:210`
- 判据：检查器口径须与产物一致（用户要求「检查器口径错误也是缺陷」）
- **对构建方「待修 A」的独立回答：我实测是 8。这条我定 P1、不定 P0** —— 理由：它不产生患者可见的错误结论，且权威的指纹/需求表已被改对；但它是「检查器把错数字写成合同」，只要不改，下一个人加页面时还会被这个 6 误导，所以不能算纯记录精度 P2。

**P1-7　自检声称的 demo-data 指纹与实物不符（同类问题第三轮后复发）**
- 现象：`index.html:236`「当前 sha256 前 8 = `1d38e5e2`（与 docs/PROTOTYPE-FIXES.md 的指纹表一致）」、`docs/PROTOTYPE-FIXES.md:61`「sha256 现 `1d38e5e2…`，js_bytes 16574」；实物 `d4fbc2b1` / **34046 B**。第三轮 `PROTOTYPE-REVIEW-3.md:19/22` 记录 `1d38e5e2` 当时正确。
- 复现：`shasum -a 256 prototypes/v0.2/demo-data.js`。
- 涉及：`prototypes/v0.2/index.html:236`、`docs/PROTOTYPE-FIXES.md:61`
- 判据：G2 冻结哈希纪律（自检必须与实物同源）

**P1-8　`matching/expressions` 的否定语境放行，**结构上抓不到 `不符合条件`**，绿不构成证据**
- 现象：`negCtx` 测禁词前 28 字符；`不符合条件` 自带「不」，可自我放行。当前页面实测该词 0 命中（干净），但断言不可依赖。
- 复现：在页面植入 `badge('不符合条件')` → 检查器仍绿（按代码路径推断；构建方自己的负向测试只覆盖了 `匹配度 82%`）。
- 涉及：`scripts/check-prototype.mjs`（`matching/expressions` 的 `negCtx`）
- 判据：检查器必须能红（否则等于没有断言）

**P1-9　`matching/ironlaw` 是文本存在性检查，不是行为检查**
- 现象：只断言 `const tier =` 之后 300 字符内同时出现 `undefined|null|''|""` 与 `undetermined`；把返回顺序改成 `undefined → 'satisfied'` 但保留那两个字样仍会绿。
- 复现：读 `scripts/check-prototype.mjs` 的 `matching/ironlaw` 分支；或让 `tier` 在 guard 之后返回 `satisfied` 再跑 → 绿。
- 判据：MATCHING-SPEC §4.2「这是整个算法最重要的一条」⇒ 断言必须验行为

**P1-10　自检声称「B 档案同样命中 R1 不可比说明」为假**
- 现象：B 档案所有单指标与 4 条组合的 `#chart-panel .note` 都是 `[]`（空）。B 的 pcr 本就单实验室单单位、无 gap，**页面行为符合规范**，错的是这句自述。
- 复现：`#onechart` 切 B → `[...document.querySelectorAll('#chart-panel .note')].map(e=>e.innerText)` → `[]`。
- 涉及：`prototypes/v0.2/index.html:274`
- 判据：16 号 R1（图上可见不可比说明）+ 声明与实现一致。修法建议：删掉「B 同样命中」，或改成「B 档案无不可比记录，故不显示提示」——**不要为了让自述成立去伪造提示**。

**P1-11　S7 导出件里含「可以谈停药」，而自检称「全页 0 处停药方向性文案」**
- 现象：B 档案 `[data-act='tfr-export']` 输出含 `DMR 超过 2 年、TKI 用了 6 年，达到书面条件，可以谈停药…`（来源 文件 B-D5）。页面 body 文本确实没有这个词（所以 checker `wording: 禁词 0 命中` 也是真的），但**导出件是用户会拿走的东西**，且导出件没有页面上的免责声明。
- 复现：`#tfr` 切 B → 导出 → 读 `#tfrOut`。
- 涉及：`prototypes/v0.2/index.html:242` 的自检表述 + TFR 导出渲染（`app.js` `tfr-export` 分支）
- 判据：24 号/项目纪律「TFR 页不得出现停药方向性文案」；若坚持保留医生原话引用，**导出件必须带来源+免责尾注**，且自检应改成「页面正文 0 处」。
- 级别理由：这是一条**带来源的医生原话引用**（不是工具给的建议），内容本身属记录；但导出件脱离页面语境 + 自述为假，故 P1 不 P0。

---

### P2（记录精度 / 打磨）—— 共 3 条

**P2-1　自检「每点 `<title>` 共 26 个」不可复现**
- 实测默认 2 条线 = **16** 个 `<title>`；选满 4 条 = **38** 个。26 既不是哪个真实状态。
- 涉及：`prototypes/v0.2/index.html:271`；R12 本身（每点都有 title）**通过**。

**P2-2　`#trial` A 档 PDF 第 4 页为空白尾页**
- 实测 4 页 / 615,528 B，第 4 页提取文本 0 字符。
- 涉及：打印分页规则；不影响可读性。

**P2-3　「还没有记录 / 暂无可比较的前次记录」文案出厂状态永不出现**
- A/B 两档案 7 个指标每个都 ≥1 个点，这两条分支一次也走不到。文案本身在码里（`app.js:1739/1748/1766`），我注入内存后确认渲染正确、**没有把无记录写成 0**。属「数据没覆盖到分支」，记 P2 提醒补一条空档案夹具。

---

## §8 结论

**P0 = 5**

- P0-1 一图秀曲线 + 指标卡背面折线 **全部为空**（`smoothPath` 传数组）
- P0-2 一图秀 R3：开关治疗条改变**所有数据点坐标**
- P0-3 归一化基准取窗口内首点，图例谎称「全期口径」，切窗口曲线跳变
- P0-4 指标卡翻面状态**跨档案串档**（24 号 MT13）
- P0-5 分类指标「副作用记录」被画进数值轴，图例漏 `NaN`

**P1 = 11　P2 = 3**

### 不能签 G2

理由不是「整体质量」，而是三条硬事实：

1. **本轮主打的新能力「一图秀」的核心产物不存在。** 页面上写着「归一化叠看曲线」、自检写着「曲线 d 属性逐条不变（实测 True）」，而实际渲染出来的 `d` 全是空字符串——一个功能可以差，但不能**声称自己画了线而一条线都没有**。同类问题也打穿了指标卡背面（16 号 §2 明确要求背面迷你折线）。
2. **两处自证是「被空字符串骗过的真」**：R3 的「d 逐条不变」因为 d 恒空而成立；归一化的「全期口径」因为没人核对基准来源而成立。这类自证比没自证更危险——它会让下一轮评审跳过这两个点。
3. **第三轮 P0-R1 的缺陷类（状态不按档案分桶）在新增的指标卡上原样复发**：`molFlipped` 是全局 Set，A 翻开的卡到 B 还开着。上一轮修了 `tfrOut` 与 `fertQ` 两处，但没有把它变成一条通则，于是新能力又踩一次。

**可以确认的好消息**（同样有实测支撑，不是说客气话）：
- 指标卡的 3D 合同、六段层级、a11y（inert + 不可 Tab + 键盘 + reduced-motion）、2/2/1 断点、276px 恒高、零溢出——**全部达标**，这是本轮最扎实的一块；
- 临床试验页的**铁律**（缺失 → 永远「无法判定」）在代码结构与实测数据两层都成立，§4.4 表达约束没有违规，渠道诚实、4 条试验全部标了【演示虚构】、pending 单列、汇总只计数——**这一页可以签**；
- 第三轮的 P0-R1（`fertQ` 分桶）与 P0-R2（S7 原话导出 A/B 各 2 条）**确实修好了**；
- 打印没退化（`#mol` A 9 页 / B 8 页，逐字节复现），390px 无溢出，五个检查器全绿。

**要签 G2，至少得把 5 条 P0 清掉；其中 P0-1 与 P0-3 是同一条渲染链上的两个 bug，一起修最省事。**

---

## §9 未验证项（如实列出）

1. **视觉/观感未验证**：我所在的评审模型不支持读图，`read_image` 直接拒绝（`model "deepseek-4.1-flash" does not declare image input`）。截图我抓了（`/tmp/onechart_panel.png` 等），但**没有真正看过**。所有视觉结论都只来自 computed style、rect、DOM 结构、`getBBox`，不含「看起来对不对」。
2. **16 号 R6 的描线动画未验证**：`pathLength=1` + `dasharray` 的动画效果**无法验证**，因为 path 的 `d` 是空的（P0-1）。同理 R11（reduced-motion 下 `stroke-dasharray:none`）在图上也没有可观察对象。
3. **R2 单点不连线 / 空窗口空态未实机触发**：出厂数据下每指标每窗口都有 ≥2 点。我尝试注入一个只有 2019 年记录的指标来触发窗口空态，但 `window.PROTO` 在该次探测中为 `undefined`，注入的指标也没有出现在 picker 里，**未能实机复现**。P1-1 的结论来自源码（`app.js:1935`）+ 构建方自述的比对，只有代码级证据，没有运行级证据。
4. **指标卡「还没有记录 / 暂无可比较的前次记录」的注入验证只有一次**：那次注入（推 `window.DEMO_DATA.metrics.A` + 触发重渲染）我观察到了正确文案，但后续同类注入未能复现，因此这两条文案的**运行级**证据强度低于本报告其它结论；源码层面可确认（`app.js:1739/1748/1766`）。
5. **其它浏览器未测**：只在 Chrome（`channel="chrome"`）跑。`preserve-3d`、`backface-visibility`、`inert` 在 Safari/Firefox 的行为未验。
6. **打印只在 Chrome 测**：`page.pdf()`。真实用户走系统打印对话框（边距、页眉页脚、缩放）可能不同。
7. **规则本身的临床正确性未评审**：我只验了「缺失不会流向已满足」「三档只有三种」「表达约束」「元信息」这些工程合同。`cml-rules-2026.10-1` 里每条入排标准写得对不对、阈值（ECOG 0–1、QTc <450/<470、脂肪酶 ≤1.5×ULN）是否与原文一致——**我没有对照真实试验方案核过**，这超出本轮范围，但签 G2 前应由懂临床的人过一遍。
8. **A/B 之外的档案未测**：只有两份演示档案。多档案下的分桶修复（`fertQByProfile` 只初始化了 A/B 两个 key）在第三份档案上是否成立，未验。
9. **键盘全页 Tab 序**：只在指标卡区域做了 60 次 Tab 的隐藏面检查；全页 Tab 序、焦点陷阱、跳过链接未系统验证。
10. **评审期间文件被改**：`index.html` 在评审中途从 `3e2fcbbc`/299 变为 `99f9b62e`/300（见 §0.2）。§0 的两个快照都记了；但我**无法排除**在我最后一次探测之后又有新提交，本报告的行为结论对应 `app.js e53cbfeb`（该文件全程未变）。
