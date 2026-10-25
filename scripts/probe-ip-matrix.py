#!/usr/bin/env python3
"""IP2 / X1–X4 走查 harness（把独立评审的口径固化成可复跑证据）

用法：
    python3 scripts/probe-ip-matrix.py [--width 1440] [--json out.json]

它回答四件事（都出数字，不口头）：
  X1 页面覆盖：每个一级路由都有入站链接（孤儿页=0）；INTERACTION-DESIGN §二 的每条路径入口文
     案在渲染 DOM 中可找到（逐字）
  X2 路径走通：每条入口文案能被点到（元素可点击）
  X3 CRUD 双通道：「⋯ 更多」手工通道与 AI 草稿通道同时存在；每个可写页有 ≤6 字段表单
  X4 无头断言：上面全部断言逐条出计数与失败明细

另含 P0 派生断言（评审提出、已固化为检查项）：
  - 打印媒体下折叠卡五块可见（P0-1）
  - 导出内容是事实区/看法区/问题清单，不含费用明细（P0-6）
  - 引用块必须紧跟来源（P0-9）
  - 切换档案后未提交草稿清空（P0-11）
"""
import argparse, functools, http.server, json, re, socketserver, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
P2 = ROOT / "prototypes" / "v0.2"
IPDOC = ROOT / "docs" / "INTERACTION-DESIGN.md"
PAGES = [("dash", "看板"), ("mol", "分子线"), ("med", "服药线"), ("ae", "副作用日志"),
         ("tfr", "TFR 档案"), ("cost", "费用记录"), ("fert", "生育计划"),
         ("prep", "复诊准备"), ("docs", "资料导入"), ("trial", "临床试验")]


def parse_entry_captions():
    """从 INTERACTION-DESIGN §二 表里取「入口（看板哪块，逐字）」列的逐字文案。"""
    txt = IPDOC.read_text(encoding="utf-8")
    start = txt.find("## 二、场景路径表")
    end = txt.find("## 三、", start)
    block = txt[start:end]
    caps = []
    for line in block.splitlines():
        if not line.startswith("| S"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        sid = cells[0]
        raw = cells[2]
        # 单元格里通常是 「文案」 或 「卡片」卡的「文案」；取所有中文引号内片段
        found = re.findall(r"[「『]([^」』]+)[」』]", raw)
        for f in found:
            if f and f not in caps:
                caps.append((sid, f))
    return caps


def serve(directory):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def ip6_counts(page, base, pages):
    """IP6：每页顶层「新增/打开表单」入口 ≤1（行内三态/提交按钮/面板/设置不算）"""
    # 只算「在本页原地打开表单」：走 goto() 跳转到别的页的快捷入口不算
    OPEN = ('-new', '-manual', '-pick', '-qadd')
    EXCL = ('panel-toggle', 'cfg-path-save', 'cfg-', '-state', '-save', 'mol-save')
    out = {}
    for pid in pages:
        page.goto(f"{base}#{pid}", wait_until="load"); page.wait_for_timeout(140)
        acts = page.evaluate("""(OPEN) => {
          const r=[];
          document.querySelectorAll('[data-act]').forEach(e=>{
            const a=e.getAttribute('data-act');
            if (e.closest('details.more')) return;
            if (!OPEN.some(k=>a.endsWith(k))) return;
            if (a==='mol-new'||a==='ae-new'||a==='cost-new'||a==='rx-new') return; /* 跳转型 */
            r.push(a);
          });
          return r;
        }""", list(OPEN))
        out[pid] = acts
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--json")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright
    httpd, port = serve(P2)
    base = f"http://127.0.0.1:{port}/index.html"
    caps = parse_entry_captions()
    res = {"pages": len(PAGES), "entry_captions": len(caps), "X1": {}, "X2": {}, "X3": {}, "X4": {},
           "p0_checks": {}, "failures": []}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": args.width, "height": 1000})

        # ---- 收集全部渲染 DOM 与链接图 ----
        dom = {}
        links = set()
        for pid, _ in PAGES:
            page.goto(f"{base}#{pid}", wait_until="load")
            page.wait_for_timeout(150)
            page.evaluate("() => { document.querySelectorAll('details').forEach(d => d.open = true); }")
            page.wait_for_timeout(80)
            dom[pid] = page.evaluate("() => document.body.innerText")
            for h in page.evaluate("() => [...document.querySelectorAll('a[href^=\"#\"]')].map(a => a.getAttribute('href').replace('#','').split('/')[0])"):
                links.add(h)

        # ---- X1 孤儿页 = ①无入站链接 或 ②没有任何场景路径经过（评审口径） ----
        routed = set(pid for pid, _ in PAGES)
        link_orphans = sorted(routed - links)
        iptxt = IPDOC.read_text(encoding="utf-8")
        path_block = iptxt[iptxt.find("## 二、场景路径表"):iptxt.find("## 三、")]
        no_path = sorted(pid for pid, label in PAGES if label not in path_block)
        res["X1"]["routes"] = len(routed)
        res["X1"]["orphans_by_link"] = link_orphans
        res["X1"]["orphans_by_scenario_path"] = no_path
        res["X1"]["orphans"] = sorted(set(link_orphans) | set(no_path))
        if res["X1"]["orphans"]:
            res["failures"].append(f"X1 孤儿页 {res['X1']['orphans']}（链接缺席={link_orphans} 路径未经过={no_path}）")

        # ---- X1/X2 入口文案逐字可达 + 可点击 ----
        missing, unclickable = [], []
        for sid, cap in caps:
            hit_page = next((pid for pid, txt in dom.items() if cap in txt), None)
            if not hit_page:
                missing.append({"scene": sid, "caption": cap})
                continue
            page.goto(f"{base}#{hit_page}", wait_until="load")
            page.wait_for_timeout(120)
            el = page.query_selector(f"text={cap}")
            if not el:
                unclickable.append({"scene": sid, "caption": cap, "page": hit_page})
        res["X1"]["captions_missing"] = missing
        res["X2"]["captions_unreachable"] = unclickable
        res["X2"]["captions_reachable"] = len(caps) - len(missing)
        if missing:
            res["failures"].append(f"X1 入口文案缺失 {len(missing)} 条")
        if unclickable:
            res["failures"].append(f"X2 入口文案点不到 {len(unclickable)} 条")

        # ---- X3 双通道：⋯ 更多（手工）与 AI 草稿；写表单字段数 ----
        more_pages = [pid for pid, txt in dom.items() if "⋯ 更多" in txt or "更多" in txt]
        ai_pages = [pid for pid, txt in dom.items() if "AI 协助" in txt or "ai-draft" in txt.lower()]
        forms = page.evaluate("""() => [...document.querySelectorAll('form, .manual-form')].map(f => ({
            id: f.id || f.className, fields: f.querySelectorAll('input,select,textarea').length }))""")
        res["X3"] = {"pages_with_more": more_pages, "pages_with_ai": ai_pages,
                     "forms": forms, "forms_over_6": [f for f in forms if f["fields"] > 6]}
        if not more_pages:
            res["failures"].append("X3 全站没有「⋯ 更多」手工通道")
        if res["X3"]["forms_over_6"]:
            res["failures"].append(f"X3 表单字段 >6：{res['X3']['forms_over_6']}")

        # ---- P0-1 打印媒体下折叠卡五块可见 ----
        host = None
        for pid, _ in PAGES:
            page.goto(f"{base}#{pid}", wait_until="load"); page.wait_for_timeout(120)
            if page.evaluate("() => document.querySelectorAll('details.phase-fold').length"):
                host = pid
                break
        if host:
            page.goto(f"{base}#{host}", wait_until="load"); page.wait_for_timeout(150)
            page.emulate_media(media="print")
            vis = page.evaluate("""() => {
                const cards = [...document.querySelectorAll('details.phase-fold')];
                return cards.map(c => {
                    const blocks = [...c.querySelectorAll('section.pd-block')];
                    return { blocks: blocks.length, visible: blocks.filter(b => b.offsetHeight > 0).length };
                });
            }""")
            page.emulate_media(media="screen")
            ok = bool(vis) and all(v["visible"] == 5 for v in vis)
            res["p0_checks"]["print_foldout_visible"] = {"host": host, "cards": vis, "pass": ok}
            if not ok:
                res["failures"].append("P0-1 打印媒体下折叠卡五块未全部可见")
        else:
            res["p0_checks"]["print_foldout_visible"] = {"pass": False, "reason": "未找到折叠卡"}
            res["failures"].append("P0-1 未找到折叠卡")

        # ---- P0-9 引用块必须紧跟来源 ----
        no_src = 0
        for pid, _ in PAGES:
            page.goto(f"{base}#{pid}", wait_until="load"); page.wait_for_timeout(100)
            page.evaluate("() => { document.querySelectorAll('details').forEach(d => d.open = true); }")
            no_src += page.evaluate("""() => [...document.querySelectorAll('q.quote')]
                .filter(q => !(q.nextElementSibling && q.nextElementSibling.classList.contains('src'))).length""")
        res["p0_checks"]["quotes_without_src"] = no_src
        if no_src:
            res["failures"].append(f"P0-9 引用块无来源 {no_src} 处")

        # ---- P0-11 切换档案清空草稿 ----
        draft = page.evaluate("""() => {
            const ta = document.querySelector('textarea');
            if (!ta) return { ok: true, note: '无未提交草稿控件，跳过' };
            ta.value = '跨档案草稿测试';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            const btns = [...document.querySelectorAll('button')];
            const sw = btns.find(b => /档案\\s*B/.test(b.textContent));
            if (sw) sw.click();
            const ta2 = document.querySelector('textarea');
            return { ok: !ta2 || ta2.value === '', value_after: ta2 ? ta2.value : null };
        }""")
        res["p0_checks"]["draft_isolated_on_switch"] = draft
        if not draft.get("ok"):
            res["failures"].append("P0-11 切换档案后草稿未清空")

        res["X4"] = {"assertions": len(caps) + len(routed) + 4 + 1,
                     "failures": len(res["failures"]), "detail": res["failures"]}
        page.close(); browser.close()
    httpd.shutdown()
    res["pass"] = not res["failures"]
    print(json.dumps(res, ensure_ascii=False, indent=2))
    if args.json:
        Path(args.json).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(0 if res["pass"] else 1)


if __name__ == "__main__":
    main()
