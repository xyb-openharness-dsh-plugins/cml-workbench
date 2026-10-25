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
  const chartRoots = (src.match(/class="chart"/g) || []).length;
  if (chartRoots < 1) F('chart/root', '没有 class="chart" 的 SVG 根'); else O('chart/root', `class="chart" 出现 ${chartRoots} 次`);
  if (!/fritsch|Fritsch|monotone/i.test(js)) F('chart/smooth', '未找到 Fritsch–Carlson / monotone 平滑实现'); else O('chart/smooth', '有单调插值实现');
  if (!/is_std|isStd/.test(js)) F('chart/comparability', '未读取 is_std（可比性四要素）'); else O('chart/comparability', '读取了可比性要素');
  if (!/不可比/.test(js)) F('chart/segbreak', '缺少"不可比"分段标注'); else O('chart/segbreak', '有不可比分段标注');

  /* --- AI 按钮 --- */
  if (!/cml:agent-draft/.test(js)) F('ai/event', '未派发 cml:agent-draft 事件'); else O('ai/event', '有 cml:agent-draft');
  const aiCount = (js.match(/cml:agent-draft/g) || []).length;
  if (aiCount < 8) F('ai/coverage', `AI 入口仅 ${aiCount} 处（10 页至少要 8 页，打卡与 TFR/生育可除外）`); else O('ai/coverage', `AI 入口 ${aiCount} 处`);

  /* --- private 三出口 --- */
  if (!/function\s+filterPrivate/.test(js)) F('private/fn', '未找到统一 filterPrivate 函数'); else O('private/fn', '有 filterPrivate');
  const exits = ['export', 'ai', 'summary'].filter((e) => new RegExp(`filterPrivate\\([^)]*['"\`]${e}['"\`]`).test(js));
  if (exits.length < 3) F('private/exits', `三出口只覆盖 ${exits.join(',') || '无'}（需 export/ai/summary）`); else O('private/exits', '三出口均经 filterPrivate');

  /* --- 面板宽度 25–45% --- */
  const widthOk = /0\.25|25%/.test(css + js) && /0\.45|45%/.test(css + js) && /0\.35|35%/.test(css + js);
  if (!widthOk) F('panel/width', '面板默认 35% 或范围 25%–45% 缺失'); else O('panel/width', '面板 35% 默认 / 25–45% 范围在位');
  if (!/localStorage/.test(js)) F('panel/persist', '宽度偏好未持久化'); else O('panel/persist', '有偏好持久化');

  /* --- 字号 12.5–15 --- */
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
  const bad = sizes.filter((s) => s < 12.5 || s > 15);
  if (bad.length) F('font/size', `越界字号 ${[...new Set(bad)].join(',')}（只允许 12.5–15）`); else O('font/size', `字号 ${[...new Set(sizes)].sort((a, b) => a - b).join('/')} 全部在 12.5–15`);

  /* --- [hidden] --- */
  if (!/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css)) F('hidden', '缺 [hidden]{display:none!important}'); else O('hidden', '[hidden] 规则在位');

  /* --- 页脚贴底 --- */
  if (!/margin-top:\s*auto/.test(css)) F('footer', '页脚未贴底（缺 margin-top:auto）'); else O('footer', '页脚贴底');

  /* --- 判读词（红线 K1） --- */
  const banned = ['达标', '未达标', '建议治疗', '可以停药', '无需就医', '治愈率', 'risk_level', '诊断结论'];
  const hits = banned.filter((w) => src.includes(w));
  if (hits.length) F('wording', `禁词命中：${hits.join('、')}`); else O('wording', '禁词 0 命中');

  /* --- 判断色阶（红绿好坏） --- */
  if (/--good|--bad|--ok-green|is-normal|is-abnormal/.test(src)) F('color/judgement', '出现好坏语义色阶'); else O('color/judgement', '无好坏语义色阶');

  /* --- 数据只读（唯一源） --- */
  const data = readFileSync(files.data, 'utf8');
  if (!/window\.DEMO_DATA/.test(data)) F('data/source', 'demo-data.js 未导出 window.DEMO_DATA'); else O('data/source', '原型读 demo-data.js（唯一源）');
  if (/localStorage\.setItem\([^)]*DEMO_DATA/.test(js)) F('data/write', '原型把演示数据写回本地存储（违反唯一源）'); else O('data/write', '原型不改写演示数据');
}

console.log(JSON.stringify({ prototype: P2, pass: fails.length === 0, fails, oks }, null, 2));
process.exit(fails.length === 0 ? 0 : 1);
