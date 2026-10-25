/* HTTP 层：public/ 静态文件 + 一条前缀路由挂到宿主。
 *
 * 三条规矩在这里说一次，别处不许再定一遍：
 * 1. 静态文件只在 public/ 内解析；`..` 一律拦掉，解析结果必须仍在根目录里（路径穿越）。
 * 2. 未知 /api/* 返回 JSON 404，不返回 HTML —— 前端按 JSON 解析，收到 HTML 的报错很难查。
 * 3. 只读演示库：M5 阶段界面读 public/demo-data.js（唯一源产物），服务端不写用户文件。
 */
import { createReadStream, statSync, existsSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

/** 把 URL 路径映射到 public/ 下的真实文件；不允许逃出目录。返回绝对路径或 null。 */
export function resolvePublic(urlPath) {
  const rel = decodeURIComponent(String(urlPath || '')).replace(/^\/+/, '')
  if (rel === '') return join(PUBLIC_DIR, 'index.html')
  if (rel.split('/').some((seg) => seg === '..' || seg === '.')) return null
  const abs = resolve(PUBLIC_DIR, rel)
  if (abs !== PUBLIC_DIR && !abs.startsWith(PUBLIC_DIR + sep)) return null
  return abs
}

export function servePublic(req, res, urlPath) {
  const abs = resolvePublic(urlPath)
  if (!abs || !existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
    return true
  }
  res.writeHead(200, {
    'content-type': MIME[extname(abs)] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(abs).pipe(res)
  return true
}
