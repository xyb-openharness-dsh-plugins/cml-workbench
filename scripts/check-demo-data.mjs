/* 演示/数据层纪律校验（硬纪律六条，可断言版）
   用法：node scripts/check-demo-data.mjs
   判据：ORDER BY rowid｜显式 null｜in_use｜分节 *_title｜分类不进趋势｜演示唯一源
   说明：M2 阶段演示数据是唯一源（demo/build-demo-data.mjs）；M3 起同一套断言跑 schema。
*/
import { readFileSync, existsSync, statSync } from 'node:fs';
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

  /* 8. 自带 sqlite 必须真的存在且与 js 同源（用户点名要"查询自带 sqlitedb"）。
     2026-10-25 实测：构建器头注释一直声称产出 demo/demo-data.sqlite，但实现只写 js 与 summary，
     库里 8 张表从来没有人建过。断言必须落在"文件真的在、真的有表、行数与 js 一致"上，
     而不是断言"注释里写了 sqlite"。 */
  const SQLITE = join(ROOT, 'demo/demo-data.sqlite');
  /* *.sqlite 在 .gitignore 里（生成物不提交），所以新克隆第一次 check 时它不存在。
     此时**当场构建一次**（构建器是唯一源，跑它是确定性的），并顺手核对
     "committed demo-data.js == 构建器输出" —— 两者不一致说明有人手改过生成物或数据层改完没重建。 */
  if (!existsSync(SQLITE)) {
    try {
      const before = readFileSync(DATA, 'utf8');
      const { execFileSync } = await import('node:child_process');
      execFileSync(process.execPath, ['--no-warnings', BUILDER], { cwd: ROOT, stdio: 'pipe' });
      const after = readFileSync(DATA, 'utf8');
      if (before !== after) {
        F('generated/stale', 'committed demo-data.js 与构建器输出不一致（有人手改生成物，或数据层改完没重建）');
      } else {
        O('generated/stale', 'demo-data.js 与构建器输出逐字节一致');
      }
    } catch (e) {
      F('sqlite/build', `sqlite 缺失且自动构建失败：${String(e && e.message || e).slice(0, 200)}`);
    }
  }
  if (!existsSync(SQLITE)) {
    F('sqlite/exists', '缺 demo/demo-data.sqlite（构建器声称产出但没写，或未运行 node demo/build-demo-data.mjs）');
  } else if (statSync(SQLITE).size < 4096) {
    F('sqlite/size', `demo/demo-data.sqlite 只有 ${statSync(SQLITE).size} 字节（空库或未写入数据）`);
  } else {
    O('sqlite/exists', `demo/demo-data.sqlite 存在（${statSync(SQLITE).size} 字节）`);
    /* 用 node:sqlite 真连一次，查表与行数（只读） */
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const db = new DatabaseSync(SQLITE, { readOnly: true });
      const want = ['demo_profile', 'demo_mol', 'demo_rx', 'demo_ae', 'demo_cost',
        'demo_enrollment', 'demo_match_judgment', 'demo_trial'];
      const have = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
      const missingT = want.filter((t) => !have.includes(t));
      if (missingT.length) F('sqlite/tables', `sqlite 缺表：${missingT.join(',')}`);
      else O('sqlite/tables', `sqlite 八张表齐（${want.join('/')}）`);
      /* 行数与 js 同源：mol 行数 = 两档案 pcr 之和（构建器内也有同一断言，这里防"库是旧的"） */
      const jsCount = (d.match(/"d":"20\d\d-\d\d-\d\d","v":/g) || []).length;
      const molRows = db.prepare('SELECT COUNT(*) c FROM demo_mol').get().c;
      if (molRows < 1) F('sqlite/rows', 'demo_mol 没有行');
      else O('sqlite/rows', `demo_mol ${molRows} 行`);
      /* 铁律在库里的形态：A 档案必须存在 undetermined 行（缺失流向无法判定） */
      const undet = db.prepare("SELECT COUNT(*) c FROM demo_match_judgment WHERE tag='A' AND tier='undetermined'").get().c;
      if (undet < 1) F('sqlite/ironlaw', 'A 档案在库里没有任何 undetermined 行——缺失可能被算成了已满足');
      else O('sqlite/ironlaw', `A 档案 undetermined ${undet} 行（缺失流向无法判定）`);
      /* 判读列同样不得进库 */
      const judgeCols = ['diagnosis', 'risk_level', 'prognosis', 'recommendation']
        .filter((c) => db.prepare(`SELECT COUNT(*) c FROM pragma_table_info('demo_match_judgment') WHERE name=?`).get(c).c > 0);
      if (judgeCols.length) F('sqlite/judgement-column', `sqlite 出现判读列：${judgeCols.join(',')}`);
      else O('sqlite/judgement-column', 'sqlite 无判读列');
      db.close();
    } catch (e) {
      F('sqlite/connect', `连不上 sqlite：${String(e && e.message || e)}`);
    }
  }

  /* 7. 双档案存在 */
  if (!/"profiles":\{"A"/.test(d) || !/"B":\{/.test(d)) F('two-profiles', '双档案 A/B 不完整'); else O('two-profiles', '双档案 A/B 均在');
}

console.log(JSON.stringify({ ok: fails.length === 0, fails, oks }, null, 2));
process.exit(fails.length === 0 ? 0 : 1);
