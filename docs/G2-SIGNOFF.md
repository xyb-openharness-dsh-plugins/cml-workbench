# G2 签认包 · CML 工作台 M2（原型）

状态：**待用户签认**。本文件是给用户的决策清单，不是自述成绩单——每条都写清"证据长什么样、怎么自己复核"。

- 生成时间：2026-10-25
- 原型指纹：`app.js e53cbfeb/2726` · `index.html 99f9b62e/300` · `style.css 4d7f33bc/406` · `demo-data.js d4fbc2b1/2`
- 唯一数据源：`demo/build-demo-data.mjs`（`node demo/build-demo-data.mjs` 可复现，内置断言会自己抛错）

## 一、M2 要求 vs 实际

| M2 要求 | 实际 | 怎么自己验 |
| --- | --- | --- |
| 原型 demo 唯一源 + 四件套 | `demo/build-demo-data.mjs` 生成 `demo-data.js`，四件套在 `prototypes/v0.2/` | `node demo/build-demo-data.mjs` 看 `{"ok":true,...}` |
| 治疗线用 32 号折叠卡 | 7 张 `<details class="phase-fold">`，固定五块，共 35 块 | `node scripts/check-prototype.mjs` 的 foldout 断言 |
| 窄宽 30 号 | 1440/1024/800/420 四档 × **11 页** × 展开态，横向溢出 0 | `python3 scripts/probe-page-view.py` |
| HVT X1–X4 | X1=0（11 路由、孤儿 0）/ X2=0 / X3=0 / X4=0 | `python3 scripts/probe-ip-matrix.py` |
| SVG 根 `class="chart"` | **8 个**（A+B × dash/mol/onechart/cost 各 1；`svg:not(.chart)=0`），加入一图秀后由 6 增至 8 | `probe-page-view.py` 的 charts |
| smoothPath 用 Fritsch–Carlson | 自实现单调三次，含单调性修正 | `grep -n "function smoothPath" prototypes/v0.2/app.js` |
| AI 按钮走 `xxx:agent-draft` 一键携带提示词 | `aiButton(page,label,prompt)`，有 prompt 时带 `data-prompt`，只填不发 | `probe-ip-matrix.py` 的 agent-draft 断言 |
| 独立评审判 P0=0 | 前四轮：11 → 2 → 2 → 见第四轮 | `docs/PROTOTYPE-REVIEW*.md` |
| README 按 33 号 ≥4 张实渲截图 + 折叠收/展态 | 12 张（含折叠收/展、指标卡/翻面、一图秀、三档匹配、窄宽） | `node scripts/check-readme-assets.mjs` |

## 二、用户 m01086 三条新需求（本轮新增）

1. **指标卡有序 · 分系列 · 3D 反转** → 分子线「指标卡（分系列·翻面）」tab：7 卡 / 4 类 / 类别标题带项数与有记录数；
   点卡翻 180°，**翻转前后 rect 完全一致（位移 0.0）**，480ms，每卡独立，翻面不重渲染。
2. **一图秀指标选择窗口** → 新一级页「病情一图秀」：窗口按类别分组、独立滚动、最多 4 条；时间窗/治疗条开关；
   只重绘 `#chart-panel`；不可比处断开并给说明。
3. **临床试验：建档 → 检索/AI 协助 → 自带 sqlite + 外部技能 → 三档 + 匹配指数** →
   「匹配指数」按家族规范实为**入组档案完整度 x/y**（不是匹配度百分比，27 号禁止综合评分）。
   现实现：18 字段/7 组建档（全部来自既有病情数据）、11 条规则（10 confirmed + 1 pending）、三档确定性求值、
   **缺字段永远流向「无法判定」**、汇总只计数、不排序不推荐、渠道覆盖如实。
   A 完整度 **14/18**（满足 7/冲突 0/无法判定 3），B **13/18**（满足 5/冲突 1/无法判定 4）。
   4 条试验为**演示虚构**，M4 接 unified-trial-mcp 后整体替换。

## 三、本轮我修掉的、复审没抓到的问题（自查清单）

| # | 问题 | 后果 | 修法 |
| --- | --- | --- | --- |
| 1 | 卡片用了 `q.date`，数据字段是 `d` | 全站显示 `undefined` | 全局替换；`grep -c "\.date"` = 0 |
| 2 | `segmentsOf` 返回 `[{pts,gap}]`，`miniSVG` 当数组用 | **整页白屏**（`seg.map is not a function`） | 改为迭代 `seg.pts` |
| 3 | 免责文案里写了「总分/综合评分/健康指数」 | 反而触发 27 号验收红线 | 改写为「不把多个指标合成一个数字」 |
| 4 | `<details open>` | 默认展开 details 必须为 0 的断言失败 | 去掉 `open` |
| 5 | `svg .ax` 11px | 字号越界 | 12.5px |
| 6 | 卡片断点 700px | 27 号要求 860px 档单列，三档断言不过 | 改 960px |
| 7 | `onechart` 是**孤儿页**（无入站链接、无场景路径） | 用户无法从界面到达 | 看板 + 试验页加入口；补 S10/S11 |
| 8 | A 档案注释写「8 月起换实验室」但四条同实验室 | 「不可比」演示形同虚设 | 补真实外院 `is_std=0` 记录 |

## 四、检查器口径改动（需要用户知道并认可的）

- `check-prototype.mjs` 字号断言由「一律 12.5–15」改为**按选择器豁免**（`.mval` 允许 33px，依据 24 号 §5）。
  豁免必须逐选择器声明，新增豁免要记进 `DEV-REQUIREMENTS §七`。**不是放宽断言，是修正粒度**。
- 三个探针的 `PAGES` 补 `onechart`；新增 `check-probe-coverage.mjs` 断言「探针覆盖 = `ROUTES`」，
  防止以后加页漏扫（已双向验证）。

## 五、明确未验证（不写"通过"）

1. 实体打印机分页与断卡位置（只验了 Chrome `page.pdf()` 的页数/字节与文本层）。
2. 浏览器大字缩放 125%/150% 下无横向滚动、按钮触控 ≥44px（只用 CSS 与四档宽度验，未真机缩放）。
3. 触屏拖拽会话区（只有代码路径）。
4. Safari / Firefox 下 3D 翻面与 `inert`。
5. MinerU 六部件、真实试验数据、API 凭据——全是界面态。
6. 一图秀未做 zoom / 关键点 / 变化标注三个可选图层，`pin` 未实现。
7. 内存态：刷新即回演示数据，未接后端持久化。

## 六、签认选择

- **A. 签认 G2**，进入 M3（schema/0001 + freeze-contract sha256 + 判读列断言）。
- **B. 先补未验证项**（例如大字缩放、Safari 翻面）再签。
- **C. 指出要改的地方**，我改完再送一轮。

> 我的建议：先看第四节那两条检查器口径改动是否接受；如果接受，A/B/C 里我推荐 **A**——
> 因为第 5 节列的未验证项里，1/2/3/4 都要等 M6 装进 Desktop 才能真验，在 M2 阶段强推只会变成"假装验过"。

## 七、第四轮独立评审结论（待填）

_评审子代理 `f7be6f17` 正在跑，产出 `docs/PROTOTYPE-REVIEW-4.md`。结论到达后补在此处，并按 P0 数决定是否仍然建议 A。_

## 八、签认包自查时发现的一处待修

写本包时顺手复算了自检里的数字，发现 `prototypes/v0.2/index.html` 第 5 条写着「图表 SVG 数 = 6」
（分子线/看板/费用各 1，A/B 各 3），但加入一图秀后**实测是 8**（每份档案 dash/mol/onechart/cost 各 1，A+B 共 8）。

- 折叠卡那条是对的：A 4 张 + B 3 张 = **7**，实测一致。
- 图表数这条**已过期**，需要把 6 改成 8 并写明 onechart 计入。

处理时机：第四轮评审正在核对 `index.html` 的冻结哈希，**现在改会让它核的哈希失效**。
故本条先记在此处，等评审报告回来后与它列出的问题一起改（一处提交、一次复跑检查器）。

## 九、自查发现的第二处待修（逻辑，不是数字）

`app.js` `chartPanel()` 里的空态判断写的是：

```js
var allEmpty = ms.every(function (m) { return !(m.points || []).length; });
```

它看的是指标**全部记录**是否为空，而 16 号 R2 要求的是「**窗口内**没数据 → 空态」。
后果：如果选的指标在所选时间窗内一条都没有、但在窗外有记录，面板会画出一张**没有任何曲线的空图**，不给任何说明。
当前演示数据跨度 2026-01～2026-10，`all/12m/6m` 三个窗口都还有点，所以**这条现在触发不了**——属潜伏缺陷，但逻辑确实错了。

正确写法应是先取窗口内的点再判空：

```js
var windowed = ms.map(function (m) { return inWindow(m.points || [], state.oneRange || 'all'); });
var allEmpty = windowed.every(function (p) { return !p.length; });
// 且单条曲线在窗口内为空时，应逐条说明"这条在所选时间窗内没有记录"，而不是静默跳过
```

处理时机同第八节：等第四轮评审报告回来一起改、一起复跑检查器，避免让它的哈希核对失效。
