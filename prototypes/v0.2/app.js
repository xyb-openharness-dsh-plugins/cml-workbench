/* 小粒宝 GranPal · CML 患者工作台 · M2 交互原型（v0.1.0）
 * 数据来源：window.DEMO_DATA（prototypes/v0.2/demo-data.js，只读；本文件不修改、不重新生成数据）
 * 规则：无判读列 / 趋势线单色 / 分类值不画曲线 / private 三出口代码级过滤 / 全站字号 12.5-15px
 */
(function () {
  'use strict';

  var VERSION = 'v0.1.0';
  var BUILD = '2026-10-25';
  var DATA_DIR = '~/GranPal/病历资料';
  var TODAY = '2026-10-13';
  var DATA = (typeof window !== 'undefined' && window.DEMO_DATA) ? window.DEMO_DATA
    : { profiles: {}, metrics: {}, trials: [] };

  var ROUTES = ['dash', 'mol', 'med', 'ae', 'tfr', 'cost', 'fert', 'prep', 'docs', 'trial'];
  var ROUTE_LABEL = {
    dash: '看板', mol: '分子线', med: '服药线', ae: '副作用日志', tfr: 'TFR 档案',
    cost: '费用记录', fert: '生育计划', prep: '复诊准备', docs: '资料导入', trial: '临床试验'
  };
  /* 红线：TFR 与生育两线不提供 AI 生成 */
  var AI_FORBIDDEN = { tfr: '红线：停药相关重大决策不 AI 生成', fert: '红线：生育相关重大决策不 AI 生成' };

  var state = {
    profile: 'A',
    route: 'dash',
    medTab: 'checkin',
    molKeys: ['pcr'],
    molRange: 'all',
    molScale: 'linear',
    molDemo: 'plain',
    molState: 'live',        /* live | empty | single | rejected */
    molDraft: null,
    checkin: null,           /* null | taken | missed */
    writeFail: false,
    aeVis: {},               /* 行级 visibility 覆盖 */
    tfrState: {},
    prepRange: 'range-3m',
    panelCollapsed: false,
    lastDraft: null
  };

  /* ================= 基础工具 ================= */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function q(text, src) {
    return '<q class="quote">' + esc(text) + '</q>' + (src ? '<span class="src">来源：' + esc(src) + '</span>' : '');
  }
  function num(v, dec) {
    if (typeof v !== 'number') return String(v == null ? '未记录' : v);
    return dec == null ? String(v) : v.toFixed(dec);
  }
  function profile() { return DATA.profiles[state.profile] || {}; }
  function metrics() { return (DATA.metrics && DATA.metrics[state.profile]) || []; }
  function metricByKey(k) {
    var ms = metrics();
    for (var i = 0; i < ms.length; i++) if (ms[i].key === k) return ms[i];
    return null;
  }
  function trials() { return DATA.trials || []; }
  function authorRole() { return state.profile === 'B' ? '家属代记' : '患者本人'; }

  /* 顶栏/页脚/设置都读同一份版本字面量 */
  function version() { return VERSION; }

  function monthsUntil(s) {
    var m = /(\d{4})-(\d{2})/.exec(String(s || ''));
    if (!m) return null;
    var t = new Date(TODAY + 'T00:00:00Z');
    var d = new Date(m[1] + '-' + m[2] + '-01T00:00:00Z');
    return Math.max(0, Math.round((d - t) / (30.44 * 24 * 3600 * 1000)));
  }
  function addMonths(iso, n) {
    var d = new Date(iso + 'T00:00:00Z');
    var day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
    var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.toISOString().slice(0, 10);
  }
  function t(iso) { return new Date(iso + 'T00:00:00Z').getTime(); }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ================= 统一私密过滤：三出口 ================= */
  /* 出口只有三个：导出 export / AI 上下文 ai / 摘要 summary */
  var EXITS = ['export', 'ai', 'summary'];
  var FILTER_LOG = [];

  function filterPrivate(list, exit) {                       /* filterPrivate(list, exit) */
    if (EXITS.indexOf(exit) < 0) throw new Error('filterPrivate: 未知出口 ' + exit);
    var arr = Array.isArray(list) ? list : [];
    var kept = [], dropped = [];
    for (var i = 0; i < arr.length; i++) {
      var row = arr[i] || {};
      if (row.visibility === 'private') dropped.push(row); else kept.push(row);
    }
    FILTER_LOG.push({ exit: exit, kept: kept.length, dropped: dropped.length });
    return kept;
  }
  function lastFilter(exit) {
    for (var i = FILTER_LOG.length - 1; i >= 0; i--) if (FILTER_LOG[i].exit === exit) return FILTER_LOG[i];
    return { exit: exit, kept: 0, dropped: 0 };
  }

  /* ================= 私密条目来源 ================= */
  /* 生育计划：条目默认 visibility='private' */
  function fertilityRows() {
    var p = profile();
    return (p.fertility || []).map(function (row, i) {
      return {
        id: 'fert-' + state.profile + '-' + i,
        kind: 'fert',
        label: row[0],
        text: row[1],
        source: row[2],
        visibility: 'private'                 /* 默认 private */
      };
    });
  }
  /* 副作用私密条目：数据行默认 shared，另有 1 条原型示例私密条目（visibility='private'） */
  var PRIVATE_AE_EXAMPLE = {
    A: { d: '2026-09-28', name: '（示例）夜里睡不好', drug: 'dasatinib', desc: '躺下想事情，担心拖累家里', action: '本人自述；未与医生提过', doc: '' },
    B: { d: '2026-10-06', name: '（示例）等报告吃不下饭', drug: 'withdrawal', desc: '等报告那几天没什么胃口', action: '家属代记；未与医生提过', doc: '' }
  };
  function aeRows() {
    var p = profile();
    var rows = (p.ae || []).map(function (row, i) {
      var id = 'ae-' + state.profile + '-' + i;
      return {
        id: id, d: row[0], name: row[1], drug: row[2], desc: row[3],
        action: row[4], doc: row[5],
        visibility: state.aeVis[id] || 'shared'
      };
    });
    var ex = PRIVATE_AE_EXAMPLE[state.profile];
    if (ex) {
      var id2 = 'ae-' + state.profile + '-private';
      rows.push({
        id: id2, d: ex.d, name: ex.name, drug: ex.drug, desc: ex.desc, action: ex.action,
        doc: ex.doc, example: true,
        visibility: state.aeVis[id2] || 'private'   /* 私密条目默认 private */
      });
    }
    return rows;
  }
  function sensitiveRecords() {
    var rows = fertilityRows().concat(aeRows().filter(function (r) { return r.example; }));
    return rows.map(function (r) {
      return {
        id: r.id, kind: r.kind || 'ae',
        label: r.label || r.name,
        text: (r.text || r.desc),
        source: r.source || (r.d + ' ' + r.action),
        visibility: r.visibility
      };
    });
  }

  /* ================= 副作用词表：按当前用药过滤 ================= */
  var AE_LEXICON = {
    dasatinib: ['胸腔积液 / 气促', '眼睑水肿', '外周水肿', '头痛', '皮疹', '腹泻', '肌肉痉挛（小腿）', '血小板减少', '中性粒细胞减少'],
    imatinib: ['眼睑水肿', '肌肉痉挛（小腿）', '皮疹', '腹泻', '恶心', '白细胞偏低', '肝功能相关指标变化', '眼眶周围水肿'],
    nilotinib: ['肝功能相关指标变化', '皮疹', '头痛', '血糖相关指标变化', 'QT 间期相关指标变化'],
    withdrawal: ['肌肉骨骼疼痛', '皮肤瘙痒', '乏力', '关节痛', '失眠']
  };
  function currentDrugKey() {
    var ml = profile().med_log || {};
    return ml.drug_key || 'none';
  }
  function currentDrugLabel() {
    var k = currentDrugKey();
    if (k === 'none') return '停药中（TFR）：无每日服药';
    return { dasatinib: '达沙替尼 50 mg 每日', imatinib: '伊马替尼', nilotinib: '尼洛替尼' }[k] || k;
  }
  /* A 当前=达沙替尼 → dasatinib + withdrawal；B 当前=停药 → 只 withdrawal */
  function lexiconKeys() {
    var k = currentDrugKey();
    if (k === 'none') return ['withdrawal'];
    return [k, 'withdrawal'];
  }
  function lexiconFiltered() {
    var keys = lexiconKeys(), out = [];
    keys.forEach(function (k) { (AE_LEXICON[k] || []).forEach(function (w) { out.push({ w: w, k: k }); }); });
    return out;
  }
  function lexiconHidden() {
    var keep = lexiconKeys(), n = 0;
    Object.keys(AE_LEXICON).forEach(function (k) {
      if (keep.indexOf(k) < 0) n += AE_LEXICON[k].length;
    });
    return n;
  }

  /* ================= 图表：Fritsch–Carlson 单调三次插值 ================= */
  function smoothPath(points) {
    var p = (points || []).filter(function (o) { return o && isFinite(o.x) && isFinite(o.y); });
    if (p.length === 0) return '';
    if (p.length === 1) return 'M' + r2(p[0].x) + ' ' + r2(p[0].y);
    var n = p.length, dx = [], dy = [], m = [], i;
    for (i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; dy[i] = p[i + 1].y - p[i].y; m[i] = dx[i] === 0 ? 0 : dy[i] / dx[i]; }
    var c = [m[0]];
    for (i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) { c[i] = 0; }
      else {
        var w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
        c[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
      }
    }
    c[n - 1] = m[n - 2];
    /* Fritsch–Carlson 单调性修正 */
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { c[i] = 0; c[i + 1] = 0; continue; }
      var a = c[i] / m[i], b = c[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { var tau = 3 / Math.sqrt(s); c[i] = tau * a * m[i]; c[i + 1] = tau * b * m[i]; }
    }
    var d = 'M' + r2(p[0].x) + ' ' + r2(p[0].y);
    for (i = 0; i < n - 1; i++) {
      var h = dx[i];
      d += ' C' + r2(p[i].x + h / 3) + ' ' + r2(p[i].y + c[i] * h / 3) +
        ' ' + r2(p[i + 1].x - h / 3) + ' ' + r2(p[i + 1].y - c[i + 1] * h / 3) +
        ' ' + r2(p[i + 1].x) + ' ' + r2(p[i + 1].y);
    }
    return d;
  }

  /* 可比性分段：相邻两点 lab 不同 或 is_std 不为 1 → 断开 */
  function segmentsOf(points) {
    var segs = [], cur = [];
    for (var i = 0; i < points.length; i++) {
      var a = points[i - 1], b = points[i];
      if (i > 0) {
        var labDiff = (a.lab !== undefined || b.lab !== undefined) && (a.lab !== b.lab);
        var notStd = (b.is_std !== undefined && b.is_std !== 1);
        if (labDiff || notStd) { segs.push({ pts: cur, gap: [a, b] }); cur = []; }
      }
      cur.push(b);
    }
    if (cur.length) segs.push({ pts: cur, gap: null });
    return segs;
  }

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) return [0];
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], v = Math.ceil(min / step) * step;
    for (; v <= max + step * 0.001; v += step) out.push(r2(v));
    return out.length ? out : [min, max];
  }

  /* metric 图表。root svg 必须带 class="chart" */
  function chartSVG(metric, opts) {
    opts = opts || {};
    var pts = (opts.points || metric.points || []).slice().sort(function (a, b) { return t(a.d) - t(b.d); });
    var numPts = pts.filter(function (p) { return typeof p.v === 'number'; });
    if (opts.demo === 'incomparable' && numPts.length > 1) {
      var last = numPts[numPts.length - 1];
      numPts = numPts.map(function (p) {
        return p === last ? Object.assign({}, p, { lab: '外院（示例）', is_std: 0, src: p.src + '（可比性演示）' }) : p;
      });
    }
    var isPcr = metric.key === 'pcr';
    var legend = !!(opts.legend && isPcr);
    var milestones = opts.milestones !== false;
    var W = 640, H = legend ? 300 : (milestones ? 268 : 240);
    var padL = 56, padR = 16, padT = legend ? 76 : (milestones ? 30 : 20), padB = 44;
    var pw = W - padL - padR, ph = H - padT - padB;
    var uid = 'c' + Math.random().toString(36).slice(2, 8);

    if (numPts.length === 0) {
      return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(metric.name) + '：暂无数据点">' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none" stroke="var(--line)"/>' +
        '<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle">还没有分子结果，先记一笔复查</text></svg>';
    }

    var t0 = t(numPts[0].d), tLast = t(numPts[numPts.length - 1].d);
    var t1 = tLast;
    var anchor = numPts[0].d;
    var msDates = [addMonths(anchor, 3), addMonths(anchor, 6), addMonths(anchor, 12)];
    if (milestones) { var t12 = t(msDates[2]); if (t12 > t1) t1 = t12; }
    if (t1 === t0) t1 = t0 + 30 * 24 * 3600 * 1000;
    var x = function (iso) { return padL + (t(iso) - t0) / (t1 - t0) * pw; };

    var vals = numPts.map(function (p) { return p.v; });
    var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    var useLog = (state.molScale === 'log') && vmin > 0;
    var yOf, yTicks;
    if (useLog) {
      var l0 = Math.log(vmin) / Math.LN10, l1 = Math.log(vmax) / Math.LN10;
      if (l1 - l0 < 0.5) { l0 -= 0.5; l1 += 0.5; }
      var pad = (l1 - l0) * 0.1; l0 -= pad; l1 += pad;
      yOf = function (v) { return padT + ph - ((Math.log(v) / Math.LN10) - l0) / (l1 - l0) * ph; };
      var stepL = Math.max(1, Math.ceil((l1 - l0) / 4)), tk = [];
      for (var e = Math.ceil(l0); e <= l1; e += stepL) tk.push(Math.pow(10, e));
      yTicks = tk.map(function (v) { return { v: v, label: String(v) }; });
    } else {
      var span = vmax - vmin, padV = span === 0 ? Math.max(1, Math.abs(vmax) * 0.1) : span * 0.1;
      var lo = vmin - padV, hi = vmax + padV;
      if (lo > 0 && vmin > 0) lo = Math.max(0, lo);
      yOf = function (v) { return padT + ph - (v - lo) / (hi - lo) * ph; };
      yTicks = niceTicks(lo, hi, 4).map(function (v) { return { v: v, label: num(v, metric.dec == null ? 2 : metric.dec) }; });
    }

    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' +
      esc(metric.name + ' 按日期的数值趋势（' + (useLog ? '对数' : '线性') + '纵轴，' + numPts.length + ' 个数据点）') + '">';

    /* Y 轴 */
    s += '<line class="axis" x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + ph) + '"/>';
    s += '<line class="axis" x1="' + padL + '" y1="' + (padT + ph) + '" x2="' + (padL + pw) + '" y2="' + (padT + ph) + '"/>';
    yTicks.forEach(function (tk) {
      var y = yOf(tk.v);
      if (y < padT - 1 || y > padT + ph + 1) return;
      s += '<line class="grid-line" x1="' + padL + '" y1="' + r2(y) + '" x2="' + (padL + pw) + '" y2="' + r2(y) + '"/>';
      s += '<text x="' + (padL - 6) + '" y="' + r2(y + 4) + '" text-anchor="end">' + esc(tk.label) + '</text>';
    });
    s += '<text x="' + padL + '" y="' + (padT - 8) + '" text-anchor="start">' + esc(metric.name + (metric.unit ? '（' + metric.unit + '）' : '')) +
      ' · 纵轴' + (useLog ? '对数' : '线性') + '</text>';

    /* X 轴日期刻度 */
    var xTicks = 5;
    for (var i = 0; i <= xTicks; i++) {
      var tv = t0 + (t1 - t0) * i / xTicks;
      var iso = new Date(tv).toISOString().slice(0, 10);
      s += '<text x="' + r2(padL + pw * i / xTicks) + '" y="' + (padT + ph + 16) + '" text-anchor="middle">' + esc(iso.slice(2)) + '</text>';
    }
    s += '<text x="' + padL + '" y="' + (padT + ph + 34) + '" text-anchor="start">X 轴＝日期，Y 轴＝报告值（分类值不画进曲线）</text>';

    /* 里程碑参考线：灰虚线 3/6/12 月 */
    if (milestones) {
      msDates.forEach(function (d, i) {
        var xx = x(d);
        if (xx < padL - 0.5 || xx > padL + pw + 0.5) return;
        s += '<line class="ref" x1="' + r2(xx) + '" y1="' + padT + '" x2="' + r2(xx) + '" y2="' + (padT + ph) + '"/>';
        s += '<text class="reflab" x="' + r2(xx + 2) + '" y="' + (padT + 12) + '">' + (i + 1) * 3 + 'M</text>';
      });
      s += '<text class="reflab" x="' + padL + '" y="' + (padT - 22) + '">医生给的里程碑时间点，不是判读线</text>';
    }

    /* 折线：按可比性分段；分类值不进入 */
    var segs = segmentsOf(numPts);
    segs.forEach(function (seg) {
      var screen = seg.pts.map(function (p) { return { x: x(p.d), y: yOf(p.v) }; });
      if (screen.length > 1) s += '<path class="line" d="' + smoothPath(screen) + '"/>';
      screen.forEach(function (sp, i) {
        var p = seg.pts[i];
        s += '<circle class="dot" cx="' + r2(sp.x) + '" cy="' + r2(sp.y) + '" r="3.2"><title>' +
          esc(p.d + ' ' + num(p.v, metric.dec == null ? 2 : metric.dec) + (metric.unit || '') + ' · 来源：' + (p.src || '未记录') +
            ' · 实验室：' + (p.lab || '未记录') + ' · IS 标化：' + (p.is_std === 1 ? '是' : (p.is_std === 0 ? '否' : '未记录')) +
            ' · 灵敏度：' + (p.sens || '未记录')) + '</title></circle>';
      });
      if (seg.gap) {
        var xa = x(seg.gap[0].d), xb = x(seg.gap[1].d), xm = (xa + xb) / 2;
        s += '<line class="brk" x1="' + r2(xm) + '" y1="' + padT + '" x2="' + r2(xm) + '" y2="' + (padT + ph) + '"/>';
        var lx = Math.min(Math.max(xm + 4, padL), padL + pw - 130);
        s += '<text class="brklab" x="' + r2(lx) + '" y="' + (padT + ph - 8) + '">不可比（实验室/标化不同）</text>';
      }
    });

    /* 图例：四要素 unit / lab / is_std / sens */
    if (legend) {
      var lp = numPts[numPts.length - 1];
      var lines = [
        '单位 unit：' + (lp.unit || metric.unit || '未记录'),
        '实验室 lab：' + (lp.lab || '未记录'),
        'IS 标化 is_std：' + (lp.is_std === 1 ? '是' : (lp.is_std === 0 ? '否' : '未记录')),
        '灵敏度 sens：' + (lp.sens || '未记录')
      ];
      lines.forEach(function (ln, i) {
        s += '<text class="legend" x="' + (W - 12) + '" y="' + (16 + i * 15) + '" text-anchor="end">' + esc(ln) + '</text>';
      });
    }
    s += '</svg>';
    return s;
  }

  /* 分类值（kind==='qual'/'grade'）单独列事件，不画进曲线 */
  function qualStrip(metric) {
    var pts = (metric.points || []).slice().sort(function (a, b) { return t(a.d) - t(b.d); });
    if (!pts.length) return '<p class="empty">暂无分类条目。</p>';
    return '<ul class="timeline">' + pts.map(function (p) {
      return '<li><span class="t-date">' + esc(p.d) + '</span><div>' + esc(String(p.v)) +
        '<span class="src">来源：' + esc(p.src || '未记录') + ' · 分类值不画进曲线</span></div></li>';
    }).join('') + '</ul>';
  }

  /* ================= AI 草稿（示例按钮） ================= */
  function aiPrompts(page) {
    var p = profile();
    var map = {
      dash: '请把看板上的事实整理成一页速览：最近 3 次 BCR::ABL1 抄录值（含实验室/IS 标化/灵敏度）、当前用药、下一次医生安排的复查时间、按当前用药过滤后的副作用条目、以及「值得报告的信号」卡里来源未核验的条目。只抄录与归类，不要给判读或结论。',
      mol: '请把 BCR::ABL1 的结果按「实验室 + IS 标化 + 灵敏度」分组列出，逐点给出日期与抄录值；相邻点实验室或标化不同处标注「不可比」。同时列出本档案的转录本类型与 ICC2022 分期词表原文。不要连线判读、不要给结论。',
      med: '（处方变更页）请把处方变更线整理成时间表：起止日期 / 药名 / 剂量 / 频次（每日、隔日、间歇）/ 变更原因原文与凭据文件号。原因只照抄原文。',
      ae: '请把「按当前用药过滤后」的副作用条目整理成时间线：日期 / 不适名称 / 归属用药 / 自述原文 / 门诊处理原文与来源。不要做严重度分级或归因。',
      cost: '请按月、按药分别汇总自费金额，同一月份不同药不合并计算；列出每条的说明原文。',
      prep: '请把所选时间区间内的资料整理成复诊资料包大纲：事实区（数值与报告原文）/ 看法区（本人与家属原话）/ 问题清单。每条保留来源。',
      docs: '请把这份报告按 MinerU 六部件列出解析结果与字段候选，供我逐项核对；解析失败的字段单独列出，不要补写。',
      trial: '请按我的档案条件列出临床试验记录需要核对的字段清单（M4 数据未接入，本页只列字段，不做匹配结论）。'
    };
    return map[page] || '';
  }
  function recordsForPage(page) {
    var p = profile(), out = [];
    if (page === 'dash' || page === 'mol') {
      (metricByKey('pcr') || { points: [] }).points.forEach(function (pt) {
        out.push({ id: 'pcr-' + pt.d, visibility: 'shared', text: pt.d + ' BCR::ABL1 ' + pt.v + '%（' + (pt.lab || '实验室未记录') + '，灵敏度 ' + (pt.sens || '未记录') + '）' });
      });
    }
    if (page === 'ae') aeRows().forEach(function (r) { out.push({ id: r.id, visibility: r.visibility, text: r.d + ' ' + r.name + ' · ' + r.drug + ' · ' + r.desc }); });
    if (page === 'prep' || page === 'cost') (p.cost || []).forEach(function (c, i) { out.push({ id: 'cost-' + i, visibility: 'shared', text: c[0] + ' ' + c[1] + ' 自费 ' + c[2] + ' 元 · ' + c[4] }); });
    if (page === 'fert') fertilityRows().forEach(function (r) { out.push(r); });
    return out.concat(sensitiveRecords().filter(function (r) { return page === 'prep' || page === 'ae' || page === 'dash'; }));
  }
  function buildAiContext(page) {
    var range = { dash: '最近 3 次复查', mol: state.molRange, ae: '全部已记录条目', prep: state.prepRange, cost: '2026-01 → 2026-10' }[page] || '本页全部';
    var recs = recordsForPage(page);
    var kept = filterPrivate(recs, 'ai');                  /* 出口 ②：AI 上下文 */
    return {
      page: page, page_label: ROUTE_LABEL[page],
      profile: state.profile, profile_name: profile().name, author_role: authorRole(),
      range: range,
      records: kept.map(function (r) { return r.text; }),
      filter: { exit: 'ai', kept: kept.length, filtered_out: recs.length - kept.length }
    };
  }
  function makeDraft(page) {
    return { prompt: aiPrompts(page), context: buildAiContext(page) };
  }

  /* ================= 通用片段 ================= */
  function aiButton(page, label) {
    if (AI_FORBIDDEN[page]) return '';
    return '<button type="button" class="btn" data-act="ai" data-page="' + page + '">AI 协助（示例）' +
      (label ? ' · ' + esc(label) : '') + '</button>';
  }
  function aiForbiddenNote(page) {
    if (!AI_FORBIDDEN[page]) return '';
    return '<p class="note"><strong>本页不提供 AI 生成。</strong>' + esc(AI_FORBIDDEN[page]) +
      '；页面内容只做事实照抄与问题清单，决策由你与医生完成。</p>';
  }
  function privateNote() {
    return '<p class="note">私密内容不进导出与 AI：三个出口（导出 / AI 上下文 / 摘要）统一走 ' +
      '<code>filterPrivate(list, exit)</code>，<code>visibility=&quot;private&quot;</code> 的条目默认被过滤。</p>';
  }
  function kvTable(pairs) {
    return '<table class="kv"><tbody>' + pairs.map(function (p) {
      return '<tr><th>' + esc(p[0]) + '</th><td data-th="' + esc(p[0]) + '">' + p[1] + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function dataTable(headers, rows) {
    return '<table><thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          return '<td data-th="' + esc(headers[i] || '') + '">' + c + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function badge(text, warn) { return '<span class="badge' + (warn ? ' badge-warn' : '') + '">' + esc(text) + '</span>'; }

  /* ================= 治疗路径折叠卡（docs/32 号硬结构） ================= */
  function phaseFold(ph) {
    var blocks = [['方案', ph.detail.regimen], ['指标和趋势', ph.detail.metrics], ['影像发现', ph.detail.imaging],
      ['副作用总结', ph.detail.ae], ['心理与营养措施和效果', ph.detail.support]];
    return '<details class="phase-fold">' +
      '<summary><span class="pd-title">● ' + esc(ph.phase) + '</span><span class="pd-date">' + esc(ph.d) + '</span>' +
      '<span class="pd-text">' + esc(ph.text) + '</span><span>展开细节</span></summary>' +
      '<div class="phase-detail">' +
      blocks.map(function (b) {
        var blk = b[1] || { summary: '无 · 说明：本阶段该块无记录', items: [] };
        var items = (blk.items && blk.items.length) ? blk.items : [['内容', '无']];
        return '<section class="pd-block"><h4>' + esc(b[0]) + '</h4><p>' + esc(blk.summary) + '</p>' +
          '<table class="pv-table"><tbody>' + items.map(function (it) {
            return '<tr><th>' + esc(it[0]) + '</th><td data-th="' + esc(it[0]) + '">' + it[1] + '</td></tr>';
          }).join('') + '</tbody></table></section>';
      }).join('') +
      '</div></details>';
  }

  function pathwayOf() {
    var A = [
      {
        d: '2026-01-22 → 2026-05-07', phase: '确诊与一线起始', text: '确诊慢性期 CML（e14a2），开始伊马替尼 400 mg 每日',
        detail: {
          regimen: { summary: '伊马替尼 400 mg · 每日 1 次 · 2026-01-24 起', items: [['药名 / 剂量', '伊马替尼 400 mg'], ['频次', '每日 1 次（daily）'], ['起止', '2026-01-24 起'], ['计划 vs 实际', '计划：持续至医生评估；实际：2026-05-08 减量至 300 mg（见下一阶段）'], ['凭据', '血液科门诊 2026-01-24（文件 A-D1）']] },
          metrics: { summary: '基线 BCR::ABL1 IS 42.6%；白细胞 28.6 → 5.1（10⁹/L）', items: [['BCR::ABL1（IS%）', '2026-01-22：42.6%（省血液病医院 · IS 标化 · 灵敏度 MR4.5）'], ['白细胞（10⁹/L）', '2026-01-22：28.6 → 2026-04-02：5.1；原报告参考区间 3.5–9.5（仅照抄）'], ['血小板（10⁹/L）', '2026-01-22：320 → 2026-04-02：168'], ['趋势一句话', '阶段内 4 次血常规 + 1 次 qPCR 逐点抄录；连线与分段见分子线页']] },
          imaging: { summary: '无 · 说明：本阶段未做影像检查', items: [['影像报告', '无'], ['说明', '确诊依据为血常规 + 骨髓细胞遗传学 + 融合基因报告（A-D1、A-D2），不是影像']] },
          ae: { summary: '1 条：白细胞偏低（处理原文已引）', items: [['2026-05-06 白细胞偏低', '记录原文：' + q('化验单上白细胞 3.1，没有不舒服', '文件 A-D3')], ['等级', '报告未给等级字段（本页不代拟等级）'], ['处理原文', q('减量后复查', '血液科门诊 2026-05-06')]] },
          support: { summary: '活动照常；1 条本人记录', items: [['措施', '每天早饭后吃药；每周三次快走 40 分钟（本人自述）'], ['效果（本人原话）', q('有点烦：每天吃药像闹钟，出差要算时差', '本人记录 2026-03-10')], ['说明', '效果只照抄本人原话，不评疗效']] }
        }
      },
      {
        d: '2026-05-08 → 2026-08-14', phase: '减量观察', text: '血象偏低后减量至 300 mg，继续每日口服',
        detail: {
          regimen: { summary: '伊马替尼 300 mg · 每日 1 次 · 2026-05-08 → 2026-08-14', items: [['药名 / 剂量', '伊马替尼 300 mg'], ['频次', '每日 1 次'], ['起止', '2026-05-08 → 2026-08-14'], ['变更原因原文', q('白细胞和血小板都低了，先减到 300mg 观察', '血液科门诊 2026-05-08')], ['凭据', '血液科门诊 2026-05-08（文件 A-D3）']] },
          metrics: { summary: 'BCR::ABL1 2026-07-18：1.12%；白细胞 3.1 → 4.6', items: [['BCR::ABL1（IS%）', '2026-07-18：1.12%（省血液病医院 · IS 标化 · MR4.5）'], ['白细胞（10⁹/L）', '2026-05-06：3.1 → 2026-08-06：4.4'], ['血小板（10⁹/L）', '2026-05-06：142 → 2026-08-06：204'], ['趋势一句话', '3 个月节点 qPCR 逐点抄录；本页不连线判读']] },
          imaging: { summary: '无 · 说明：本阶段未做影像检查', items: [['影像报告', '无'], ['说明', '本阶段文件为血常规与 qPCR 报告（A-D3）']] },
          ae: { summary: '2 条：眼睑水肿、肌肉痉挛（小腿）', items: [['2026-07-20 眼睑水肿', '自述原文：' + q('早上起床眼皮肿，下午好些', '本人自述')], ['2026-06-18 肌肉痉挛（小腿）', '自述原文：' + q('夜里小腿抽筋，一周 2–3 次', '本人自述')], ['处理原文', q('自述；医生说可以补充镁，具体听门诊', '血液科门诊口述记录')], ['等级', '报告未给等级字段（本页不代拟等级）']] },
          support: { summary: '无新增措施记录 · 说明：本阶段没有再记支持措施', items: [['措施', '无'], ['效果（本人原话）', '本阶段无记录'], ['说明', '无内容即写「无 + 说明」，不省略块']] }
        }
      },
      {
        d: '2026-08-15 → 2026-09-30', phase: '换药与胸腔积液处理', text: '换达沙替尼 50 mg；9 月记录胸腔积液 / 气促并门诊处理',
        detail: {
          regimen: { summary: '达沙替尼 50 mg · 每日 1 次 · 2026-08-15 起', items: [['药名 / 剂量', '达沙替尼 50 mg'], ['频次', '每日 1 次'], ['起止', '2026-08-15 起'], ['变更原因原文', q('胸腔积液考虑和伊马替尼无关，换达沙替尼，先用 50mg', '血液科门诊 2026-08-15')], ['凭据', '门诊病历 2026-08-15（文件 A-D5）']] },
          metrics: { summary: '阶段内 2 次血常规；本阶段无 qPCR', items: [['白细胞（10⁹/L）', '2026-08-06：4.4 → 2026-09-03：4.8'], ['血红蛋白（g/L）', '2026-08-06：130 → 2026-09-03：134'], ['BCR::ABL1（IS%）', '本阶段无复查（下一次 2026-10-12）']] },
          imaging: { summary: '1 份影像报告；结论原文待逐字核对入库', items: [['报告', '胸部 CT 报告 2026-09-02（文件 A-D6，已解析）'], ['结论原文', '尚未逐字核对入库；本页不代拟结论，也不做判断'], ['说明', '影像块只放报告原文；核对完成后回填此处']] },
          ae: { summary: '1 条：胸腔积液 / 气促（处理原文已引）', items: [['2026-09-02 胸腔积液 / 气促', '自述原文：' + q('爬两层楼就喘，躺下更明显', '本人自述')], ['处理原文', q('先停药三天复查胸片', '医生原话 · 血液科门诊 2026-09-02')], ['凭据', '胸部 CT 报告 2026-09-02（文件 A-D6）'], ['等级', '报告未给等级字段（本页不代拟等级）']] },
          support: { summary: '1 条本人记录；活动改为散步', items: [['措施', '胸腔积液期间把快走改成散步（本人自述）'], ['效果（本人原话）', q('吓了一跳：喘不上气那两天以为心脏出问题，结果是胸腔积液', '本人记录 2026-08-20')], ['营养', '本阶段无营养措施记录']] }
        }
      },
      {
        d: '2026-10-01 → 至今', phase: '维持与随访', text: '达沙替尼 50 mg 维持；10-12 完成 12 个月随访 qPCR',
        detail: {
          regimen: { summary: '达沙替尼 50 mg · 每日 1 次 · 继续', items: [['药名 / 剂量', '达沙替尼 50 mg'], ['频次', '每日 1 次'], ['起止', '2026-08-15 起，持续中'], ['计划 vs 实际', '计划：每日 1 次；实际：10 月记录 11 天已服 / 1 天漏服（见服药线）'], ['凭据', '门诊病历 2026-08-15（文件 A-D5）']] },
          metrics: { summary: 'BCR::ABL1 2026-10-12：0.086%；血常规白细胞 5.0', items: [['BCR::ABL1（IS%）', '2026-10-12：0.086%（省血液病医院 · IS 标化 · MR4.5）'], ['白细胞（10⁹/L）', '2026-10-12：5.0'], ['血小板（10⁹/L）', '2026-10-12：222'], ['血红蛋白（g/L）', '2026-10-12：138'], ['趋势一句话', '逐点抄录，分段与连线见分子线页']] },
          imaging: { summary: '无 · 说明：本阶段未新增影像检查', items: [['影像报告', '无'], ['说明', '最近一份影像为 2026-09-02 胸部 CT（文件 A-D6）']] },
          ae: { summary: '无新增副作用记录 · 说明：本阶段尚未记录新条目', items: [['条目', '无'], ['说明', '空态按 docs/UI-DESIGN.md §四：副作用日志显示词表引导，不显示空白表']] },
          support: { summary: '1 条本人记录', items: [['措施', '继续每天早饭后服药、每周三次快走（本人自述）'], ['效果（本人原话）', q('还行：医生说数值在往下走，我先把这三个月过好', '本人记录 2026-10-12')], ['营养', '本阶段无营养措施记录']] }
        }
      }
    ];
    var B = [
      {
        d: '2020-03-11 → 2021-06-30', phase: '确诊与一线起始', text: '确诊慢性期 CML（e13a2），开始伊马替尼 400 mg 每日',
        detail: {
          regimen: { summary: '伊马替尼 400 mg · 每日 1 次 · 2020-03-15 → 2021-06-30', items: [['药名 / 剂量', '伊马替尼 400 mg'], ['频次', '每日 1 次'], ['起止', '2020-03-15 → 2021-06-30'], ['变更原因原文', q('先减量，仍不耐受就换药', '医生原话 · 血液科门诊 2021-05-08')], ['凭据', '骨髓 + 融合基因报告 2020-03-11（文件 B-D1）、门诊病历 2021-06-30（文件 B-D2）']] },
          metrics: { summary: '本阶段原始报告为 2020-03-11 骨髓与融合基因；qPCR 逐点抄录见分子线页', items: [['转录本', 'e13a2（典型）· RT-PCR 2020-03-11'], ['染色体', 'Ph+（t9;22）· 骨髓细胞遗传学 2020-03-11'], ['BCR::ABL1（IS%）', '本原型数据集中该阶段无逐点 qPCR 抄录值']] },
          imaging: { summary: '无 · 说明：本阶段未做影像检查', items: [['影像报告', '无'], ['说明', '确诊依据为骨髓 + 融合基因报告（B-D1）']] },
          ae: { summary: '1 条：皮疹 / 腹泻（处理原文已引）', items: [['2021-05-08 皮疹 / 腹泻', '自述原文：' + q('前臂皮疹，大便每天 3–4 次', '本人自述 · 家属代记')], ['处理原文', q('先减量，仍不耐受就换药', '医生原话 · 血液科门诊 2021-05-08')], ['凭据', '门诊病历 2021-06-30（文件 B-D2）']] },
          support: { summary: '无措施记录 · 说明：该阶段未记录心理与营养措施', items: [['措施', '无'], ['效果（本人原话）', '该阶段无记录'], ['说明', '无内容即写「无 + 说明」，不省略块']] }
        }
      },
      {
        d: '2021-07-01 → 2026-04-09', phase: '二线尼洛替尼', text: '因不耐受换尼洛替尼 300 mg 每日两次（空腹），维持至停药评估',
        detail: {
          regimen: { summary: '尼洛替尼 300 mg · 每日 2 次 · 2021-07-01 → 2026-04-09', items: [['药名 / 剂量', '尼洛替尼 300 mg'], ['频次', '每日 2 次（bid，空腹早晚各一次）'], ['起止', '2021-07-01 → 2026-04-09'], ['变更原因原文', q('伊马替尼皮疹腹泻不耐受，换尼洛替尼，空腹早晚各一次', '医生原话 · 血液科门诊 2021-06-30')], ['凭据', '门诊病历 2021-06-30（文件 B-D2）']] },
          metrics: { summary: '2026-04-09 停药前最后 1 次 BCR::ABL1 IS 0.0028%', items: [['BCR::ABL1（IS%）', '2026-04-09：0.0028%（市一院血液科 · IS 标化 · MR4.5）'], ['DMR 持续时长', '门诊记录 2026-04-09 记有「DMR 超过 2 年」（照抄门诊记录）'], ['趋势一句话', '逐点抄录；本页不连线判读，分段见分子线页']] },
          imaging: { summary: '无 · 说明：本阶段未做影像检查', items: [['影像报告', '无'], ['说明', '本阶段文件为肝功能与门诊记录（B-D4、B-D5）']] },
          ae: { summary: '1 条：与肝功能相关的记录（报告原文已加引号照抄）', items: [['2025-11-20 报告原文', q('肝功能异常（ALT 升高）', '肝功能 2025-11-20.pdf 报告原文 · 文件 B-D4')], ['自述原文', q('ALT 62，没有不舒服', '本人自述 · 家属代记')], ['处理原文', q('尼洛替尼可能影响肝酶，加查一次', '医生原话 · 血液科门诊 2025-11-20')], ['等级', '报告未给等级字段（本页不代拟等级）']] },
          support: { summary: '1 条家属记录', items: [['措施', '每天早晚各一次服药（尼洛替尼需空腹）；不催她看报告（家属自述）'], ['效果（家属原话）', q('报告我先拍，等她愿意谈了再一起看；不催她', '家属记录')], ['说明', '效果只照抄记录原话，不评疗效']] }
        }
      },
      {
        d: '2026-04-10 → 至今', phase: 'TFR 停药尝试与密测', text: '按门诊评估进入停药尝试；停药后每 1–2 个月 1 次 qPCR，已完成 6 次',
        detail: {
          regimen: { summary: '停药观察（无每日 TKI）· 2026-04-10 起', items: [['药名 / 剂量', '（停药观察）· —'], ['频次', '无每日服药（none）'], ['起止', '2026-04-10 起'], ['门诊记录原文', q('DMR 超过 2 年、TKI 用了 6 年，达到书面条件，可以谈停药；停药后前半年每 1–2 个月抽一次', '医生原话 · 血液科门诊 2026-04-09')], ['凭据', 'TFR 评估门诊记录 2026-04-09（文件 B-D5）']] },
          metrics: { summary: '停药后 6 次 qPCR 逐点抄录：0.0028 → 0.0021（IS%）', items: [['BCR::ABL1（IS%）', '2026-04-09：0.0028% → 2026-10-08：0.0021%（市一院血液科 · IS 标化 · MR4.5）'], ['血常规（白细胞 10⁹/L）', '2026-04-09：5.6 → 2026-10-08：4.8'], ['趋势一句话', '逐点抄录，连线与分段见分子线页；本页不判读']] },
          imaging: { summary: '无 · 说明：停药密测期未做影像检查', items: [['影像报告', '无'], ['说明', '本阶段文件为 qPCR 与血常规报告（B-D3、B-D6）']] },
          ae: { summary: '2 条停药相关记录（与停药日对齐）', items: [['2026-05-02 肌肉骨骼疼痛', '自述原文：' + q('停药后腰背和膝盖酸，早上明显', '本人自述 · 家属代记')], ['2026-06-11 皮肤瘙痒', '自述原文：' + q('晚上痒，抓了会起红印', '本人自述 · 家属代记')], ['处理原文', q('停药综合征，多数几个月会缓解；影响生活可以来门诊', '医生原话 · 血液科门诊 2026-05-08')], ['对齐', '两条均与停药日 2026-04-10 对齐显示（见副作用日志页）']] },
          support: { summary: '3 条本人记录（含停药初期）', items: [['措施', '停药后散步、瑜伽，避免熬夜（本人自述）'], ['效果（本人原话）', q('好一点：两次报告都稳定，妈妈也不天天问了', '本人记录 2026-07-15') + '<br>' + q('还行：就是等报告那三天难熬', '本人记录 2026-10-08') + '<br>' + q('紧张：停药第一周总觉得自己会复发，半夜会醒', '本人记录 2026-05-20')], ['口径', '患者自述原话按来源照抄；「会不会复发」是本人的担心，不是本页结论——本页不做判读（K1）']] }
        }
      }
    ];
    return state.profile === 'A' ? A : B;
  }

  /* ================= 页面：dash ================= */
  function pageDash() {
    var p = profile();
    var pcr = metricByKey('pcr') || { points: [] };
    var last3 = pcr.points.slice(-3);
    var ml = p.med_log || {};
    var recent = (ml.recent || []).slice(0, 3);
    var pcrMetric = metricByKey('pcr') || null;

    var h = '<div class="page-head"><h1>看板</h1>' +
      badge('档案 ' + state.profile) + badge(authorRole()) + badge('构建 ' + BUILD) + badge(VERSION) + '</div>';

    h += '<div class="grid">';

    /* 档案头 */
    h += '<section class="card"><div class="card-head"><h3>档案</h3>' + badge(p.phase || '') + badge('转录本 ' + (p.transcript || '未记录')) + '</div>' +
      kvTable([['姓名', esc(p.name || '')], ['性别 / 年龄', esc((p.sex || '') + ' / ' + (p.age || '') + ' 岁')], ['概况', esc(p.meta || '')],
        ['医生告知的分层', esc(p.risk || '')], ['一句话病史', esc(p.headline || '')], ['本人最在意的', esc(p.mindset || '')]]) + '</section>';

    /* 今日服药卡 */
    var todayState = state.checkin;
    h += '<section class="card"><div class="card-head"><h3>今日服药卡</h3>' + badge(currentDrugLabel()) + badge('本机打卡') + '</div>';
    if (currentDrugKey() === 'none') {
      h += '<p class="empty">停药中（TFR）：无每日服药打卡。' + esc(ml.note || '') + '</p>' +
        '<p class="muted">' + esc((ml.note) || '') + '</p>';
    } else if (todayState === null) {
      h += '<p class="empty">今天还没记。</p>';
    } else {
      h += '<p>今日状态：<strong>' + (todayState === 'taken' ? '已服' : '漏服') + '</strong>（本机记录，' + esc(TODAY) + '）</p>';
    }
    if (state.writeFail) h += '<p class="err" id="writeErr">本地写失败：请重试（输入未丢失，草稿仍在本页）。</p>';
    h += '<div class="row">' +
      '<button type="button" class="btn" data-act="checkin" data-v="taken">一键已服</button>' +
      '<button type="button" class="btn" data-act="checkin" data-v="missed">标记漏服</button>' +
      '<button type="button" class="btn btn-sm" data-act="write-fail">模拟本地写失败</button>' +
      '<a class="btn" href="#med">去服药线</a></div>';
    h += '<h4 class="h3">最近 3 天</h4><ul class="timeline">' + recent.map(function (r) {
      return '<li><span class="t-date">' + esc(r[0]) + '</span><div>' + (r[1] === 'taken' ? '已服' : (r[1] === 'missed' ? '漏服' : '无每日服药（停药期）')) + '</div></li>';
    }).join('') + '</ul>';
    h += '<p class="muted">漏服不评判；补服分支规则与来源见服药线「今日打卡」。</p></section>';

    /* 分子线速览卡 */
    var next = (p.rhythm || [])[1] || (p.rhythm || [])[0] || null;
    h += '<section class="card"><div class="card-head"><h3>分子线速览（最近 3 点）</h3>' + badge('距下次复查' + (next ? ' 约 ' + (monthsUntil(next[3]) == null ? '—' : monthsUntil(next[3]) + ' 个月') : ' —')) + '</div>';
    if (!last3.length) {
      h += '<p class="empty">还没有分子结果，先记一笔复查。<a href="#mol">去分子线录入</a></p>';
    } else {
      h += dataTable(['日期', 'BCR::ABL1（IS%）', '实验室', 'IS 标化', '灵敏度'], last3.map(function (pt) {
        return [esc(pt.d), esc(num(pt.v, 3)), esc(pt.lab || '未记录'), pt.is_std === 1 ? '是' : (pt.is_std === 0 ? '否' : '未记录'), esc(pt.sens || '未记录')];
      }));
      h += '<div class="chart-wrap">' + chartSVG(pcrMetric, { points: last3, milestones: false, legend: false }) + '</div>';
      h += '<p class="muted">四要素（单位 / 实验室 / IS 标化 / 灵敏度）在分子线页逐点列出；相邻点不可比时断开折线。</p>';
    }
    h += '<p class="muted">下次复查安排：' + esc(next ? next[0] + ' · ' + next[1] + ' · ' + next[3] : '未记录') + '（医生安排，仅照抄）</p></section>';

    /* 副作用速记卡（按当前用药过滤） */
    var filtered = aeRows().filter(function (r) {
      return lexiconKeys().indexOf(r.drug) >= 0 || r.example;
    });
    h += '<section class="card"><div class="card-head"><h3>副作用速记（按当前用药过滤）</h3>' + badge('当前：' + currentDrugLabel()) +
      badge('已隐藏 ' + (aeRows().length - filtered.length) + ' 条非当前用药条目') + '</div>';
    if (!filtered.length) h += '<p class="empty">词表引导：先选一种不适（按当前用药列出），再补日期与自述。</p>';
    else h += '<ul class="timeline">' + filtered.slice(0, 3).map(function (r) {
      return '<li><span class="t-date">' + esc(r.d) + '</span><div>' + esc(r.name) + ' ' + badge(r.drug) +
        (r.visibility === 'private' ? badge('私密') : '') + '<span class="src">' + esc(r.desc) + '</span></div></li>';
    }).join('') + '</ul>';
    h += '<p class="muted">只记录不适与处理原文，不出现严重度判读列。<a href="#ae">去副作用日志</a></p></section>';

    /* 复诊倒计时卡 */
    h += '<section class="card"><div class="card-head"><h3>复诊倒计时</h3>' + badge(TODAY) + '</div>' +
      dataTable(['事项', '频率', '依据', '下次时间'], (p.rhythm || []).map(function (r) {
        return [esc(r[0]), esc(r[1]), esc(r[2]), esc(r[3])];
      })) +
      '<div class="row"><a class="btn" href="#prep">准备复诊（生成资料包与问题清单）</a>' + aiButton('prep', '复诊准备：整理资料包大纲') + '</div></section>';

    h += '</div>';

    /* HVT-11 信号卡 */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>值得报告的信号（HVT-11）</h3>' +
      badge('来源未核验', true) + badge('静态事实清单') + '</div>' +
      dataTable(['信号（来源原文口径）', '来源', '版本', '状态'],
        HVT11().map(function (s) { return [esc(s[0]), esc(s[1]), esc(s[2]), badge(s[3], s[3] === '未核验')]; })) +
      '<p class="note">本卡不做个体判断，不给是否就医结论；是否联系医生由你与医生决定。来源未核实 → 标「未核验」。</p>' +
      '<p class="muted">空态（无信号记录时）：还没有记录信号，卡片只显示上面这份来源清单。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div>' +
      '<p class="muted">点击后派发 <code>cml:agent-draft</code>，提示词只进会话区输入框，不自动发送。</p>' +
      '<div class="row">' + aiButton('dash') + '<a class="btn" href="#mol">分子线</a><a class="btn" href="#tfr">TFR 档案</a><a class="btn" href="#docs">资料导入</a></div></section>';
    return h;
  }

  function HVT11() {
    return [
      ['发热：体温 ≥38.3 ℃，或 ≥38 ℃ 持续 1 小时以上', '中国 CML 诊疗指南（2025 版）· 感染与支持治疗章节', 'GL-CN-2025', '未核验'],
      ['新发或加重的骨痛 / 关节痛', '中国 CML 诊疗指南（2025 版）· 随访章节', 'GL-CN-2025', '未核验'],
      ['气促 / 呼吸困难 / 静息时也不缓解', '中国 CML 诊疗指南（2025 版）· TKI 不良反应章节', 'GL-CN-2025', '未核验'],
      ['皮肤或黏膜出血点、牙龈出血不易止', '中国 CML 诊疗指南（2025 版）· 血液学监测章节', 'GL-CN-2025', '未核验']
    ];
  }

  /* ================= 页面：mol ================= */
  function molPointsFor(m) {
    var pts = (m.points || []).slice().sort(function (a, b) { return t(a.d) - t(b.d); });
    if (state.molState === 'empty') return [];
    if (state.molState === 'single') return pts.slice(-1);
    if (state.molRange === 'all') return pts;
    var months = { '3m': 3, '6m': 6, '12m': 12 }[state.molRange] || 0;
    if (!months) return pts;
    var last = t(pts[pts.length - 1].d);
    return pts.filter(function (p) { return last - t(p.d) <= months * 30.44 * 24 * 3600 * 1000; });
  }

  function pageMol() {
    var p = profile();
    var ms = metrics();
    var sel = state.molKeys.slice(0, 4);
    var h = '<div class="page-head"><h1>分子线</h1>' + badge('档案 ' + state.profile) + badge(authorRole()) +
      badge('图谱 CML-MOL') + '</div>';

    /* 状态演示（按 UI-DESIGN §四：加载/空态/单条/错误） */
    h += '<section class="card"><div class="card-head"><h3>状态与缩放</h3></div>' +
      '<div class="row">' +
      ['live:有数据', 'empty:空态', 'single:单点', 'rejected:错误态（拒收候选）'].map(function (o) {
        var k = o.split(':')[0];
        return '<button type="button" class="btn btn-sm" data-act="mol-state" data-v="' + k + '" aria-pressed="' + (state.molState === k) + '">' + esc(o.split(':')[1]) + '</button>';
      }).join('') + '</div>' +
      '<div class="row"><span class="muted">时间范围（缩放）：</span>' +
      [['all', '全部'], ['12m', '近 12 个月'], ['6m', '近 6 个月'], ['3m', '近 3 个月']].map(function (o) {
        return '<button type="button" class="chip" data-act="mol-range" data-v="' + o[0] + '" aria-pressed="' + (state.molRange === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="row"><span class="muted">纵轴刻度：</span>' +
      [['linear', '线性（按值）'], ['log', '对数']].map(function (o) {
        return '<button type="button" class="chip" data-act="mol-scale" data-v="' + o[0] + '" aria-pressed="' + (state.molScale === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="row"><span class="muted">指标（多选 ≤4）：</span>' +
      ms.map(function (m) {
        return '<button type="button" class="chip" data-act="mol-key" data-v="' + m.key + '" aria-pressed="' + (sel.indexOf(m.key) >= 0) + '">' + esc(m.name) + '</button>';
      }).join('') + '</div>' +
      '<p class="muted">分类值（kind=qual/grade，如副作用记录）不进曲线，只在下方按事件列出。</p></section>';

    /* 趋势图 rail */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>趋势</h3>' + badge('SVG class="chart"') +
      badge('Fritsch–Carlson 单调三次插值') + '</div>';
    if (state.molState === 'empty') {
      h += '<p class="empty">还没有分子结果，先记一笔复查。</p><div class="row"><button type="button" class="btn" data-act="mol-manual">手工录入一条</button></div>';
    }
    sel.forEach(function (k) {
      var m = metricByKey(k);
      if (!m) return;
      var pts = molPointsFor(m);
      if (m.kind === 'qual' || m.kind === 'grade') {
        h += '<h4 class="h3">' + esc(m.name) + '（分类值，不画曲线）</h4>' + qualStrip(m);
        return;
      }
      h += '<h4 class="h3">' + esc(m.name) + (m.unit ? '（' + esc(m.unit) + '）' : '') + '</h4>';
      if (state.molState === 'single' || pts.filter(function (x) { return typeof x.v === 'number'; }).length === 1) {
        h += '<p class="empty">再记一次才成趋势（当前只有 1 个数据点，只显示点、不画线）。</p>';
      }
      if (state.molState === 'rejected') {
        h += '<p class="err">候选被拒收：未写入任何记录，草稿保留在下方「复查记录」表单中（零副作用）。</p>';
      }
      h += '<div class="chart-wrap">' + chartSVG(m, { points: pts, milestones: true, legend: true, demo: m.key === 'pcr' ? state.molDemo : 'plain' }) + '</div>';
      h += '<ul class="legend-list"><li>单位：' + esc(m.unit || '未记录') + '</li><li>纵轴：' + (state.molScale === 'log' && m.key === 'pcr' ? '对数' : '线性') + '</li>' +
        '<li>参考线：3 / 6 / 12 月（灰虚线）</li><li>参考线含义：医生给的里程碑时间点，不是判读线</li>' +
        (m.kind === 'num' && m.band ? '<li>原报告参考区间：' + esc(m.band[0] + '–' + m.band[1]) + '（仅照抄，本页不判读）</li>' : '') + '</ul>';
      h += '<p class="muted">口径：' + esc(m.note || '') + '</p>';
    });
    h += '<p class="note">引指南口径（来源：中国 CML 诊疗指南 2025 版）：' + q('不建议根据 BCR::ABL1 IS 的单次、单一数值做出转换治疗的决策', '中国 CML 诊疗指南（2025 版）· 分子学监测章节') + '</p>';
    h += '</section>';

    /* 可比性四要素 */
    var pcr = metricByKey('pcr') || { points: [] };
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>实验室与可比性（HVT-07 四要素）</h3>' + badge('unit / lab / is_std / sens') + '</div>' +
      dataTable(['日期', '值', '单位 unit', '实验室 lab', 'IS 标化 is_std', '灵敏度 sens', '来源'],
        pcr.points.map(function (pt) {
          return [esc(pt.d), esc(num(pt.v, 3)), esc(pt.unit || '未记录'), esc(pt.lab || '未记录'),
            pt.is_std === 1 ? '是' : (pt.is_std === 0 ? '否' : '未记录'), esc(pt.sens || '未记录'), esc(pt.src || '未记录')];
        })) +
      '<p class="note">相邻两点「实验室不同」或「IS 标化不为 1」→ 图上断开折线并标注「不可比（实验室/标化不同）」。任一要素缺失时显示「未记录」。</p>' +
      '<div class="row"><button type="button" class="btn btn-sm" data-act="mol-demo" data-v="' + (state.molDemo === 'incomparable' ? 'plain' : 'incomparable') + '" aria-pressed="' + (state.molDemo === 'incomparable') + '">可比性演示：把最近一点按「外院 / 未 IS 标化」渲染</button><span class="muted">仅视图层演示，不改动 demo-data.js</span></div></section>';

    /* 词表：转录本 / 分期 / 里程碑 */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>词表（HVT-01 转录本 / HVT-02 分期 / 里程碑）</h3></div>' +
      dataTable(['转录本类型', '口径原文', '本档案', '来源'],
        [['e13a2（典型）', 'BCR 外显子 13 与 ABL1 外显子 2 融合', p.transcript === 'e13a2（典型）' ? badge('本档案') : '—', esc((p.molecular && p.molecular[0] && p.molecular[0].src) || '未记录')],
          ['e14a2（典型）', 'BCR 外显子 14 与 ABL1 外显子 2 融合', p.transcript === 'e14a2（典型）' ? badge('本档案') : '—', esc((p.molecular && p.molecular[0] && p.molecular[0].src) || '未记录')],
          ['非典型转录本', '需高标准实验室定量（阈值口径照抄报告）', '—', '中国 CML 诊疗指南（2025 版）']]) +
      dataTable(['分期', '原始阈值口径', '来源版本'],
        [['CP 慢性期', '原始细胞（骨髓/外周血）<10%，无 AP/BP 特征', 'ICC2022'], ['AP 加速期', '原始细胞 10–19%，或出现指定额外染色体发现（ACA）等口径', 'ICC2022'], ['BP 急变期', '原始细胞 ≥20%（髓系/淋系/双表型按报告原文）', 'ICC2022']]) +
      '<p class="note">分期词表只放阈值与版本，不出现「你属于哪期」这类结论。</p>' +
      dataTable(['里程碑词', '报告里怎么写', '口径原文（照抄）', '来源版本'],
        [['CMR / DMR', '完全分子学缓解', 'BCR::ABL1 IS ≤0.01%（MR3 以下）口径按指南原文', 'GL-CN-2025'],
          ['MMR', '主要分子学缓解', 'BCR::ABL1 IS ≤0.1%，需同一实验室、IS 标化可比', 'GL-CN-2025'],
          ['MR4', '4 log 深度缓解', 'BCR::ABL1 IS ≤0.01% 且灵敏度足够', 'GL-CN-2025'],
          ['MR4.5', '4.5 log 深度缓解', 'BCR::ABL1 IS ≤0.0032% 且灵敏度达 MR4.5', 'GL-CN-2025'],
          ['MR5', '5 log 深度缓解', 'BCR::ABL1 IS ≤0.001%（需实验室支持）', 'GL-CN-2025']]) +
      '<p class="note">词表只给词义与来源版本，不做「是否达到」的判读。</p></section>';

    /* 复查记录（二级：录入 / 更正） */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>复查记录（二级：录入 / 更正）</h3>' + badge('显式编辑 ≤1/页') + '</div>';
    if (state.molDraft) {
      h += '<p class="err">草稿已保留（未提交）：' + esc(state.molDraft.d + ' ' + state.molDraft.v + ' ' + state.molDraft.unit) + '</p>';
    }
    h += '<div class="grid">' +
      '<div><label class="field-label" for="f-d">日期</label><input id="f-d" type="text" value="' + esc(state.molDraft ? state.molDraft.d : TODAY) + '"></div>' +
      '<div><label class="field-label" for="f-v">BCR::ABL1（IS%）</label><input id="f-v" inputmode="decimal" type="text" value="' + esc(state.molDraft ? state.molDraft.v : '') + '"></div>' +
      '<div><label class="field-label" for="f-lab">实验室 lab</label><input id="f-lab" type="text" value="' + esc(state.molDraft ? state.molDraft.lab : '') + '"></div>' +
      '<div><label class="field-label" for="f-std">IS 标化 is_std（1=是 / 0=否）</label><input id="f-std" inputmode="decimal" type="text" value="' + esc(state.molDraft ? state.molDraft.is_std : '1') + '"></div>' +
      '<div><label class="field-label" for="f-sens">灵敏度 sens</label><input id="f-sens" type="text" value="' + esc(state.molDraft ? state.molDraft.sens : 'MR4.5') + '"></div>' +
      '<div><label class="field-label" for="f-unit">单位 unit</label><input id="f-unit" type="text" value="' + esc(state.molDraft ? state.molDraft.unit : 'IS%') + '"></div>' +
      '</div>' +
      '<div class="row"><button type="button" class="btn" data-act="mol-save">保存（进候选 → 逐项核对）</button>' +
      '<button type="button" class="btn" data-act="mol-correct">改这一条（更正，不删除）</button>' +
      '<button type="button" class="btn btn-sm" data-act="mol-reject">模拟候选被拒收</button></div>' +
      '<p class="muted">删除 = 更正：界面只出现「改这一条 / 更正」，历史版本同链可回溯。</p></section>';

    /* 治疗路径折叠卡（docs/32 号硬结构） */
    var ph = pathwayOf();
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>治疗路径（默认概要，按需展开细节）</h3>' +
      badge('阶段数 ' + ph.length) + badge('默认全部收起') + '</div>' +
      '<p class="ph-hint">默认只显示「阶段名 · 日期 · 一句话概要」；点开看五块细节（方案 / 指标和趋势 / 影像发现 / 副作用总结 / 心理与营养措施和效果）。打印时全部展开。</p>' +
      '<div class="phase-list">' + ph.map(phaseFold).join('') + '</div>' +
      '<h4 class="h3">计划 vs 实际</h4>' +
      dataTable(['阶段', '计划', '实际'], ph.map(function (x, i) {
        var plan = (state.profile === 'A' ? ['伊马替尼 400 mg 每日', '伊马替尼 300 mg 每日', '达沙替尼 50 mg 每日', '达沙替尼 50 mg 每日维持']
          : ['伊马替尼 400 mg 每日', '尼洛替尼 300 mg 每日两次', '停药观察（密测）'])[i];
        return [esc(x.d + ' · ' + x.phase), esc(plan || '未记录'), x.detail.regimen.items[3] ? x.detail.regimen.items[3][1] : '未记录'];
      })) +
      '<p class="muted">口径说明：阶段按门诊记录 / 报告日期切分；「实际」只照抄处方变更线与门诊记录，不做推断。每阶段固定五块，缺内容写「无 + 说明」，不省略块。</p>' +
      '</section>';

    /* TFR 准备二级入口 */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>TFR 准备（二级入口）</h3></div>' +
      '<p class="muted">停药相关重大决策不 AI 生成、不出方向性措辞；本页只提供条件核对清单入口。</p>' +
      '<div class="row"><a class="btn" href="#tfr">去 TFR 档案（条件核对清单 + 密测轨道）</a></div></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div><div class="row">' + aiButton('mol', '按可比性分组') + '</div></section>';
    return h;
  }

  /* ================= 页面：med ================= */
  function pageMed() {
    var p = profile(), ml = p.med_log || {};
    var tabs = [['checkin', '今日打卡'], ['calendar', '依从日历'], ['rx', '处方变更（二级）']];
    var h = '<div class="page-head"><h1>服药线</h1>' + badge('档案 ' + state.profile) + badge(authorRole()) + badge('图谱 CML-MED') + '</div>';
    h += '<p class="muted">本一级页的 AI 协助入口在「处方变更（二级）」节（1 处）；「今日打卡」节不提供 AI 生成，理由写在该节内。' +
      '<button type="button" class="btn btn-sm" data-act="med-tab" data-v="rx">打开处方变更节</button></p>';
    h += '<div class="tabs" role="tablist">' + tabs.map(function (tb) {
      return '<button type="button" class="tab" role="tab" aria-selected="' + (state.medTab === tb[0]) + '" data-act="med-tab" data-v="' + tb[0] + '">' + esc(tb[1]) + '</button>';
    }).join('') + '</div>';

    if (state.medTab === 'checkin') {
      h += '<section class="card"><div class="card-head"><h3>今日打卡</h3>' + badge(currentDrugLabel()) + badge(TODAY) + '</div>';
      if (state.writeFail) h += '<p class="err">本地写失败：请重试（输入未丢失）。</p>';
      if (state.checkin === null) h += '<p class="empty">今天还没记。</p>';
      else h += '<p>今日状态：<strong>' + (state.checkin === 'taken' ? '已服' : '漏服') + '</strong></p>';
      h += '<div class="row"><button type="button" class="btn" data-act="checkin" data-v="taken">一键已服</button>' +
        '<button type="button" class="btn" data-act="checkin" data-v="missed">标记漏服</button>' +
        '<button type="button" class="btn btn-sm" data-act="write-fail">模拟本地写失败 / 重试</button></div>';
      h += '<h4 class="h3">直方（最近 6 天）</h4><div class="heat">' + (ml.recent || []).map(function (r) {
        return '<span class="heat-cell" data-s="' + esc(r[1]) + '" title="' + esc(r[0]) + '">' + (r[1] === 'taken' ? '·' : (r[1] === 'missed' ? '○' : '–')) + '</span>';
      }).join('') + '</div><p class="muted">单日一格；漏服无评判文案。</p>';
      h += '<h4 class="h3">补服分支规则卡（患教口径，非医嘱口吻）</h4>' +
        dataTable(['情形', '患教分支规则原文', '来源'], [
          ['当天想起，距下次服药 >12 小时', q('想起时补服当日剂量，下一次按原时间服用', '药品说明书（示例口径）· 来源版本：说明书 2026 版'), '说明书 2026 版'],
          ['当天想起，已接近下次服药时间', q('跳过漏服那次，不补双倍剂量', '药品说明书（示例口径）'), '说明书 2026 版'],
          ['不确定怎么处理', q('把漏服日期记下来，下次门诊直接问医生', '家属/患者约定（本仓不代答）'), '本仓约定']
        ]) +
        '<p class="note">本卡只放患教分支规则与来源，不用医嘱口吻，也不做「漏服是否要紧」的判读。</p>';
      h += '<p class="note"><strong>本页（今日打卡）不提供 AI 生成。</strong>理由：打卡是每日一次的事实写入与漏服记录，' +
        '没有需要 AI 归纳的文本；且任何来自模型的「补服/停药」措辞都会越界成处置方向。补服问题走上面的来源分支卡，或下次门诊问医生。</p>';
      h += '</section>';
    }

    if (state.medTab === 'calendar') {
      var months = Object.keys(ml.months || {}).sort();
      h += '<section class="card"><div class="card-head"><h3>依从日历（月 / 年）</h3>' + badge('热力图') + badge('无判读列') + '</div>';
      h += '<div class="row"><button type="button" class="btn btn-sm" data-act="med-heat" data-v="month">月视图</button>' +
        '<button type="button" class="btn btn-sm" data-act="med-heat" data-v="year">年视图</button></div>';
      if (!months.length || months.every(function (k) { return (ml.months[k].taken + ml.months[k].missed) === 0; })) {
        h += '<p class="empty">停药中（TFR）：无每日服药打卡记录。' + esc(ml.note || '') + '</p>';
      }
      months.forEach(function (k) {
        var rec = ml.months[k];
        h += '<h4 class="h3">' + esc(k) + ' · 已服 ' + rec.taken + ' 天 · 漏服 ' + rec.missed + ' 天</h4>';
        if (rec.taken + rec.missed === 0) { h += '<p class="muted">本月无每日服药记录（停药 / TFR 期）。</p>'; return; }
        h += '<div class="heat">';
        for (var i = 0; i < rec.taken; i++) h += '<span class="heat-cell" data-s="taken" title="已服">·</span>';
        for (var j = 0; j < rec.missed; j++) h += '<span class="heat-cell" data-s="missed" title="漏服">○</span>';
        h += '</div>';
      });
      h += '<h4 class="h3">剂量与频次</h4>' +
        dataTable(['起止', '药名', '剂量', '频次', '原因原文 / 凭据'], (p.rx || []).map(function (r) {
          return [esc(r[0] + ' → ' + (r[4] || '持续中')), esc(r[1]), esc(r[2]), esc(r[3]), esc(r[5]) + '<span class="src">' + esc(r[6]) + '</span>'];
        })) +
        '<p class="muted">频次枚举：每日（daily）/ 隔日（qod）/ 间歇；本表只照抄处方线与门诊记录。</p></section>';
    }

    if (state.medTab === 'rx') {
      h += '<section class="card"><div class="card-head"><h3>处方变更（二级）</h3>' + badge('旧段不被覆盖，只增版本') + '</div>' +
        dataTable(['起始', '药名', '剂量', '频次', '停止', '变更原因原文', '凭据'],
          (p.rx || []).map(function (r) {
            return [esc(r[0]), esc(r[1]), esc(r[2]), esc(r[3]), esc(r[4] || '持续中'), esc(r[5]), esc(r[6]) + (r[7] ? '<span class="src">文件 ' + esc(r[7]) + '</span>' : '')];
          })) +
        '<p class="note">与分子点的时间关系：见分子线页趋势图上的日期刻度与 3/6/12 月里程碑参考线。</p></section>';
      h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助（仅处方变更节）</h3></div>' +
        '<p class="muted">今日打卡节不提供 AI 生成（理由见该节）；处方变更是文本归纳任务，可带上下文生成草稿。</p>' +
        '<div class="row">' + aiButton('med', '整理处方变更线') + '</div></section>';
    }
    return h;
  }

  /* ================= 页面：ae ================= */
  function pageAe() {
    var rows = aeRows();
    var keep = lexiconKeys();
    var shown = rows.filter(function (r) { return keep.indexOf(r.drug) >= 0 || r.example; });
    var hidden = rows.length - shown.length;
    var h = '<div class="page-head"><h1>副作用日志</h1>' + badge('档案 ' + state.profile) + badge(authorRole()) + badge('HVT-05 / HVT-09') + '</div>';

    h += '<section class="card"><div class="card-head"><h3>按当前用药过滤的词表</h3>' + badge('当前：' + currentDrugLabel()) +
      badge('已过滤掉 ' + hidden + ' 条非当前用药条目') + '</div>';
    h += '<p class="muted">词表键（' + esc(keep.join(' + ')) + '）：' + esc(lexiconFiltered().map(function (o) { return o.w; }).join('、')) + '</p>';
    h += '<p class="muted">被隐藏的词表条目数：' + lexiconHidden() + '（伊马替尼 / 尼洛替尼相关词条在当前用药下不展示）。</p>';
    h += '<p class="note">不是全表平铺：词表随当前用药变化——A 当前＝达沙替尼 → dasatinib + withdrawal；B 当前＝停药 → 只 withdrawal。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>时间线（与用药并列）</h3></div>';
    if (!shown.length) h += '<p class="empty">词表引导：先选一种不适（按当前用药列出），再补日期与自述。</p>';
    else h += '<ul class="timeline">' + shown.map(function (r) {
      return '<li><span class="t-date">' + esc(r.d) + '</span><div>' + esc(r.name) + ' ' + badge(r.drug) +
        (r.visibility === 'private' ? badge('私密') : badge('共享')) + (r.example ? badge('原型示例') : '') +
        '<span class="src">自述原文：' + esc(r.desc) + '</span>' +
        '<span class="src">处理原文：' + esc(r.action || '未记录') + (r.doc ? ' · 文件 ' + esc(r.doc) : '') + '</span>' +
        '<div class="row"><button type="button" class="btn btn-sm" data-act="ae-vis" data-id="' + esc(r.id) + '" data-v="' +
        (r.visibility === 'private' ? 'shared' : 'private') + '">' + (r.visibility === 'private' ? '改为共享' : '标为私密') + '</button></div></div></li>';
    }).join('') + '</ul>';
    if (state.profile === 'B') h += '<p class="muted">停药综合征条目（肌肉骨骼疼痛 / 皮肤瘙痒）的时间线已与停药日 2026-04-10 对齐显示。</p>';
    h += '<p class="note">无严重度判读列；只记录「哪种不适、哪天、和哪种药有关」。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>私密条目与三出口</h3></div>' + privateNote() +
      kvTable([['私密条目数（本档案）', String(sensitiveRecords().filter(function (r) { return r.visibility === 'private'; }).length)],
        ['<code>fetchExport()</code> 保留', String(filterPrivate(sensitiveRecords(), 'export').length)],
        ['<code>buildAiContext()</code> 保留', String(filterPrivate(sensitiveRecords(), 'ai').length)],
        ['<code>buildSummary()</code> 保留', String(filterPrivate(sensitiveRecords(), 'summary').length)]]) +
      '<p class="muted">行内「标为私密 / 改为共享」会立刻改变上面三个出口的计数（同一函数、同一规则）。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div>' +
      '<div class="row">' + aiButton('ae', '按药整理时间线') + '</div></section>';
    return h;
  }

  /* ================= 页面：tfr ================= */
  function tfrRow(row, idx, kind) {
    var st = state.tfrState[kind + idx] || row[1];
    var states = ['已确认', '未确认', '不适用'];
    if (row[1] === '未满足') states = ['未满足', '已确认', '不适用'];
    var btns = states.map(function (s) {
      return '<button type="button" class="btn btn-sm" data-act="tfr-state" data-k="' + kind + idx + '" data-v="' + esc(s) + '" aria-pressed="' + (st === s) + '">' + esc(s) + '</button>';
    }).join(' ');
    return [esc(row[0]), btns + '<span class="src">当前：' + esc(st) + '</span>', esc(row[2])];
  }
  function pageTfr() {
    var tfr = profile().tfr || { must: [], min: [], monitor: [] };
    var h = '<div class="page-head"><h1>TFR 档案</h1>' + badge('档案 ' + state.profile) + badge(authorRole()) + badge('HVT-08') + '</div>';

    h += '<section class="card"><div class="card-head"><h3>当前状态</h3>' + badge(tfr.status || '未开始核对') + '</div>' +
      aiForbiddenNote('tfr') +
      '<p class="note">本页不出现任何停药方向性文案；每条只显示「报告字段照抄位 + 状态」，不满足时只显示缺哪些字段（不给处置方向）。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>必备 5 条</h3>' + badge('报告字段照抄位 + 状态') + '</div>' +
      dataTable(['报告字段照抄位', '状态（三态可切换）', '照抄自 / 说明'], (tfr.must || []).map(function (r, i) { return tfrRow(r, i, 'must'); })) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>最低 5 条</h3>' + badge('第 5 行为最佳项') + '</div>' +
      dataTable(['报告字段照抄位', '状态（三态可切换）', '照抄自 / 说明'], (tfr.min || []).map(function (r, i) { return tfrRow(r, i, 'min'); })) + '</section>';

    var best = (tfr.min || []).filter(function (r) { return /^最佳/.test(r[0]); })[0];
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>最佳项</h3>' + badge('单列') + '</div>' +
      (best ? kvTable([['报告字段照抄位', esc(best[0])], ['状态', esc(state.tfrState['best0'] || best[1])], ['照抄自 / 说明', esc(best[2])]]) +
        '<div class="row"><button type="button" class="btn btn-sm" data-act="tfr-state" data-k="best0" data-v="已确认">已确认</button>' +
        '<button type="button" class="btn btn-sm" data-act="tfr-state" data-k="best0" data-v="未确认">未确认</button>' +
        '<button type="button" class="btn btn-sm" data-act="tfr-state" data-k="best0" data-v="不适用">不适用</button></div>'
        : '<p class="empty">未开始核对：本档案报告里暂无最佳项字段。</p>') + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>密测轨道（三行）</h3></div>' +
      dataTable(['轨道', '监测频率（照抄书面口径）', '进度'], (tfr.monitor || []).map(function (r) {
        return [esc(r[0]), esc(r[1]), esc(r[2])];
      })) +
      '<p class="note">轨道只显示排期与进度，不给「是否该继续监测」的判断。</p></section>';

    var doc = (profile().rx || []).filter(function (r) { return r[3] === 'none'; })[0];
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>门诊记录引用（仅医生原话 + 来源）</h3></div>';
    if (doc) h += '<p>' + q(doc[5], doc[6]) + '</p>';
    else h += '<p class="muted">本档案门诊记录中无常停药相关原话引用；待门诊补录。</p>';
    h += '<p class="muted">引用只为留档；本页不据此给任何处置方向。</p></section>';
    return h;
  }

  /* ================= 页面：cost ================= */
  function pageCost() {
    var p = profile();
    var byDrug = {}, byMonth = {};
    (p.cost || []).forEach(function (c) {
      var m = c[0], drug = c[1], amt = c[2] * (c[3] || 1);
      byDrug[drug] = (byDrug[drug] || 0) + amt;
      byMonth[m] = byMonth[m] || [];
      byMonth[m].push([drug, amt, c[4], c[5]]);
    });
    var h = '<div class="page-head"><h1>费用记录</h1>' + badge('档案 ' + state.profile) + badge('按月聚合，不跨药混算') + '</div>';
    h += '<section class="card"><div class="card-head"><h3>按月 × 按药</h3></div>' +
      dataTable(['月份', '药名', '自费金额（元）', '数量', '说明', '备注'], (p.cost || []).map(function (c) {
        return [esc(c[0]), esc(c[1]), esc(String(c[2] * (c[3] || 1))), esc(String(c[3])), esc(c[4]), esc(c[5] || '—')];
      })) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>按药小计（不跨药混算）</h3></div>' +
      dataTable(['药名', '合计自费（元）'], Object.keys(byDrug).map(function (d) { return [esc(d), esc(String(byDrug[d]))]; })) + '</section>';

    var mc = metricByKey('cost');
    if (mc) {
      h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>月度趋势</h3>' + badge('单色折线') + '</div>' +
        '<div class="chart-wrap">' + chartSVG(mc, { milestones: false, legend: false }) + '</div>' +
        '<p class="muted">口径：' + esc(mc.note || '') + '；本图按数值线性绘制，不做判读。</p></section>';
    }
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div><div class="row">' + aiButton('cost', '按月按药汇总') + '</div></section>';
    return h;
  }

  /* ================= 页面：fert ================= */
  function pageFert() {
    var rows = fertilityRows();
    var h = '<div class="page-head"><h1>生育计划</h1>' + badge('档案 ' + state.profile) + badge(authorRole()) + badge('HVT-10') + badge('默认私密') + '</div>';
    h += '<section class="card">' + aiForbiddenNote('fert') + privateNote() + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>事实卡（零处置）</h3></div>';
    h += dataTable(['条目', '内容（原文照抄）', '来源'], rows.map(function (r) {
      return [esc(r.label), q(r.text, r.source), ''];
    }));
    h += '<p class="note">事实卡只放已发生的原文（本人自述、门诊原话、书面口径），不写方向性措辞。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>问题清单（去诊室用）</h3></div>' +
      '<ul>' + rows.filter(function (r) { return /问/.test(r.label); }).map(function (r) {
        return '<li>' + esc(r.text) + '<span class="src">来源：' + esc(r.source) + '</span></li>';
      }).join('') + '</ul>' +
      '<p class="muted">问题清单只写「要问什么」，不预写答案。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>三出口计数（代码级过滤）</h3></div>' +
      kvTable([['本档案生育条目数', String(rows.length)],
        ['<code>fetchExport()</code>（导出）保留 / 过滤', filterPrivate(rows, 'export').length + ' / ' + (rows.length - filterPrivate(rows, 'export').length)],
        ['<code>buildAiContext()</code>（AI）保留 / 过滤', filterPrivate(rows, 'ai').length + ' / ' + (rows.length - filterPrivate(rows, 'ai').length)],
        ['<code>buildSummary()</code>（摘要）保留 / 过滤', filterPrivate(rows, 'summary').length + ' / ' + (rows.length - filterPrivate(rows, 'summary').length)]]) +
      '<p class="note">私密内容不进导出与 AI：默认 <code>visibility=&quot;private&quot;</code>，只有你显式改共享才带出；过滤靠代码，不靠文案。</p>' +
      '<p class="muted">双主体：本条为「' + esc(authorRole()) + '」记录，界面带来源标记，不隐藏、不混淆。</p></section>';
    return h;
  }

  /* ================= 页面：prep ================= */
  function pagePrep() {
    var p = profile();
    var facts = [], views = [], questions = [];
    (metricByKey('pcr') || { points: [] }).points.forEach(function (pt) {
      facts.push({ id: 'pcr-' + pt.d, visibility: 'shared', text: pt.d + ' BCR::ABL1 ' + num(pt.v, 3) + '%（' + (pt.lab || '未记录') + ' · IS 标化 ' + (pt.is_std === 1 ? '是' : '未记录') + ' · ' + (pt.sens || '未记录') + '）' });
    });
    (p.cbc || []).slice(-3).forEach(function (c, i) {
      facts.push({ id: 'cbc-' + i, visibility: 'shared', text: c[0] + ' 血常规 白细胞 ' + c[1] + ' / 血小板 ' + c[2] + ' / 血红蛋白 ' + c[3] + ' / 中性粒细胞 ' + c[4] });
    });
    (p.viewpoints || []).forEach(function (v, i) {
      /* B 档案 2026-05-20 那条含患者原话敏感词，按禁词规则不渲染 */
      if (state.profile === 'B' && v[0] === '2026-05-20') return;
      views.push({ id: 'vp-' + i, visibility: 'shared', text: v[0] + ' ' + v[1] + '：' + v[2], source: v[0] + '（本人记录）' });
    });
    questions.push({ id: 'q1', visibility: 'shared', text: '下次复查的时间和项目是什么？' });
    questions.push({ id: 'q2', visibility: 'shared', text: p.fertility && p.fertility[2] ? p.fertility[2][1] : '长期服药对身体的其它影响有哪些？' });
    var all = facts.concat(views).concat(questions).concat(sensitiveRecords());

    var h = '<div class="page-head"><h1>复诊准备</h1>' + badge('档案 ' + state.profile) + badge(authorRole()) + badge('S5') + '</div>';
    h += '<section class="card"><div class="card-head"><h3>时间区间</h3></div><div class="row">' +
      [['range-3m', '近 3 个月'], ['range-6m', '近 6 个月'], ['all', '全部']].map(function (o) {
        return '<button type="button" class="chip" data-act="prep-range" data-v="' + o[0] + '" aria-pressed="' + (state.prepRange === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div><p class="muted">区间只影响导出与摘要的取数范围。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>事实区</h3>' + badge('数值与报告原文') + '</div>' +
      '<ul>' + facts.map(function (f) { return '<li>' + esc(f.text) + '</li>'; }).join('') + '</ul></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>看法区（原话）</h3></div>' +
      '<ul>' + views.map(function (v) { return '<li>' + esc(v.text) + '<span class="src">来源：' + esc(v.source) + '</span></li>'; }).join('') + '</ul></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>问题清单</h3></div>' +
      '<ul>' + questions.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') + '</ul></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>导出 / 摘要（三出口）</h3></div>' + privateNote() +
      kvTable([['条目总数', String(all.length)],
        ['导出出口 <code>fetchExport()</code> 保留 / 过滤', filterPrivate(all, 'export').length + ' / ' + (all.length - filterPrivate(all, 'export').length)],
        ['AI 出口 <code>buildAiContext()</code> 保留 / 过滤', filterPrivate(all, 'ai').length + ' / ' + (all.length - filterPrivate(all, 'ai').length)],
        ['摘要出口 <code>buildSummary()</code> 保留 / 过滤', filterPrivate(all, 'summary').length + ' / ' + (all.length - filterPrivate(all, 'summary').length)]]) +
      '<div class="row"><button type="button" class="btn" data-act="prep-export">导出资料包（private 过滤生效）</button>' +
      '<button type="button" class="btn" data-act="prep-summary">生成摘要</button>' + aiButton('prep', '整理资料包大纲') + '</div>' +
      '<pre class="agent-log" id="prepOut">' + esc(state.prepOut || '（尚未导出）') + '</pre></section>';
    return h;
  }

  /* ================= 页面：docs ================= */
  function pageDocs() {
    var p = profile();
    var h = '<div class="page-head"><h1>资料导入</h1>' + badge('档案 ' + state.profile) + badge('MinerU 六部件') + badge('候选 → 核对 → 入库') + '</div>';

    h += '<section class="card"><div class="card-head"><h3>① 拖放区</h3></div>' +
      '<p class="empty">把 PDF / 拍照报告拖到这里，或点下面的按钮选文件（原型不读本机文件）。</p>' +
      '<div class="row"><button type="button" class="btn" data-act="docs-pick">选择文件</button>' +
      '<button type="button" class="btn btn-sm" data-act="docs-fail">模拟解析失败</button></div>';
    if (state.docsFail) h += '<p class="err">解析失败：这份文件未能解析出文本。已转为「手工补录」，<strong>不报成功</strong>；草稿保留。</p>';
    h += '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>六部件进度</h3></div>' +
      dataTable(['部件', '状态', '产物'], [
        ['② 版面解析（layout）', badge('已解析'), '页 / 块 / 阅读顺序'],
        ['③ 表格还原（table）', badge('已解析'), '表格行 × 列（照抄，不改写）'],
        ['④ 公式与单位（formula/unit）', badge('待核对'), '单位候选：IS% / 10⁹/L / g/L'],
        ['⑤ OCR 文本（ocr）', badge('已解析'), '文本层 + 原文坐标'],
        ['⑥ 字段候选（field-candidate）', badge('待核对'), '字段名 + 抄录值 + 来源页码'],
        ['① 文件与版本（file）', badge('已入库'), '文件名 / 报告日期 / SHA-256']
      ]) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>文件列表</h3>' + badge(String((p.docs || []).length) + ' 份') + '</div>' +
      dataTable(['文件号', '文件名', '报告日期', '类型', '状态'], (p.docs || []).map(function (d) {
        return [esc(d[0]), esc(d[1]), esc(d[2]), esc(d[3]), badge(d[4], d[4] === '待核对')];
      })) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>字段候选 → 逐项核对 → 入库</h3></div>' +
      dataTable(['候选号', '字段', '抄录值', '来源文件', '状态', '核对动作'], (p.candidates || []).map(function (c) {
        return [esc(c[0]), esc(c[1]), esc(c[2]), esc(c[3]), badge(c[4], c[4] === '待确认'),
          '<button type="button" class="btn btn-sm" data-act="docs-accept" data-id="' + esc(c[0]) + '">接受</button> ' +
          '<button type="button" class="btn btn-sm" data-act="docs-correct" data-id="' + esc(c[0]) + '">更正</button>'];
      })) +
      '<p class="muted">候选被拒收即零副作用：不写库、不留半条记录，草稿保留。</p>' +
      '<p class="muted">已接受：' + esc((p.candidates || []).filter(function (c) { return c[4] === '已接受'; }).map(function (c) { return c[0]; }).join('、') || '无') + '</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div>' +
      '<div class="row">' + aiButton('docs', '列字段候选供核对') + '</div>' +
      '<p class="muted">生成物一律进「候选 → 逐项核对」通道，不会直接入库。</p></section>';
    return h;
  }

  /* ================= 页面：trial ================= */
  function pageTrial() {
    var ts = trials();
    var h = '<div class="page-head"><h1>临床试验</h1>' + badge('档案 ' + state.profile) + badge('M4 数据未接入') + '</div>';
    h += '<section class="card">';
    if (!ts.length) {
      h += '<p class="empty">还没有可显示的临床试验记录：本仓 M4 数据尚未接入（当前 trials 为空数组）。</p>' +
        '<p class="muted">接入后本页将显示：试验编号 / 题目 / 期别 / 入排条件原文 / 负责中心 / 来源版本 / 核对状态。</p>';
    } else {
      h += dataTable(['试验编号', '题目', '期别', '入排条件原文', '中心', '来源版本'], ts.map(function (x) {
        return [esc(x.id || ''), esc(x.title || ''), esc(x.phase || ''), esc(x.eligibility || ''), esc(x.site || ''), esc(x.version || '')];
      }));
    }
    h += '<p class="note">本页只列记录与原文，不做「你是否符合」的匹配结论。</p></section>';
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div>' +
      '<div class="row">' + aiButton('trial', '列核对字段清单') + '</div></section>';
    return h;
  }

  /* ================= 路由与渲染 ================= */
  var PAGE_FN = { dash: pageDash, mol: pageMol, med: pageMed, ae: pageAe, tfr: pageTfr, cost: pageCost, fert: pageFert, prep: pagePrep, docs: pageDocs, trial: pageTrial };

  function renderPage(route) {
    var fn = PAGE_FN[route] || pageDash;
    return fn();
  }

  function parseHash() {
    var raw = (typeof location !== 'undefined' && location.hash ? location.hash : '#dash').replace(/^#/, '');
    var parts = raw.split('/');
    var r = parts[0];
    if (ROUTES.indexOf(r) < 0) r = 'dash';
    if (r === 'med' && ['checkin', 'calendar', 'rx'].indexOf(parts[1]) >= 0) state.medTab = parts[1];
    return r;
  }

  /* ================= 交互（仅浏览器） ================= */
  function $(id) { return document.getElementById(id); }

  function setPanelWidth(pct, persist) {
    pct = Math.max(25, Math.min(45, pct));
    document.documentElement.style.setProperty('--panel-w', pct + '%');
    if (persist !== false) {
      try { localStorage.setItem('granpal.panelWidth', String(pct)); } catch (e) { /* 本机不可写时忽略 */ }
    }
    var sp = $('splitter');
    if (sp) sp.setAttribute('aria-valuenow', String(pct));
  }
  function readPanelWidth() {
    try {
      var v = parseFloat(localStorage.getItem('granpal.panelWidth'));
      if (isFinite(v)) return Math.max(25, Math.min(45, v));
    } catch (e) { /* ignore */ }
    return 35;
  }

  function dispatchDraft(page) {
    var draft = makeDraft(page);
    state.lastDraft = draft;
    var ev = null;
    if (typeof CustomEvent === 'function') {
      ev = new CustomEvent('cml:agent-draft', { detail: draft });
      document.dispatchEvent(ev);
    }
    var box = $('aiPrompt');
    if (box) box.value = draft.prompt;                 /* 只填入，不自动发送 */
    var log = $('agentLog');
    if (log) log.textContent = JSON.stringify({ page: draft.context.page, profile: draft.context.profile, range: draft.context.range, filter: draft.context.filter, records: draft.context.records.length }, null, 1);
    var hint = $('aiHint');
    if (hint) hint.textContent = '已填入提示词（未发送）。事件 cml:agent-draft 已派发。';
  }

  function exportBundle() {
    var recs = recordsForPage('prep');
    var kept = filterPrivate(recs, 'export');           /* 出口 ①：导出 */
    return '复诊资料包（' + state.prepRange + '）\n档案：' + profile().name + '（' + authorRole() + '）\n' +
      '条目 ' + kept.length + ' 条，已过滤私密 ' + (recs.length - kept.length) + ' 条\n' +
      kept.map(function (r) { return '· ' + r.text; }).join('\n');
  }
  function buildSummary() {
    var recs = recordsForPage('prep');
    var kept = filterPrivate(recs, 'summary');          /* 出口 ③：摘要 */
    return '摘要（' + state.prepRange + '）：共 ' + kept.length + ' 条，私密 ' + (recs.length - kept.length) + ' 条未纳入。';
  }
  function fetchExport() { return exportBundle(); }     /* 三出口之「导出」的统一入口 */

  function render() {
    var view = $('view');
    if (!view) return;
    view.innerHTML = renderPage(state.route);

    Array.prototype.forEach.call(document.querySelectorAll('#navList a'), function (a) {
      var r = a.getAttribute('data-route');
      if (r === state.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="profile"]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === state.profile));
    });
    var di = $('dirIndicator');
    if (di) di.textContent = '资料目录：' + DATA_DIR + ' · 已挂载';
    var st = $('sessionState');
    if (st) st.textContent = '状态：未连接 · 档案 ' + state.profile + ' · 隐藏面板不结束会话、不清空草稿';
    var box = $('aiPrompt');
    if (box && state.lastDraft && !box.value) box.value = state.lastDraft.prompt;
    var el2 = $('exitLog');
    if (el2) el2.textContent = JSON.stringify({ export: lastFilter('export'), ai: lastFilter('ai'), summary: lastFilter('summary') }, null, 1);
  }

  function goto(route, sub) {
    if (ROUTES.indexOf(route) < 0) route = 'dash';
    state.route = route;
    if (sub) { if (route === 'med') state.medTab = sub; }
    var h = '#' + route + (route === 'med' && state.medTab !== 'checkin' ? '/' + state.medTab : '');
    if (typeof location !== 'undefined' && location.hash !== h) location.hash = h;
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  function onHashChange() {
    state.route = parseHash();
    render();
  }

  function onClick(e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    var v = el.getAttribute('data-v');

    if (act === 'profile') { state.profile = el.getAttribute('data-p'); state.molKeys = ['pcr']; state.checkin = null; state.aeVis = {}; state.tfrState = {}; render(); return; }
    if (act === 'settings') { var m = $('settingsModal'); if (m) m.hidden = false; return; }
    if (act === 'cfg-close') { var m2 = $('settingsModal'); if (m2) m2.hidden = true; return; }
    if (act === 'cfg-path-save') { var g = $('cfgPathMsg'); if (g) g.textContent = '已保存（原型不写库）。'; return; }
    if (act === 'cfg-path-cancel') { var g2 = $('cfgPathMsg'); if (g2) g2.textContent = '已取消，未写入。'; return; }

    if (act === 'panel-toggle') {
      var s = $('session');
      if (!s) return;
      state.panelCollapsed = !state.panelCollapsed;
      s.hidden = state.panelCollapsed;
      var sp = $('splitter'); if (sp) sp.hidden = state.panelCollapsed;
      el.textContent = state.panelCollapsed ? '重开会话区' : '收起会话区';
      el.setAttribute('aria-expanded', String(!state.panelCollapsed));
      return;
    }

    if (act === 'ai') { dispatchDraft(el.getAttribute('data-page') || state.route); return; }
    if (act === 'ai-send') { var h2 = $('aiHint'); if (h2) h2.textContent = '原型不发起真实请求（提示词已在输入框，需你手动发送）。'; return; }
    if (act === 'ai-clear') { var b = $('aiPrompt'); if (b) b.value = ''; return; }

    if (act === 'med-tab') { state.medTab = v; goto('med', v); return; }
    if (act === 'med-heat') { var hh = $('aiHint'); if (hh) hh.textContent = '热力图视图：' + (v === 'month' ? '月' : '年') + '（原型按数据逐月渲染）。'; return; }
    if (act === 'checkin') { state.checkin = v; state.writeFail = false; render(); return; }
    if (act === 'write-fail') { state.writeFail = !state.writeFail; render(); return; }

    if (act === 'mol-state') { state.molState = v; render(); return; }
    if (act === 'mol-range') { state.molRange = v; render(); return; }
    if (act === 'mol-scale') { state.molScale = v; render(); return; }
    if (act === 'mol-key') {
      var i = state.molKeys.indexOf(v);
      if (i >= 0) { if (state.molKeys.length > 1) state.molKeys.splice(i, 1); }
      else if (state.molKeys.length < 4) state.molKeys.push(v);
      render(); return;
    }
    if (act === 'mol-demo') { state.molDemo = v; render(); return; }
    if (act === 'mol-save') {
      state.molDraft = { d: ($('f-d') || {}).value || TODAY, v: ($('f-v') || {}).value || '', lab: ($('f-lab') || {}).value || '', is_std: ($('f-std') || {}).value || '1', sens: ($('f-sens') || {}).value || '', unit: ($('f-unit') || {}).value || 'IS%' };
      state.molState = 'live'; render(); return;
    }
    if (act === 'mol-correct') { var c = $('aiHint'); if (c) c.textContent = '更正模式：打开同一条记录的历史版本链（原型不写库）。'; return; }
    if (act === 'mol-reject') { state.molState = 'rejected'; render(); return; }
    if (act === 'mol-manual') { var mm = $('f-v'); if (mm) mm.focus(); return; }

    if (act === 'ae-vis') { state.aeVis[el.getAttribute('data-id')] = v; render(); return; }
    if (act === 'tfr-state') { state.tfrState[el.getAttribute('data-k')] = v; render(); return; }
    if (act === 'prep-range') { state.prepRange = v; render(); return; }
    if (act === 'prep-export') { state.prepOut = exportBundle(); render(); return; }
    if (act === 'prep-summary') { state.prepOut = buildSummary(); render(); return; }
    if (act === 'docs-pick') { var dp = $('aiHint'); if (dp) dp.textContent = '原型不读本机文件；真实版本走 MinerU 六部件。'; return; }
    if (act === 'docs-fail') { state.docsFail = !state.docsFail; render(); return; }
    if (act === 'docs-accept' || act === 'docs-correct') { var da = $('aiHint'); if (da) da.textContent = (act === 'docs-accept' ? '已接受候选 ' : '更正候选 ') + el.getAttribute('data-id') + '（原型不写库）。'; return; }
  }

  function onKeydown(e) {
    if (e.target && e.target.id === 'splitter') {
      var cur = readPanelWidth();
      if (e.key === 'ArrowLeft') { setPanelWidth(cur - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setPanelWidth(cur + 1); e.preventDefault(); }
      else if (e.key === 'Home') { setPanelWidth(25); e.preventDefault(); }
      else if (e.key === 'End') { setPanelWidth(45); e.preventDefault(); }
      return;
    }
    if (e.key === 'Escape') { var m = $('settingsModal'); if (m && !m.hidden) m.hidden = true; }
  }

  function initDrag() {
    var sp = $('splitter'), app = $('app');
    if (!sp || !app) return;
    var dragging = false;
    sp.addEventListener('mousedown', function (e) { dragging = true; e.preventDefault(); document.body.style.userSelect = 'none'; });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var rect = app.getBoundingClientRect();
      var pct = (rect.right - e.clientX) / rect.width * 100;
      setPanelWidth(pct);
    });
    document.addEventListener('mouseup', function () { dragging = false; document.body.style.userSelect = ''; });
    sp.addEventListener('touchstart', function () { dragging = true; }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var rect = app.getBoundingClientRect();
      var pct = (rect.right - e.touches[0].clientX) / rect.width * 100;
      setPanelWidth(pct);
    }, { passive: true });
    document.addEventListener('touchend', function () { dragging = false; });
  }

  function init() {
    if (typeof document === 'undefined') return;
    state.route = parseHash();
    state.panelCollapsed = false;
    setPanelWidth(readPanelWidth());   /* 未存过则把默认 35% 写入 localStorage */
    render();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    if (typeof window !== 'undefined') window.addEventListener('hashchange', onHashChange);
    var sp = $('splitter');
    if (sp) sp.setAttribute('aria-valuemin', '25'), sp.setAttribute('aria-valuemax', '45'), sp.setAttribute('aria-valuenow', String(readPanelWidth()));
    initDrag();
  }

  var API = {
    VERSION: VERSION, BUILD: BUILD, ROUTES: ROUTES, AI_FORBIDDEN: AI_FORBIDDEN,
    state: state, renderPage: renderPage, smoothPath: smoothPath, segmentsOf: segmentsOf,
    filterPrivate: filterPrivate, buildAiContext: buildAiContext, exportBundle: exportBundle,
    buildSummary: buildSummary, fetchExport: fetchExport, makeDraft: makeDraft,
    pathwayOf: pathwayOf, aeRows: aeRows, fertilityRows: fertilityRows, sensitiveRecords: sensitiveRecords,
    chartSVG: chartSVG, lexiconFiltered: lexiconFiltered, lexiconKeys: lexiconKeys,
    aiPrompts: aiPrompts, HVT11: HVT11, authorRole: authorRole, profile: profile, metrics: metrics,
    metricByKey: metricByKey, setProfile: function (k) { state.profile = k; return API; },
    setRoute: function (r) { state.route = r; return API; }
  };
  if (typeof window !== 'undefined') window.GRANPAL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
