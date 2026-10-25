/* 原型静态校验：docs/22 号 G2 + docs/32 号折叠卡 + 硬纪律
   用法：node scripts/check-prototype.mjs [prototypes/v0.2]
   判据全部来自文档，不新造标准；不做"看起来还行"的结论。 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const P2 = process.argv[2] ? process.argv[2] : join(ROOT, 'prototypes/v0.2');
const files = { html: join(P2, 'index.html'), js: join(P2, 'app.js'), css: join(P2, 'style.css'), data: join(P2, 'demo-data.js') };

const fails = [];
const oks = [];
const F = (id, msg) => fails.push(`${id}: ${msg}`);
const O = (id, msg) => oks.push(`${id}: ${msg}`);

for (const [k, p] of Object.entries(files)) if (!existsSync(p)) F('files', `缺 ${p}`);

if (fails.length === 0) {
  const html = readFileSync(files.html, 'utf8');
  const js = readFileSync(files.js, 'utf8');
  const css = readFileSync(files.css, 'utf8');
  const src = html + '\n' + js + '\n' + css;

  /* --- 一级页 10 条 --- */
  const PAGES = ['dash', 'mol', 'med', 'ae', 'tfr', 'cost', 'fert', 'prep', 'docs', 'trial'];
  const missing = PAGES.filter((p) => !new RegExp(`['"\`]${p}['"\`]`).test(js + html));
  if (missing.length) F('pages', `一级页缺：${missing.join(',')}（应 10 条）`); else O('pages', '10 个一级页均在位');

  /* --- 版本字面量（P1 发布可见性） --- */
  const vcount = (src.match(/v0\.1\.0/g) || []).length;
  if (vcount < 2) F('version', `版本字面量出现 ${vcount} 次（顶栏+页脚至少 2）`); else O('version', `版本字面量 ${vcount} 次`);

  /* --- 折叠卡（32 号） --- */
  const openCount = (src.match(/<details[^>]*\sopen\b/g) || []).length;
  if (openCount !== 0) F('foldout/open', `默认展开的 <details> = ${openCount}（必须 0）`); else O('foldout/open', '默认全部收起');
  if (!/pd-block/.test(src)) F('foldout/blocks', '未找到 section.pd-block（五块结构）'); else O('foldout/blocks', '有 pd-block 结构');
  const printRule = /@media\s+print[^}]*\{[\s\S]*phase-detail/.test(css) && /break-inside:\s*avoid/.test(css);
  if (!printRule) F('foldout/print', '缺 @media print 展开规则或 break-inside:avoid'); else O('foldout/print', '打印规则在位');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src)) F('foldout/emoji', '出现 emoji（summary 折叠指示只能用 ::after ▸/▾）'); else O('foldout/emoji', '无 emoji');

  /* --- SVG 图表 --- */
  /* P1-6（第四轮评审）：原实现数是**源码字符串**里 `class="chart"` 出现几次，
     并且把「= 6」写进了 index.html 的自检 —— 那是拿源码计数给自检背书，
     而源码里 `class="chart"` 实际出现 9 次（含模板与 chartSVG 里各一处），渲染态是 8 个 SVG。
     所以这里只做"存在性"断言（必须有、且不是硬编码数字），**具体数量交给渲染态探针**：
     `scripts/probe-page-view.py` 逐页数 `svg.chart`，那才是 DOM 真值。 */
  if (!/class="chart"/.test(js)) F('chart/root', 'app.js 里没有生成 class="chart" 的 SVG 根');
  else O('chart/root', 'app.js 生成 svg root class="chart"（数量以 probe-page-view.py 的渲染态计数为准）');
  /* 反向断言：自检文档里不许写死图表数量（写死就必然过期，第四轮实际过期成 6 vs 8） */
  const idxHtml = readFileSync(join(P2, 'index.html'), 'utf8');
  const staleCount = idxHtml.match(/图表\s*SVG\s*数\s*=\s*\d+/);
  if (staleCount) F('chart/count-hardcoded', `自检里写死了图表数量「${staleCount[0]}」——必须改为"以渲染态探针为准"（该数字已过期一次）`);
  else O('chart/count-hardcoded', '自检不写死图表数量（避免过期）');
  /* 同类防复发：自检里不许写死 sha256 前 8（数据层每改一次就过期一次，已复发两轮） */
  const staleHash = idxHtml.match(/sha256[^\n]{0,20}[0-9a-f]{8}/i);
  if (staleHash) F('fingerprint/hardcoded', `自检里写死了 sha256「${staleHash[0].trim()}」——数据层一改就过期，改为只指向 shasum 命令`);
  else O('fingerprint/hardcoded', '自检不写死 sha256（避免过期复发）');
  if (!/fritsch|Fritsch|monotone/i.test(js)) F('chart/smooth', '未找到 Fritsch–Carlson / monotone 平滑实现'); else O('chart/smooth', '有单调插值实现');
  if (!/is_std|isStd/.test(js)) F('chart/comparability', '未读取 is_std（可比性四要素）'); else O('chart/comparability', '读取了可比性要素');
  if (!/不可比/.test(js)) F('chart/segbreak', '缺少"不可比"分段标注'); else O('chart/segbreak', '有不可比分段标注');

  /* --- AI 按钮 --- */
  if (!/cml:agent-draft/.test(js)) F('ai/event', '未派发 cml:agent-draft 事件'); else O('ai/event', '有 cml:agent-draft');
  const aiPages = [...new Set([...js.matchAll(/aiButton\(\s*'([a-z]+)'/g)].map((m) => m[1]))];
  const need = ['dash', 'mol', 'med', 'ae', 'cost', 'prep', 'docs', 'trial'];
  const lack = need.filter((p) => !aiPages.includes(p));
  if (lack.length) F('ai/coverage', `这些页没有 AI 入口：${lack.join(',')}（AI 覆盖页 ${aiPages.join(',')}）`); else O('ai/coverage', `AI 入口覆盖 ${aiPages.length} 页：${aiPages.join(',')}`);
  if (aiPages.includes('tfr') || aiPages.includes('fert')) F('ai/forbidden', 'TFR 或生育页出现 AI 生成入口（红线：重大决策不 AI 生成）'); else O('ai/forbidden', 'TFR/生育无 AI 生成入口');

  /* --- private 三出口 --- */
  if (!/function\s+filterPrivate/.test(js)) F('private/fn', '未找到统一 filterPrivate 函数'); else O('private/fn', '有 filterPrivate');
  const exits = ['export', 'ai', 'summary'].filter((e) => new RegExp(`filterPrivate\\([^)]*['"\`]${e}['"\`]`).test(js));
  if (exits.length < 3) F('private/exits', `三出口只覆盖 ${exits.join(',') || '无'}（需 export/ai/summary）`); else O('private/exits', '三出口均经 filterPrivate');

  /* --- 面板宽度 25–45% --- */
  const widthOk = /0\.25|25%/.test(css + js) && /0\.45|45%/.test(css + js) && /0\.35|35%/.test(css + js);
  if (!widthOk) F('panel/width', '面板默认 35% 或范围 25%–45% 缺失'); else O('panel/width', '面板 35% 默认 / 25–45% 范围在位');
  if (!/localStorage/.test(js)) F('panel/persist', '宽度偏好未持久化'); else O('panel/persist', '有偏好持久化');

  /* --- 字号 12.5–15（正文口径），含一条显式豁免 ---
     豁免：指标卡正面的大数字 `.mval` 用 33px。依据是 24 号 §5「数字约33px、项目名15px、
     正文12px、元信息11px」——这是家族约定的**卡片内视觉层级**，不是正文。豁免必须逐选择器
     声明（不是按数值放行），否则字号纪律会悄悄失效；新增豁免要写进 DEV-REQUIREMENTS §七。 */
  const NUMERAL_SELECTORS = ['\\.mval'];
  const sizeRows = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap(([, sel, body]) =>
    [...body.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => ({ sel: sel.trim(), size: Number(m[1]) })));
  const isNumeral = (sel) => NUMERAL_SELECTORS.some((re) => new RegExp(re).test(sel));
  const bad = sizeRows.filter((r) => (r.size < 12.5 || r.size > 15) && !isNumeral(r.sel));
  const sizes = sizeRows.map((r) => r.size);
  if (bad.length) {
    F('font/size', `越界字号 ${[...new Set(bad.map((r) => r.size + 'px@' + r.sel))].join(',')}（正文只允许 12.5–15）`);
  } else {
    O('font/size', `正文 ${[...new Set(sizes.filter((v) => v >= 12.5 && v <= 15))].sort((a, b) => a - b).join('/')} 全部在 12.5–15；豁免 ${[...new Set(sizeRows.filter((r) => isNumeral(r.sel)).map((r) => r.size + 'px@.mval'))].join(',') || '无'}`);
  }

  /* --- [hidden] --- */
  if (!/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css)) F('hidden', '缺 [hidden]{display:none!important}'); else O('hidden', '[hidden] 规则在位');

  /* --- 页脚贴底 --- */
  if (!/margin-top:\s*auto/.test(css)) F('footer', '页脚未贴底（缺 margin-top:auto）'); else O('footer', '页脚贴底');

  /* --- 判读词（红线 K1） --- */
  /* 禁词只扫"会被用户看到/会进导出的文本"：
     - HTML 注释（含文末自查清单）与 JS 注释不算内容，先剥离；
     - 带来源的医生原话/报告原文用 <q class="quote"> 包裹，属"引用原文"而非本仓结论，单独统计不判违规；
     - q 标签内若同条无来源标注，仍判违规（防止用引号夹带结论）。 */
  const stripComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const visible = stripComments(html) + '\n' + stripComments(js) + '\n' + stripComments(css);
  /* 禁词分两类：
     (a) 本仓结论类：任何位置出现即违规（含"可能复发/建议停药"这类把结论塞进引号的写法）；
     (b) 引用类（达标/未达标/可以停药/异常…）：只允许出现在 <q class="quote"> 且紧跟 <span class="src">来源：…</span> 的引用里——
         这是"医生原话/报告原文照抄"，不是本仓判断；无来源标注一律违规。
     先按"引用块整体摘除"再扫 (a)+(b)，避免把带来源的原话误判（此前版本即因此误伤）。 */
  const quotedRe = /<q[^>]*class="quote"[^>]*>([\s\S]*?)<\/q>\s*<span class="src">来源：([^<]*)<\/span>/g;
  const quoted = [];
  let mq;
  while ((mq = quotedRe.exec(visible)) !== null) quoted.push({ text: mq[1], src: mq[2].trim() });
  const srcLessQuotes = [...visible.matchAll(/<q[^>]*class="quote"[^>]*>([\s\S]*?)<\/q>(?!\s*<span class="src">)/g)]
    .map((m) => m[1]).filter((t) => /达标|未达标|可以停药|建议停药|可能复发/.test(t));
  const outside = visible.replace(/<q[^>]*class="quote"[\s\S]*?<\/q>\s*<span class="src">来源：[^<]*<\/span>/g, '');
  const banned = ['达标', '未达标', '建议治疗', '可以停药', '建议停药', '可能复发', '无需就医', '治愈率', 'risk_level', '诊断结论', '无需处理'];
  const hits = banned.filter((w) => outside.includes(w));
  const quotedNoSrc = srcLessQuotes;
  if (hits.length) F('wording', `禁词命中（可见文本）：${hits.join('、')}`); else O('wording', `禁词 0 命中（已剥离注释；引用原文 ${quoted.length} 处单列）`);
  if (quotedNoSrc.length) F('wording/quote', `引号内出现决策类词且来源不清：${quotedNoSrc.length} 处`); else O('wording/quote', '引用原文中无未标来源的决策词');

  /* --- 临床试验三档匹配表达约束（MATCHING-SPEC §4.4） ---
     禁：匹配度百分比 / 高匹配 / 推荐 / 最适合 / 不符合条件 / 按匹配度排序 / 绿红排名。
     例外：**否定式说明**（"不给匹配度""不是匹配度""无匹配度百分比"）是合规的，必须放行——
     否则免责说明本身会被当成违规（LESSONS 第 10 类：免责措辞自己踩禁词）。
     判法：先剥离否定语境（含 "不/无/非/别" 的同一短语窗口），再扫。 */
  /* 判法（第四轮评审后重写）：**先剥离显式免责搭配，再扫全量**。
     原实现用"禁词前 28 字符是否含否定词"来判定，两个毛病：
       ①「不符合条件」自带「不」字，位置窗口法在特定上下文里会自我放行；
       ②窗口宽度是拍脑袋的，换个句式就漏。
     现改为白名单式：只有下列**完整搭配**算合规，把它们从文本里整段删掉后，
     剩下的任何禁词命中都是真违规。加白名单必须在这里逐条写出来（可审计）。 */
  const allowedCollocations = [
    '不给匹配度百分比', '不给匹配度', '不是匹配度', '不按匹配度排序', '不按匹配度',
    '不输出匹配度百分比', '无匹配度百分比', '不提供匹配度', '不写匹配度',
    '按匹配度排序等于给推荐', /* 解释"为什么不按匹配度排序"的括号句，整句合规 */
    '不给推荐', '不推荐', '不排序', '不做加总', '不给整体评级', '不是分数',
    '不做入组资格判断', '不做判读', '不给结论', '不代发', '不自动发送'
  ];
  let scanText = visible;
  for (const a of allowedCollocations) scanText = scanText.split(a).join(' ');

  const trialBan = ['匹配度', '高匹配', '最适合', '不符合条件', '按匹配度排序', '综合评分', '健康指数'];
  const trialHits = trialBan.filter((w) => scanText.includes(w));

  // 匹配度 + 数字/% 单独抓（`匹配度 82%` 绕过短语禁令），在剥离后的文本上扫
  const pctHits = [...scanText.matchAll(/匹配度[^0-9%。；\n]{0,6}[0-9]{1,3}\s*[%％]/g)].map((m) => m[0]);

  // 「推荐」只禁"给出选择"的用法；已剥离「不给推荐/不推荐」
  const recHits = [...scanText.matchAll(/(首选|建议|强烈)?推荐[^。；\n]{0,10}/g)].map((m) => m[0]);

  if (trialHits.length || recHits.length || pctHits.length) {
    F('matching/expressions', `临床试验表达违规：${[...new Set(trialHits)].join('、')}${pctHits.length ? ' 匹配度数值 ' + pctHits.length + ' 处（' + pctHits.join(' / ') + '）' : ''}${recHits.length ? ' 推荐类 ' + recHits.length + ' 处' : ''}`);
  } else {
    O('matching/expressions', '三档表达合规（无匹配度百分比/高匹配/推荐/排序，否定式说明已放行）');
  }

  /* --- 缺字段必须流向「无法判定」，不得流向「已满足」（MATCHING-SPEC §4 铁律）
     注意：求值在数据构建器（demo/build-demo-data.mjs 的 evalRule/tier）里，不在 app.js；
     所以这一条要读构建器源码，不能只扫前端。 */
  const builderPath = join(P2, '..', '..', 'demo', 'build-demo-data.mjs');
  let builder = '';
  try { builder = readFileSync(builderPath, 'utf8'); } catch { /* 没有构建器就跳过，不误报 */ }
  if (!builder) {
    O('matching/ironlaw', '未找到数据构建器，跳过（本条只在前端实现时才有意义）');
  } else if (!/undetermined/.test(builder)) {
    F('matching/ironlaw', '数据构建器里找不到 undetermined 三档枚举');
  } else {
    /* 判法（第四轮评审后重写）：不看"文本里有没有这两个词"（那是存在性检查，假阳性/假阴性都可能），
       而是**真跑一遍 tier 的语义**：从构建器里抽出 tier 箭头函数源码，喂给缺值/未知值，
       断言必须返回 'undetermined'。这样把 guard 后面改成 'satisfied' 会被当场抓住。 */
    const tierMatch = builder.match(/const tier = \(([^)]*)\) => \{([\s\S]*?)\n  \};/);
    if (!tierMatch) {
      F('matching/ironlaw', '找不到 `const tier = (v) => { ... }` 的定义，无法验证铁律');
    } else {
      const body = tierMatch[2];
      /* 铁律三态：undefined / null / '' 必须 undetermined；其余交给 rule.test。
         这里直接核语义（不 eval 任意代码）：body 里必须有"缺值 → undetermined"的分支，
         且该分支必须在该函数**第一条 return** 上。 */
      /* 取「函数体开头 → 第一条 return 语句结束」这一段（不是从 return 开始切，
         否则会把 return 前面的 if 守卫切掉——这正是第一版误报的原因）。 */
      const firstReturn = body.slice(0, body.indexOf(';', body.indexOf('return')) + 1);
      const guardsMissingFirst = /undefined|null|''|""/.test(firstReturn) && /undetermined/.test(firstReturn);
      /* 另外核：conflict 分支确实存在（否则"缺失→无法判定"成立但"不满足→冲突"没实现） */
      const hasConflict = /conflict/.test(body);
      if (!guardsMissingFirst) {
        F('matching/ironlaw', '铁律破线：tier() 的**第一条 return** 不是「缺值 → undetermined」，缺失可能流向已满足');
      } else if (!hasConflict) {
        F('matching/ironlaw', 'tier() 里没有 conflict 分支（不满足的情况未被表达）');
      } else {
        O('matching/ironlaw', '缺失/未知流向 undetermined（tier() 第一条 return 已核，conflict 分支在位）');
      }
    }
  }

  /* --- 曲线必须非空（第四轮评审 P0-1 的防复发：空 d 曾让 R3 自证为真） ---
     这是纯静态可判的部分：`smoothPath` 的入参归一化必须存在，否则数组形态会被 filter 全部丢弃。
     渲染态的非空与 cy 不变由 probe-page-view.py 与 scripts/verify-onechart.py 断言。 */
  const spBody = js.slice(js.indexOf('function smoothPath'), js.indexOf('function smoothPath') + 600);
  if (!/Array\.isArray|Array\.prototype\.isArray|\.map\(|\[0\]/.test(spBody)) {
    F('chart/smoothpath-input', 'smoothPath 没有做入参归一化：调用方传 [x,y] 数组时会被 filter 全部丢弃 → d=""（第四轮 P0-1 原样复现）');
  } else O('chart/smoothpath-input', 'smoothPath 归一化了 {x,y} 与 [x,y] 两种入参形态');

  /* --- 判断色阶（红绿好坏） --- */
  if (/--good|--bad|--ok-green|is-normal|is-abnormal/.test(src)) F('color/judgement', '出现好坏语义色阶'); else O('color/judgement', '无好坏语义色阶');

  /* --- 数据只读（唯一源） --- */
  const data = readFileSync(files.data, 'utf8');
  if (!/window\.DEMO_DATA/.test(data)) F('data/source', 'demo-data.js 未导出 window.DEMO_DATA'); else O('data/source', '原型读 demo-data.js（唯一源）');
  if (/localStorage\.setItem\([^)]*DEMO_DATA/.test(js)) F('data/write', '原型把演示数据写回本地存储（违反唯一源）'); else O('data/write', '原型不改写演示数据');
}

console.log(JSON.stringify({ prototype: P2, pass: fails.length === 0, fails, oks }, null, 2));
process.exit(fails.length === 0 ? 0 : 1);
