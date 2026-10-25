/**
 * 包的入口：DSH 插件的服务端侧。宿主加载的就是这个文件，需要
 * `name` / `inject` / `Config` / `apply` 四样（workbench-standard §3.4）。
 *
 * 这一层只做四件事：
 * 1. 过宿主鉴权（connection.requestRejection），不自己造登录；
 * 2. 把请求交给 dsh/routes.js 那张**两条链路共用**的路由表；
 * 3. UI 走 iframe：业务界面（public/，11 个一级页）是一份独立前端，
 *    宿主只负责把它放进面板业务区，面板是 customFrame=true（见 lib/client.js）；
 * 4. 卸载时按序解绑。
 *
 * 数据源去向：M5 阶段界面读 public/demo-data.js（demo/build-demo-data.mjs 的唯一源产物），
 * 服务端只读、不落用户文件。M3/M4 接 schema 与真实库时从这里换数据源，
 * 界面与路由表不用动（路由表已按"有 source / 无 source"两种形态写好）。
 */
import Schema from '@deepseek-ai/schemastery'
import { createApiHandler, API_PREFIX, UI_PREFIX } from './routes.js'
import { servePublic } from './server.js'
import { version, build } from '../lib/version.js'

export const name = 'cml-workbench-main'
export const inject = ['webServer', 'connection']

export { API_PREFIX, UI_PREFIX }

/** Config 必须是 Schemastery schema；root 可选——配了就记下资料目录，没配就是演示态。 */
export const Config = Schema.object({
  root: Schema.string(),
})

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  })
  res.end(buf)
}

export function apply(ctx, config = {}) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')

  const workspace = config.root ?? null
  const api = createApiHandler({
    version,
    serveUi: (req, res, urlPath) => servePublic(req, res, urlPath),
    failure: null,
  })

  const handler = (req, res) => {
    // 鉴权：宿主不给结论就不放行，不自建登录态
    if (typeof ctx.connection?.requestRejection !== 'function') {
      return sendJson(res, 503, { error: 'connection authentication capability unavailable' })
    }
    const rejection = ctx.connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { error: 'Authentication required' })
    return api(req, res)
  }

  ctx.effect(() => {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler })
    return () => {
      try { dispose && dispose() } catch { /* 卸载清理失败不该盖住原错误 */ }
    }
  }, `cml-workbench ui + api (${version}/${build}${workspace ? ' · root=' + workspace : ' · demo'})`)
}
