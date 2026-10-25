# PROTOTYPE-FIXES · P0 修复留痕（M2）

日期：**2026-10-25**。对象：`prototypes/v0.2/{index.html,app.js,style.css}`（`demo-data.js` 只读未改，sha256 = `efef460e816caa485ab9d77d47b5fd13ca9649f21bda2cf2b5fbcccc2b6dac33`）。
评审来源：`docs/PROTOTYPE-REVIEW.md`（独立评审，P0=11 / P1=18 / P2=12；X1=X2=X3=0, X4=1）。
修复后冻结提交：`7841dba`（app.js `d025378d…` 2116 行 / index.html `7ec65de3…` 258 行 / style.css `93654520…` 296 行）。

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
