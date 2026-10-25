/* 版本与构建信息：包版本只有一个来源（package.json），别处不许再写一遍版本号。 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export const version = manifest.version

let build = 'unknown'
try {
  build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
} catch { /* 非 git 环境（装进 profile 后通常没有 .git）：保留 unknown，不抛错 */ }

export { build }
