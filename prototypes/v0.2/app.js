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

  var ROUTES = ['dash', 'mol', 'onechart', 'med', 'ae', 'tfr', 'cost', 'fert', 'prep', 'docs', 'trial'];
  var ROUTE_LABEL = {
    dash: '看板', mol: '分子线', onechart: '病情一图秀', med: '服药线', ae: '副作用日志', tfr: 'TFR 档案',
    cost: '费用记录', fert: '生育计划', prep: '复诊准备', docs: '资料导入', trial: '临床试验'
  };
  /* 红线：TFR 与生育两线不提供 AI 生成 */
  var AI_FORBIDDEN = { tfr: '红线：停药相关重大决策不 AI 生成', fert: '红线：生育相关重大决策不 AI 生成' };

  /* P0-5：写入是本机内存态，页面必须明写这句（全站常量，页脚 + 各写入卡复用） */
  var MEM_NOTICE = '原型为内存态，刷新回到演示数据';

  var state = {
    /* P0-4（第四轮评审，违反 24 号 MT13）：原为全局 Set，A 翻开 pcr 卡 → 切 B → B 的 pcr 卡进来就是开的。
       与 fertQByProfile 同一做法：按档案分桶，切档案各看各的。 */
    molFlippedByProfile: { A: new Set(), B: new Set() },
    oneSel: ['pcr', 'wbc'],
    oneRange: 'all',
    oneToggles: { treatment: true },
    profile: 'A',
    route: 'dash',
    medTab: 'checkin',
    molTab: 'trend',         /* trend | lab（CML-LAB「复查记录」二级页） */
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
    lastDraft: null,
    gloss: '',               /* S6：点开的里程碑角标 */
    /* P0-11④：未提交草稿按档案分桶；切换档案时显式清空（另一档案的表单拿不到） */
    drafts: { A: {}, B: {} },
    /* 本机内存态新增记录（每档案独立；刷新回到 demo 数据） */
    extra: {
      A: { pcr: [], ae: [], cost: [], rx: [] },
      B: { pcr: [], ae: [], cost: [], rx: [] }
    },
    accepted: { A: {}, B: {} },   /* P0-5：docs 候选「接受/更正」的真实状态 */
    /* P0-R1：生育页问题清单按档案分桶。切档案不是"清空"而是"各看各的"——
       清空会丢本人刚写的东西，共用一份又会把 B 的问题显示给 A。 */
    fertQByProfile: { A: [], B: [] },
    writes: []                    /* 最近写入回执（可观察） */
  };
  function ex() { return state.extra[state.profile]; }
  function draft() { return state.drafts[state.profile]; }
  function lastWrite(kind) {
    for (var i = state.writes.length - 1; i >= 0; i--) if (state.writes[i].kind === kind) return state.writes[i];
    return null;
  }
  function noteWrite(kind, text) {
    state.writes.push({ kind: kind, text: text, profile: state.profile });
    if (state.writes.length > 20) state.writes.shift();
  }

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
  /* 全量指标视图 = 演示数据 + 本机内存态写入（合并点唯一，就在这）。
     2026-10-25 自查发现：指标卡与一图秀选择器原先直接读 `metrics()`（未合并 ex()），
     写入一条复查记录后，趋势图变成 6 点、可比性表 6 行，但指标卡与选择器**仍显示旧的最近值 0.086**——
     同一份数据出现两个"最新值"，正是前几轮反复栽的那类问题。现在 metrics() 本身就合并，
     所有读取方（卡片 / 选择器 / 趋势 / 表）走同一份。 */
  function baseMetrics() { return (DATA.metrics && DATA.metrics[state.profile]) || []; }
  function metrics() {
    return baseMetrics().map(function (m) {
      if (m.key === 'pcr' && (ex().pcr || []).length) {
        return Object.assign({}, m, { points: m.points.concat(ex().pcr) });
      }
      if (m.key === 'cost' && (ex().cost || []).length) {
        return Object.assign({}, m, { points: m.points.concat(costExtraPoints(ex().cost)) });
      }
      return m;
    });
  }
  /* 本机内存态新增的费用条目 → 月度聚合点（每档案独立，刷新即消失） */
  function costExtraPoints(entries) {
    var byMonth = {};
    (entries || []).forEach(function (e) {
      var m = String(e.d || '').slice(0, 7);
      if (!m) return;
      byMonth[m] = (byMonth[m] || 0) + Number(e.amount || 0);
    });
    return Object.keys(byMonth).sort().map(function (m) {
      return { d: m + '-01', v: byMonth[m], src: '本机新增（' + MEM_NOTICE + '）' };
    });
  }
  /* P0-5：本机写入必须真的改变取数（趋势图新增点 / 费用聚合变化） */
  function metricByKey(k) {
    /* 合并已在 metrics() 里做过，这里只做查找——避免同一处写入被合并两次 */
    var ms = metrics();
    for (var i = 0; i < ms.length; i++) if (ms[i].key === k) return ms[i];
    return null;
  }
  function trials() { return DATA.trials || []; }
  /* 双主体：作者视角按档案取（A 患者本人 / B 家属代记）。
     注意：演示档案 A/B 是**两位不同患者**，不是同一人的两个视角——此前注释写过「同一患者的两条记录视角」，
     与数据矛盾，2026-10-25 P0-11 已按事实改正，此处注释同步。 */
  function authorRole() { return state.profile === 'B' ? '家属代记' : '患者本人'; }
  function authorView() { return state.profile === 'B' ? '家属代记视角' : '患者本人视角'; }
  /* 双主体：同一档案内一条记录可由本人或家属代记。
     演示档案 A 的记录者＝本人（patient self）；档案 B 由母亲代记为默认记录者，
     患者本人原话仍按来源标「本人自述」——两者并存，不互相冒充。 */
  function recorderDefault() { return state.profile === 'B' ? '家属代记' : '本人'; }
  function recBadge(r) { return badge('记录者：' + (r || recorderDefault())); }

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
  /* P0-11②：每档案每条的「记录者」（本人 / 家属代记），逐条可见 */
  var FERT_RECORDER = {
    A: ['本人', '本人', '本人'],
    B: ['本人', '家属代记', '母子共同记录']
  };
  var AE_RECORDER = {
    A: ['本人', '本人', '本人', '本人'],
    B: ['家属代记', '家属代记', '家属代记', '家属代记']
  };
  /* 生育计划：条目默认 visibility='private' */
  function fertilityRows() {
    var p = profile();
    var rec = FERT_RECORDER[state.profile] || [];
    return (p.fertility || []).map(function (row, i) {
      return {
        id: 'fert-' + state.profile + '-' + i,
        kind: 'fert',
        label: row[0],
        text: row[1],
        source: row[2],
        recorder: rec[i] || recorderDefault(),
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
    var rec = AE_RECORDER[state.profile] || [];
    var rows = (p.ae || []).map(function (row, i) {
      var id = 'ae-' + state.profile + '-' + i;
      return {
        id: id, d: row[0], name: row[1], drug: row[2], desc: row[3],
        action: row[4], doc: row[5],
        recorder: rec[i] || recorderDefault(),
        visibility: state.aeVis[id] || 'shared'
      };
    });
    /* P0-3：本机手工写入的条目（内存态） */
    (ex().ae || []).forEach(function (e) {
      rows.push({
        id: e.id, d: e.d, name: e.name, drug: e.drug, desc: e.desc, action: e.action, doc: e.doc,
        recorder: e.recorder || recorderDefault(), local: true,
        visibility: state.aeVis[e.id] || 'shared'
      });
    });
    var exr = PRIVATE_AE_EXAMPLE[state.profile];
    if (exr) {
      var id2 = 'ae-' + state.profile + '-private';
      rows.push({
        id: id2, d: exr.d, name: exr.name, drug: exr.drug, desc: exr.desc, action: exr.action,
        doc: exr.doc, example: true,
        recorder: recorderDefault(),
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
        recorder: r.recorder || recorderDefault(),
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
  function drugLabelOf(key) {
    return { dasatinib: '达沙替尼', imatinib: '伊马替尼', nilotinib: '尼洛替尼', withdrawal: '停药相关（停药综合征）' }[key] || key;
  }

  /* ================= 本机内存态记录（P0-2 / P0-3 / P0-4 / P0-5） ================= */
  /* 费用：demo 行 + 本机新增行（同一个月聚合，不跨药混算） */
  function costRows() {
    var base = (profile().cost || []).map(function (c) {
      return { m: c[0], drug: c[1], amt: c[2], qty: (c[3] == null ? 1 : c[3]), note: c[4], extra: c[5],
        recorder: recorderDefault(), local: false };
    });
    (ex().cost || []).forEach(function (e) {
      base.push({
        m: String(e.d || '').slice(0, 7), drug: e.drug + (e.spec ? ' · ' + e.spec : ''), amt: Number(e.amount || 0), qty: 1,
        note: '医保标记：' + e.insured + ' · 本机新增（' + MEM_NOTICE + '）', extra: '',
        recorder: e.recorder || recorderDefault(), local: true, d: e.d
      });
    });
    return base;
  }
  /* 处方变更：只新增分段（旧段不被覆盖） */
  function rxRows() {
    var rows = (profile().rx || []).map(function (r) {
      return { start: r[0], drug: r[1], dose: r[2], freq: r[3], stop: r[4], reason: r[5],
        src: r[6], doc: r[7], recorder: recorderDefault(), local: false };
    });
    (ex().rx || []).forEach(function (e) {
      rows.push({ start: e.start, drug: e.drug, dose: e.dose, freq: e.freq, stop: e.stop,
        reason: e.reason, src: e.src, doc: e.doc, recorder: e.recorder || recorderDefault(), local: true });
    });
    return rows;
  }
  /* 原因原文：医生原话一律进 <q class="quote"> + 紧邻 <span class="src">（红线） */
  function rxReasonCell(r) {
    var raw = String(r.reason == null ? '' : r.reason);
    var m = /^医生原话：「([\s\S]*)」$/.exec(raw);
    if (m) return q(m[1], (r.src || '未记录') + (r.doc ? ' · 文件 ' + r.doc : ''));
    if (!raw || raw === '—') return esc(raw || '—');
    return esc(raw) + '<span class="src">来源：' + esc((r.src || '未记录') + (r.doc ? ' · 文件 ' + r.doc : '')) + '</span>';
  }

  /* ================= P0-10：TFR 只记「字段有没有出现在报告里」 ================= */
  var TFR_STATES = ['已抄录', '未抄录', '待补'];
  function tfrMapState(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (TFR_STATES.indexOf(s) >= 0) return s;
    if (s === '已确认') return '已抄录';       /* 报告里出现了这个字段 */
    if (s === '未确认') return '未抄录';       /* 报告里还没抄到这个字段 */
    if (s === '不适用') return '待补';
    return '未抄录';
  }
  /* 去掉 demo 数据里夹带的判读式括号（深度缓解阈值断言），只留照抄值 */
  function tfrNote(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s || s === '—') return '报告里尚未抄录该字段（待补）';
    s = s.replace(/[（(]\s*未达[^）)]*[）)]/g, '').replace(/未满足/g, '').replace(/\s{2,}/g, ' ').trim();
    return s;
  }
  function tfrConditionCell(row) {
    var name = String((row && row[0]) || '');
    var src = String((row && row[2]) || '').trim();
    var has = src && src !== '—';
    return esc(name) + '<span class="src">书面条件条目照抄自：' +
      (has ? esc(tfrNote(src)) : '本档案尚未抄录该条件的书面原文（待补，本仓不代拟）') + '</span>';
  }
  function tfrStatusLabel(s) {
    var m = /^([^（(]*)/.exec(String(s || ''));
    var out = (m ? m[1] : String(s || '')).trim();
    return out || '未开始核对';
  }
  function tfrStatusDetail(s) {
    var str = String(s || '');
    var quoted = /提过[：:]\s*([^）)]+)/.exec(str);
    var date = (/(\d{4}-\d{2}-\d{2})/.exec(str) || [])[1] || '';
    if (quoted) return '<p>' + q(quoted[1].trim(), '医生原话 · 血液科门诊 ' + (date || '门诊日期未记录')) + '</p>';
    if (date) return '<p class="muted">照抄自本档案门诊记录（停药日 ' + esc(date) + '）<span class="src">来源：门诊记录原文 · 文件号见服药线「处方变更」凭据列</span></p>';
    return '';
  }

  /* ================= P0-7：入口逐字 + 「⋯ 更多」收口 ================= */
  /* 每页一个「⋯ 更多」收口；med / mol 的收口标题＝INTERACTION-DESIGN §二 的逐字入口
     （S4「⋯ 更多→换药/调剂量了」/ S7「⋯ 更多→停药尝试准备」），点开即是手工通道 */
  var MORE_CAPTION = { med: '⋯ 更多→换药/调剂量了', mol: '⋯ 更多→停药尝试准备' };
  function moreBlock(page) {
    var M = { dash: 1, mol: 1, med: 1, ae: 1, tfr: 1, cost: 1, fert: 1, prep: 1, docs: 1, trial: 1 }[page];
    if (!M) return '';
    var items = MORE_ITEMS[page] || [];
    if (!items.length) return '';
    return '<details class="more"><summary>' + esc(MORE_CAPTION[page] || '⋯ 更多') + '</summary><ul class="more-list">' +
      items.map(function (it) { return '<li>' + it + '</li>'; }).join('') + '</ul>' +
      '<p class="muted">手工入口收在「⋯ 更多」里：卡片上只留一个显式编辑动作（IP6）。</p></details>';
  }
  var MORE_ITEMS = {
    dash: [
      '<button type="button" class="btn btn-sm" data-act="mol-new">记一笔复查</button>',
      '<a class="btn btn-sm" href="#docs">看原文（资料导入的候选）</a>',
      '<a class="btn btn-sm" href="#trial">临床试验（M4 数据未接入）</a>',
      '<a class="btn btn-sm" href="#mol/lab">复查记录 CML-LAB（血常规密测 / 骨髓原文）</a>'
    ],
    mol: [
      '<button type="button" class="btn btn-sm" data-act="mol-manual">手工补一条复查记录（6 字段）</button>',
      '<button type="button" class="btn btn-sm" data-act="mol-lab">复查记录 CML-LAB（血常规密测 / 骨髓原文）</button>',
      '<button type="button" class="btn btn-sm" data-act="tfr-prep">停药尝试准备</button>',
      '<a class="btn btn-sm" href="#docs">看原文（资料导入的候选）</a>'
    ],
    med: [
      '<button type="button" class="btn btn-sm" data-act="rx-new">换药/调剂量了</button>',
      '<a class="btn btn-sm" href="#med/checkin">改这一条（打卡更正）</a>'
    ],
    ae: [
      '<button type="button" class="btn btn-sm" data-act="ae-new">记一次不舒服</button>',
      '<a class="btn btn-sm" href="#docs">看原文（凭据文件）</a>',
      '<a class="btn btn-sm" href="#med/rx">换药/调剂量了</a>'
    ],
    tfr: [
      '<a class="btn btn-sm" href="#docs">看原文（门诊记录 / 报告文件）</a>',
      '<button type="button" class="btn btn-sm" data-act="tfr-prep">停药尝试准备</button>'
    ],
    cost: [
      '<button type="button" class="btn btn-sm" data-act="cost-new">记一笔</button>',
      '<a class="btn btn-sm" href="#docs">看原文（费用票据 / 发票）</a>'
    ],
    fert: [
      '<button type="button" class="btn btn-sm" data-act="fert-ask">我要问的</button>',
      '<a class="btn btn-sm" href="#prep">把问题带进复诊资料包</a>'
    ],
    prep: [
      '<a class="btn btn-sm" href="#docs">引用资料导入的候选</a>',
      '<a class="btn btn-sm" href="#trial">临床研究核对字段</a>'
    ],
    docs: [
      '<button type="button" class="btn btn-sm" data-act="docs-pick">看原文（选择文件）</button>',
      '<a class="btn btn-sm" href="#prep">把候选带进复诊资料包</a>'
    ],
    trial: [
      '<a class="btn btn-sm" href="#mol">去分子线看趋势</a>',
      '<a class="btn btn-sm" href="#onechart">去病情一图秀叠看</a>',
      '<a class="btn btn-sm" href="#docs">去资料导入核对原文</a>'
    ],
    onechart: [
      '<a class="btn btn-sm" href="#mol">去分子线看指标卡与词表</a>',
      '<a class="btn btn-sm" href="#trial">去临床试验核对入组字段</a>'
    ]
  };

  /* ================= S6：里程碑角标 → 词义 + 来源版本 ================= */
  var GLOSS = [
    ['IS%', '国际标准化（International Scale）的 BCR::ABL1 百分比口径，是报告原文使用的单位；本仓不做任何 IS / 非 IS 换算判读。', 'GL-CN-2025 · 报告原文单位'],
    ['MMR', '主要分子学缓解：BCR::ABL1 IS ≤0.1%，需同一实验室、IS 标化可比（口径照抄指南原文）。', 'GL-CN-2025'],
    ['MR4', '4 log 深度缓解：BCR::ABL1 IS ≤0.01% 且灵敏度足够（口径照抄指南原文）。', 'GL-CN-2025'],
    ['MR4.5', '4.5 log 深度缓解：BCR::ABL1 IS ≤0.0032% 且灵敏度达 MR4.5（口径照抄指南原文）。', 'GL-CN-2025'],
    ['CMR / DMR', '完全分子学缓解：BCR::ABL1 IS ≤0.01%（MR3 以下）口径按指南原文。', 'GL-CN-2025']
  ];
  function glossCard(key) {
    var row = null;
    GLOSS.forEach(function (g) { if (g[0] === key) row = g; });
    if (!row) return '';
    return '<section class="card gloss-card" id="glossCard"><div class="card-head"><h4 class="h3">词表卡：' + esc(row[0]) + '</h4>' +
      badge('零判读') + '</div><p>词义：' + esc(row[1]) + '</p>' +
      '<p>来源版本：' + esc(row[2]) + '</p>' +
      '<p class="note">词表只给词义与来源版本，不做「是否达到」的判读。</p></section>';
  }

  /* ================= 图表：Fritsch–Carlson 单调三次插值 ================= */
  function smoothPath(points) {
    /* 两种入参形态都接受：{x,y} 对象（趋势页）与 [x,y] 数组（一图秀 / 指标卡背面）。
       2026-10-25 第四轮评审 P0-1：调用方传的是数组，原实现只认对象，filter 全丢 → d="" 一条线都没画，
       而当时的 R3 断言把空字符串当成"没变"从而自证为真。归一化放在入口，避免再被某一种形态打穿。 */
    var p = (points || []).map(function (o) {
      if (!o) return null;
      if (Array.isArray(o)) return { x: Number(o[0]), y: Number(o[1]) };
      return o;
    }).filter(function (o) { return o && isFinite(o.x) && isFinite(o.y); });
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
  /* ================= P0-6：复诊资料包 = 事实区 / 看法区 / 问题清单（同一个数组算计数） ================= */
  function prepRangeLabel() {
    return { 'range-3m': '近 3 个月', 'range-6m': '近 6 个月', all: '全部' }[state.prepRange] || state.prepRange;
  }
  function prepInRange(iso) {
    var months = { 'range-3m': 3, 'range-6m': 6, all: 0 }[state.prepRange] || 0;
    if (!months) return true;
    return t(iso) >= t(TODAY) - months * 30.44 * 24 * 3600 * 1000;
  }
  function prepBundle() {
    var p = profile(), facts = [], views = [], questions = [];
    var rec = recorderDefault();
    (metricByKey('pcr') || { points: [] }).points.filter(function (pt) { return prepInRange(pt.d); }).forEach(function (pt) {
      facts.push({
        id: 'pcr-' + pt.d, section: 'facts', visibility: 'shared', recorder: pt.recorder || rec,
        text: pt.d + ' BCR::ABL1 ' + num(pt.v, 3) + '%（' + (pt.lab || '未记录') + ' · IS 标化 ' +
          (pt.is_std === 1 ? '是' : '未记录') + ' · ' + (pt.sens || '未记录') + '）' +
          (pt.local ? ' · 本机新增（' + MEM_NOTICE + '）' : '')
      });
    });
    var cbcDates = ((metricByKey('wbc') || { points: [] }).points || []).map(function (x) { return x.d; })
      .filter(prepInRange).slice(-3);
    cbcDates.forEach(function (d) {
      var g = function (k) {
        var m = metricByKey(k), v = '未记录';
        ((m && m.points) || []).forEach(function (x) { if (x.d === d) v = x.v; });
        return v;
      };
      facts.push({
        id: 'cbc-' + d, section: 'facts', visibility: 'shared', recorder: rec,
        text: d + ' 血常规 白细胞 ' + g('wbc') + ' 10⁹/L · 中性粒细胞 ' + g('anc') + ' 10⁹/L · 血红蛋白 ' +
          g('hgb') + ' g/L · 血小板 ' + g('plt') + ' 10⁹/L'
      });
    });
    (p.viewpoints || []).forEach(function (v, i) {
      /* B 档案 2026-05-20 那条含患者原话敏感词：只在分子线折叠卡内以带来源引用出现，不进资料包 */
      if (state.profile === 'B' && v[0] === '2026-05-20') return;
      if (!prepInRange(v[0])) return;
      views.push({
        id: 'vp-' + i, section: 'views', visibility: 'shared', recorder: rec,
        text: v[0] + ' ' + v[1] + '：' + v[2],
        source: v[0] + (state.profile === 'B' ? '（患者原话 · 家属代记）' : '（本人记录）')
      });
    });
    questions.push({ id: 'q1', section: 'questions', visibility: 'shared', recorder: rec, text: '下次复查的时间和项目是什么？' });
    /* P1-2：S9 产物（生育页问题清单）必须进复诊包，否则"加了却带不走"。
       只取本档案的（fertQByProfile 按档案分桶），避免 B 的问题出现在 A 的资料包里。 */
    (state.fertQByProfile[state.profile] || []).forEach(function (t, i) {
      questions.push({ id: 'fq-' + i, section: 'questions', visibility: 'shared', recorder: rec, text: t,
        source: '生育页问题清单（本人/家属填写）' });
    });
    questions.push({
      id: 'q2', section: 'questions', visibility: 'shared', recorder: rec,
      text: '长期服药对身体的其它影响、能不能减量，我要怎么问才说清楚？',
      source: '生育计划资料夹（要点照抄，已去识别）'
    });
    var all = facts.concat(views).concat(questions).concat(sensitiveRecords().map(function (r) {
      return { id: r.id, section: 'private', visibility: r.visibility, recorder: r.recorder, text: r.text };
    }));
    return { facts: facts, views: views, questions: questions, all: all };
  }
  function recordsForPage(page) {
    var p = profile(), out = [];
    if (page === 'dash' || page === 'mol') {
      (metricByKey('pcr') || { points: [] }).points.forEach(function (pt) {
        out.push({ id: 'pcr-' + pt.d, visibility: 'shared', recorder: pt.recorder || recorderDefault(),
          text: pt.d + ' BCR::ABL1 ' + pt.v + '%（' + (pt.lab || '实验室未记录') + '，灵敏度 ' + (pt.sens || '未记录') + '）' });
      });
    }
    if (page === 'ae') aeRows().forEach(function (r) { out.push({ id: r.id, visibility: r.visibility, recorder: r.recorder, text: r.d + ' ' + r.name + ' · ' + r.drug + ' · ' + r.desc }); });
    if (page === 'cost') costRows().forEach(function (c, i) { out.push({ id: 'cost-' + i, visibility: 'shared', recorder: c.recorder, text: c.m + ' ' + c.drug + ' 自费 ' + (c.amt * c.qty) + ' 元 · ' + c.note }); });
    if (page === 'fert') fertilityRows().forEach(function (r) { out.push(r); });
    if (page === 'prep') return prepBundle().all;
    return out.concat(sensitiveRecords().filter(function (r) { return page === 'ae' || page === 'dash'; }));
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
  /* AI 按钮。传 prompt 时走 agent-draft（一键携带预写提示词+病情上下文，只填输入框不自动发送）；
     不传时走通用 ai 派发。两条路径都不替用户下结论。 */
  function aiButton(page, label, prompt) {
    if (AI_FORBIDDEN[page]) return '';
    var txt = 'AI 协助（示例）' + (label ? ' · ' + esc(label) : '');
    if (prompt) {
      return '<button type="button" class="btn" data-act="agent-draft" data-page="' + page +
        '" data-prompt="' + esc(prompt) + '">' + txt + '</button>';
    }
    return '<button type="button" class="btn" data-act="ai" data-page="' + page + '">' + txt + '</button>';
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
          ae: { summary: '1 条：皮疹 / 腹泻（处理原文已引）', items: [['2021-05-08 皮疹 / 腹泻', '患者原话：' + q('前臂皮疹，大便每天 3–4 次', '家属代记（患者原话）')], ['处理原文', q('先减量，仍不耐受就换药', '医生原话 · 血液科门诊 2021-05-08')], ['凭据', '门诊病历 2021-06-30（文件 B-D2）']] },
          support: { summary: '无措施记录 · 说明：该阶段未记录心理与营养措施', items: [['措施', '无'], ['效果（本人原话）', '该阶段无记录'], ['说明', '无内容即写「无 + 说明」，不省略块']] }
        }
      },
      {
        d: '2021-07-01 → 2026-04-09', phase: '二线尼洛替尼', text: '因不耐受换尼洛替尼 300 mg 每日两次（空腹），维持至停药评估',
        detail: {
          regimen: { summary: '尼洛替尼 300 mg · 每日 2 次 · 2021-07-01 → 2026-04-09', items: [['药名 / 剂量', '尼洛替尼 300 mg'], ['频次', '每日 2 次（bid，空腹早晚各一次）'], ['起止', '2021-07-01 → 2026-04-09'], ['变更原因原文', q('伊马替尼皮疹腹泻不耐受，换尼洛替尼，空腹早晚各一次', '医生原话 · 血液科门诊 2021-06-30')], ['凭据', '门诊病历 2021-06-30（文件 B-D2）']] },
          metrics: { summary: '2026-04-09 停药前最后 1 次 BCR::ABL1 IS 0.0028%', items: [['BCR::ABL1（IS%）', '2026-04-09：0.0028%（市一院血液科 · IS 标化 · MR4.5）'], ['DMR 持续时长', '门诊记录 2026-04-09 记有「DMR 超过 2 年」（照抄门诊记录）'], ['趋势一句话', '逐点抄录；本页不连线判读，分段见分子线页']] },
          imaging: { summary: '无 · 说明：本阶段未做影像检查', items: [['影像报告', '无'], ['说明', '本阶段文件为肝功能与门诊记录（B-D4、B-D5）']] },
          ae: { summary: '1 条：与肝功能相关的记录（报告原文已加引号照抄）', items: [['2025-11-20 报告原文', q('肝功能异常（ALT 升高）', '肝功能 2025-11-20.pdf 报告原文 · 文件 B-D4')], ['患者原话', q('ALT 62，没有不舒服', '家属代记（患者原话）')], ['处理原文', q('尼洛替尼可能影响肝酶，加查一次', '医生原话 · 血液科门诊 2025-11-20')], ['等级', '报告未给等级字段（本页不代拟等级）']] },
          support: { summary: '1 条家属记录', items: [['措施', '每天早晚各一次服药（尼洛替尼需空腹）；不催她看报告（家属自述）'], ['效果（家属代记原话）', q('报告我先拍，等她愿意谈了再一起看；不催她', '家属记录')], ['说明', '效果只照抄记录原话，不评疗效']] }
        }
      },
      {
        d: '2026-04-10 → 至今', phase: 'TFR 停药尝试与密测', text: '按门诊评估进入停药尝试；停药后每 1–2 个月 1 次 qPCR，已完成 6 次',
        detail: {
          regimen: { summary: '停药观察（无每日 TKI）· 2026-04-10 起', items: [['药名 / 剂量', '（停药观察）· —'], ['频次', '无每日服药（none）'], ['起止', '2026-04-10 起'], ['门诊记录原文', q('DMR 超过 2 年、TKI 用了 6 年，达到书面条件，可以谈停药；停药后前半年每 1–2 个月抽一次', '医生原话 · 血液科门诊 2026-04-09')], ['凭据', 'TFR 评估门诊记录 2026-04-09（文件 B-D5）']] },
          metrics: { summary: '停药后 6 次 qPCR 逐点抄录：0.0028 → 0.0021（IS%）', items: [['BCR::ABL1（IS%）', '2026-04-09：0.0028% → 2026-10-08：0.0021%（市一院血液科 · IS 标化 · MR4.5）'], ['血常规（白细胞 10⁹/L）', '2026-04-09：5.6 → 2026-10-08：4.8'], ['趋势一句话', '逐点抄录，连线与分段见分子线页；本页不判读']] },
          imaging: { summary: '无 · 说明：停药密测期未做影像检查', items: [['影像报告', '无'], ['说明', '本阶段文件为 qPCR 与血常规报告（B-D3、B-D6）']] },
          ae: { summary: '2 条停药相关记录（与停药日对齐）', items: [['2026-05-02 肌肉骨骼疼痛', '患者原话：' + q('停药后腰背和膝盖酸，早上明显', '家属代记（患者原话）')], ['2026-06-11 皮肤瘙痒', '患者原话：' + q('晚上痒，抓了会起红印', '家属代记（患者原话）')], ['处理原文', q('停药综合征，多数几个月会缓解；影响生活可以来门诊', '医生原话 · 血液科门诊 2026-05-08')], ['对齐', '两条均与停药日 2026-04-10 对齐显示（见副作用日志页）']] },
          support: { summary: '3 条患者原话记录（家属代记，含停药初期）', items: [['措施', '停药后散步、瑜伽，避免熬夜（患者原话 · 家属代记）'], ['效果（本人原话）', q('好一点：两次报告都稳定，妈妈也不天天问了', '患者原话 · 家属代记 2026-07-15') + '<br>' + q('还行：就是等报告那三天难熬', '患者原话 · 家属代记 2026-10-08') + '<br>' + q('紧张：停药第一周总觉得自己会复发，半夜会醒', '患者原话 · 家属代记 2026-05-20')], ['口径', '患者原话按来源照抄（记录者为家属代记）；患者的担心原样保留在引号内，不是本页结论——本页不做判读（K1）']] }
        }
      }
    ];
    return state.profile === 'A' ? A : B;
  }

  /* ================= 页面：dash ================= */
  function pageDash() {
    /* 一图秀入口（X1：不允许孤儿页——它必须从看板这条真实使用路径上够得着） */
    var p = profile();
    var pcr = metricByKey('pcr') || { points: [] };
    var last3 = pcr.points.slice(-3);
    var ml = p.med_log || {};
    var recent = (ml.recent || []).slice(0, 3);
    var pcrMetric = metricByKey('pcr') || null;

    var h = '<div class="page-head"><h1>看板</h1>' +
      badge('档案 ' + state.profile + ' · ' + authorView()) + badge('记录者随条目标注') + badge('构建 ' + BUILD) + badge(VERSION) + '</div>' +
      '<p class="muted mem-notice" id="memNotice">' + MEM_NOTICE + '；本机写入只改变当前页面状态。</p>';

    h += '<div class="grid">';

    /* 档案头 */
    h += '<section class="card"><div class="card-head"><h3>档案</h3>' + badge(p.phase || '') + badge('转录本 ' + (p.transcript || '未记录')) + '</div>' +
      kvTable([['姓名', esc(p.name || '')], ['性别 / 年龄', esc((p.sex || '') + ' / ' + (p.age || '') + ' 岁')], ['概况', esc(p.meta || '')],
        ['医生告知的分层', esc(p.risk || '')], ['一句话病史', esc(p.headline || '')], ['本人最在意的', esc(p.mindset || '')],
        ['本页记录者', esc(recorderDefault())]]) + '</section>';

    /* 今日服药卡（S2 入口逐字：「今天吃了吗」） */
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
      '<button type="button" class="btn" data-act="today-taken">今天吃了吗</button>' +
      '<button type="button" class="btn" data-act="checkin" data-v="taken">一键已服</button>' +
      '<button type="button" class="btn" data-act="checkin" data-v="missed">标记漏服</button>' +
      '<button type="button" class="btn btn-sm" data-act="write-fail">模拟本地写失败</button>' +
      '<a class="btn" href="#med">去服药线</a></div>';
    h += '<h4 class="h3">最近 3 天</h4><ul class="timeline">' + recent.map(function (r) {
      return '<li><span class="t-date">' + esc(r[0]) + '</span><div>' + (r[1] === 'taken' ? '已服' : (r[1] === 'missed' ? '漏服' : '无每日服药（停药期）')) +
        ' ' + recBadge(null) + '</div></li>';
    }).join('') + '</ul>';
    h += '<p class="muted">漏服不评判；补服分支规则与来源见服药线「今日打卡」。</p></section>';

    /* 分子线速览卡（S1 入口逐字：「记一笔复查」） */
    var next = (p.rhythm || [])[1] || (p.rhythm || [])[0] || null;
    h += '<section class="card"><div class="card-head"><h3>分子线速览（最近 3 点）</h3>' + badge('距下次复查' + (next ? ' 约 ' + (monthsUntil(next[3]) == null ? '—' : monthsUntil(next[3]) + ' 个月') : ' —')) + '</div>';
    if (!last3.length) {
      h += '<p class="empty">还没有分子结果，先记一笔复查。</p>';
    } else {
      h += dataTable(['日期', 'BCR::ABL1（IS%）', '实验室', 'IS 标化', '灵敏度'], last3.map(function (pt) {
        return [esc(pt.d), esc(num(pt.v, 3)) + (pt.local ? ' ' + badge('本机新增') : ''), esc(pt.lab || '未记录'), pt.is_std === 1 ? '是' : (pt.is_std === 0 ? '否' : '未记录'), esc(pt.sens || '未记录')];
      }));
      h += '<div class="chart-wrap">' + chartSVG(pcrMetric, { points: last3, milestones: false, legend: false }) + '</div>';
      h += '<p class="muted">四要素（单位 / 实验室 / IS 标化 / 灵敏度）在分子线页逐点列出；相邻点不可比时断开折线。</p>';
    }
    h += '<div class="row"><button type="button" class="btn" data-act="mol-new">记一笔复查</button>' +
      '<a class="btn" href="#mol">去分子线</a>' +
      '<a class="btn" href="#onechart">病情一图秀（叠看几条线）</a></div>';
    h += '<p class="muted">下次复查安排：' + esc(next ? next[0] + ' · ' + next[1] + ' · ' + next[3] : '未记录') + '（医生安排，仅照抄）</p></section>';

    /* 副作用速记卡（S3 入口逐字：「记一次不舒服」） */
    var filtered = aeRows().filter(function (r) {
      return lexiconKeys().indexOf(r.drug) >= 0 || r.example;
    });
    h += '<section class="card"><div class="card-head"><h3>副作用速记（按当前用药过滤）</h3>' + badge('当前：' + currentDrugLabel()) +
      badge('已隐藏 ' + (aeRows().length - filtered.length) + ' 条非当前用药条目') + '</div>';
    if (!filtered.length) h += '<p class="empty">词表引导：先选一种不适（按当前用药列出），再补日期与自述。</p>';
    else h += '<ul class="timeline">' + filtered.slice(0, 3).map(function (r) {
      return '<li><span class="t-date">' + esc(r.d) + '</span><div>' + esc(r.name) + ' ' + badge(r.drug) +
        ' ' + recBadge(r.recorder) + (r.visibility === 'private' ? badge('私密') : '') +
        '<span class="src">' + esc(r.desc) + '</span></div></li>';
    }).join('') + '</ul>';
    h += '<div class="row"><button type="button" class="btn" data-act="ae-new">记一次不舒服</button>' +
      '<a class="btn" href="#ae">去副作用日志</a></div>';
    h += '<p class="muted">只记录不适与处理原文，不出现严重度判读列。</p></section>';

    /* 费用速记卡（S8 入口逐字：「记一笔」） */
    var rowsC = costRows(), monthAgg = {}, totalC = 0;
    rowsC.forEach(function (c) {
      var amt = Number(c.amt || 0) * Number(c.qty == null ? 1 : c.qty);
      monthAgg[c.m] = (monthAgg[c.m] || 0) + amt;
      totalC += amt;
    });
    var lastMonth = Object.keys(monthAgg).sort().pop() || '—';
    h += '<section class="card"><div class="card-head"><h3>费用速记（按月 × 按药）</h3>' + badge('不跨药混算') + badge('本机新增 ' + (ex().cost || []).length + ' 笔') + '</div>' +
      kvTable([['最近一月（' + esc(lastMonth) + '）自费合计', '<span id="dashCostMonth">' + monthAgg[lastMonth] + '</span> 元'],
        ['全部月份自费合计', '<span id="dashCostTotal">' + totalC + '</span> 元'],
        ['已记条目数', '<span id="dashCostCount">' + rowsC.length + '</span> 条']]) +
      '<p class="muted">只照抄票据金额，不做省不省钱判断。</p>' +
      '<div class="row"><button type="button" class="btn" data-act="cost-new">记一笔</button>' +
      '<a class="btn" href="#cost">去费用记录</a></div></section>';

    /* 复诊倒计时卡（S5 入口逐字：「准备复诊」） */
    h += '<section class="card"><div class="card-head"><h3>复诊倒计时</h3>' + badge(TODAY) + '</div>' +
      dataTable(['事项', '频率 / 书面口径原文', '依据', '下次时间'], (p.rhythm || []).map(function (r) {
        return [esc(r[0]), rhythmCell(r), esc(r[2]), esc(r[3])];
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

    /* P0-4 / P0-8：全站「⋯ 更多」收口；docs / trial 在场景路径上可达 */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口与通道</h3></div>' +
      moreBlock('dash') +
      '<p class="muted">资料导入（候选 → 核对）与临床试验（M4 数据未接入）从本卡「⋯ 更多」和「准备复诊」路径进入。</p></section>';
    return h;
  }

  /* 看板复诊倒计时：出现处置方向的「书面口径」行一律进 <q class="quote"> + 来源 */
  function rhythmCell(r) {
    var txt = String((r && r[1]) || '');
    if (/丧失|恢复\s*TKI|复发|停药/.test(txt + String((r && r[0]) || ''))) {
      return q(txt, String((r && r[2]) || '未记录') + ' · 照抄原文，本页不给处置方向');
    }
    return esc(txt) + '<span class="src">来源：' + esc(String((r && r[2]) || '未记录')) + '（照抄）</span>';
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
    var tabs = [['trend', '趋势与词表'], ['cards', '指标卡（分系列·翻面）'], ['lab', '复查记录 CML-LAB（二级）']];
    var h = '<div class="page-head"><h1>分子线</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) +
      badge('图谱 CML-MOL') + badge('记录者随条目标注') + '</div>';
    h += '<div class="tabs" role="tablist">' + tabs.map(function (tb) {
      return '<button type="button" class="tab" role="tab" aria-selected="' + (state.molTab === tb[0]) + '" data-act="mol-tab" data-v="' + tb[0] + '">' + esc(tb[1]) + '</button>';
    }).join('') + '</div>';
    if (state.molTab === 'lab') return h + molLabBody() + molFormBody();
    if (state.molTab === 'cards') return h + molCardsBody();
    return h + molTrendBody();
  }

  /* 复查记录（二级：录入 / 更正）——P1-5（第四轮评审）：这段表单原先只在「趋势与词表」tab 里渲染，
     而 CML-LAB 子页的 tab 名与卡片标题都写着「二级：录入 / 更正」，点进去却找不到输入框。
     抽成共享函数，两个 tab 都渲染同一份表单（DOM id 唯一，不会重复）。 */
  function molFormBody() {
    var h = '';
    /* 复查记录（二级：录入 / 更正）——P0-5：保存真的写入本机内存态并让趋势图新增点 */
    h += '<section class="card" id="molFormCard" style="margin-top:12px"><div class="card-head"><h3>复查记录（二级：录入 / 更正）</h3>' +
      badge('显式编辑 ≤1/页') + badge('记录者：' + recorderDefault()) + '</div>' +
      '<p class="muted mem-notice">' + MEM_NOTICE + '：保存后趋势图会新增 1 个点、分子记录 +1；刷新即回到演示数据。</p>';
    var w = lastWrite('mol');
    if (w && w.profile === state.profile) h += '<p class="ok" id="molWriteMsg">' + esc(w.text) + '</p>';
    if (state.molDraft) {
      h += '<p class="err" id="molDraftMsg">草稿已保留（未提交）：' + esc(state.molDraft.d + ' ' + state.molDraft.v + ' ' + state.molDraft.unit) + '</p>';
    }
    var md = draft().mol || state.molDraft || null;
    h += '<div class="grid">' +
      '<div><label class="field-label" for="f-d">日期</label><input id="f-d" type="text" value="' + esc(md ? md.d : TODAY) + '"></div>' +
      '<div><label class="field-label" for="f-v">BCR::ABL1（IS%）</label><input id="f-v" inputmode="decimal" type="text" value="' + esc(md ? md.v : '') + '"></div>' +
      '<div><label class="field-label" for="f-lab">实验室 lab</label><input id="f-lab" type="text" value="' + esc(md ? md.lab : '') + '"></div>' +
      '<div><label class="field-label" for="f-std">IS 标化 is_std（1=是 / 0=否）</label><input id="f-std" inputmode="decimal" type="text" value="' + esc(md ? md.is_std : '1') + '"></div>' +
      '<div><label class="field-label" for="f-sens">灵敏度 sens</label><input id="f-sens" type="text" value="' + esc(md ? md.sens : 'MR4.5') + '"></div>' +
      '<div><label class="field-label" for="f-unit">单位 unit</label><input id="f-unit" type="text" value="' + esc(md ? md.unit : 'IS%') + '"></div>' +
      '</div>' +
      '<div class="row"><button type="button" class="btn" data-act="mol-save">保存（写入本机内存态）</button>' +
      '<button type="button" class="btn" data-act="mol-correct">改这一条（更正，不删除）</button>' +
      '<button type="button" class="btn btn-sm" data-act="mol-reject">模拟候选被拒收</button></div>' +
      '<p class="muted">删除 = 更正：界面只出现「改这一条 / 更正」，历史版本同链可回溯。</p>';
    var extraPts = (ex().pcr || []);
    h += '<h4 class="h3">本机新增的复查记录（' + extraPts.length + ' 条，内存态）</h4>';
    if (!extraPts.length) h += '<p class="empty">还没有本机新增记录；保存后这里会列出，并同步进趋势图与复诊资料包。</p>';
    else h += '<ul class="timeline">' + extraPts.map(function (x, i) {
      return '<li><span class="t-date">' + esc(x.d) + '</span><div>' + esc(num(x.v, 3) + ' ' + (x.unit || 'IS%') +
        ' · ' + (x.lab || '实验室未记录') + ' · IS 标化 ' + (x.is_std === 1 ? '是' : '否')) + ' ' + recBadge(x.recorder) +
        ' <span class="src">来源：' + esc(x.src || ('本机录入 · ' + MEM_NOTICE)) + '</span> ' +
        '<button type="button" class="btn btn-sm" data-act="mol-local-del" data-id="' + i + '">撤回这一条（本机）</button></div></li>';
    }).join('') + '</ul>';
    h += '</section>';
    return h;
  }

  /* 分子线 · 复查记录 CML-LAB（二级页，UI-DESIGN:37-39 / HVT-06） */
  function molLabBody() {
    var p = profile();
    var keys = [['wbc', '白细胞', '10⁹/L'], ['anc', '中性粒细胞', '10⁹/L'], ['hgb', '血红蛋白', 'g/L'], ['plt', '血小板', '10⁹/L']];
    var dates = ((metricByKey('wbc') || { points: [] }).points || []).map(function (x) { return x.d; });
    var firstT = dates.length ? t(dates[0]) : 0;
    var val = function (k, d) {
      var m = metricByKey(k), v = '未记录';
      ((m && m.points) || []).forEach(function (x) { if (x.d === d) v = x.v; });
      return v;
    };
    var h = '<p class="muted mem-notice">' + MEM_NOTICE + '。</p>';
    h += '<section class="card"><div class="card-head"><h3>血常规密测轨道（HVT-06）</h3>' +
      badge('前 2 个月每 1–2 周（照抄书面口径）') + badge('共 ' + dates.length + ' 次') + '</div>' +
      '<p class="note">书面口径（照抄）：治疗前 2 个月每 1–2 周复查血常规；之后按门诊安排。来源：中国 CML 诊疗指南（2025 版）· 血液学监测章节 · GL-CN-2025。</p>' +
      '<div class="track">' + dates.map(function (d) {
        var dense = (t(d) - firstT) <= 62 * 24 * 3600 * 1000;
        return '<span class="track-cell' + (dense ? ' track-dense' : '') + '" title="' + esc(d) + '">' + esc(d.slice(5)) + '</span>';
      }).join('') + '</div>' +
      '<p class="muted">实心格＝前 2 个月密测段（每 1–2 周）；空心格＝门诊常规频次。每格日期与数值均照抄报告，不做判读。</p>' +
      dataTable(['日期', '白细胞（10⁹/L）', '中性粒细胞（10⁹/L）', '血红蛋白（g/L）', '血小板（10⁹/L）', '与上次间隔（天）', '来源'],
        dates.map(function (d, i) {
          var gap = i === 0 ? '—' : Math.round((t(d) - t(dates[i - 1])) / (24 * 3600 * 1000));
          return [esc(d), esc(String(val('wbc', d))), esc(String(val('anc', d))), esc(String(val('hgb', d))), esc(String(val('plt', d))),
            esc(String(gap)), '血常规报告原文 · 记录者：' + esc(recorderDefault())];
        })) + '</section>';

    var mol = p.molecular || [];
    var rows = mol.filter(function (m) { return /转录本|染色体/.test(String(m.k)); }).map(function (m) {
      return [esc(m.k), q(m.v, m.src), esc(m.note || '—'), esc(recorderDefault())];
    });
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>骨髓 / 细胞遗传学（原文摘录）</h3>' + badge('原文照抄') + '</div>' +
      (rows.length ? dataTable(['项目', '报告原文摘录', '报告字段（照抄）', '记录者'], rows) :
        '<p class="empty">本档案尚无骨髓 / 细胞遗传学原文摘录。</p>') +
      '<p class="note">骨髓与细胞遗传学的结论原文如未逐字核对入库，就写「待逐字核对入库」；本页不代拟结论、不做判读。</p>' +
      '<p class="muted">来源文件：' + esc(((p.docs || [])[0] || ['—'])[0]) + ' · ' + esc(((p.docs || [])[0] || ['—', '未记录'])[1]) + '</p>' +
      '<div class="row"><button type="button" class="btn" data-act="mol-manual">记一笔复查（血常规 / 骨髓）</button>' +
      '<a class="btn" href="#docs">去资料导入看原文</a></div></section>';
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口</h3></div>' + moreBlock('mol') + '</section>';
    return h;
  }

  function molTrendBody() {
    var p = profile();
    var ms = metrics();
    var sel = state.molKeys.slice(0, 4);
    var h = '<p class="muted mem-notice" id="memNotice">' + MEM_NOTICE + '。</p>';

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
    /* S6 入口逐字：趋势页任意「IS%」「MMR」角标 → 点开词表卡（词义 + 来源版本） */
    h += '<div class="row" id="glossRow"><span class="muted">里程碑角标（点开看词义与来源版本）：</span>' +
      GLOSS.map(function (g) {
        return '<button type="button" class="badge badge-btn" data-act="gloss" data-v="' + esc(g[0]) + '" aria-pressed="' +
          (state.gloss === g[0]) + '">' + esc(g[0]) + '</button>';
      }).join('') +
      '<a class="btn btn-sm" href="#trial">临床研究核对字段</a>' +
      '<a class="btn btn-sm" href="#docs">资料导入（候选 → 核对）</a></div>';
    if (state.gloss) h += glossCard(state.gloss);
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
      dataTable(['日期', '值', '单位 unit', '实验室 lab', 'IS 标化 is_std', '灵敏度 sens', '来源', '记录者'],
        pcr.points.map(function (pt) {
          return [esc(pt.d), esc(num(pt.v, 3)), esc(pt.unit || '未记录'), esc(pt.lab || '未记录'),
            pt.is_std === 1 ? '是' : (pt.is_std === 0 ? '否' : '未记录'), esc(pt.sens || '未记录'), esc(pt.src || '未记录'),
            recBadge(pt.recorder)];
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

    h += molFormBody();

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

    /* P0-4 / P0-7 / P0-8：「⋯ 更多」收口 + S7「停药尝试准备」+ CML-LAB 二级页入口 */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口与二级页</h3></div>' +
      eachLink() + moreBlock('mol') + '</section>';
    return h;
  }
  function eachLink() {
    return '<p class="muted">二级页：<a href="#mol/lab">复查记录 CML-LAB（血常规密测轨道 + 骨髓 / 细胞遗传学原文摘录）</a>；' +
      '<a href="#docs">资料导入（字段候选 → 逐项核对）</a>；<a href="#trial">临床试验（M4 数据未接入）</a>。</p>';
  }

  /* ================= 页面：med ================= */
  function pageMed() {
    var p = profile(), ml = p.med_log || {};
    var tabs = [['checkin', '今日打卡'], ['calendar', '依从日历'], ['rx', '处方变更（二级）']];
    var h = '<div class="page-head"><h1>服药线</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) + badge('图谱 CML-MED') + badge('记录者随条目标注') + '</div>';
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
        dataTable(['起止', '药名', '剂量', '频次', '原因原文', '记录者'], rxRows().map(function (r) {
          return [esc(r.start + ' → ' + (r.stop || '持续中')), esc(r.drug), esc(r.dose), esc(r.freq), rxReasonCell(r), recBadge(r.recorder)];
        })) +
        '<p class="muted">频次枚举：每日（daily）/ 隔日（qod）/ 间歇（intermittent）/ 无每日服药（none）；本表只照抄处方线与门诊记录。</p></section>';
    }

    if (state.medTab === 'rx') {
      var rxs = rxRows();
      h += '<section class="card"><div class="card-head"><h3>处方变更（二级）</h3>' + badge('旧段不被覆盖，只增版本') +
        badge('当前 ' + rxs.length + ' 段') + '</div>' +
        dataTable(['起始', '药名', '剂量', '频次', '停止', '变更原因原文', '凭据', '记录者'],
          rxs.map(function (r) {
            return [esc(r.start + (r.local ? '（本机新增）' : '')), esc(r.drug), esc(r.dose), esc(r.freq), esc(r.stop || '持续中'),
              rxReasonCell(r), esc(r.src || '未记录') + (r.doc ? '<span class="src">文件 ' + esc(r.doc) + '</span>' : ''), recBadge(r.recorder)];
          })) +
        '<p class="note">与分子点的时间关系：见分子线页趋势图上的日期刻度与 3/6/12 月里程碑参考线。旧段不被覆盖：新提交只追加一段，历史段落原样保留。</p></section>';

      /* P0-4：处方变更手工通道（6 字段） */
      var rd = draft().rx || null;
      h += '<section class="card" id="rxFormCard" style="margin-top:12px"><div class="card-head"><h3>换药/调剂量了（手工 6 字段）</h3>' +
        badge('记录者：' + recorderDefault()) + '</div>' +
        '<p class="muted mem-notice">' + MEM_NOTICE + '：提交后处方变更线新增 1 段，旧段不被覆盖。</p>';
      var rw = lastWrite('rx');
      if (rw && rw.profile === state.profile) h += '<p class="ok" id="rxWriteMsg">' + esc(rw.text) + '</p>';
      h += '<div class="grid">' +
        '<div><label class="field-label" for="rx-drug">药名</label><input id="rx-drug" type="text" value="' + esc(rd ? rd.drug : '') + '"></div>' +
        '<div><label class="field-label" for="rx-dose">剂量</label><input id="rx-dose" inputmode="decimal" type="text" value="' + esc(rd ? rd.dose : '') + '"></div>' +
        '<div><label class="field-label" for="rx-freq">频次</label><select id="rx-freq">' +
        ['daily', 'qod', 'intermittent', 'none'].map(function (k) {
          var sel2 = (rd ? rd.freq : 'daily') === k ? ' selected' : '';
          return '<option value="' + k + '"' + sel2 + '>' + k + '（' + ({ daily: '每日', qod: '隔日', intermittent: '间歇', none: '无每日服药' }[k]) + '）</option>';
        }).join('') + '</select></div>' +
        '<div><label class="field-label" for="rx-start">开始日期</label><input id="rx-start" type="text" value="' + esc(rd ? rd.start : TODAY) + '"></div>' +
        '<div><label class="field-label" for="rx-stop">结束日期（可空 = 持续中）</label><input id="rx-stop" type="text" value="' + esc(rd ? rd.stop : '') + '"></div>' +
        '<div><label class="field-label" for="rx-reason">变更原因原文（医嘱 / 门诊记录逐字）</label><input id="rx-reason" type="text" value="' + esc(rd ? rd.reason : '') + '"></div>' +
        '</div>' +
        '<div class="row"><button type="button" class="btn" data-act="rx-save">提交（只新增版本）</button>' +
        '<button type="button" class="btn btn-sm" data-act="rx-clear">清空草稿</button></div>' +
        '<p class="muted">原因原文只照抄你手里的门诊记录 / 医嘱文字；本仓不代拟药名与剂量。</p></section>';

      h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助（仅处方变更节）</h3></div>' +
        '<p class="muted">今日打卡节不提供 AI 生成（理由见该节）；处方变更是文本归纳任务，可带上下文生成草稿。</p>' +
        '<div class="row">' + aiButton('med', '整理处方变更线') + '</div></section>';
    }

    /* P0-4：全站「⋯ 更多」收口（含逐字入口「换药/调剂量了」） */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口</h3></div>' +
      '<p class="muted">本次改动里的手工写入口收在「⋯ 更多」；卡片上只留一个显式编辑动作。</p>' +
      moreBlock('med') + '</section>';
    return h;
  }

  /* ================= 页面：ae ================= */
  function pageAe() {
    var rows = aeRows();
    var keep = lexiconKeys();
    var shown = rows.filter(function (r) { return keep.indexOf(r.drug) >= 0 || r.example; });
    var hidden = rows.length - shown.length;
    var h = '<div class="page-head"><h1>副作用日志</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) +
      badge('HVT-05 / HVT-09') + badge('记录者随条目标注') + '</div>';

    h += '<section class="card"><div class="card-head"><h3>按当前用药过滤的词表</h3>' + badge('当前：' + currentDrugLabel()) +
      badge('已过滤掉 ' + hidden + ' 条非当前用药条目') + '</div>';
    h += '<p class="muted">词表键（' + esc(keep.join(' + ')) + '）：' + esc(lexiconFiltered().map(function (o) { return o.w; }).join('、')) + '</p>';
    h += '<p class="muted">被隐藏的词表条目数：' + lexiconHidden() + '（伊马替尼 / 尼洛替尼相关词条在当前用药下不展示）。</p>';
    h += '<p class="note">不是全表平铺：词表随当前用药变化——A 当前＝达沙替尼 → dasatinib + withdrawal；B 当前＝停药 → 只 withdrawal。</p></section>';

    /* P0-3：时间线 + 「记一次不舒服」入口（5 字段手工表单） */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>时间线（与用药并列）</h3>' +
      badge('条目 ' + shown.length + ' 条') + '</div>';
    h += '<div class="row" id="aeEntryRow"><button type="button" class="btn" data-act="ae-new">记一次不舒服</button>' +
      '<span class="muted">入口逐字：副作用卡「记一次不舒服」（5 字段）。</span></div>';
    if (!shown.length) h += '<p class="empty">词表引导：先选一种不适（按当前用药列出），再补日期与自述。</p>';
    else h += '<ul class="timeline" id="aeTimeline">' + shown.map(function (r) {
      var label = (r.recorder === '本人') ? '自述原文：' : '代记原文（患者原话）：';
      return '<li><span class="t-date">' + esc(r.d) + '</span><div>' + esc(r.name) + ' ' + badge(r.drug) + ' ' + recBadge(r.recorder) +
        (r.visibility === 'private' ? badge('私密') : badge('共享')) + (r.example ? badge('原型示例') : '') +
        (r.local ? badge('本机新增', true) : '') +
        '<span class="src">' + esc(label) + esc(r.desc) + '</span>' +
        '<span class="src">处理原文：' + esc(r.action || '未记录') + (r.doc ? ' · 文件 ' + esc(r.doc) : '') + '</span>' +
        '<div class="row"><button type="button" class="btn btn-sm" data-act="ae-vis" data-id="' + esc(r.id) + '" data-v="' +
        (r.visibility === 'private' ? 'shared' : 'private') + '">' + (r.visibility === 'private' ? '改为共享' : '标为私密') + '</button></div></div></li>';
    }).join('') + '</ul>';
    if (state.profile === 'B') h += '<p class="muted">停药综合征条目（肌肉骨骼疼痛 / 皮肤瘙痒）的时间线已与停药日 2026-04-10 对齐显示；这些条目的记录者是家属代记，患者原话另标。</p>';
    h += '<p class="note">无严重度判读列；只记录「哪种不适、哪天、和哪种药有关」。</p></section>';

    /* P0-3：≤5 字段手工表单 */
    var ad = draft().ae || null;
    h += '<section class="card" id="aeFormCard" style="margin-top:12px"><div class="card-head"><h3>记一次不舒服（手工 5 字段）</h3>' +
      badge('记录者：' + recorderDefault()) + '</div>' +
      '<p class="muted mem-notice">' + MEM_NOTICE + '：提交后下面时间线新增 1 条。</p>';
    var aw = lastWrite('ae');
    if (aw && aw.profile === state.profile) h += '<p class="ok" id="aeWriteMsg">' + esc(aw.text) + '</p>';
    h += '<div class="grid">' +
      '<div><label class="field-label" for="ae-w">不适词（按当前用药的词表）</label><select id="ae-w">' +
      lexiconFiltered().map(function (o) {
        var sel2 = (ad ? ad.name : '') === o.w ? ' selected' : '';
        return '<option value="' + esc(o.w) + '"' + sel2 + '>' + esc(o.w) + '</option>';
      }).join('') + '</select></div>' +
      '<div><label class="field-label" for="ae-d">日期</label><input id="ae-d" type="text" value="' + esc(ad ? ad.d : TODAY) + '"></div>' +
      '<div><label class="field-label" for="ae-drug">归属用药</label><select id="ae-drug">' +
      lexiconKeys().map(function (k) {
        var sel2 = (ad ? ad.drug : currentDrugKey()) === k ? ' selected' : '';
        return '<option value="' + esc(k) + '"' + sel2 + '>' + esc(drugLabelOf(k)) + '</option>';
      }).join('') + '</select></div>' +
      '<div><label class="field-label" for="ae-desc">一句自述</label><input id="ae-desc" type="text" value="' + esc(ad ? ad.desc : '') + '"></div>' +
      '<div><label class="field-label" for="ae-doc">凭据（文件名 / 门诊日期，可空）</label><input id="ae-doc" type="text" value="' + esc(ad ? ad.doc : '') + '"></div>' +
      '</div>' +
      '<div class="row"><button type="button" class="btn" data-act="ae-save">提交（写入本机内存态）</button>' +
      '<button type="button" class="btn btn-sm" data-act="ae-clear">清空草稿</button></div>' +
      '<p class="muted">自述只照抄你写的那句话；本页不做严重度分级、不做归因判断。</p></section>';

    /* 三出口计数：与行内切换用同一个数组（aeRows），声明与实现一致 */
    var aeAll = aeRows();
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>私密条目与三出口</h3></div>' + privateNote() +
      kvTable([['副作用条目总数（本档案，含私密）', String(aeAll.length)],
        ['私密条目数（本档案）', String(aeAll.filter(function (r) { return r.visibility === 'private'; }).length)],
        ['<code>fetchExport()</code> 保留 / 过滤', filterPrivate(aeAll, 'export').length + ' / ' + (aeAll.length - filterPrivate(aeAll, 'export').length)],
        ['<code>buildAiContext()</code> 保留 / 过滤', filterPrivate(aeAll, 'ai').length + ' / ' + (aeAll.length - filterPrivate(aeAll, 'ai').length)],
        ['<code>buildSummary()</code> 保留 / 过滤', filterPrivate(aeAll, 'summary').length + ' / ' + (aeAll.length - filterPrivate(aeAll, 'summary').length)]]) +
      '<p class="muted">行内「标为私密 / 改为共享」会立刻改变上面三个出口的计数（与页面计数用同一个 <code>aeRows()</code> 数组、同一个 <code>filterPrivate(list, exit)</code>）。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div>' +
      '<div class="row">' + aiButton('ae', '按药整理时间线') + '</div></section>';

    /* P0-4：全站「⋯ 更多」收口 */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口</h3></div>' + moreBlock('ae') + '</section>';
    return h;
  }

  /* ================= 页面：tfr（P0-10：删掉一切自作判读，只记「字段出现在报告里了吗」） ================= */
  function tfrRow(row, idx, kind) {
    var key = kind + idx;
    var st = state.tfrState[key] || tfrMapState(row[1]);
    var btns = TFR_STATES.map(function (x) {
      return '<button type="button" class="btn btn-sm" data-act="tfr-state" data-k="' + key + '" data-v="' + esc(x) +
        '" aria-pressed="' + (st === x) + '">' + esc(x) + '</button>';
    }).join(' ');
    return [tfrConditionCell(row), btns + '<span class="src">当前：' + esc(st) + '</span>', esc(tfrNote(row[2]))];
  }
  function tfrStateBtns(key, raw) {
    var st = state.tfrState[key] || tfrMapState(raw);
    return '<div class="row">' + TFR_STATES.map(function (x) {
      return '<button type="button" class="btn btn-sm" data-act="tfr-state" data-k="' + key + '" data-v="' + esc(x) +
        '" aria-pressed="' + (st === x) + '">' + esc(x) + '</button>';
    }).join('') + '</div>';
  }
  function pageTfr() {
    var tfr = profile().tfr || { must: [], min: [], monitor: [] };
    var h = '<div class="page-head"><h1>TFR 档案</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) + badge('HVT-08') + badge('本页零判读') + '</div>';

    h += '<section class="card"><div class="card-head"><h3>核对状态（照抄）</h3>' + badge('核对状态：' + tfrStatusLabel(tfr.status)) + '</div>' +
      aiForbiddenNote('tfr') + tfrStatusDetail(tfr.status) +
      '<p class="note">本页只做两件事：① 列出「指南 / 门诊书面条件条目」并给出它照抄自哪份记录；② 记录这个字段在你报告里出现了吗（三态：已抄录 / 未抄录 / 待补）。' +
      '本页不判断这些条件是否成立，也不给任何停药或继续用药的方向；页内医生原话一律带来源、只作留档。</p>' +
      '<p class="muted">指南书面条件原文如未逐字核对入库，条目来源处写「待补（本仓不代拟）」；不臆造原文。</p></section>';

    var tbl = ['书面条件条目（照抄报告字段）', '这个字段在报告里出现了吗（三态可切换）', '照抄自 / 说明（照抄原文，本仓不判读）'];
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>必备 5 条</h3>' + badge('报告字段照抄位 + 三态') + '</div>' +
      dataTable(tbl, (tfr.must || []).map(function (r, i) { return tfrRow(r, i, 'must'); })) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>最低 5 条</h3>' + badge('第 5 行为最佳项') + '</div>' +
      dataTable(tbl, (tfr.min || []).map(function (r, i) { return tfrRow(r, i, 'min'); })) + '</section>';

    var best = (tfr.min || []).filter(function (r) { return /^最佳/.test(r[0]); })[0];
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>最佳项</h3>' + badge('单列') + '</div>' +
      (best ? kvTable([['书面条件条目', tfrConditionCell(best)],
        ['这个字段在报告里出现了吗', String(state.tfrState['best0'] || tfrMapState(best[1]))],
        ['照抄自 / 说明', esc(tfrNote(best[2]))]]) + tfrStateBtns('best0', best[1])
        : '<p class="empty">本档案报告里暂无最佳项字段（待补）。</p>') +
      '<p class="muted">单列只为排版，不代表条件的成立与否。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>密测轨道（三行）</h3></div>' +
      dataTable(['轨道', '监测频率（照抄书面口径）', '进度（照抄门诊记录）'], (tfr.monitor || []).map(function (r) {
        return [esc(r[0]), esc(r[1]), esc(r[2])];
      })) +
      '<p class="note">轨道只显示排期与进度，不给「是否该继续监测」的判断；血常规密测轨道见分子线二级页「复查记录 CML-LAB」。</p>' +
      '<div class="row"><a class="btn btn-sm" href="#mol/lab">去复查记录 CML-LAB（血常规密测轨道）</a></div></section>';

    var doc = (profile().rx || []).filter(function (r) { return r[3] === 'none'; })[0];
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>门诊记录引用（仅医生原话 + 来源）</h3></div>';
    if (doc) h += '<p>' + q(String(doc[5]).replace(/^医生原话：「|」$/g, ''), (doc[6] || '未记录') + (doc[7] ? ' · 文件 ' + doc[7] : '')) + '</p>';
    else h += '<p class="muted">本档案门诊记录中无常停药相关原话引用；待门诊补录。</p>';
    h += '<p class="muted">引用只为留档：医生原话原样照抄并带来源，本页不据此给任何处置方向。</p></section>';

    /* S7 产物：核对清单导出（只导照抄字段与原话，不含任何"是否满足"结论） */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>导出核对清单（去诊室用）</h3>' +
      badge('三块：必备 / 最低 / 门诊原话') + '</div>' +
      '<p class="muted">导出只含「报告字段照抄位 + 核对状态 + 医生原话与来源」，本清单不给结论。</p>' +
      '<div class="row"><button type="button" class="btn" data-act="tfr-export">导出核对清单</button>' +
      '<button type="button" class="btn btn-sm" data-act="tfr-print">打印这一页</button></div>' +
      '<pre class="agent-log" id="tfrOut">' + esc(state.tfrOut || '（尚未导出）') + '</pre></section>';
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口</h3></div>' + moreBlock('tfr') + '</section>';
    return h;
  }

  /* ================= 页面：cost（P0-2：记一笔入口 + ≤5 字段手工表单） ================= */
  function pageCost() {
    var rows = costRows();
    var byDrug = {}, byMonth = {}, total = 0;
    rows.forEach(function (c) {
      var amt = Number(c.amt || 0) * Number(c.qty == null ? 1 : c.qty);
      byDrug[c.drug] = (byDrug[c.drug] || 0) + amt;
      byMonth[c.m] = byMonth[c.m] || [];
      byMonth[c.m].push(c);
      total += amt;
    });
    var lastMonth = Object.keys(byMonth).sort().pop() || '—';
    var monthSum = (byMonth[lastMonth] || []).reduce(function (a, c) { return a + Number(c.amt || 0) * Number(c.qty == null ? 1 : c.qty); }, 0);

    var h = '<div class="page-head"><h1>费用记录</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) +
      badge('按月聚合，不跨药混算') + badge('记录者随条目标注') + '</div>' +
      '<p class="muted mem-notice">' + MEM_NOTICE + '：提交后当月聚合与按药小计立刻变化。</p>' +
      '<div class="row"><button type="button" class="btn" data-act="cost-new">记一笔</button>' +
      '<span class="muted">入口逐字：费用卡「记一笔」（手工 5 字段）。</span></div>';

    /* P0-2：≤5 字段手工表单（药名 / 规格 / 自费金额 / 医保标记 / 日期） */
    var cd = draft().cost || null;
    h += '<section class="card" id="costFormCard"><div class="card-head"><h3>记一笔（手工 5 字段）</h3>' +
      badge('记录者：' + recorderDefault()) + '</div>';
    var cw = lastWrite('cost');
    if (cw && cw.profile === state.profile) h += '<p class="ok" id="costWriteMsg">' + esc(cw.text) + '</p>';
    h += '<div class="grid">' +
      '<div><label class="field-label" for="cost-drug">药名</label><input id="cost-drug" type="text" value="' + esc(cd ? cd.drug : '') + '"></div>' +
      '<div><label class="field-label" for="cost-spec">规格</label><input id="cost-spec" type="text" value="' + esc(cd ? cd.spec : '') + '"></div>' +
      '<div><label class="field-label" for="cost-amount">自费金额（元）</label><input id="cost-amount" inputmode="decimal" type="text" value="' + esc(cd ? cd.amount : '') + '"></div>' +
      '<div><label class="field-label" for="cost-insured">医保标记</label><select id="cost-insured">' +
      ['门特报销后自付', '全自费', '医保统筹', '其他'].map(function (x) {
        var sel2 = (cd ? cd.insured : '门特报销后自付') === x ? ' selected' : '';
        return '<option value="' + esc(x) + '"' + sel2 + '>' + esc(x) + '</option>';
      }).join('') + '</select></div>' +
      '<div><label class="field-label" for="cost-date">日期</label><input id="cost-date" type="text" value="' + esc(cd ? cd.d : TODAY) + '"></div>' +
      '</div>' +
      '<div class="row"><button type="button" class="btn" data-act="cost-save">提交（写入本机内存态）</button>' +
      '<button type="button" class="btn btn-sm" data-act="cost-clear">清空草稿</button></div>' +
      '<p class="muted">金额只照抄票据原文；不跨药混算，不做省不省钱的判断。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>按月 × 按药</h3>' +
      badge('条目 ' + rows.length + ' 条') + '</div>' +
      dataTable(['月份', '药名', '自费金额（元）', '数量', '说明', '备注', '记录者'], rows.map(function (c) {
        return [esc(c.m) + (c.local ? ' ' + badge('本机新增', true) : ''), esc(c.drug), esc(String(Number(c.amt || 0) * Number(c.qty == null ? 1 : c.qty))),
          esc(String(c.qty)), esc(c.note), esc(c.extra || '—'), recBadge(c.recorder)];
      })) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>聚合（不跨药混算）</h3></div>' +
      kvTable([['当月（' + esc(lastMonth) + '）自费合计', '<span id="costMonthAgg">' + monthSum + '</span> 元'],
        ['全部月份自费合计', '<span id="costTotalAgg">' + total + '</span> 元'],
        ['本机新增', '<span id="costLocalCount">' + (ex().cost || []).length + '</span> 笔']]) +
      dataTable(['药名', '合计自费（元）'], Object.keys(byDrug).map(function (d) { return [esc(d), esc(String(byDrug[d]))]; })) +
      '<p class="muted">同一月份不同药不合并计算；本机新增条目参与上面的聚合。</p></section>';

    var mc = metricByKey('cost');
    if (mc) {
      h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>月度趋势</h3>' + badge('单色折线') + '</div>' +
        '<div class="chart-wrap">' + chartSVG(mc, { milestones: false, legend: false }) + '</div>' +
        '<p class="muted">口径：' + esc(mc.note || '') + '；本图按数值线性绘制，不做判读。</p></section>';
    }
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div><div class="row">' + aiButton('cost', '按月按药汇总') + '</div></section>';
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口</h3></div>' + moreBlock('cost') + '</section>';
    return h;
  }

  /* ================= 页面：fert（S9：入口逐字「我要问的」） ================= */
  function pageFert() {
    var rows = fertilityRows();
    var h = '<div class="page-head"><h1>生育计划</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) +
      badge('HVT-10') + badge('默认私密') + badge('记录者随条目标注') + '</div>';
    h += '<section class="card">' + aiForbiddenNote('fert') + privateNote() + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>事实卡（零处置）</h3></div>';
    h += dataTable(['条目', '内容（原文照抄）', '来源', '记录者'], rows.map(function (r) {
      return [esc(r.label), q(r.text, r.source), esc(r.source || '未记录'), recBadge(r.recorder)];
    }));
    h += '<p class="note">事实卡只放已发生的原文（本人自述、门诊原话、书面口径），不写方向性措辞。</p></section>';

    /* S9 入口逐字：资料夹「我要问的」 */
    h += '<section class="card" id="fertAskCard" style="margin-top:12px"><div class="card-head"><h3>问题清单（去诊室用）</h3>' +
      badge('记录者：' + recorderDefault()) + '</div>' +
      '<div class="row" id="fertAskRow"><button type="button" class="btn" data-act="fert-ask">我要问的</button>' +
      '<span class="muted">入口逐字：资料夹「我要问的」。点开后高亮下面这份清单。</span></div>' +
      '<ul id="fertAskList">' + rows.filter(function (r) { return /问/.test(r.label); }).map(function (r) {
        return '<li>' + esc(r.text) + recBadge(r.recorder) + '<span class="src">来源：' + esc(r.source) + '</span></li>';
      }).join('') + '</ul>' +
      '<p class="muted">问题清单只写「要问什么」，不预写答案；本页不提供 AI 生成（红线：生育相关重大决策不 AI 生成）。</p>' +
      '<div class="row" style="margin-top:8px"><label class="field-label" for="fertQ">新增要问的</label>' +
      '<input id="fertQ" type="text" placeholder="只写要问什么，不写答案" value="' + esc((draft().fertQ || '')) + '">' +
      '<button type="button" class="btn" data-act="fert-qadd">加入清单</button></div>' +
      '<ul id="fertQNew">' + (state.fertQByProfile[state.profile] || []).map(function (t, i) {
        return '<li>' + esc(t) + recBadge(recorderDefault()) +
          '<button type="button" class="btn btn-sm" data-act="fert-qdel" data-i="' + i + '">删掉这条</button></li>';
      }).join('') + '</ul>' +
      (state.fertQMsg ? '<p class="ok" id="fertQMsg">' + esc(state.fertQMsg) + '</p>' : '') +
      '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>三出口计数（代码级过滤）</h3></div>' +
      kvTable([['本档案生育条目数', String(rows.length)],
        ['<code>fetchExport()</code>（导出）保留 / 过滤', filterPrivate(rows, 'export').length + ' / ' + (rows.length - filterPrivate(rows, 'export').length)],
        ['<code>buildAiContext()</code>（AI）保留 / 过滤', filterPrivate(rows, 'ai').length + ' / ' + (rows.length - filterPrivate(rows, 'ai').length)],
        ['<code>buildSummary()</code>（摘要）保留 / 过滤', filterPrivate(rows, 'summary').length + ' / ' + (rows.length - filterPrivate(rows, 'summary').length)]]) +
      '<p class="note">私密内容不进导出与 AI：默认 <code>visibility=&quot;private&quot;</code>，只有你显式改共享才带出；过滤靠代码，不靠文案。</p>' +
      '<p class="muted">双主体：本页是「' + esc(authorView()) + '」下的记录，逐条标记录者（' +
      esc(rows.map(function (r) { return r.recorder; }).join(' / ')) + '），患者自己的原话才标「本人」。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口</h3></div>' + moreBlock('fert') + '</section>';
    return h;
  }

  /* ================= 页面：prep（P0-6：三块导出 + 计数与导出一致；P0-8：引用 docs 候选） ================= */
  function pagePrep() {
    var b = prepBundle();
    var keptExport = filterPrivate(b.all, 'export');
    var keptAi = filterPrivate(b.all, 'ai');
    var keptSum = filterPrivate(b.all, 'summary');
    var sec = bundleSections(keptExport);

    var h = '<div class="page-head"><h1>复诊准备</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) + badge('S5') + badge('记录者随条目标注') + '</div>';
    h += '<section class="card"><div class="card-head"><h3>时间区间</h3></div><div class="row">' +
      [['range-3m', '近 3 个月'], ['range-6m', '近 6 个月'], ['all', '全部']].map(function (o) {
        return '<button type="button" class="chip" data-act="prep-range" data-v="' + o[0] + '" aria-pressed="' + (state.prepRange === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div><p class="muted">区间真的影响取数：切换后下面三块与导出的条目数一起变。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>事实区</h3>' + badge('数值与报告原文') +
      badge(sec.facts.length + ' 条') + '</div>' +
      '<ul>' + (b.facts.length ? b.facts.map(function (f) { return '<li>' + esc(f.text) + ' ' + recBadge(f.recorder) + '</li>'; }).join('') : '<li>（区间内无条目）</li>') + '</ul>' +
      '<p class="muted">本区数值来自「资料导入」的字段候选与报告原文 → <a href="#docs">去资料导入逐项核对</a>。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>看法区（原话）</h3>' + badge(sec.views.length + ' 条') + '</div>' +
      '<ul>' + (b.views.length ? b.views.map(function (v) {
        return '<li>' + esc(v.text) + ' ' + recBadge(v.recorder) + '<span class="src">来源：' + esc(v.source) + '</span></li>';
      }).join('') : '<li>（区间内无条目）</li>') + '</ul></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>问题清单</h3>' + badge(sec.questions.length + ' 条') + '</div>' +
      '<ul>' + (b.questions.length ? b.questions.map(function (x) {
        return '<li>' + esc(x.text) + ' ' + recBadge(x.recorder) + (x.source ? '<span class="src">来源：' + esc(x.source) + '</span>' : '') + '</li>';
      }).join('') : '<li>（暂无）</li>') + '</ul></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>导出 / 摘要（三出口）</h3></div>' + privateNote() +
      kvTable([['条目总数（三块 + 私密条目）', String(b.all.length)],
        ['导出出口 <code>fetchExport()</code> 保留 / 过滤', '<span id="prepExportKept">' + keptExport.length + '</span> / ' + (b.all.length - keptExport.length)],
        ['AI 出口 <code>buildAiContext()</code> 保留 / 过滤', keptAi.length + ' / ' + (b.all.length - keptAi.length)],
        ['摘要出口 <code>buildSummary()</code> 保留 / 过滤', keptSum.length + ' / ' + (b.all.length - keptSum.length)],
        ['导出内容构成', '事实区 ' + sec.facts.length + ' 条 + 看法区 ' + sec.views.length + ' 条 + 问题清单 ' + sec.questions.length + ' 条 = ' + keptExport.length + ' 条']]) +
      '<p class="muted">页面上的「保留 N」与导出的「条目 N 条」用同一个数组、同一次 <code>filterPrivate(list, "export")</code> 算出；导出只含事实区 / 看法区 / 问题清单三块，不含费用明细。</p>' +
      '<div class="row"><button type="button" class="btn" data-act="prep-export">导出资料包（private 过滤生效）</button>' +
      '<button type="button" class="btn" data-act="prep-summary">生成摘要</button>' + aiButton('prep', '整理资料包大纲') + '</div>' +
      '<pre class="agent-log" id="prepOut">' + esc(state.prepOut || '（尚未导出）') + '</pre></section>';

    /* P0-8：把 docs / trial 放进场景路径 */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本包引用的来源页</h3></div>' +
      '<p class="muted">事实区的每条数值都应有报告文件出处：<a href="#docs">资料导入（字段候选 ' +
      esc(((profile().candidates || [])[0] || ['—'])[0]) + ' … 逐项核对）</a>；' +
      '本档案是否符合某项临床研究的核对字段见 <a href="#trial">临床试验（M4 数据未接入，只列字段）</a>。</p>' +
      moreBlock('prep') + '</section>';
    return h;
  }

  /* ================= 页面：docs（P0-5：接受候选真的改状态；P0-8：S5 路径引用） ================= */
  function pageDocs() {
    var p = profile();
    var acc = state.accepted[state.profile] || {};
    var cands = (p.candidates || []).map(function (c) {
      return { id: c[0], field: c[1], value: c[2], file: c[3], status: acc[c[0]] || c[4], local: !!acc[c[0]] };
    });
    var acceptedN = cands.filter(function (c) { return c.status === '已接受'; }).length;

    var h = '<div class="page-head"><h1>资料导入</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) +
      badge('MinerU 六部件') + badge('候选 → 核对 → 入库') + '</div>' +
      '<p class="muted mem-notice" id="memNotice">' + MEM_NOTICE + '：「接受」只改本页候选状态与计数。</p>';

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
        ['④ 公式与单位（formula/unit）', badge('待核对'), '单位候选：IS% / 10⁹L / g/L'],
        ['⑤ OCR 文本（ocr）', badge('已解析'), '文本层 + 原文坐标'],
        ['⑥ 字段候选（field-candidate）', badge('待核对'), '字段名 + 抄录值 + 来源页码'],
        ['① 文件与版本（file）', badge('已入库'), '文件名 / 报告日期 / SHA-256']
      ]) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>文件列表</h3>' + badge(String((p.docs || []).length) + ' 份') + '</div>' +
      dataTable(['文件号', '文件名', '报告日期', '类型', '状态'], (p.docs || []).map(function (d) {
        return [esc(d[0]), esc(d[1]), esc(d[2]), esc(d[3]), badge(d[4], d[4] === '待核对')];
      })) + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>字段候选 → 逐项核对 → 入库</h3>' +
      badge('已接受 ' + acceptedN + ' / ' + cands.length + ' 条') + '</div>' +
      dataTable(['候选号', '字段', '抄录值', '来源文件', '状态', '核对动作'], cands.map(function (c) {
        return [esc(c.id), esc(c.field), esc(c.value), esc(c.file),
          badge(c.status, c.status === '待确认') + (c.local ? ' ' + badge('本机改', true) : '') + ' ' + recBadge(recorderDefault()),
          '<button type="button" class="btn btn-sm" data-act="docs-accept" data-id="' + esc(c.id) + '">接受</button> ' +
          '<button type="button" class="btn btn-sm" data-act="docs-correct" data-id="' + esc(c.id) + '">更正</button>'];
      })) +
      '<p class="muted">候选被拒收即零副作用：不写库、不留半条记录，草稿保留。</p>' +
      '<p class="muted" id="docsAcceptedLine">已接受：' + esc(cands.filter(function (c) { return c.status === '已接受'; }).map(function (c) { return c.id; }).join('、') || '无') +
      '（共 ' + acceptedN + ' 条，本机内存态）</p>' +
      '<p class="muted">接受后本页状态列与计数立刻变；记录者：' + esc(recorderDefault()) + '。</p>' +
      /* P1-4（第四轮评审）：更正写进了 ex().docVersions，但页面从不渲染它 → 用户点完更正看不到新值，
         产物不可观察（第三轮 P1-1 同类问题在这条路径复发）。版本链必须可见：原值、新值、时间、记录者、来源。 */
      (function () {
        var vs = ex().docVersions || [];   /* ex() 按档案取，版本链天然不串档 */
        var head = '<h4 class="sub">更正记录（版本链 · 原行保留不覆盖）' + (vs.length ? ' · ' + vs.length + ' 条' : '') + '</h4>';
        if (!vs.length) return head + '<p class="muted">还没有更正。点任一行「更正」后，这里会按时间列出原值 → 新值（原值不会被覆盖）。</p>';
        return head + dataTable(['候选号', '原值', '更正为', '日期', '记录者', '来源'], vs.map(function (x) {
          return [esc(x.id), esc(x.from || '（空）'), '<strong>' + esc(x.to) + '</strong>', esc(x.at),
            esc(x.recorder || '未记录'), '<span class="muted">' + esc(x.src) + '</span>'];
        }));
      })() + '</section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>本页 AI 协助</h3></div>' +
      '<div class="row">' + aiButton('docs', '列字段候选供核对') + '</div>' +
      '<p class="muted">生成物一律进「候选 → 逐项核对」通道，不会直接入库。</p></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>手工入口与去向</h3></div>' +
      '<p class="muted">本页候选是复诊资料包「事实区」的来源 → <a href="#prep">去复诊准备看资料包</a>。</p>' +
      moreBlock('docs') + '</section>';
    return h;
  }

  /* ================= 页面：trial ================= */
  /* ================= 指标卡：分类 + 分系列 + 3D 翻面（24 号 / 16 号 §2） =================
     合同（改前必读）：
     - 外卡固定高 276px；翻转前后 getBoundingClientRect 完全一致（靠固定高 + 绝对定位双面）。
     - 真 3D：外层 perspective:1100px，内层 preserve-3d，点整卡 rotateY(180deg)。
     - 每卡独立：state.molFlippedByProfile[profile] 是 Set(code)，不存 DOM、不重渲染，且按档案隔离。
     - 结构必须 button > span.inner > (span.front + span.back)：内容若是 button 的兄弟节点就结构上不可能翻转。
     - 隐藏面 aria-hidden + inert，键盘 Tab 不会停到看不见的一面。
     - 无记录写"还没有记录"（不显示 0——0 是有效值）；单点写"暂无可比较的前次记录"。 */
  function catOrder() { return DATA.categoryOrder || []; }
  function catMeta(cat) {
    var g = catOrder().filter(function (c) { return c.cat === cat; })[0];
    return g || { cat: cat, label: cat, color: '#2f6f66', note: '' };
  }
  /* 同组前次：只认同指标 / 同单位 / 同实验室 / 同标准化状态的上一条 */
  function prevComparable(m, pt) {
    var same = (m.points || []).filter(function (q) {
      return q.d < pt.d && q.lab === pt.lab && q.is_std === pt.is_std && (q.unit || m.unit) === (pt.unit || m.unit);
    });
    return same.length ? same[same.length - 1] : null;
  }
  function fmtVal(m, v) { return num(v, m.dec == null ? 2 : m.dec); }

  function metricCardFront(m) {
    var pts = (m.points || []).slice().sort(function (a, b) { return t(a.d) - t(b.d); });
    var last = pts[pts.length - 1];
    var h = '<span class="eyebrow" style="color:' + esc(catMeta(m.cat).color) + '">' +
      '<span class="dot" style="background:' + esc(catMeta(m.cat).color) + '"></span>' + esc(m.cat) + '</span>';
    h += '<span class="mname">' + esc(m.name) + '</span>';
    if (!pts.length) {
      h += '<span class="mval mnone">还没有记录</span>' +
        '<span class="mmeta">还没有可用于比对的记录</span>';
    } else if (m.kind === 'qual' || m.kind === 'grade') {
      h += '<span class="mval mqual">' + esc(String(last.v == null ? '—' : last.v)) + '</span>' +
        '<span class="mmeta">分类记录，不进数值曲线</span>';
    } else {
      h += '<span class="mval">' + fmtVal(m, last.v) + '<span class="munit">' + esc(m.unit || '') + '</span></span>';
      var prev = prevComparable(m, last);
      if (!prev) {
        h += '<span class="mmeta">暂无可比较的前次记录</span>';
      } else {
        var d = last.v - prev.v;
        var arrow = d > 0 ? '↑' : (d < 0 ? '↓' : '→');
        h += '<span class="mmeta">较前次 ' + arrow + ' ' + fmtVal(m, Math.abs(d)) + ' ' + esc(m.unit || '') +
          '（' + esc(prev.d) + ' 同实验室同标准化）</span>';
      }
      h += '<span class="mmeta">已记录 ' + pts.length + ' 次 · 最近采样 ' + esc(last.d) +
        (last.lab ? ' · ' + esc(last.lab) : '') + '</span>';
    }
    h += '<span class="mhint">点卡片翻面看历次记录</span>';
    return h;
  }

  function metricCardBack(m) {
    var pts = (m.points || []).slice().sort(function (a, b) { return t(a.d) - t(b.d); });
    var h = '<span class="mname">' + esc(m.name) + '<span class="munit"> ' + esc(m.unit || '') + '</span></span>';
    if (pts.length < 2) {
      h += '<span class="mmeta">' + (pts.length ? '暂无可比较的前次记录（只有 1 次记录，不连线）' : '还没有记录') + '</span>';
      if (pts.length) h += '<span class="mmeta">' + esc(pts[0].d) + ' · ' + fmtVal(m, pts[0].v) + ' ' + esc(m.unit || '') + '</span>';
    } else {
      h += '<span class="mini" role="img" aria-label="' + esc(m.name) + '历次记录">' + miniSVG(m, pts) + '</span>';
      h += '<span class="mmeta">' + esc(pts[0].d) + ' 至 ' + esc(pts[pts.length - 1].d) +
        ' · 共 ' + pts.length + ' 次 · 末次 ' + fmtVal(m, pts[pts.length - 1].v) + ' ' + esc(m.unit || '') + '</span>';
    }
    var labs = [];
    pts.forEach(function (q) { if (q.lab && labs.indexOf(q.lab) < 0) labs.push(q.lab); });
    var stds = pts.map(function (q) { return q.is_std === 1 ? '标准化' : '未标准化'; })
      .filter(function (v2, i, a) { return a.indexOf(v2) === i; });
    h += '<span class="mmeta">' + esc(labs.join(' · ') || '机构待补') + ' · ' + esc(stds.join(' / ')) +
      (m.note ? ' · ' + esc(m.note) : '') + '</span>';
    return h;
  }

  /* 背面迷你折线：横轴按真实采样日期比例（不按点序号等距），单点不连线 */
  function miniSVG(m, pts) {
    var W = 240, H = 74, padL = 6, padR = 6, padT = 8, padB = 14;
    var xs = pts.map(function (q) { return t(q.d); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var vs = pts.map(function (q) { return Number(q.v); });
    var v0 = Math.min.apply(null, vs), v1 = Math.max.apply(null, vs);
    var sx = function (v) { return padL + (x1 === x0 ? (W - padL - padR) / 2 : (v - x0) / (x1 - x0) * (W - padL - padR)); };
    var sy = function (v) { return H - padB - (v1 === v0 ? (H - padT - padB) / 2 : (v - v0) / (v1 - v0) * (H - padT - padB)); };
    /* segmentsOf 返回 [{pts:[...], gap:[a,b]|null}]；gap 处断开＝不可比，不跨组连线 */
    var segs = segmentsOf(pts);
    var paths = segs.map(function (seg) {
      if (!seg.pts || seg.pts.length < 2) return '';
      var xy = seg.pts.map(function (q) { return [sx(t(q.d)), sy(Number(q.v))]; });
      return '<path d="' + smoothPath(xy) + '" fill="none" stroke="' +
        catMeta(m.cat).color + '" stroke-width="1.6"></path>';
    }).join('');
    var dots = pts.map(function (q, i) {
      return '<circle cx="' + sx(xs[i]).toFixed(1) + '" cy="' + sy(Number(q.v)).toFixed(1) + '" r="2.4" fill="' +
        catMeta(m.cat).color + '"><title>' + esc(q.d) + ' · ' + fmtVal(m, q.v) + ' ' + esc(m.unit || '') + '</title></circle>';
    }).join('');
    return '<svg class="mini-chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
      '" role="img" aria-label="' + esc(m.name) + '历次记录小图">' + paths + dots + '</svg>';
  }

  /* 一张卡：button 外壳（可聚焦可翻）> inner > front + back。
     注意不要在里面再嵌 button（24 号 §5），背面来源信息用 span。 */
  function metricCard(m) {
    var flipped = (state.molFlippedByProfile[state.profile] || new Set()).has(m.key);
    return '<button type="button" class="mcard' + (flipped ? ' flipped' : '') + '" data-act="mcard" data-key="' +
      esc(m.key) + '" aria-pressed="' + (flipped ? 'true' : 'false') + '" role="group" tabindex="0"' +
      ' aria-label="' + esc(m.name) + '，点一次翻面看历次记录，再点返回">' +
      '<span class="mcard-inner">' +
      '<span class="mface front"' + (flipped ? ' aria-hidden="true" inert' : '') + '>' + metricCardFront(m) + '</span>' +
      '<span class="mface back"' + (flipped ? '' : ' aria-hidden="true" inert') + '>' + metricCardBack(m) + '</span>' +
      '</span></button>';
  }

  /* 分组区块：标题＝类别名 + 指标项数 + 有记录项数（24 号） */
  function metricCardsBody() {
    var ms = metrics();
    if (!ms.length) return '<p class="empty">还没有指标定义。</p>';
    var order = catOrder().map(function (c) { return c.cat; });
    var groups = {};
    ms.forEach(function (m) { (groups[m.cat] = groups[m.cat] || []).push(m); });
    /* 顺序只取目录；目录里没有的类别排到最后（"其他已记录指标"），不在这里另排 */
    var cats = order.filter(function (c) { return groups[c]; });
    Object.keys(groups).forEach(function (c) { if (cats.indexOf(c) < 0) cats.push(c); });

    var h = '';
    cats.forEach(function (c) {
      var items = groups[c];
      var withRec = items.filter(function (m) { return (m.points || []).length; }).length;
      var meta = catMeta(c);
      h += '<section class="cat-block"><h3 class="cat-head" style="border-left-color:' + esc(meta.color) + '">' +
        esc(meta.label) + '<span class="cat-count">' + items.length + ' 项 · 有记录 ' + withRec + ' 项</span></h3>' +
        (meta.note ? '<p class="muted">' + esc(meta.note) + '</p>' : '') +
        '<div class="mcard-grid">' + items.map(metricCard).join('') + '</div></section>';
    });
    return h;
  }

  function molCardsBody() {
    var h = '<p class="muted mem-notice">' + MEM_NOTICE + '。</p>';
    h += '<section class="card"><div class="card-head"><h3>按类别分系列</h3>' +
      badge('点卡片翻面') + badge('逐项记录，不加总') + '</div>' +
      '<p class="muted">一张卡 = 一个可比序列。类别与顺序取唯一目录（与一图秀共用同一份），页面不做第二处分组。' +
      '换实验室 / 换单位会拆成不同可比组，不跨组连线，也不自行换算。</p>' +
      categoryLegend() + '</section>';
    h += '<div style="margin-top:12px">' + metricCardsBody() + '</div>';
    h += '<p class="note">本页不做任何加总：不把多个指标合成一个数字，也不给整体评级。' +
      '颜色只标类别身份，不用红绿表示好坏。</p>';
    return h;
  }

  function categoryLegend() {
    var used = [];
    metrics().forEach(function (m) { if (used.indexOf(m.cat) < 0) used.push(m.cat); });
    return '<div class="row legend-row">' + catOrder().filter(function (c) { return used.indexOf(c.cat) >= 0; })
      .map(function (c) {
        return '<span class="legend-item"><span class="dot" style="background:' + esc(c.color) + '"></span>' + esc(c.label) + '</span>';
      }).join('') + '</div>';
  }

  /* ================= 一图秀：三合同 + 指标选择窗口（16 号 R1–R12） =================
     硬规则：
     - R1 每条线独立归一化，图上必须可见"不可比"说明；不跨可比组连线、不自行换算。
     - R2 单点不连线；窗口内无数据给空态。
     - R3 治疗条与数据区分层：关掉治疗节点时曲线 d 属性不变。
     - R4 只标末点，靠右时改 text-anchor=end。
     - R7 指标选择 ≤4、列表独立滚动容器、≤900px 收进 <details> 仍可展开。
     - R10 .chart-wrap 内横滚，390px 下 body 不溢出。
     - R12 svg role=img + aria-label，每点有 <title>。
     选择目录与指标卡共用同一份 categoryOrder（16 号 §3 + 24 号）；筛选变化只重绘 #chart-panel。 */
  function oneChartSel() { return state.oneSel || []; }
  function oneChartBody() {
    var ms = metrics();
    var sel = oneChartSel().filter(function (k) { return metricByKey(k); }).slice(0, 4);
    var h = '<p class="muted mem-notice">' + MEM_NOTICE + '。</p>';

    /* ---- 指标选择窗口（≤4 多选；按类别分组；独立滚动） ---- */
    var picker = '<div class="muted">已选 <strong id="oneCount">' + sel.length + '</strong>/4（最多同时看 4 条线，超过会让图读不清）</div>' +
      /* P1-2：拒选提示放在 picker 内部（侧栏收起也能看到） */
      '<p class="warn-line" id="onePickHint" hidden></p>' +
      '<div class="metric-list" id="oneList">' + catOrder().filter(function (c) {
        return ms.some(function (m) { return m.cat === c.cat; });
      }).map(function (c) {
        var items = ms.filter(function (m) { return m.cat === c.cat; });
        return '<div class="pick-group"><div class="pick-head"><span class="dot" style="background:' + esc(c.color) + '"></span>' +
          esc(c.label) + '</div>' + items.map(function (m) {
            var pts = (m.points || []);
            var last = pts.slice().sort(function (a, b) { return t(a.d) - t(b.d); })[pts.length - 1];
            var on = sel.indexOf(m.key) >= 0;
            return '<button type="button" class="pick-item' + (on ? ' on' : '') + '" data-act="one-pick" data-v="' +
              esc(m.key) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
              '<span class="pick-name">' + esc(m.name) + '</span>' +
              '<span class="pick-val">' + (pts.length ? fmtVal(m, last.v) + ' ' + esc(m.unit || '') : '还没有记录') + '</span>' +
              '</button>';
          }).join('') + '</div>';
      }).join('') + '</div>';

    h += '<section class="card"><div class="card-head"><h3>指标选择</h3>' + badge('最多 4 条线') + '</div>' +
      /* R7：列表放进可展开的 <details>，但**不默认展开**（原型纪律：默认展开的 details 必须为 0）；
         展开后是独立滚动容器，≤900px 折叠仍能展开。 */
      '<details class="pick"><summary id="onePickSum">选要看哪几条（按类别分组）· 已选 ' + sel.length + '/4</summary>' + picker + '</details></section>';

    /* ---- 图区：只重绘 #chart-panel ---- */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>一图秀</h3>' +
      badge('归一化后叠看') + badge('不可比处断开') + '</div>' +
      '<div class="row"><span class="muted">时间窗：</span>' +
      [['all', '全部'], ['12m', '近 12 个月'], ['6m', '近 6 个月']].map(function (o) {
        return '<button type="button" class="chip" data-act="one-range" data-v="' + o[0] + '" aria-pressed="' +
          ((state.oneRange || 'all') === o[0]) + '">' + o[1] + '</button>';
      }).join('') +
      '<span class="muted" style="margin-left:12px">图层：</span>' +
      '<button type="button" class="chip" data-act="one-toggle" data-v="treatment" aria-pressed="' +
        (state.oneToggles.treatment ? 'true' : 'false') + '">治疗条</button>' +
      '</div>' +
      '<div id="chart-panel">' + chartPanel(sel) + '</div></section>';

    /* ---- 图例与口径说明 ---- */
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>怎么看这张图</h3></div>' +
      '<ul class="note-list">' +
      '<li>每条线各自归一化（以各自窗口内首个记录为 100%），所以<strong>纵向高度只表示变化幅度，不表示数值大小</strong>；要看原始值看指标卡。</li>' +
      '<li>换实验室 / 换单位 / 未做 IS 标化的记录会<strong>断开成不同可比组</strong>，图上用断口表示——不跨组连线，也不自行换算。</li>' +
      '<li>时间窗切换后图例仍标「全期」口径的原始值，屏幕上的高度不代表跨窗口可比。</li>' +
      '<li>关掉「治疗条」只影响治疗行，曲线本身不变。</li>' +
      '<li>本图不做加总，也不给整体评级。</li></ul></section>';
    return h;
  }

  function chartPanel(sel) {
    if (!sel.length) return '<p class="empty">还没有选择要看哪几条指标。上面勾选 1–4 项后这里会出现叠看曲线。</p>';
    var picked = sel.map(metricByKey);
    /* P0-5（第四轮评审）：分类指标（kind=qual/grade，如「副作用记录」）是文本事件，
       27 号 §1 要求"分类变量只画节点、不进数值轴"。原实现在归一化里把它当数值算 → 图例漏出"基线 NaN"、
       4 个点 cy 全顶到最上。这里把它们从曲线里剔除，单列说明，不进坐标系。 */
    var nonNumeric = picked.filter(function (m) { return m.kind === 'qual' || m.kind === 'grade'; });
    var ms = picked.filter(function (m) { return !(m.kind === 'qual' || m.kind === 'grade'); });
    if (!ms.length) {
      return '<p class="empty">选中的指标都是分类记录（如副作用事件），图上只按事件列出、不画坐标轴。' +
        '要看事件明细去「副作用日志」页。</p>';
    }
    /* R2/P1-1：窗口内没数据 → 空态（不是"数值 0"）。
       注意必须先按窗口过滤再判空 —— 原来判的是"指标全部记录是否为空"，
       若某指标只在窗外有记录，会画出一张没有任何曲线的空图。 */
    var windowed = ms.map(function (m) { return inWindow(m.points || [], state.oneRange || 'all'); });
    var allEmpty = windowed.every(function (arr) { return !arr.length; });
    if (allEmpty) return '<p class="empty">选中的指标在所选时间窗内还没有记录。换个时间窗，或先在分子线／复查记录里补一条。</p>';

    var W = 640, H = 300, padL = 56, padR = 20, padT = 24, padB = 56;
    var series = ms.map(function (m, i) {
      var pts = windowed[i].slice().sort(function (a, b) { return t(a.d) - t(b.d); });
      /* P0-3（第四轮评审）：图例写「全期口径」，基线就必须取**全期首点**，不能取窗口内首点——
         否则切到 6m 后同一个点的 cy 会变，图例那句话就是假的。 */
      var allPts = (m.points || []).slice().sort(function (a, b) { return t(a.d) - t(b.d); });
      var base = allPts.length ? Number(allPts[0].v) : 0;
      return { m: m, pts: pts, base: base, color: catMeta(m.cat).color, idx: i, nonNumeric: false };
    });
    var treated = state.oneToggles.treatment;
    /* P0-2（第四轮评审，违反 16 号 R3）：原先写成 `plotH = H - padT - padB - (treated ? 22 : 0)`，
       开关治疗条会压缩绘图区，导致**每个点的 cy 都变**（实测 pcr 2026-07-18: 218.7→240.4），
       而自检却因为曲线 d 为空串而自证"d 不变 True"。治疗条必须占**独立行**，不参与曲线坐标系。 */
    var plotH = H - padT - padB - 22; /* 22px 永远留给治疗条那一行，与开关无关 */
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
      '" role="img" aria-label="选中的 ' + ms.length + ' 条指标归一化叠看曲线">';
    svg += '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) + '" y2="' + (padT + plotH) + '" stroke="#ded9d1"></line>';
    svg += '<text x="' + (padL - 6) + '" y="' + (padT + 4) + '" text-anchor="end" class="ax">基线=100</text>';
    svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + (W - padR) + '" y2="' + padT + '" stroke="#eee" stroke-dasharray="3 3"></line>';

    series.forEach(function (s2) {
      if (!s2.pts.length) return;
      var maxPct = Math.max.apply(null, s2.pts.map(function (q) { return s2.base ? (Number(q.v) / s2.base) * 100 : 100; }));
      var minPct = Math.min.apply(null, s2.pts.map(function (q) { return s2.base ? (Number(q.v) / s2.base) * 100 : 100; }));
      var span = Math.max(1, maxPct - 1);
      var sx = function (iso) {
        var ts = s2.pts.map(function (q) { return t(q.d); });
        var x0 = Math.min.apply(null, ts), x1 = Math.max.apply(null, ts);
        return padL + (x1 === x0 ? (W - padL - padR) / 2 : (t(iso) - x0) / (x1 - x0) * (W - padL - padR));
      };
      var sy = function (v) {
        var pct = s2.base ? (Number(v) / s2.base) * 100 : 100;
        return padT + plotH - Math.max(0, Math.min(1, (pct - 1) / span)) * plotH;
      };
      s2.segs = segmentsOf(s2.pts);
      s2.segs.forEach(function (seg) {
        if (!seg.pts || seg.pts.length < 2) return;
        svg += '<path class="series-line" data-key="' + esc(s2.m.key) + '" d="' +
          smoothPath(seg.pts.map(function (q) { return [sx(q.d), sy(q.v)]; })) + '" fill="none" stroke="' +
          s2.color + '" stroke-width="1.8"></path>';
      });
      s2.pts.forEach(function (q, i) {
        svg += '<circle cx="' + sx(q.d).toFixed(1) + '" cy="' + sy(q.v).toFixed(1) + '" r="2.6" fill="' + s2.color +
          '"><title>' + esc(s2.m.name) + ' ' + esc(q.d) + ' · ' + fmtVal(s2.m, q.v) + ' ' + esc(s2.m.unit || '') + '</title></circle>';
      });
      /* R4 只标末点；靠右改 text-anchor=end；多序列奇偶错开避免重叠 */
      var last = s2.pts[s2.pts.length - 1];
      var lx = sx(last.d), anchor = (W - padR - lx < 46) ? 'end' : 'start';
      svg += '<text x="' + (anchor === 'end' ? lx - 4 : lx + 4) + '" y="' + (sy(last.v) + (s2.idx % 2 ? 12 : -4)) +
        '" text-anchor="' + anchor + '" class="ax" fill="' + s2.color + '">' + esc(s2.m.name) + '</text>';
    });
    if (treated) {
      svg += '<rect x="' + padL + '" y="' + (H - padB + 6) + '" width="' + (W - padL - padR) + '" height="8" fill="#efe9df"></rect>' +
        '<text x="' + padL + '" y="' + (H - padB + 34) + '" class="ax">治疗条：按用药起止铺色（开关只影响这一行）</text>';
    }
    svg += '</svg>';

    /* R1：不可比说明必须图上可见 */
    var breaks = series.filter(function (s2) { return (s2.segs || []).some(function (g) { return g.gap; }); });
    var h = '<div class="chart-wrap">' + svg + '</div>';
    if (breaks.length) {
      h += '<p class="note"><strong>不可比提示：</strong>' + breaks.map(function (s2) { return esc(s2.m.name); }).join('、') +
        ' 在窗口内有跨越不同实验室 / 未 IS 标化 / 换单位的记录，曲线在此<strong>断开</strong>，不跨组相连、不自行换算。</p>';
    }
    /* 图例：标口径 */
    h += '<div class="legend-row">' + series.map(function (s2) {
      return '<span class="legend-item"><span class="dot" style="background:' + esc(s2.color) + '"></span>' +
        esc(s2.m.name) + '<span class="muted">（基线 ' + fmtVal(s2.m, s2.base) + ' ' + esc(s2.m.unit || '') +
        ' · 全期首点口径，不随窗口变）</span></span>';
    }).join('') + '</div>';
    /* P0-5：分类指标不进坐标系，单列说明（不静默丢弃） */
    if (nonNumeric.length) {
      h += '<p class="note">以下选中项是<strong>分类记录</strong>（文本事件，没有数值大小），按 27 号 §1 不画进坐标轴：' +
        nonNumeric.map(function (m) { return esc(m.name) + '（' + (m.points || []).length + ' 条）'; }).join('、') +
        '。事件明细见「副作用日志」页。</p>';
    }
    return h;
  }

  /* 只重绘图表面板：不动页头、不动选择器的焦点与滚动位置，也不重建整页
     （16 号：整页重渲染会丢焦点/翻转/滚动）。 */
  function repaintChartPanel() {
    var panel = $('chart-panel');
    if (!panel) { render(); return; }
    var sel = oneChartSel().filter(function (k) { return metricByKey(k); }).slice(0, 4);
    panel.innerHTML = chartPanel(sel);
    var cnt = $('oneCount'); if (cnt) cnt.textContent = String(sel.length);
    var sm = $('onePickSum'); if (sm) sm.textContent = '选要看哪几条（按类别分组）· 已选 ' + sel.length + '/4';
    document.querySelectorAll('[data-act="one-pick"]').forEach(function (b) {
      var on = sel.indexOf(b.getAttribute('data-v')) >= 0;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-act="one-range"]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-v') === (state.oneRange || 'all') ? 'true' : 'false');
    });
    document.querySelectorAll('[data-act="one-toggle"]').forEach(function (b) {
      b.setAttribute('aria-pressed', state.oneToggles[b.getAttribute('data-v')] ? 'true' : 'false');
    });
  }

  function inWindow(pts, range) {
    if (range === 'all' || !range) return pts;
    var months = { '12m': 12, '6m': 6, '3m': 3 }[range] || 12;
    var latest = pts.reduce(function (a, q) { return t(q.d) > a ? t(q.d) : a; }, 0);
    var cut = latest - months * 30.44 * 86400000;
    return pts.filter(function (q) { return t(q.d) >= cut; });
  }

  /* ================= 临床试验：入组档案 + 三档匹配（MATCHING-SPEC §2/§3/§4） =================
     红线（改前必读）：
     - 只输出三档：已满足 / 可能冲突 / 无法判定。「缺失」永远流向无法判定，绝不流向已满足。
     - 不输出匹配度百分比、不给推荐、不按匹配度排序、不用绿红给试验排名。
     - 唯一允许的"指数"是**入组档案完整度 x/y**（字段数之比，不是分数）。
     - 检索与匹配是两步：本页只展示"记录里有什么"与"逐条比对结果"，不代表入组资格。 */
  function enrollmentOf(tag) { return (DATA.enrollment || {})[tag] || []; }
  function matchOf(tag) { return (DATA.match || {})[tag] || null; }

  function tierLabel(t) {
    return t === 'satisfied' ? '已满足' : (t === 'conflict' ? '可能冲突' : '无法判定');
  }
  function tierClass(t) {
    return t === 'satisfied' ? 'tier-ok' : (t === 'conflict' ? 'tier-warn' : 'tier-unknown');
  }

  /* 入组档案：分组展示，全部来自既有病情数据，不重复录入。缺失字段显式写"未记录"。 */
  function enrollmentBody() {
    var fs = enrollmentOf(state.profile);
    if (!fs.length) return '<p class="empty">本档案还没有可用于比对的资料。</p>';
    var present = fs.filter(function (f) { return f.present; }).length;
    var missing = fs.filter(function (f) { return !f.present; });
    var groups = [];
    fs.forEach(function (f) { if (groups.indexOf(f.g) < 0) groups.push(f.g); });
    var h = '<div class="card-head"><h3>入组档案</h3>' +
      '<span class="muted">完整度 <strong>' + present + '/' + fs.length + '</strong> · 全部来自既有病情数据</span></div>';
    h += '<p class="muted">完整度是"本档案有记录的字段数 / 本页会用到的字段数"，不是分数、不是匹配度；缺的字段会让对应条件显示「无法判定」。</p>';
    if (missing.length) {
      h += '<p class="note">本次比对会用到但缺失：' + missing.map(function (f) { return esc(f.k); }).join(' · ') +
        ' —— 这些条件一律判「无法判定」，不会因为没记录就算满足。</p>';
    }
    groups.forEach(function (g) {
      var rows = fs.filter(function (f) { return f.g === g; });
      h += '<h4 class="sub">' + esc(g) + '</h4>' +
        kvTable(rows.map(function (f) {
          return [f.k, f.present ? String(f.v) : '（未记录）'];
        }));
    });
    h += '<p class="muted">CML 的入组条件看的是分期、转录本类型、激酶区突变、既往 TKI 线数与器官功能；' +
      '<strong>本页不做 IHC 标志物筛选</strong>（IHC 是实体瘤的分型工具，不适用于 CML）。</p>';
    return h;
  }

  /* 三档结果：逐条列出"你的记录"与来源；汇总只计数，不给匹配度。 */
  function matchBody() {
    var a = matchOf(state.profile);
    if (!a) return '<p class="empty">本档案还没有生成过比对结果。</p>';
    var h = '<div class="card-head"><h3>逐条比对（三档）</h3>' +
      badge('档案 rev ' + a.profileRevision) + badge('规则集 ' + a.ruleSetVersion) +
      badge('评估生成 ' + a.generatedAt) + '</div>' +
      /* P1-3：§4.5 要求"档案 version + 规则集版本 + 逐条判定"三元同在，缺档案 rev 就无法回答
         "这份评估对应哪一版档案、档案改了以后它是否过期"。 */
      '<p class="muted">档案 rev 与规则集版本一并记录：档案内容改过后，这份评估应视为过期并重新评估（本页保留旧结论仅作对照）。</p>';
    h += '<p class="sum-line">已满足 <strong>' + a.done + '</strong> 项 · 可能冲突 <strong>' + a.conflict +
      '</strong> 项 · 无法判定 <strong>' + a.undetermined + '</strong> 项 · 待确认规则 <strong>' +
      a.pending.length + '</strong> 项<span class="muted">（汇总只计数，不给匹配度）</span></p>';

    ['conflict', 'undetermined', 'satisfied'].forEach(function (tier) {
      var rows = a.judgments.filter(function (j) { return j.tier === tier; });
      if (!rows.length) return;
      h += '<h4 class="sub ' + tierClass(tier) + '">' + tierLabel(tier) + '（' + rows.length + '）</h4>';
      h += '<ul class="tier-list">' + rows.map(function (j) {
        return '<li class="' + tierClass(tier) + '"><span class="tier-tag">' + tierLabel(tier) + '</span>' +
          '<span class="tier-text">' + esc(j.text) + '</span>' +
          '<span class="tier-mine">你的记录：' + esc(j.mine) + '</span>' +
          '<span class="tier-src">来源：' + esc(j.src) + ' · 字段：' + esc(j.field) + '</span></li>';
      }).join('') + '</ul>';
    });

    if (a.pending.length) {
      h += '<h4 class="sub">待确认规则（' + a.pending.length + '）</h4>' +
        '<p class="muted">这些条件原文没能结构化，<strong>不参与上面对比</strong>，需要你或医生对着原文确认。</p>' +
        '<ul class="tier-list">' + a.pending.map(function (r) {
          return '<li class="tier-unknown"><span class="tier-tag">待确认</span>' +
            '<span class="tier-text">' + esc(r.text) + '</span>' +
            '<span class="tier-src">来源：' + esc(r.src) + '</span></li>';
        }).join('') + '</ul>';
    }

    h += '<p class="muted">排序按数据来源顺序，不按匹配度（按匹配度排序等于给推荐）。' +
      '判定是确定性规则求值：同一份档案 + 同一版规则 = 同一结果，不由模型现算。</p>';
    h += '<p class="note"><strong>这不是入组资格判断。</strong>本页只把"该问的问题"整理清楚：' +
      '哪些条件你的记录看起来不冲突、哪些要再确认什么。入组判断属于医生与研究中心。</p>';
    return h;
  }

  function trialListBody() {
    var ts = trials();
    if (!ts.length) {
      return '<p class="empty">当前没有可用渠道的试验记录。</p>' +
        '<p class="muted">注意区分两件事：「这个渠道里没有」与「这个渠道没在查」——后者不能说成前者。</p>';
    }
    var h = '<div class="card-head"><h3>试验登记摘录</h3>' + badge('登记状态，未核实') + '</div>';
    h += '<p class="note">以下为<strong>演示虚构条目</strong>，不是真实临床试验信息；M4 接入 unified-trial-mcp 后整体替换。' +
      '登记 ≠ 有效 ≠ 安全 ≠ 可入组。</p>';
    h += ts.map(function (x) {
      return '<div class="trial-item"><div class="trial-head"><strong>' + esc(x.title) + '</strong>' +
        '<span class="muted">' + esc(x.id) + '</span></div>' +
        '<div class="trial-meta">' + badge(x.phase) + badge(x.status) + '<span class="muted">申办：' + esc(x.sponsor) + '</span></div>' +
        '<p class="muted">' + esc(x.note) + '</p>' +
        '<p class="trial-foot muted">渠道：' + esc(x.channel) + ' · 最后核对 ' + esc(x.lastCheck) + '</p></div>';
    }).join('');
    h += '<div class="muted" style="margin-top:8px">本次检索覆盖 <strong>1/1</strong> 个渠道（演示渠道 · 就绪）· ' +
      '未参与：ICTRP（未配置）· ChiCTR 在线（未配置）· chinadrugtrials（未配置）· 小胰宝归档（本癌种无覆盖）</div>';
    return h;
  }

  function pageTrial() {
    var a = matchOf(state.profile);
    var fs = enrollmentOf(state.profile);
    var present = fs.filter(function (f) { return f.present; }).length;
    var h = '<div class="page-head"><h1>临床试验</h1>' + badge('档案 ' + state.profile) +
      badge('演示数据') + badge('完整度 ' + present + '/' + fs.length) + badge('无匹配度百分比') + '</div>';

    /* ① 入组档案（建档：基因 / 病理 / 细胞遗传学 / 治疗史 / 器官功能） */
    h += '<section class="card">' + enrollmentBody() + '</section>';

    /* ② 三档比对结果 */
    h += '<section class="card" style="margin-top:12px">' + matchBody() + '</section>';

    /* ③ 检索（与匹配是两步，不合并） */
    h += '<section class="card" style="margin-top:12px">' + trialListBody() + '</section>';

    /* ④ AI 协助：只把提示词填进输入框，不自动发送、不下结论 */
    var mp = '请只根据我「入组档案」里的记录，对上面试验的入组条件逐条判断，' +
      '只用「已满足 / 可能冲突 / 无法判定」三档逐条列出，每条写清「你的记录」与来源；' +
      '缺失字段一律判「无法判定」；不输出匹配度百分比、不排序、不写哪条更适合我。' +
      '入组资格以医生与研究中心为准。';
    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>AI 协助整理问题</h3>' +
      aiForbiddenNote('trial') + '</div>' +
      '<p class="muted">只把问题整理成清单：按钮只把提示词填进右上角输入框，<strong>不会自动发送</strong>，也不替你下结论。</p>' +
      '<div class="row">' + aiButton('trial', '把比对提示词填进输入框', mp) + '</div></section>';

    h += '<section class="card" style="margin-top:12px"><div class="card-head"><h3>从哪里进来（场景路径）</h3></div>' +
      '<p class="muted">分子线趋势页的词表卡给出「临床研究核对字段」入口 → <a href="#mol">去分子线趋势与词表</a>；' +
      '复诊资料包也引用本页字段清单 → <a href="#prep">去复诊准备</a>。</p>' +
      moreBlock('trial') + '</section>';
    return h;
  }

  /* ================= 路由与渲染 ================= */
  function pageOneChart() {
    var h = '<div class="page-head"><h1>病情一图秀</h1>' + badge('档案 ' + state.profile + ' · ' + authorView()) +
      badge('归一化叠看') + badge('不做加总') + '</div>';
    return h + oneChartBody();
  }

  var PAGE_FN = { dash: pageDash, mol: pageMol, onechart: pageOneChart, med: pageMed, ae: pageAe, tfr: pageTfr, cost: pageCost, fert: pageFert, prep: pagePrep, docs: pageDocs, trial: pageTrial };

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
    /* 2026-10-25 自查发现：原来只认 lab / 其余一律 trend，于是「tab 是 cards 时点 lab→cards」
       会被 hashchange 打回 trend——指标卡 tab 从 lab 出发根本到不了。现在三个 tab 都进 hash。 */
    if (r === 'mol') state.molTab = (['lab', 'cards'].indexOf(parts[1]) >= 0) ? parts[1] : 'trend';
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

  /* P0-6：导出＝事实区 / 看法区 / 问题清单三块；计数与页面显示来自同一个 filterPrivate 调用 */
  function bundleSections(kept) {
    return {
      facts: kept.filter(function (r) { return r.section === 'facts'; }),
      views: kept.filter(function (r) { return r.section === 'views'; }),
      questions: kept.filter(function (r) { return r.section === 'questions'; })
    };
  }
  function bundleLines(rows) {
    if (!rows.length) return '（区间内无条目）';
    return rows.map(function (r) {
      return '· ' + r.text + (r.source ? '（来源：' + r.source + '）' : '') + '（记录者：' + (r.recorder || recorderDefault()) + '）';
    }).join('\n');
  }
  function exportBundle() {
    var b = prepBundle();
    var kept = filterPrivate(b.all, 'export');           /* 出口 ①：导出 */
    var sec = bundleSections(kept);
    return '复诊资料包（' + prepRangeLabel() + '）\n' +
      '档案：' + profile().name + '（' + authorView() + '）\n' +
      '条目 ' + kept.length + ' 条，已过滤私密 ' + (b.all.length - kept.length) + ' 条（与页面显示同一个数组、同一次 filterPrivate(list, "export")）\n' +
      '\n【事实区】\n' + bundleLines(sec.facts) +
      '\n\n【看法区】\n' + bundleLines(sec.views) +
      '\n\n【问题清单】\n' + bundleLines(sec.questions);
  }
  function buildSummary() {
    var b = prepBundle();
    var kept = filterPrivate(b.all, 'summary');          /* 出口 ③：摘要 */
    var sec = bundleSections(kept);
    return '摘要（' + prepRangeLabel() + '）：事实区 ' + sec.facts.length + ' 条 / 看法区 ' + sec.views.length +
      ' 条 / 问题清单 ' + sec.questions.length + ' 条；共 ' + kept.length + ' 条，私密 ' +
      (b.all.length - kept.length) + ' 条未纳入。';
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
    /* P0-1：打印媒体下新建的折叠卡也要展开（否则打印丢内容） */
    if (printMediaMatches()) setPrintOpen(true);
  }

  /* ================= P0-1：打印时真展开折叠卡（display:grid 对闭合 details 无效） ================= */
  function setPrintOpen(on) {
    Array.prototype.forEach.call(document.querySelectorAll('details.phase-fold'), function (d) {
      if (on) {
        if (!d.open) { d.setAttribute('data-auto-open', '1'); d.open = true; }
      } else if (d.getAttribute('data-auto-open') === '1') {
        d.open = false;
        d.removeAttribute('data-auto-open');
      }
    });
  }
  function printMediaMatches() {
    try { return !!(window.matchMedia && window.matchMedia('print').matches); } catch (e) { return false; }
  }
  function initPrintOpen() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    var mq = window.matchMedia('print');
    var onChange = function (e) { setPrintOpen(!!(e && 'matches' in e ? e.matches : mq.matches)); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    window.addEventListener('beforeprint', function () { setPrintOpen(true); });
    window.addEventListener('afterprint', function () { setPrintOpen(false); });
    setPrintOpen(printMediaMatches());
  }

  function goto(route, sub) {
    if (ROUTES.indexOf(route) < 0) route = 'dash';
    state.route = route;
    if (sub) { if (route === 'med') state.medTab = sub; }
    var h = '#' + route + (route === 'med' && state.medTab !== 'checkin' ? '/' + state.medTab : '') +
      (route === 'mol' && state.molTab !== 'trend' ? '/' + state.molTab : '');
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

    if (act === 'profile') {
      /* P0-11④：切换档案时清空所有未提交草稿（A 的草稿不得出现在 B 的表单里） */
      state.drafts = { A: {}, B: {} };
      state.molDraft = null;
      state.molState = 'live';
      state.profile = el.getAttribute('data-p');
      state.molKeys = ['pcr'];
      state.molTab = 'trend';
      state.checkin = null;
      state.aeVis = {};
      state.tfrState = {};
      state.gloss = '';
      state.prepOut = null;
      /* P0-R1：切档案必须清掉产物层，否则 A 屏幕会显示 B 生成的清单（上轮 P0-11 同类回归）。
         prepOut 原本就有，但本轮新增的 tfrOut / fertQ / fertQMsg 漏了。 */
      state.tfrOut = null;
      state.fertQMsg = '';
      state.docsFail = false;
      state.lastDraft = null;
      var ap = $('aiPrompt'); if (ap) ap.value = '';
      var al = $('agentLog'); if (al) al.textContent = '（尚未触发）';
      var ah = $('aiHint'); if (ah) ah.textContent = '已切换档案：未提交草稿已清空。';
      render(); return;
    }
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
    if (act === 'today-taken') {
      /* S2 入口逐字「今天吃了吗」：停药期无每日服药 → 去打卡页说明 */
      if (currentDrugKey() === 'none') { goto('med', 'checkin'); return; }
      state.checkin = 'taken'; state.writeFail = false; render(); return;
    }
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
    if (act === 'one-pick') {
      var sel = state.oneSel || [];
      var i = sel.indexOf(v);
      if (i >= 0) sel.splice(i, 1);
      else if (sel.length < 4) sel.push(v);
      else {
        /* P1-2（第四轮评审）：原来只写 #aiHint，而它在会话侧栏里——侧栏收起时 rect=0×0，用户完全看不到反馈。
           16 号 R7 要求"第 5 个不可选或有明确提示"，所以提示必须落在 **picker 自己内部**（用户此刻正在看的地方），
           侧栏只作为附带。 */
        var hh = $('aiHint'); if (hh) hh.textContent = '最多同时看 4 条线：先去一条再选新的。';
        var hint = $('onePickHint');
        if (hint) { hint.textContent = '最多同时看 4 条线：先去一条再选新的。'; hint.hidden = false; }
        return;
      }
      state.oneSel = sel;
      var h2 = $('onePickHint'); if (h2) { h2.textContent = ''; h2.hidden = true; }
      repaintChartPanel();   /* R10/16 号：筛选只重绘面板，不整页重渲染 */
      return;
    }
    if (act === 'one-range') { state.oneRange = v; repaintChartPanel(); return; }
    if (act === 'one-toggle') {
      state.oneToggles[v] = !state.oneToggles[v];
      repaintChartPanel(); return;
    }
    if (act === 'mcard') {
      /* 翻面：只改这一张卡的 class / aria-pressed / aria-hidden / inert，绝不 render()
         （重渲染会重建 DOM，过渡动画与焦点都会丢）。每张卡独立。 */
      var card = el.closest ? el.closest('.mcard') : el;
      if (!card) return;
      var key = card.getAttribute('data-key');
      var on = card.getAttribute('aria-pressed') === 'true';
      var set = state.molFlippedByProfile[state.profile];
      if (!set) { set = state.molFlippedByProfile[state.profile] = new Set(); }
      if (on) { set.delete(key); } else { set.add(key); }
      card.classList.toggle('flipped', !on);
      card.setAttribute('aria-pressed', on ? 'false' : 'true');
      var fr = card.querySelector('.front'), bk = card.querySelector('.back');
      [{ e: fr, hide: !on }, { e: bk, hide: on }].forEach(function (o) {
        if (!o.e) return;
        if (o.hide) { o.e.setAttribute('aria-hidden', 'true'); o.e.setAttribute('inert', ''); }
        else { o.e.removeAttribute('aria-hidden'); o.e.removeAttribute('inert'); }
      });
      return;
    }
    if (act === 'mol-tab') { state.molTab = v; goto('mol'); return; }
    if (act === 'mol-lab') { state.molTab = 'lab'; goto('mol', 'lab'); return; }
    if (act === 'gloss') { state.gloss = (state.gloss === v) ? '' : v; render(); return; }
    if (act === 'mol-save') { saveMol(); return; }
    if (act === 'mol-correct') {
      /* P1-1：原实现只改 #aiHint 一句文案，页面数据零变化——就是"点了没反应"。
         更正必须落地成版本链条目并可见：取最近一条本机新增记录，写一条更正版本。 */
      var pts0 = (ex().pcr || []);
      if (!pts0.length) {
        noteWrite('mol', '更正不可用：本机还没有新增记录，先保存一条再改（原记录一律不覆盖）。');
        render(); return;
      }
      var last = pts0[pts0.length - 1];
      ex().pcrVersions = ex().pcrVersions || [];
      ex().pcrVersions.push({
        d: last.d, from: last.v, to: last.v, at: TODAY, recorder: recorderDefault(),
        src: '本机更正（' + MEM_NOTICE + '）· 原行保留不覆盖'
      });
      state.molState = 'correcting';
      noteWrite('mol', '已建立更正版本链：' + last.d + ' 这条现在有 ' +
        (ex().pcrVersions.filter(function (v0) { return v0.d === last.d; }).length) +
        ' 个版本（原值不覆盖；改完值点保存会写新版本）。' + MEM_NOTICE + '。');
      render(); return;
    }
    if (act === 'mol-reject') {
      state.molState = 'rejected';
      draft().mol = readMolForm();                 /* 拒收零副作用：只留草稿，不写任何记录 */
      render(); return;
    }
    if (act === 'mol-manual') { goto('mol'); focusFirst('#f-v'); return; }
    if (act === 'mol-new') { goto('mol'); focusFirst('#f-v'); return; }
    if (act === 'mol-local-del') {
      ex().pcr.splice(Number(el.getAttribute('data-id')), 1);
      noteWrite('mol', '已撤回一条本机新增记录（' + MEM_NOTICE + '）。');
      render(); return;
    }
    if (act === 'tfr-prep') { goto('tfr'); return; }

    if (act === 'ae-vis') { state.aeVis[el.getAttribute('data-id')] = v; render(); return; }
    if (act === 'ae-new') { goto('ae'); focusFirst('#ae-w'); return; }
    if (act === 'ae-save') { saveAe(); return; }
    if (act === 'ae-clear') { draft().ae = null; render(); return; }

    if (act === 'cost-new') { goto('cost'); focusFirst('#cost-drug'); return; }
    if (act === 'cost-save') { saveCost(); return; }
    if (act === 'cost-clear') { draft().cost = null; render(); return; }

    if (act === 'rx-new') { goto('med', 'rx'); focusFirst('#rx-drug'); return; }
    if (act === 'rx-save') { saveRx(); return; }
    if (act === 'rx-clear') { draft().rx = null; render(); return; }

    if (act === 'fert-ask') {
      var ask = $('fertAskList');
      if (ask) { ask.classList.add('ask-hi'); try { ask.scrollIntoView({ block: 'center' }); } catch (e2) { /* ignore */ } }
      var hh0 = $('aiHint'); if (hh0) hh0.textContent = '已打开「我要问的」问题清单（本页不提供 AI 生成）。';
      return;
    }

    if (act === 'tfr-state') { state.tfrState[el.getAttribute('data-k')] = v; render(); return; }
    if (act === 'prep-range') { state.prepRange = v; render(); return; }
    /* S7 产物：导出核对清单（只照抄字段 + 原话，零结论） */
    if (act === 'tfr-export') {
      var tf = profile().tfr || { must: [], min: [], monitor: [] };
      var lines = ['TFR 核对清单（档案 ' + state.profile + ' · ' + authorView() + '）',
                   '导出时间：' + TODAY + ' · 只含报告字段照抄位与医生原话，本清单不给结论', ''];
      lines.push('【必备 5 条】');
      (tf.must || []).forEach(function (r, i) {
        lines.push((i + 1) + '. ' + (r[0] || '') + '｜报告原文值：' + (r[1] || '未抄录') + '｜核对三态：' + tfrMapState(r[1]));
      });
      lines.push('', '【最低 5 条】');
      (tf.min || []).forEach(function (r, i) {
        lines.push((i + 1) + '. ' + (r[0] || '') + '｜报告原文值：' + (r[1] || '未抄录') + '｜核对三态：' + tfrMapState(r[1]));
      });
      /* 门诊原话与页面同源：都取 rx 里 outcome==='none' 的那条医生原话（此前读
         profile().tfr.quotes，demo 数据无该键 → 导出恒 0 条，而页面明明显示 1 条）。 */
      var tfrQuotes = (profile().rx || []).filter(function (r) { return /医生原话/.test(String(r[5] || '')); });
      lines.push('', '【门诊原话（带来源）】');
      if (!tfrQuotes.length) lines.push('· 本档案门诊记录中无相关原话引用；待门诊补录。');
      tfrQuotes.forEach(function (r) {
        lines.push('· ' + String(r[5] || '').replace(/^医生原话：「|」$/g, '') +
                   '（来源：' + (r[6] || '未记录') + (r[7] ? ' · 文件 ' + r[7] : '') + '）');
      });
      /* P1-11（第四轮评审）：导出件是用户会拿走的东西，脱离页面语境。
         「可以谈停药」这句是**医生原话引用**，不是工具给的建议，但导出后页面上的免责说明就没了。
         所以导出件必须自带尾注：来源 + 不给结论 + 决策归医生。 */
      lines.push('', '【说明】',
        '· 本清单只照抄报告字段与门诊原话，**不给任何结论**，也不判断是否满足停药条件。',
        '· 引用的医生原话逐条标了来源文件；原话是否适用请与你的主治医生核对。',
        '· 是否具备停药条件、何时停药，必须由血液科医生依据完整报告判断，本清单不能替代。',
        '· 生成于 ' + TODAY + ' · 档案 ' + state.profile + ' · ' + MEM_NOTICE + '。');
      state.tfrOut = lines.join('\n');
      state.lastWrite = { page: 'tfr', profile: state.profile, text: '已生成核对清单：' + (tf.must || []).length + ' 条必备 + ' + (tf.min || []).length + ' 条最低 + ' + tfrQuotes.length + ' 条门诊原话' };
      render(); return;
    }
    if (act === 'tfr-print') { try { window.print(); } catch (e3) { /* ignore */ } return; }
    if (act === 'fert-qadd') {
      var inp = $('fertQ');
      var v = inp ? String(inp.value || '').trim() : '';
      if (!v) { state.fertQMsg = '写一句「要问什么」再点加入（不写答案）。'; render(); return; }
      state.fertQByProfile[state.profile] = (state.fertQByProfile[state.profile] || []).concat([v]);
      draft().fertQ = '';
      state.fertQMsg = '已加入清单：' + v + '（记录者：' + recorderDefault() + '）';
      state.lastWrite = { page: 'fert', profile: state.profile, text: '已加入问题清单（' + state.fertQByProfile[state.profile].length + ' 条）' };
      render(); return;
    }
    if (act === 'fert-qdel') {
      var ii = Number(el.getAttribute('data-i'));
      state.fertQByProfile[state.profile] = (state.fertQByProfile[state.profile] || []).filter(function (_, k) { return k !== ii; });
      state.fertQMsg = '已删掉一条（剩 ' + (state.fertQByProfile[state.profile] || []).length + ' 条）';
      render(); return;
    }
    if (act === 'prep-export') { state.prepOut = exportBundle(); render(); return; }
    if (act === 'prep-summary') { state.prepOut = buildSummary(); render(); return; }
    if (act === 'docs-pick') { var dp = $('aiHint'); if (dp) dp.textContent = '原型不读本机文件；真实版本走 MinerU 六部件。'; return; }
    if (act === 'docs-fail') { state.docsFail = !state.docsFail; render(); return; }
    if (act === 'docs-accept' || act === 'docs-correct') {
      var id = el.getAttribute('data-id');
      var p0 = profile();
      var cand = (p0.candidates || []).filter(function (c) { return c[0] === id; })[0];
      if (act === 'docs-accept') {
        state.accepted[state.profile][id] = '已接受';
        noteWrite('docs', '已接受候选 ' + id + '（状态列与计数立刻变，本机内存态）。');
      } else {
        /* P1-1：原实现只改一个状态字符串，页面上「已接受」那行一字不变——点了没反应。
           更正必须是可见的版本链产物：写一条更正记录（原值 → 新值 + 时间 + 记录者），保留原行不覆盖。 */
        var nv = prompt('更正后的值（原值：' + (cand ? cand[2] : '') + '）', cand ? cand[2] : '');
        if (nv == null || String(nv).trim() === '') {
          noteWrite('docs', '更正已取消：没有填写新值，原记录未改动。');
          render(); return;
        }
        state.accepted[state.profile][id] = '已更正';
        ex().docVersions = ex().docVersions || [];
        ex().docVersions.push({
          id: id, from: cand ? cand[2] : '', to: String(nv).trim(),
          at: TODAY, recorder: recorderDefault(),
          src: '本机更正（' + MEM_NOTICE + '）· 原行保留不覆盖'
        });
        noteWrite('docs', '已更正候选 ' + id + '：' + (cand ? cand[2] : '') + ' → ' + String(nv).trim() +
          '（版本链 +1，原行保留，本机内存态）。');
      }
      render(); return;
    }
  }

  function focusFirst(sel) {
    var node = document.querySelector(sel);
    if (node && node.focus) node.focus();
  }
  function readMolForm() {
    return { d: ($('f-d') || {}).value || TODAY, v: ($('f-v') || {}).value || '', lab: ($('f-lab') || {}).value || '',
      is_std: ($('f-std') || {}).value || '1', sens: ($('f-sens') || {}).value || '', unit: ($('f-unit') || {}).value || 'IS%' };
  }
  /* P0-5：保存真的写入本机内存态 → 趋势图新增点 / 分子记录 +1 */
  function saveMol() {
    var f = readMolForm();
    var val = parseFloat(String(f.v).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(val)) {
      state.molDraft = f;
      noteWrite('mol', '保存失败：BCR::ABL1 值不是数字，未写入任何记录（草稿保留）。');
      render(); return;
    }
    ex().pcr.push({
      d: f.d || TODAY, v: val, src: '本机录入（' + MEM_NOTICE + '）', lab: f.lab || '未记录',
      is_std: String(f.is_std) === '1' ? 1 : 0, unit: f.unit || 'IS%', sens: f.sens || '未记录',
      recorder: recorderDefault(), local: true
    });
    state.molDraft = null; draft().mol = null; state.molState = 'live';
    var n = (metricByKey('pcr') || { points: [] }).points.length;
    noteWrite('mol', '已写入本机内存态：' + f.d + ' ' + val + ' ' + (f.unit || 'IS%') + '；趋势图当前 ' + n +
      ' 个点（分子记录 +1）。' + MEM_NOTICE + '。');
    render();
  }
  function saveAe() {
    var name = ($('ae-w') || {}).value || '';
    var d = ($('ae-d') || {}).value || TODAY;
    var drug = ($('ae-drug') || {}).value || currentDrugKey();
    var desc = ($('ae-desc') || {}).value || '';
    var doc = ($('ae-doc') || {}).value || '';
    if (!name || !desc) {
      draft().ae = { name: name, d: d, drug: drug, desc: desc, doc: doc };
      noteWrite('ae', '未提交：不适词与一句自述都要填（草稿保留）。');
      render(); return;
    }
    ex().ae.push({ id: 'ae-' + state.profile + '-local-' + Date.now(), d: d, name: name, drug: drug, desc: desc,
      action: recorderDefault() === '本人' ? '本人自述；未与医生提过' : '家属代记；未与医生提过', doc: doc,
      recorder: recorderDefault() });
    draft().ae = null;
    var n = aeRows().length;
    noteWrite('ae', '已写入本机内存态：时间线新增 1 条，当前 ' + n + ' 条。' + MEM_NOTICE + '。');
    render();
  }
  function saveCost() {
    var drug = ($('cost-drug') || {}).value || '';
    var spec = ($('cost-spec') || {}).value || '';
    var raw = ($('cost-amount') || {}).value || '';
    var amount = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
    var insured = ($('cost-insured') || {}).value || '门特报销后自付';
    var d = ($('cost-date') || {}).value || TODAY;
    if (!drug || !isFinite(amount)) {
      draft().cost = { drug: drug, spec: spec, amount: raw, insured: insured, d: d };
      noteWrite('cost', '未提交：药名与自费金额都要填（草稿保留）。');
      render(); return;
    }
    ex().cost.push({ drug: drug, spec: spec, amount: amount, insured: insured, d: d, recorder: recorderDefault() });
    draft().cost = null;
    var m = String(d).slice(0, 7);
    var sum = 0;
    costRows().forEach(function (c) { if (c.m === m) sum += Number(c.amt || 0) * Number(c.qty == null ? 1 : c.qty); });
    noteWrite('cost', '已写入本机内存态：' + m + ' 当月自费合计变为 ' + sum + ' 元（当前 ' + costRows().length + ' 条）。' + MEM_NOTICE + '。');
    render();
  }
  function saveRx() {
    var drug = ($('rx-drug') || {}).value || '';
    var dose = ($('rx-dose') || {}).value || '';
    var freq = ($('rx-freq') || {}).value || 'daily';
    var start = ($('rx-start') || {}).value || TODAY;
    var stop = ($('rx-stop') || {}).value || null;
    var reason = ($('rx-reason') || {}).value || '';
    if (!drug || !reason) {
      draft().rx = { drug: drug, dose: dose, freq: freq, start: start, stop: stop, reason: reason };
      noteWrite('rx', '未提交：药名与变更原因原文都要填（草稿保留，旧段不动）。');
      render(); return;
    }
    ex().rx.push({ drug: drug, dose: dose, freq: freq, start: start, stop: stop, reason: reason,
      src: '本机录入 · ' + recorderDefault(), doc: '', recorder: recorderDefault() });
    draft().rx = null;
    noteWrite('rx', '已写入本机内存态：处方变更线新增 1 段（' + drug + ' ' + (dose || '剂量未填') + ' ' + freq +
      '），旧段原样保留；当前 ' + rxRows().length + ' 段。' + MEM_NOTICE + '。');
    render();
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
    initPrintOpen();
  }

  var API = {
    VERSION: VERSION, BUILD: BUILD, ROUTES: ROUTES, AI_FORBIDDEN: AI_FORBIDDEN, MEM_NOTICE: MEM_NOTICE,
    state: state, renderPage: renderPage, smoothPath: smoothPath, segmentsOf: segmentsOf,
    filterPrivate: filterPrivate, buildAiContext: buildAiContext, exportBundle: exportBundle,
    buildSummary: buildSummary, fetchExport: fetchExport, makeDraft: makeDraft, prepBundle: prepBundle,
    pathwayOf: pathwayOf, aeRows: aeRows, fertilityRows: fertilityRows, sensitiveRecords: sensitiveRecords,
    chartSVG: chartSVG, lexiconFiltered: lexiconFiltered, lexiconKeys: lexiconKeys,
    aiPrompts: aiPrompts, HVT11: HVT11, authorRole: authorRole, authorView: authorView,
    recorderDefault: recorderDefault, costRows: costRows, rxRows: rxRows, tfrMapState: tfrMapState,
    TFR_STATES: TFR_STATES, GLOSS: GLOSS, profile: profile, metrics: metrics,
    metricByKey: metricByKey,
    setProfile: function (k) { state.profile = k; if (typeof document !== 'undefined') render(); return API; },
    setRoute: function (r) { state.route = r; if (typeof document !== 'undefined') render(); return API; }
  };
  if (typeof window !== 'undefined') window.GRANPAL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
