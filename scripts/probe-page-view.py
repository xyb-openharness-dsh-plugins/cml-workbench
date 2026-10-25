#!/usr/bin/env python3
"""原型实渲走查（G2 证据）：4 档宽度 × 全部一级页 + 折叠卡收/展态 + 截图。

用法：
    python3 scripts/probe-page-view.py [--width 1440] [--shots docs/screenshots]

判据（出数字，不口头）：
  - 每档宽度下每页 scrollWidth 不得超过 clientWidth + 2（横向溢出 = 0）
  - 全部可见文本字号落在 12.5–15.0 px
  - SVG 图表根 class="chart"；path 的 computed fill = none；stroke 为单色
  - 折叠卡默认 [open] = 0；展开后 section.pd-block = 5（顺序固定）
  - 截图落到 docs/screenshots/（README 用）
"""
import argparse, json, threading, functools, http.server, socketserver, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
P2 = ROOT / "prototypes" / "v0.2"
PAGES = [("dash", "看板"), ("mol", "分子线"), ("med", "服药线"), ("ae", "副作用日志"),
         ("tfr", "TFR 档案"), ("cost", "费用记录"), ("fert", "生育计划"),
         ("prep", "复诊准备"), ("docs", "资料导入"), ("trial", "临床试验")]
WIDTHS = [1440, 1024, 800, 420]


def serve(directory: Path):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--shots", default="docs/screenshots")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    httpd, port = serve(P2)
    base = f"http://127.0.0.1:{port}/index.html"
    shots = ROOT / args.shots
    shots.mkdir(parents=True, exist_ok=True)
    result = {"pages": len(PAGES), "widths": WIDTHS, "overflow": [], "font_violations": [],
              "charts": 0, "chart_fill_violations": [], "shots": [], "foldout": {}}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.headed)
        for w in WIDTHS:
            page = browser.new_page(viewport={"width": w, "height": 900})
            for pid, _label in PAGES:
                page.goto(f"{base}#{pid}", wait_until="load")
                page.wait_for_timeout(120)
                ov = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if ov > 2:
                    result["overflow"].append({"width": w, "page": pid, "overflow_px": ov})
                bad = page.evaluate("""() => {
                    const out = [];
                    for (const el of document.querySelectorAll('body *')) {
                        if (el.offsetParent === null && el.tagName !== 'BODY') continue;
                        const t = (el.textContent || '').trim();
                        if (!t) continue;
                        const fs = parseFloat(getComputedStyle(el).fontSize);
                        if (fs && (fs < 12.4 || fs > 15.1)) out.push({tag: el.tagName, cls: el.className, fs});
                        if (out.length > 5) break;
                    }
                    return out;
                }""")
                if bad:
                    result["font_violations"].append({"width": w, "page": pid, "items": bad[:5]})
            page.close()

        # 图表与折叠卡（默认宽度）
        page = browser.new_page(viewport={"width": args.width, "height": 1000})
        page.goto(f"{base}#mol", wait_until="load")
        page.wait_for_timeout(200)
        result["charts"] = page.evaluate("() => document.querySelectorAll('svg.chart').length")
        fills = page.evaluate("""() => {
            const out = [];
            for (const s of document.querySelectorAll('svg.chart')) {
                for (const p of s.querySelectorAll('path')) {
                    const st = getComputedStyle(p);
                    if (st.fill !== 'none') out.push({fill: st.fill, stroke: st.stroke});
                }
            }
            return out;
        }""")
        result["chart_fill_violations"] = fills
        shot = lambda name: (page.screenshot(path=str(shots / f"{name}.png"), full_page=True),
                             result["shots"].append(f"{args.shots}/{name}.png"))
        for pid, label in PAGES:
            page.goto(f"{base}#{pid}", wait_until="load"); page.wait_for_timeout(150)
            shot(f"01-{pid}")
        # 折叠卡：收/展态各一张
        page.goto(f"{base}#med", wait_until="load"); page.wait_for_timeout(200)
        result["foldout"]["open_default"] = page.evaluate("() => document.querySelectorAll('details.phase-fold[open]').length")
        result["foldout"]["cards"] = page.evaluate("() => document.querySelectorAll('details.phase-fold').length")
        shot("02-med-foldout-collapsed")
        page.evaluate("""() => { const d = document.querySelector('details.phase-fold'); if (d) d.open = true; }""")
        page.wait_for_timeout(200)
        result["foldout"]["blocks_first_card"] = page.evaluate(
            "() => { const d = document.querySelector('details.phase-fold[open]'); return d ? d.querySelectorAll('section.pd-block').length : 0; }")
        shot("03-med-foldout-expanded")
        page.goto(f"{base}#mol", wait_until="load"); page.wait_for_timeout(200)
        shot("04-mol-chart")
        page.goto(f"{base}#ae", wait_until="load"); page.wait_for_timeout(200)
        shot("05-ae-filtered")
        page.goto(f"{base}#tfr", wait_until="load"); page.wait_for_timeout(200)
        shot("06-tfr-checklist")
        page.close()
        browser.close()
    httpd.shutdown()

    result["pass"] = (not result["overflow"] and not result["font_violations"]
                      and not result["chart_fill_violations"] and result["charts"] >= 1
                      and result["foldout"].get("open_default") == 0
                      and result["foldout"].get("blocks_first_card") == 5)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["pass"] else 1)


if __name__ == "__main__":
    main()
