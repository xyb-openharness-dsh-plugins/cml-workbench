/* 路由表：独立启动与 DSH 宿主两条链路共用同一份。
 * 不抽出来会出现两份实现——本地能开、装进 Desktop 就 404（家族里踩过）。
 * 这里只依赖 node 内置模块，**不许 import Schemastery**：独立启动时那个 peer 依赖不存在。
 */
export const API_PREFIX = '/api/cml-workbench'
export const UI_PREFIX = `${API_PREFIX}/ui`

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  })
  res.end(buf)
}

/** 建一个处理函数。serveUi 由调用方给（宿主传 servePublic，独立启动也传它）。 */
export function createApiHandler({ version, serveUi, failure }) {
  return function handler(req, res) {
    const url = new URL(req.url || '/', 'http://localhost')
    const path = url.pathname

    /* UI：挂在 /api/cml-workbench/ui/ 下；裸前缀重定向到带斜杠，否则相对路径会在宿主里解析错 */
    if (path === API_PREFIX + '/ui') {
      res.writeHead(302, { location: UI_PREFIX + '/' })
      res.end()
      return
    }
    if (path.startsWith(UI_PREFIX + '/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method_not_allowed' })
      return serveUi(req, res, path.slice(UI_PREFIX.length))
    }

    if (path === `${API_PREFIX}/health`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      if (failure) return sendJson(res, 503, { ok: false, error: 'datasource_unavailable', message: failure })
      return sendJson(res, 200, {
        ok: true,
        version,
        apiVersion: 'v1',
        /* M5 阶段：界面读 public/demo-data.js（唯一源产物），服务端不落用户数据。
           这里如实声明能力，不假装有持久化。 */
        capabilities: ['health', 'ui', 'demo-readonly'],
        storage: 'demo-readonly',
      })
    }

    if (path.startsWith(API_PREFIX + '/')) return sendJson(res, 404, { error: 'not_found', path })
    return sendJson(res, 404, { error: 'not_found', path })
  }
}
