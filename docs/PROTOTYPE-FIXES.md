# PROTOTYPE-FIXES · P0 修复留痕（M2）

日期：**2026-10-25**（第三轮复审后修订：三项能力实装，见文末段）。对象：`prototypes/v0.2/{index.html,app.js,style.css,demo-data.js}`。
评审来源：`docs/PROTOTYPE-REVIEW.md`（首评 P0=11 / P1=18 / P2=12；X1=X2=X3=0, X4=1）、`docs/PROTOTYPE-REVIEW-2.md`（复审剩 P0=2）、`docs/PROTOTYPE-REVIEW-3.md`（三审剩 P0=2，X1–X4=(1,1,0,1)）。

**当前冻结指纹（改动后必同步本表；复审曾抓到本文件写的指纹与实物不符——这是被记 P1 的原因之一）**

| 文件 | sha256 前 8 | 行数 |
| --- | --- | --- |
| `prototypes/v0.2/app.js` | `efa3d700` | 2818 |
| `prototypes/v0.2/index.html` | `0fac99a8` | 319 |
| `prototypes/v0.2/style.css` | `4d7f33bc` | 406 |
| `prototypes/v0.2/demo-data.js` | `d4fbc2b1` | 2（34046 字节） |

> 口径：本文件只记**实测到的数字**。凡未验证的，标「未验证」。

## 逐条

| # | P0 | 改了什么 | 怎么测的 | 实测结果 |
| --- | --- | --- | --- | --- |
| P0-1 | 打印时折叠卡内容丢失 | `style.css` 打印段改为同时覆盖 `details:not([open]) > .phase-detail` 与 `.phase-detail`，并在 `beforeprint` 兜底展开；页面文案改为与实现一致 | Playwright `emulate_media(media="print")` 后量每张卡 `section.pd-block` 的 `offsetHeight` | **4/4 张卡 × 5 块全部 visible=5**（`scripts/probe-ip-matrix.py` `p0_checks.print_foldout_visible.pass=true`） |
| P0-2 | S8 费用「记一笔」入口+表单缺失 | `pageCost` 增加入口按钮 + 5 字段表单（药名/规格/自费金额/医保标记/日期）+ 提交/清空 | 点 `cost-new` 数字段；填 `测试药名XYZ`/`88` 后提交 | 字段 **5 ≤ 6**；提交后 2026-10 当月自付 **620 → 708 元**、条目 **7 → 8 条**、药名小计新增一行 |
| P0-3 | S3 副作用「记一次不舒服」入口+表单缺失 | `pageAe` 增加入口 + 5 字段表单（不适词/日期/归属用药/自述/凭据） | 点 `ae-new` 数字段；填说明后提交 | 字段 **5 ≤ 6**；提交后时间线新增条目且文本可见 |
| P0-4 | S4「⋯ 更多→换药/调剂量了」缺失 | 全站每页加 `<details class="more">` 收口；`med` 的 summary 逐字为「⋯ 更多→换药/调剂量了」，内含 6 字段处方变更表单 | 点 `rx-new` 数字段并提交 | 字段 **6 ≤ 6**；提交后处方变更线新增分段、旧段保留（只增版本） |
| P0-5 | 写入产物不可观察 | `mol-save` / `docs-pick`（接受候选）改为写入 `state` 内存态并渲染成功提示 + 计数 | 提交后读页面文本与计数 | 费用/副作用/处方三条均出现「已写入本机内存态…」提示且新值可见；**页面常驻声明「原型为内存态，刷新回到演示数据」** |
| P0-6 | 复诊资料包导出内容错 | `buildPrepBundle()` 统一数组：事实区/看法区/问题清单；页面计数与导出用同一次 `filterPrivate(list,'export')` | 点 `prep-export` 取导出文本 | 导出块名 **事实区 / 看法区 / 问题清单 全部存在**；费用明细 **0 处**（`has_cost_detail=false`） |
| P0-7 | 入口文案逐字漂移 | 按 `docs/INTERACTION-DESIGN.md` §二 的「入口（逐字）」列补齐 S1–S9 入口；`docs/INTERACTION-DESIGN.md` 覆盖自检补为 10 页穷举 | `scripts/probe-ip-matrix.py` 解析文档 §二 的引号内文案，逐条在渲染 DOM 里找并点击 | 入口文案 **11/11 可达**、**0 条点不到**、`captions_missing=[]` |
| P0-8 | 孤儿页 docs/trial + 缺 CML-LAB | `prep` 页「本包引用的来源页」链到 `#docs` 与 `#trial`（进入 S5 路径）；新增 `mol` 下二级「复查记录 CML-LAB」（血常规密测轨道 + 骨髓/细胞遗传学原文摘录） | 链接图 + 场景路径文本匹配 | 孤儿页 **0**（`orphans_by_link=[]`、`orphans_by_scenario_path=[]`） |
| P0-9 | K1 非引用「复发」+ 自检声明不实 | 该处改为带来源引用（`<q class="quote">` 紧跟 `<span class="src">来源：…</span>`）；`index.html` 文末自查清单改为真实数字 | 渲染态扫 `q.quote` 是否紧跟 `.src`；展开全部 `<details>` 后扫禁词 | 引用块无来源 **0 处**；全站禁词 **0 命中**（含展开折叠卡后） |
| P0-10 | TFR 页自作判读（K1/K3 一票否决） | 删掉「未满足/未达 MR4.0」；改为「书面条件原文 + 来源」+ 本侧三态（已抄录/未抄录/待补）；页面声明改为与实现一致（保留医生原话引用并标来源） | 渲染文本检索「满足/未满足/达标/未达标」 | **0 命中**（`W3.hits=[]`） |
| P0-11 | 双主体建模错 + 草稿跨档案泄漏 | 档案切换器改「档案 A · 患者本人视角」「档案 B · 家属代记视角」；每条记录带**记录者**标记并在表格/条目上可见；B 的代记条目不标「本人自述」；切换档案清空全部草稿 | 逐页统计「本人 / 家属代记」；在 textarea 输入后点「档案 B」再读值 | 记录者标记：本人与家属代记**均 > 0**；切换后草稿值 **""**（`draft_isolated_on_switch.ok=true`） |

## 三套检查器（可复跑）
| 命令 | 覆盖 | 当前结果 |
| --- | --- | --- |
| `node scripts/check-prototype.mjs` | 页面/折叠卡/图表/红线/字号/面板/唯一源 | **pass=true**（0 fail） |
| `python3 scripts/probe-ip-matrix.py` | X1–X4 + 打印/引用来源/草稿隔离/入口文案 | **pass=true**（failures=[]） |
| `python3 scripts/probe-write-paths.py` | 写路径可观察 + TFR 禁判读 + 导出构成 + 记录者 | **pass=true**（failures=[]） |
| `python3 scripts/probe-page-view.py` | 4 档宽度溢出/字号/path fill=none/渲染态禁词/截图 | **pass=true** |

## 未验证（如实）
1. 真实打印出 PDF 的分页效果（只验证了打印媒体下五块可见）。
2. 大字 125%/150% 真实浏览器缩放下无横向滚动（只验证 4 档视口宽度）。
3. 触屏拖拽分隔器（只有代码路径）。
4. MinerU 实解析、临床试验真实数据、API 凭据（原型为界面态）。
5. 写路径全部为**内存态**，刷新回演示数据（已在页面与 README 显式声明，不算缺陷）。

## 第二轮复审（`docs/PROTOTYPE-REVIEW-2.md`）后的追加修复 · 2026-10-25 晚

复审判 **P0 剩 2 条**，两条都是"假修"（子项修好、原始指控还在）：

| # | 复审指控 | 根因（复审给的） | 改了什么 | 实测结果 |
| --- | --- | --- | --- | --- |
| P0-1 | 打印：折叠卡 DOM 里展开但**真出 PDF 只 1 页** | `style.css` 应用外壳 `html,body{height:100%}` + `overflow:hidden`，内容全在 `.main-col` 的滚动容器里，打印流只吃首屏 | 新增 `@media print` 外壳解除段：`html,body,.app,.main-col,#view` 全部 `height:auto/overflow:visible/display:block`，隐藏侧栏/顶栏/会话区/页脚/提示条 | Chrome `page.pdf()` 实测：**A 档案 9 页 / 909,797 B；B 档案 8 页 / 900,286 B**（此前 1 页 / 约 41 万 B） |
| P0-11 | 双主体：**两个档案是两位不同患者**，界面却写"同一患者的两个记录视角" | 演示数据就是 A 周建国(男 46 e14a2) / B 林雨桐(女 31 e13a2)，文案与数据矛盾 | 按事实改文案：顶栏 aria 与说明改为"示例档案 A/B 是**两位不同患者**；双主体＝同一档案内记录可由本人或家属代记，每条带「记录者」"；`app.js` 的 `recorderDefault` 加注释说明两者并存不互相冒充；文末自检同步改写 | 界面文案与数据一致；"记录者"标记仍落条目级；切档案草稿仍清空 |

### 顺带修掉的复审 P1
- **自检清单不实**：行号引用全部过期 → 改为**不写死行号**（用 `grep 关键字` 指位）；禁词统计改为脚本复算（A/B×10 页展开后全 0）；打印一栏改为写实测页数；档案切换一栏改为写"两位不同患者"。`style.css` 字号统计改为只列已用值不再报处数。
- **S7 无产物控件** → TFR 页新增「导出核对清单」（三块：必备/最低/门诊原话，导出文本 566 字符；**导出内禁词 0**，因为措辞改为"本清单不给结论"）＋「打印这一页」。
- **S9 无问题清单增删** → 生育页新增输入框 +「加入清单」/「删掉这条」；实测 0→1→0，带「记录者」标记。
- **数据源里还有判读词**（复审没抓到，我自己复测发现）：`demo/build-demo-data.mjs` 的 A 档案 min 三条状态写的是 **「未满足」**，且备注含「未达 MR4.0」——这正是首评一票否决的 K1 词。已改为三态 `未抄录` + 只抄时长/报告值；重新生成 `demo-data.js`（当日为 `1d38e5e2…`/16574B；**此后数据层又改过两轮**——补外院 pcr 记录、加指标目录与入组档案，实物现为 `d4fbc2b1`/34046B，指纹以 `shasum` 为准，本文件不追写具体值），**A/B×10 页禁词全 0**。
- **IP6 口径未定义**（复审判 5 页违规，因为没定义什么算"显式编辑"）→ 在 `docs/INTERACTION-DESIGN.md` 写明口径：只算"在本页原地打开表单"的入口，跳转型快捷入口（看卡的 `mol-new`/`ae-new`/`cost-new`）与行内三态、提交按钮、面板拖拽都不算；`scripts/probe-ip-matrix.py` 的 `ip6_counts()` 按此实现，实测 **违规 0**（fert 1 / docs 1 / 其余 0）。

### 本轮四套检查器（改后实跑）
`check-prototype.mjs` pass · `probe-ip-matrix.py` pass（failures=[]）· `probe-write-paths.py` pass · `probe-page-view.py` pass（4 档溢出 0、字号越界 0、渲染态禁词 0、无来源引用 0）

## 2026-10-25 第三轮复审后的三项能力实装（M2 增补）

本轮用户提出三条新需求（指标卡分系列+3D 翻面 / 一图秀指标选择窗口 / 临床试验建档+三档匹配），
按脚手架 24-METRIC-TREND-TAB-DESIGN、16-ONE-CHART-SPEC、27-TRACKS-AND-METRIC-CARDS 与 MATCHING-SPEC 实装。

### 当前实测指纹

| 文件 | sha256 前 8 | 行数 |
| --- | --- | --- |
| `prototypes/v0.2/app.js` | `efa3d700` | 2818 |
| `prototypes/v0.2/index.html` | `0fac99a8` | 319 |
| `prototypes/v0.2/style.css` | `4d7f33bc` | 406 |
| `prototypes/v0.2/demo-data.js` | `d4fbc2b1` | 2（34046 字节） |

### 做了什么

| 项 | 内容 | 怎么验的 |
| --- | --- | --- |
| 指标卡 | 分子线新 tab「指标卡（分系列·翻面）」；7 张卡按 4 类分组，类别标题＝名+项数+有记录数；唯一 `CATEGORY_ORDER`，与一图秀共用 | Playwright：7 卡、rect 366×276、翻面位移 0.0、`matrix3d`、`aria-pressed` 独立、再点回正面 |
| 3D 合同 | 276px 外卡 / 半径 18 / 内边距 20 / 间距 16 / 480ms `cubic-bezier(.2,.7,.2,1)` / `perspective:1100px` / `preserve-3d` / 双面 `backface-visibility:hidden` | `getComputedStyle` 实测 transition 与 transform；`prefers-reduced-motion` 走 `transition:none` |
| 不重渲染 | 翻面只改 class + aria + `aria-hidden`/`inert`，`return` 前不调 `render()` | 点击后 DOM 节点同一性保持，过渡完整播放 |
| 一图秀 | 新一级页 `#onechart`；指标选择窗口按类别分组、独立滚动、最多 4 条；时间窗 + 治疗条开关 | 第 5 次点击被拒并提示；`details` 默认收起可展开 |
| 只重绘面板 | `repaintChartPanel()` 只换 `#chart-panel` innerHTML，同步计数与 aria-pressed | `window.__stamp === document.querySelector('#chart-panel')` 为 True |
| R3 分层 | 关治疗条后曲线 `d` 逐条不变 | 前后 `.series-line` 的 `d` 字符串完全相等（True） |
| R1 不可比 | A 档案补一条外院 `is_std=0` 记录，使「不可比提示」在页面上真实出现 | A/B 两档均命中「不可比提示」与「断开」 |
| 临床试验 | 入组档案 18 字段/7 组 + 11 条规则 + 三档确定性求值；完整度 x/y；汇总只计数；渠道覆盖如实 | A 14/18（7/0/3/1）、B 13/18（5/1/4/1）；全页无匹配度百分比/推荐/排序 |

### 本轮修掉的实现错误（自查，不是复审提出的）

1. `q.date` / `pt.date` 与数据字段 `d` 不符 → 卡片全部显示 `undefined`；全局替换后 `grep -c "\.date"` = 0。
2. `segmentsOf()` 返回 `[{pts, gap}]` 而非数组 → `miniSVG` 里 `seg.map is not a function`（页面整页白屏）；改迭代 `seg.pts`。
3. 免责文案把「总分/综合评分/健康指数」写进页面 → 反而触发 27 号验收；改为「不把多个指标合成一个数字，也不给整体评级」。
4. `<details class="pick" open>` → `foldout/open` 断言（默认展开必须 0）失败；去掉 `open`。
5. `svg .ax { font-size: 11px }` → 字号断言越界；改 12.5px。
6. 卡片网格断点原写 700px → 27 号 §4.3 要求 1440/1080/860 = 2/2/1，改 `@media (max-width:959px)`。
7. `onechart` 初版是**孤儿页**（无入站链接、无场景路径经过）→ `probe-ip-matrix.py` X1 抓到；在看板「分子线速览」卡与试验页加入口，并在 `docs/INTERACTION-DESIGN.md` 补 S10/S11 与覆盖行。
8. A 的 `pcr` 注释写「8 月起换实验室（不可比）」，但 4 条记录全在同一实验室 → 注释与数据矛盾；补真实外院记录并把注释改对。

### 检查器口径改动

- `scripts/check-prototype.mjs`：字号断言由「一律 12.5–15」改为**按选择器豁免**（`NUMERAL_SELECTORS = ['\.mval']`），因为 24 号 §5 要求数字约 33px。豁免必须逐选择器声明，新增豁免须记入 `docs/DEV-REQUIREMENTS-2026-10-25.md` §七。
- `scripts/probe-page-view.py`、`scripts/probe-ip-matrix.py`、`scripts/probe-write-paths.py`：路由表补 `onechart`，使新页与既有 10 页受同一套宽度/溢出/禁词/入口扫描。

## 2026-10-25 第四轮独立评审（P0=5）后的修复

评审报告 `docs/PROTOTYPE-REVIEW-4.md`（773 行）。**P0=5 / P1=11 / P2=3，不能签 G2。**
五条 P0 全部修复并实测复验，另修 P1-1/P1-6/P1-7 三条检查器口径缺陷。

| # | P0 | 根因 | 修法 | 复验 |
| --- | --- | --- | --- | --- |
| P0-1 | **一图秀曲线一条都没画出来**（穷举 7 指标×3 窗×A/B 全部 `d=""`、bbox 0×0） | `smoothPath` 只认 `{x,y}` 对象；一图秀（`app.js:1969`）与指标卡背面（`:1795`）传的是 `[x,y]` 数组 → filter 全丢 | `smoothPath` 入口归一化两种形态（`Array.isArray` → `{x,y}`） | A `d` 长 [90,424]、bbox 379.6×194.7；B [238,234]、bbox 564.0×77.3 |
| P0-2 | **违反 16 号 R3**：关治疗条后每个点 `cy` 都变（pcr 2026-07-18: 218.7→240.4） | `plotH = H - padT - padB - (treated ? 22 : 0)` 让治疗条压缩了绘图区 | 22px 永远留给治疗条那一行，与开关无关 | A/B 两档：关治疗条后 `d` **与** `cy` 逐条相同 |
| P0-3 | 归一化基线取**窗口内**首点，图例却标「全期口径」（切 6m 后基线 42.600→8.400） | `base` 取自 `inWindow()` 之后 | `base` 取**全期首点**（`m.points` 首位），图例改「全期首点口径，不随窗口变」 | 切 6m 前后图例字符串完全相同 |
| P0-4 | **翻面状态跨档案串档**（A 翻开 pcr → 切 B，B 的 pcr 卡进来就是开的）——第三轮 P0-R1 同类缺陷在新能力复发 | `state.molFlipped` 是全局 Set | 改 `molFlippedByProfile: {A:Set, B:Set}`，与 `fertQByProfile` 同做法 | A 翻卡 `['true','false',…]` → 切 B 全 false → 切回 A 仍 `true` |
| P0-5 | **分类指标进数值轴**：副作用记录图例漏 `基线 NaN`、4 点 cy 全 24.0 顶到最上 | 归一化把 `kind:'qual'` 当数值算 | 分类指标从曲线剔除，单列文字说明「不进坐标轴」（27 号 §1） | 无 NaN；选中 ae 时出现「分类记录」说明 |
| P1-1 | `allEmpty` 判的是**全部记录**为空而非**窗口内**为空（R2 分支没实现） | 先判空后过滤 | 先 `inWindow` 再判空；并逐条给"窗口内无记录"说明 | `verify-onechart.py` V6（当前数据下记 SKIP，不记 PASS） |
| P1-6 | 检查器数**源码字符串**里 `class="chart"` 出现次数，并把错的「6」锁成断言给自己背书（源码实际 9 处、渲染 8 个） | 断言口径错层 | 改为只断言"生成 svg root"，数量交给渲染态探针；**并反向断言自检里不许写死图表数量** | 植入写死数字 → `chart/count-hardcoded` 报错 |
| P1-7 | `index.html` 与 FIXES 仍写 `1d38e5e2`/16574B，实物 `d4fbc2b1`/34046B | 数据改了两轮，文档没跟 | 两处都不再写死，改为指向 `shasum` 命令；**并加 `fingerprint/hardcoded` 反向断言** | 植入 sha256 前 8 → 报错 |

### 更值钱的一条：两条自证都是"被空值骗过的真"

R3 与「全期口径」这两条，在我方自检与第三轮复审里都曾"通过"。原因不是没测，而是**测的东西是空的**：
`d=""` 时比较前后字符串必然相等，于是"曲线不变"永远为真。

**防复发措施（已落地）**：
- 新增 `scripts/verify-onechart.py`（`npm run check:render`）：V1 **先断言 `d` 非空**再断言不变；V2 断言 bbox > 0；V3 同时比 `d` 与 `cy`；V4 比图例基线；V5 查 NaN；V6 空窗口（触发不了记 SKIP 不记 PASS）。
- 负向验证：把 `smoothPath` 还原成旧实现 → `verify-onechart.py` 变红（CAUGHT）。
- `check-prototype.mjs` 加 `chart/smoothpath-input`：静态断言 `smoothPath` 做了入参归一化。

**教训**：断言"不变"之前必须先断言"有东西"。凡比较两态相同，都要先证明两态非空/非零。

### 同批修掉的 P1（第四轮 11 条里除检查器三条外的 6 条）

| # | 缺陷 | 修法 | 复验 |
| --- | --- | --- | --- |
| P1-2 | 选第 5 条线被拒时提示只写 `#aiHint`（会话侧栏），侧栏收起 = 用户零反馈 | picker 内加 `#onePickHint`（用户此刻正看的地方），选中后自动清空 | 侧栏收起（rect 0×0）后点第 5 条，picker 内提示 w=1234 h=20.8 可见 |
| P1-3 | `profileRevision` 数据里有、页面从不渲染（§4.5 只做到 2/3） | 卡头徽章行加「档案 rev demo-v0.2 · 规则集 … · 评估生成 …」+ 过期说明 | `#trial` 正文含 `demo-v0.2` |
| P1-4 | `#docs` 更正后新值在**页面上不可见**（写进 `ex().docVersions` 却从不渲染） | 新增「更正记录（版本链）」表：候选号/原值/更正为/日期/记录者/来源 | 输入 424242 → 页面出现该值 + 版本链表头 |
| P1-5 | CML-LAB 子页标题写「二级：录入 / 更正」，但表单只在趋势 tab（`#f-v` / `mol-save` / `mol-correct` 全不存在） | 抽 `molFormBody()`，两个 tab 共用同一份表单 | lab tab 三项控件齐、`#f-v` 计数 = 1（无重复 id） |
| P1-10 | 自检称「B 档案同样命中 R1 不可比说明」为假（B 客观无 gap，页面不给提示是对的） | 改述为「B 不显示该提示，这是符合规范的」 | B `.note` = 0 / A = 1，与改后表述一致 |
| P1-11 | TFR 导出件含「可以谈停药」原话，但脱离页面语境、无免责尾注；自检却称「全页 0 处」 | 导出件加【说明】尾注（来源 + 不给结论 + 停药须由医生判断）；自检改为「**页面正文** 0 处」 | B 导出件 795 字符，含「来源」「不给任何结论」「必须由血液科医生」 |

**P1-10 的修法值得记一笔**：自述与实测不符时，正确做法是**改自述**，不是伪造提示让自述成立。
B 档案客观没有不可比记录，页面不显示提示是对的。

### 自查另外发现的两处真缺陷（不在第四轮 11 条 P1 里）

| # | 缺陷 | 为什么它是真缺陷 | 修法 |
| --- | --- | --- | --- |
| 自查-1 | **同一份数据两个"最新值"**：`metrics()` 不合并本机写入，`metricByKey()` 合并 → 写入一条复查记录后，趋势图 6 点、可比性表 6 行，但**指标卡与一图秀选择器仍显示旧的 `0.086`** | 用户刚录入 `0.045`，卡片却告诉他最新是 `0.086`。与"数据只有一个来源"直接冲突 | 把合并点收敛到 `metrics()` 一处（新增 `baseMetrics()` 只读演示数据），`metricByKey()` 改为纯查找（避免双重合并） |
| 自查-2 | **指标卡 tab 从 lab 出发到不了**：`parseHash()` 只认 `lab`，其余一律 `trend`，`cards` 不进 hash → lab → cards 被 hashchange 打回 trend | 从 CML-LAB 子页想去看指标卡，点 tab 没反应 | 三个 tab 都进 hash（`#mol/cards`）；`mol-tab` handler 改为统一走 `goto('mol')` |

实测：写入 `2026-10-20 0.045` 后，pcr 卡显示 `0.045 · 已记录 6 次 · 最近采样 2026-10-20`；lab → cards 可达、7 张卡渲染、无 pageerror。

**这两条值得记的教训**：它们都不是"某条断言不严"，而是**同一种语义在两处各写一遍**（合并逻辑、tab 白名单）。
第四轮 P0-4（翻面状态不分档案）也是同一形状。**新增"按档案/按子页"的状态时，先找有没有第二处白名单/第二个合并点。**
