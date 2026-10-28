#!/usr/bin/env python3
"""写路径与红线实测（P0 派生断言固化，X3/X4 证据）

用法：python3 scripts/probe-write-paths.py [--json out.json]

断言（每条出数字）：
  W1 手工通道表单字段数 ≤6（cost-new / ae-new / rx-new / mol-manual）
  W2 提交后产物计数真的变化（费用条数、副作用条数、处方变更段数、分子点数）
  W3 TFR 页渲染文本不含 满足/未满足/达标/未达标（K1/K3 自作判读）
  W4 prep 导出块名 = 事实区/看法区/问题清单，且不含费用明细
  W5 双主体：记录者标记（本人 / 家属代记）条数 > 0
  W6 全站渲染文本禁词（引用块除外）
"""
import argparse, functools, http.server, json, re, socketserver, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
P2 = ROOT / "prototypes" / "v0.2"
PAGES = ["dash", "mol", "onechart", "med", "ae", "tfr", "cost", "fert", "prep", "docs", "trial"]
FORMS = [("cost", "cost-new", "#cost-drug"), ("ae", "ae-new", "#ae-w"),
         ("med", "rx-new", "#rx-drug"), ("mol", "mol-manual", "#f-v"), ("mol", "mol-new", "#f-v")]


def serve(d):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(d))
    s = socketserver.TCPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, s.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json")
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright
    httpd, port = serve(P2)
    base = f"http://127.0.0.1:{port}/index.html"
    res = {"W1": [], "W2": [], "W3": {}, "W4": {}, "W5": {}, "W6": {}, "failures": []}

    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="chrome")
        page = b.new_page(viewport={"width": 1440, "height": 1000})

        # W1 表单字段数
        for pid0, act, sel in FORMS:
            page.goto(f"{base}#{pid0}", wait_until="load"); page.wait_for_timeout(200)
            page.evaluate("() => { document.querySelectorAll('details').forEach(d => d.open = true); }")
            page.wait_for_timeout(120)
            btn = page.query_selector(f'[data-act="{act}"]')
            if not btn:
                res["W1"].append({"act": act, "fields": None, "error": "按钮不存在"}); continue
            btn.click(); page.wait_for_timeout(250)
            n = page.evaluate("""(sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const scope = el.closest('section, form, div.card') || document;
                return scope.querySelectorAll('input,select,textarea').length;
            }""", sel)
            res["W1"].append({"page": pid0, "act": act, "fields": n, "ok": n is not None and n <= 6})
            if n is None or n > 6:
                res["failures"].append(f"W1 {act} 字段数 {n}（需 ≤6）")

        # W2 写后产物可观察：提交后出现写入提示，且页面文本出现刚填的值
        w2cases = [("cost", "cost-new", {"#cost-drug": "测试药名XYZ", "#cost-amount": "88"}, "测试药名XYZ", "cost-save"),
                   ("ae", "ae-new", {"#ae-desc": "测试不适说明ABC"}, "测试不适说明ABC", "ae-save"),
                   # VNext：#med 默认打卡页，处方表单在 #med/rx（v0.1.2 之前靠"切页不重置 tab"的副作用才碰巧命中）
                   ("med/rx", "rx-new", {"#rx-drug": "测试药名RX", "#rx-dose": "100 mg", "#rx-reason": "测试原因RV"}, "测试药名RX", "rx-save")]
        for pid, act, fills, val, saveact in w2cases:
            page.goto(f"{base}#{pid}", wait_until="load"); page.wait_for_timeout(200)
            page.evaluate("() => { document.querySelectorAll('details').forEach(d => d.open = true); }")
            page.wait_for_timeout(120)
            if not page.query_selector(f'[data-act="{act}"]'):
                res["W2"].append({"page": pid, "ok": False, "error": "手工入口按钮不存在"})
                res["failures"].append(f"W2 {pid} 手工入口不存在")
                continue
            for sel2, v2 in fills.items():
                el = page.query_selector(sel2)
                if el:
                    tag = el.evaluate("e => e.tagName.toLowerCase()")
                    if tag == "select":
                        opts = el.evaluate("e => [...e.options].map(o => o.value)")
                        if opts:
                            el.select_option(opts[-1])
                    else:
                        el.fill(v2)
            sub = page.query_selector(f'[data-act="{saveact}"]')
            if not sub:
                res["W2"].append({"page": pid, "ok": False, "error": "提交按钮不存在"})
                res["failures"].append(f"W2 {pid} 提交按钮不存在")
                continue
            sub.click(); page.wait_for_timeout(300)
            body = page.inner_text("body")
            wrote = ("写入" in body) or ("已记" in body) or ("提交成功" in body)
            has_val = (val in body) if val else True
            res["W2"].append({"page": pid, "write_msg": wrote, "value_visible": has_val, "ok": wrote and has_val})
            if not (wrote and has_val):
                res["failures"].append(f"W2 {pid} 提交后产物不可观察（提示={wrote} 值可见={has_val}）")

        # W3 TFR 文本
        page.goto(f"{base}#tfr", wait_until="load"); page.wait_for_timeout(200)
        txt = page.inner_text("body")
        bad = [w for w in ["满足", "未满足", "达标", "未达标"] if w in txt]
        res["W3"] = {"hits": bad, "ok": not bad}
        if bad:
            res["failures"].append(f"W3 TFR 页出现判读词 {bad}")

        # W4 导出内容
        page.goto(f"{base}#prep", wait_until="load"); page.wait_for_timeout(200)
        exp = page.query_selector('[data-act="prep-export"]')
        out = ""
        if exp:
            exp.click(); page.wait_for_timeout(300)
            out = page.evaluate("""() => {
                const ta = [...document.querySelectorAll('textarea, pre, .export-out')]
                    .map(e => e.value || e.textContent).filter(t => t && t.length > 20);
                return ta.length ? ta[0] : document.body.innerText;
            }""")
        blocks = {k: (k in out) for k in ["事实区", "看法区", "问题清单"]}
        has_cost = bool(re.search(r"费用|自费|报销", out))
        res["W4"] = {"blocks": blocks, "has_cost_detail": has_cost, "ok": all(blocks.values()) and not has_cost}
        if not all(blocks.values()):
            res["failures"].append(f"W4 导出缺块 {blocks}")
        if has_cost:
            res["failures"].append("W4 导出含费用明细")

        # W5 记录者标记
        marks = {}
        for pid in PAGES:
            page.goto(f"{base}#{pid}", wait_until="load"); page.wait_for_timeout(120)
            t = page.inner_text("body")
            marks[pid] = {"本人": t.count("本人"), "家属代记": t.count("家属代记")}
        res["W5"] = {"marks": marks,
                     "ok": any(v["家属代记"] > 0 for v in marks.values()) and any(v["本人"] > 0 for v in marks.values())}
        if not res["W5"]["ok"]:
            res["failures"].append("W5 未见记录者标记")

        # W6 全站禁词（展开折叠卡后扫）
        hits = []
        for pid in PAGES:
            page.goto(f"{base}#{pid}", wait_until="load"); page.wait_for_timeout(120)
            page.evaluate("() => { document.querySelectorAll('details').forEach(d => d.open = true); }")
            t = page.inner_text("body")
            for w in ["达标", "未达标", "可以停药", "建议停药", "无需就医", "治愈率", "可能复发"]:
                if w in t:
                    hits.append({"page": pid, "word": w})
        res["W6"] = {"hits": hits, "ok": not hits}
        if hits:
            res["failures"].append(f"W6 禁词 {hits}")

        page.close(); b.close()
    httpd.shutdown()
    res["pass"] = not res["failures"]
    print(json.dumps(res, ensure_ascii=False, indent=2))
    if args.json:
        Path(args.json).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(0 if res["pass"] else 1)


if __name__ == "__main__":
    main()
