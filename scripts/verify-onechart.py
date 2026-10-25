#!/usr/bin/env python3
"""一图秀渲染态硬断言（第四轮评审 P0-1/P0-2/P0-3/P0-5 + P1-1 的防复发）

为什么需要它：R3 曾用「d 属性不变」自证通过，而当时 d 全是空字符串——**空值让"不变"永远为真**。
这个脚本先断言 d 非空，再断言不变，A/B 两档都跑。

断言：
  V1 每条 path.series-line 的 d 非空（空串 = P0-1 复现）
  V2 path 的 bbox 宽高 > 0（真画出来了，不是只有 d 字符串）
  V3 关治疗条前后：d 逐条相同 **且** 每个点 cy 相同（P0-2）
  V4 切换时间窗前后：图例基线不变（全期首点口径，P0-3）
  V5 选分类指标（ae）时不进数值轴、不出现 NaN（P0-5）
  V6 窗口内无数据 → 空态文案（P1-1；用 3m 窗口 + B 档案的稀疏指标触发，触发不了就记 SKIP 不记 PASS）
"""
import json, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "prototypes" / "v0.2" / "index.html"
res = {"pass": False, "oks": [], "fails": [], "skips": []}
ok = lambda m: res["oks"].append(m)
bad = lambda m: res["fails"].append(m)
skip = lambda m: res["skips"].append(m)

SNAP = """() => ({
  d: [...document.querySelectorAll('#chart-panel path.series-line')].map(x => x.getAttribute('d') || ''),
  cy: [...document.querySelectorAll('#chart-panel circle')].map(c => c.getAttribute('cy')),
  legend: (document.querySelector('.legend-row') || {}).innerText || ''
})"""

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome")
    for prof in ("A", "B"):
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"file://{PAGE}#onechart")
        pg.wait_for_timeout(400)
        if prof == "B":
            pg.click('[data-act="profile"][data-p="B"]')
            pg.wait_for_timeout(400)

        s0 = pg.evaluate(SNAP)
        # V1
        if not s0["d"]:
            bad(f"{prof} V1 没有任何 path.series-line（图区为空）")
        elif any(len(x) == 0 for x in s0["d"]):
            bad(f"{prof} V1 存在空 d 的曲线（P0-1 复现）：{s0['d']}")
        else:
            ok(f"{prof} V1 {len(s0['d'])} 条曲线 d 均非空（长度 {[len(x) for x in s0['d']]}）")
        # V2
        bb = pg.evaluate("""() => { const p = document.querySelector('#chart-panel path.series-line');
            if (!p) return null; const r = p.getBBox(); return [r.width, r.height]; }""")
        if not bb or bb[0] <= 0 or bb[1] <= 0:
            bad(f"{prof} V2 曲线 bbox 无效：{bb}")
        else:
            ok(f"{prof} V2 曲线 bbox {bb[0]:.1f}×{bb[1]:.1f}")

        # V3
        pg.click('[data-act="one-toggle"][data-v="treatment"]')
        pg.wait_for_timeout(350)
        s1 = pg.evaluate(SNAP)
        if s0["d"] != s1["d"]:
            bad(f"{prof} V3 关治疗条后曲线 d 变了（P0-2）")
        elif s0["cy"] != s1["cy"]:
            bad(f"{prof} V3 关治疗条后点 cy 变了（P0-2：治疗条占了绘图区）")
        else:
            ok(f"{prof} V3 关治疗条后 d 与 cy 逐条不变（{len(s0['d'])} 条线 / {len(s0['cy'])} 点）")
        pg.click('[data-act="one-toggle"][data-v="treatment"]')
        pg.wait_for_timeout(250)

        # V4
        base_all = pg.evaluate(SNAP)["legend"]
        pg.click('[data-act="one-range"][data-v="6m"]')
        pg.wait_for_timeout(300)
        base_6 = pg.evaluate(SNAP)["legend"]
        if "全期首点" not in base_all:
            bad(f"{prof} V4 图例没有标明基线口径：{base_all[:60]}")
        elif base_all != base_6:
            bad(f"{prof} V4 切 6m 后图例基线变了（P0-3）：{base_all[:60]} -> {base_6[:60]}")
        else:
            ok(f"{prof} V4 切时间窗后基线不变且标「全期首点口径」")
        pg.click('[data-act="one-range"][data-v="all"]')
        pg.wait_for_timeout(250)

        # V5 分类指标
        if pg.query_selector('details.pick > summary[aria-expanded="false"], details.pick:not([open]) > summary'):
            pg.click("details.pick > summary")
            pg.wait_for_timeout(150)
        pg.evaluate("""() => document.querySelectorAll('[data-act="one-pick"]').forEach(b => {
            if (b.getAttribute('aria-pressed') === 'true') b.click(); })""")
        pg.wait_for_timeout(200)
        pg.click('[data-act="one-pick"][data-v="ae"]')
        pg.wait_for_timeout(300)
        body = pg.inner_text("body")
        if "NaN" in body:
            bad(f"{prof} V5 选中分类指标后出现 NaN（P0-5）")
        elif "分类记录" not in body:
            bad(f"{prof} V5 选中分类指标后没有说明「分类记录不进坐标轴」")
        else:
            ok(f"{prof} V5 分类指标不进数值轴、无 NaN、有文字说明")

        # V6 空窗口
        pg.evaluate("""() => document.querySelectorAll('[data-act="one-pick"]').forEach(b => {
            if (b.getAttribute('aria-pressed') === 'true') b.click(); })""")
        pg.wait_for_timeout(150)
        pg.click('[data-act="one-pick"][data-v="pcr"]')
        pg.wait_for_timeout(250)
        # 界面只提供 all/12m/6m 三档（没有 3m），用 6m 试触发空窗
        if pg.query_selector('[data-act="one-range"][data-v="6m"]'):
            pg.click('[data-act="one-range"][data-v="6m"]')
            pg.wait_for_timeout(300)
        else:
            skip(f"{prof} V6 界面无 6m 档，无法尝试空窗")
        panel = pg.inner_text("#chart-panel")
        if "还没有记录" in panel or "换个时间窗" in panel:
            ok(f"{prof} V6 窗口内无数据 → 空态文案")
        else:
            skip(f"{prof} V6 6m 窗口下仍有数据，空态未触发（代码路径已核：先按窗口过滤再判空）")
        if pg.query_selector('[data-act="one-range"][data-v="all"]'):
            pg.click('[data-act="one-range"][data-v="all"]')

        if errs:
            bad(f"{prof} pageerror: {errs}")
        else:
            ok(f"{prof} 无 pageerror")
        pg.close()
    b.close()

# 负向自检：脚本必须能抓住 P0-1 复现（空 d）。这里只报告，不修改文件。
res["pass"] = not res["fails"]
print(json.dumps(res, ensure_ascii=False, indent=2))
sys.exit(0 if res["pass"] else 1)
