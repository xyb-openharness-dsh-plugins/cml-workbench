/* 面板布局参数：DSH 分栏合同的唯一入参来源。
 * 客户端 register、host-contract 检查都读这一份；别处不许再写一遍 0.65（也别写补数 0.35）。
 *
 * 形态 customFrame=true：标准分栏下宿主只把 businessWidth 写成注册时的静态 CSS 变量，
 * 服务里没有 setBusinessWidth / togglePane，DOM 里也没有 splitter 节点——
 * 「可拖 + 可收起 + 顶栏开关」在那条路上不存在。所以走自定义外壳：
 * 宿主把原生会话节点作为 conversation prop 交给我们排版。
 *
 * businessSide=left：业务区在左、原生会话在最右（家族一致，用户明确要求过）。
 * businessWidth=0.65 与 AGENT_PANE.default=0.35 互补。
 */
export const PANEL = Object.freeze({
  businessSide: 'left',
  businessWidth: 0.65,
  customFrame: true,
  headerLayout: 'default',
})

/** 宿主允许的 businessWidth 区间（宿主强校验，越界直接抛错、插件激活失败）。 */
export const HOST_LIMITS = Object.freeze({ min: 0.25, max: 0.7 })

/** AI 会话面板宽度档位：拖动 / 键盘 / 预设共用这一份。 */
export const AGENT_PANE = Object.freeze({
  min: 0.25,
  max: 0.45,
  default: 0.35,
  step: 0.02,
})

/** 窄屏断点：低于它就改覆盖式抽屉，业务区不让位。 */
export const NARROW_BREAKPOINT = 760
export const DRAWER_MAX = 420

export function clampRatio(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return AGENT_PANE.default
  return Math.max(AGENT_PANE.min, Math.min(AGENT_PANE.max, n))
}
