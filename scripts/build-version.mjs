#!/usr/bin/env node
/**
 * 生成 lib/version.js（版本号的运行时副本）。
 *
 * 为什么要有这一层：`VERSION` 是唯一来源，`package.json` / 首页字面量 / 这个文件都是它的副本。
 * 原实现是"运行时读 package.json"，装进 profile 后 package.json 可能被 pnpm 改写或不在预期位置，
 * 且 spec 的家族闸口（dsh-wb-cli audit · version/lib）要求该文件里能读出**字面量**与 VERSION 对照，
 * 否则"改完版本忘了同步"不会被发现。这里把字面量生成出来，并把 git 短哈希保留为构建信息。
 *
 * 用法：
 *   node scripts/build-version.mjs          写入
 *   node scripts/build-version.mjs --check  只校验，不一致退出 1
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim()
const target = join(root, 'lib', 'version.js')

function render(current) {
  return `/* 版本与构建信息（生成物，别手改）：node scripts/build-version.mjs
 *
 * 版本号的唯一来源是根目录 VERSION；这个文件、package.json、首页版本章都是它的副本。
 * 改 VERSION 后必须重新生成，否则 \`npm run check\` 里的 --check 会直接失败。
 */
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const version = '${current}'

let build = 'unknown'
try {
  build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
} catch { /* 非 git 环境（装进 profile 后通常没有 .git）：保留 unknown，不抛错 */ }

export { build }
`
}

const expected = render(version)

if (checkOnly) {
  let current = ''
  try { current = readFileSync(target, 'utf8') } catch { /* 缺文件也走下面的同一句话 */ }
  const got = current.match(/export const version = '([^']+)'/)?.[1]
  if (current === expected) {
    console.log(`✓ lib/version.js 与 VERSION 一致（${version}）`)
    process.exit(0)
  }
  console.error(`✗ lib/version.js 过期：文件里是 ${got ?? '（缺失）'}，VERSION 是 ${version}。跑 node scripts/build-version.mjs`)
  process.exit(1)
}

writeFileSync(target, expected)
console.log(`已生成 lib/version.js（v${version}）`)