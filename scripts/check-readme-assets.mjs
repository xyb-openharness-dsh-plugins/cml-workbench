/* README 截图验收（docs/33 号 §6，可断言）
   用法：node scripts/check-readme-assets.mjs
   判据：引用的每个图片路径存在且 <2MB；截图数 ≥4；文件名含版本；docs/screenshots/ 非空
*/
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VERSION = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
const README = join(ROOT, 'README.md');
const SHOTS = join(ROOT, 'docs/screenshots');
const fails = [], oks = [];
const F = (id, m) => fails.push(`${id}: ${m}`);
const O = (id, m) => oks.push(`${id}: ${m}`);

if (!existsSync(README)) F('readme', '缺 README.md');
else {
  const md = readFileSync(README, 'utf8');
  const refs = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1].trim());
  const local = refs.filter((r) => !/^https?:/.test(r));
  if (local.length < 4) F('readme/count', `README 只引用 ${local.length} 张截图（需 ≥4）`); else O('readme/count', `引用 ${local.length} 张`);
  for (const r of local) {
    const p = resolve(ROOT, r);
    if (!existsSync(p)) { F('readme/missing', `破图：${r}`); continue; }
    const kb = statSync(p).size / 1024;
    if (kb >= 2048) F('readme/size', `${r} 体积 ${kb.toFixed(0)}KB（需 <2MB）`);
    if (!r.includes(VERSION)) F('readme/version', `${r} 文件名不含当前版本 ${VERSION}`);
  }
  if (!fails.some((f) => f.startsWith('readme/missing') || f.startsWith('readme/size') || f.startsWith('readme/version')))
    O('readme/assets', `全部截图存在、<2MB、文件名含 v${VERSION}`);
  if (!md.includes(VERSION)) F('readme/version-text', `README 正文未出现当前版本 ${VERSION}`); else O('readme/version-text', `正文含 ${VERSION}`);
}

if (!existsSync(SHOTS)) F('shots/dir', '缺 docs/screenshots/');
else {
  const imgs = readdirSync(SHOTS).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  if (imgs.length === 0) F('shots/empty', 'docs/screenshots/ 为空'); else O('shots/dir', `docs/screenshots/ 有 ${imgs.length} 张`);
}

console.log(JSON.stringify({ ok: fails.length === 0, fails, oks }, null, 2));
process.exit(fails.length === 0 ? 0 : 1);
