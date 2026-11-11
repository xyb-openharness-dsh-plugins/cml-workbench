/* 版本与构建信息（生成物，别手改）：node scripts/build-version.mjs
 *
 * 版本号的唯一来源是根目录 VERSION；这个文件、package.json、首页版本章都是它的副本。
 * 改 VERSION 后必须重新生成，否则 `npm run check` 里的 --check 会直接失败。
 */
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const version = '0.1.5'

let build = 'unknown'
try {
  build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
} catch { /* 非 git 环境（装进 profile 后通常没有 .git）：保留 unknown，不抛错 */ }

export { build }
