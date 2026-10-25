/* 演示/数据层纪律校验（硬纪律六条，可断言版）
   用法：node scripts/check-demo-data.mjs
   判据：ORDER BY rowid｜显式 null｜in_use｜分节 *_title｜分类不进趋势｜演示唯一源
   说明：M2 阶段演示数据是唯一源（demo/build-demo-data.mjs）；M3 起同一套断言跑 schema。
*/
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BUILDER = join(ROOT, 'demo/build-demo-data.mjs');
const DATA = join(ROOT, 'prototypes/v0.2/demo-data.js');
const fails = [], oks = [];
const F = (id, m) => fails.push(`${id}: ${m}`);
const O = (id, m) => oks.push(`${id}: ${m}`);

if (!existsSync(BUILDER)) F('source', '缺 demo/build-demo-data.mjs（唯一源）');
if (!existsSync(DATA)) F('source', '缺 prototypes/v0.2/demo-data.js（应由构建器生成）');

if (fails.length === 0) {
  const b = readFileSync(BUILDER, 'utf8');
  const d = readFileSync(DATA, 'utf8');

  /* 1. 唯一源：产物必须由构建器生成，且带"勿手改"头 */
  if (!/勿手改/.test(d)) F('unique-source', 'demo-data.js 缺少"勿手改"生成头'); else O('unique-source', '产物带生成头');

  /* 2. 显式 null：可比性四要素不得缺键（undefined 静默通过最危险） */
  const four = ['unit', 'lab', 'is_standardized', 'sensitivity'].filter((c) => new RegExp(`${c}\\s+IS\\s+NULL`, 'i').test(b));
  if (four.length < 4) F('explicit-null', `可比性四要素 NULL 断言只覆盖 ${four.join(',') || '无'}（需 unit/lab/is_standardized/sensitivity）`); else O('explicit-null', '四要素均有 NULL 断言');
  const nullTokens = (b.match(/null\)/g) || []).length + (b.match(/,\s*null/g) || []).length;
  if (nullTokens < 3) F('explicit-null', `显式 null 过少（${nullTokens}），可空列应显式写 null`); else O('explicit-null', `显式 null ${nullTokens} 处`);

  /* 3. 分节标题：不在主体上排 *_title 列 */
  const titleCols = [...b.matchAll(/(\w*_title)\s+TEXT/g)].map((m) => m[1]);
  if (titleCols.length > 3) F('section-title', `主体表出现 ${titleCols.length} 个 *_title 列（分节标题应走 section_titles）`); else O('section-title', `*_title 列 ${titleCols.length} 个（≤3）`);

  /* 4. 分类不进趋势：kind 非 num 的指标不得有数值点 */
  const qualBlocks = [...d.matchAll(/"kind":"(qual|grade)"[\s\S]{0,900}?"points":\[(.*?)\]/g)];
  const badQual = qualBlocks.filter(([, , pts]) => /"v":-?\d/.test(pts));
  if (badQual.length) F('category-not-trend', `${badQual.length} 个分类指标带数值点`); else O('category-not-trend', `分类指标 ${qualBlocks.length} 个，均无数值点`);

  /* 5. 判读列：库内不得出现 diagnosis/risk_level 类列 */
  const judge = ['diagnosis', 'risk_level', 'prognosis', 'recommendation'].filter((c) => new RegExp(`\\b${c}\\b`).test(b));
  if (judge.length) F('no-judgement-column', `出现判读列：${judge.join(',')}`); else O('no-judgement-column', '无判读列');

  /* 6. 文档必须由生成器带出（不可在原型里另造一套数据） */
  if (/DEMO_DATA\s*=\s*\{\s*profiles/.test(b) && !/window\.DEMO_DATA/.test(d)) F('export', '构建器未把 DEMO_DATA 写出到产物'); else O('export', '构建器产出 window.DEMO_DATA');

  /* 7. 双档案存在 */
  if (!/"profiles":\{"A"/.test(d) || !/"B":\{/.test(d)) F('two-profiles', '双档案 A/B 不完整'); else O('two-profiles', '双档案 A/B 均在');
}

console.log(JSON.stringify({ ok: fails.length === 0, fails, oks }, null, 2));
process.exit(fails.length === 0 ? 0 : 1);
