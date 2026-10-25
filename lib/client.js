/* 客户端入口：DSH Desktop 的面板外壳（customFrame=true）。
 *
 * 结构（家族统一）：
 * - 根节点**首个子元素必须是语义 <header>**，并用 `--dsh-frame-leading-clearance` 避让 macOS 窗口按钮；
 * - 业务界面是独立前端（public/），用 iframe 装进来：`/api/cml-workbench/ui/`；
 * - **原生会话节点始终挂载**，隐藏走 display，不卸载——卸载会丢输入框与草稿
 *   （宿主明确要求 "changing workbench content does not remount its input tree"）；
 * - 中间 splitter 可拖、可键盘（←/→ 步进，Home/End 到边界），区间来自 lib/layout.js；
 * - 窄于 760px 改覆盖式抽屉，业务区不让位，splitter 不出现；
 * - 无会话时业务面板照常可用，依赖会话的操作在按钮处引导，不阻断业务。
 *
 * 与 iframe 的联动（cml:* 消息族，同源校验）：
 * - 收 `cml:agent-draft` → 把提示词填进原生草稿（只填，不发送）；
 * - 收 `cml:ui-ready` → 把面板五态推给页面；
 * - 发 `cml:agent-state` → 页面顶栏显示连接状态。
 */
;(function () {
  if (!window.__ModuleLoader__) return // 静态检查脚本可能扫到这个文件，那时不该抛错

  window.__ModuleLoader__.load({
    id: "@xyb-community/cml-workbench",
    factory(require) {
      const React = require('react')
      const h = React.createElement

      const TITLE = '小粒宝 GranPal · 慢性粒细胞白血病工作台'
      const DESCRIPTION = 'CML 患者与照护者的本机病程资料工作台：BCR::ABL1 国际标尺分子线、TKI 服药与换线档案、副作用日志、TFR 停药尝试旅程、用药费用记录'
      const API_BASE = '/api/cml-workbench'
      const UI_ENTRY = `${API_BASE}/ui/`

      /* 面板参数（lib/layout.js 的唯一来源；这里不写第二份数字） */
      const BUSINESS_SIDE = 'left'
      const BUSINESS_WIDTH = 0.65
      const AGENT_MIN = 0.25, AGENT_MAX = 0.45, AGENT_DEFAULT = 0.35, AGENT_STEP = 0.02
      const NARROW_BELOW = 760, DRAWER_MAX = 420
      const WIDTH_KEY = 'granpal.panelWidth'

      const clampRatio = (v) => {
        const n = Number(v)
        if (!Number.isFinite(n)) return AGENT_DEFAULT
        return Math.max(AGENT_MIN, Math.min(AGENT_MAX, n))
      }
      const loadWidth = () => {
        try { return clampRatio(localStorage.getItem(WIDTH_KEY)) } catch { return AGENT_DEFAULT }
      }
      const saveWidth = (v) => {
        try { localStorage.setItem(WIDTH_KEY, String(v)) } catch { /* 隐私模式下写不进去，不挡使用 */ }
      }

      function Panel({ conversation }) {
        const [generation, setGeneration] = React.useState(0)
        const [broken, setBroken] = React.useState(false)
        const [note, setNote] = React.useState('')
        const [percent, setPercent] = React.useState(loadWidth)
        const [paneOpen, setPaneOpen] = React.useState(true)
        const [narrow, setNarrow] = React.useState(false)
        const [dragging, setDragging] = React.useState(false)

        const shellRef = React.useRef(null)
        const frameRef = React.useRef(null)
        const brokenTimer = React.useRef(null)
        const hasConversation = Boolean(conversation)

        /* 8 秒内没 onLoad 就当没起来：宁可给可重试的提示，也不留一块白板 */
        React.useEffect(() => {
          setBroken(false)
          brokenTimer.current = setTimeout(() => setBroken(true), 8000)
          return () => clearTimeout(brokenTimer.current)
        }, [generation])

        /* 窄屏判定用**容器宽度**，不是窗口宽度：宿主主区宽度 ≠ 窗口宽度 */
        React.useEffect(() => {
          const host = shellRef.current
          if (!host || typeof ResizeObserver !== 'function') return undefined
          const observer = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect?.width ?? 0
            setNarrow(w > 0 && w < NARROW_BELOW)
          })
          observer.observe(host)
          return () => observer.disconnect()
        }, [])

        /* 把五态推给页面顶栏 */
        const postStateToPage = React.useCallback((state) => {
          const frame = frameRef.current
          if (!frame?.contentWindow) return
          try {
            frame.contentWindow.postMessage({ type: 'cml:agent-state', state }, window.location.origin)
          } catch { /* 页面还没就绪，下次消息再说 */ }
        }, [])

        /* 收页面消息：cml:agent-draft 只填草稿不发送；cml:ui-ready 回推状态 */
        React.useEffect(() => {
          const onMessage = (ev) => {
            if (ev.origin !== window.location.origin) return
            const frame = frameRef.current
            if (!frame?.contentWindow || ev.source !== frame.contentWindow) return
            const d = ev.data || {}
            if (d.type === 'cml:ui-ready') {
              postStateToPage(hasConversation ? '已连接' : '未连接 · 新建会话后可对话')
            }
            if (d.type === 'cml:agent-draft') {
              /* 只把提示词填进原生草稿，不自动发送（家族红线：AI 不代发、不代下结论）。
                 宿主没有暴露写入草稿的能力时，如实提示"请手动复制"，不假装已填。 */
              const prompt = String(d.draft?.prompt || '')
              setNote(prompt
                ? '业务页已生成提示词：请粘贴到会话输入框再发送（工作台不代发）。'
                : '业务页没有生成提示词。')
            }
          }
          window.addEventListener('message', onMessage)
          return () => window.removeEventListener('message', onMessage)
        }, [hasConversation, postStateToPage])

        /* ---------------- splitter：拖动 ---------------- */
        const onSplitterPointerDown = (ev) => {
          const host = shellRef.current
          if (!host) return
          ev.preventDefault()
          setDragging(true)
          const rect = host.getBoundingClientRect()
          const move = (e) => {
            /* 按容器 rect 夹取，不按 window.innerWidth */
            const ratio = 1 - (e.clientX - rect.left) / rect.width
            setPercent(clampRatio(ratio))
          }
          const up = () => {
            setDragging(false)
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }
        React.useEffect(() => { saveWidth(percent) }, [percent])

        const onSplitterKeyDown = (ev) => {
          if (ev.key === 'ArrowLeft') { ev.preventDefault(); setPercent((v) => clampRatio(v + AGENT_STEP)) }
          else if (ev.key === 'ArrowRight') { ev.preventDefault(); setPercent((v) => clampRatio(v - AGENT_STEP)) }
          else if (ev.key === 'Home') { ev.preventDefault(); setPercent(AGENT_MAX) }
          else if (ev.key === 'End') { ev.preventDefault(); setPercent(AGENT_MIN) }
        }

        const headerStyle = {
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '8px 16px', paddingInlineStart: 'calc(16px + var(--dsh-frame-leading-clearance, 0px))',
          borderBottom: '1px solid var(--wb-line, #dce7df)', background: 'var(--wb-surface, #fff)',
          font: '14px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        }
        const bodyStyle = { position: 'relative', flex: 1, display: 'flex', minHeight: 0 }
        const businessStyle = { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }
        const frameStyle = { flex: 1, width: '100%', height: '100%', border: 0, display: 'block', background: '#f7faf8' }
        const paneStyle = {
          position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0,
          borderInlineStart: '1px solid var(--wb-line, #dce7df)', background: 'var(--wb-surface, #fff)',
          overflow: 'hidden',
        }
        const drawerStyle = {
          position: 'absolute', insetBlock: 0, insetInlineEnd: 0, zIndex: 30,
          boxShadow: '-8px 0 24px rgba(0,0,0,.18)',
        }
        const splitterStyle = {
          width: 6, cursor: 'col-resize', background: dragging ? '#22664e' : 'transparent',
          border: 0, padding: 0, touchAction: 'none',
        }
        const stateLabel = !hasConversation ? '未连接 · 先新建会话'
          : paneOpen ? '已连接 · 收起不影响会话' : '已连接 · 会话已收起'

        return h('div', {
          ref: shellRef,
          style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--wb-paper, #f7faf8)' },
        },
          /* 根节点首个子元素：语义 header（合同硬约束） */
          h('header', { style: headerStyle },
            h('strong', { style: { fontSize: 15 } }, '小粒宝 GranPal'),
            h('span', { style: { color: '#596c62' } }, '慢性粒细胞白血病工作台'),
            h('span', { style: { color: '#22664e', fontWeight: 600 }, 'aria-live': 'polite' }, stateLabel),
            h('span', { style: { flex: 1 } }),
            h('button', {
              type: 'button',
              'aria-pressed': paneOpen,
              onClick: () => { setPaneOpen((v) => { postStateToPage(v ? '已收起' : '已展开'); return !v }) },
              style: { minHeight: 32, minWidth: 44, cursor: 'pointer', borderRadius: 999, border: '1px solid #dce7df', background: '#fff', padding: '4px 12px' },
            }, paneOpen ? '收起 AI 对话' : '打开 AI 对话'),
            h('button', {
              type: 'button',
              onClick: () => setGeneration((g) => g + 1),
              style: { minHeight: 32, minWidth: 44, cursor: 'pointer', borderRadius: 999, border: '1px solid #dce7df', background: '#fff', padding: '4px 12px' },
            }, '重新加载界面')),

          note ? h('p', {
            role: 'status',
            style: { margin: 0, padding: '6px 16px', background: '#faf2d8', color: '#5a4a1a', fontSize: 13 },
          }, note) : null,

          h('div', { style: bodyStyle },
            h('div', { style: businessStyle },
              broken
                ? h('div', { style: { padding: 24, font: '14px/1.6 sans-serif' } },
                    h('p', null, '界面没有加载出来。'),
                    h('button', { type: 'button', onClick: () => setGeneration((g) => g + 1) }, '重试'))
                : h('iframe', {
                    key: generation,
                    ref: frameRef,
                    src: UI_ENTRY,
                    title: TITLE,
                    style: frameStyle,
                    sandbox: 'allow-scripts allow-same-origin allow-forms',
                    onLoad: () => { setBroken(false); clearTimeout(brokenTimer.current) },
                  })),
            /* 原生会话始终挂载：隐藏走 display，不卸载 */
            h('aside', {
              style: {
                ...paneStyle,
                ...(narrow ? drawerStyle : null),
                width: narrow ? `min(92%, ${DRAWER_MAX}px)` : `${percent * 100}%`,
                display: paneOpen ? 'flex' : 'none',
              },
              'aria-label': 'AI 对话',
              'aria-hidden': paneOpen ? undefined : 'true',
            }, conversation ?? h('div', { style: { padding: 20, font: '14px/1.6 sans-serif', color: '#596c62' } },
              h('b', null, 'AI 对话还没开始'),
              h('span', null, '点顶栏「AI 对话」调起 DSH 原生会话后，它会固定出现在这一侧。'),
              h('span', null, '没有会话也不影响记录：左侧的分子线、服药线、副作用日志照常可用。'))),
            !narrow && paneOpen && h('div', {
              role: 'separator',
              'aria-orientation': 'vertical',
              'aria-label': '调整 AI 对话面板宽度',
              'aria-valuemin': Math.round(AGENT_MIN * 100),
              'aria-valuemax': Math.round(AGENT_MAX * 100),
              'aria-valuenow': Math.round(percent * 100),
              tabIndex: 0,
              style: splitterStyle,
              onPointerDown: onSplitterPointerDown,
              onKeyDown: onSplitterKeyDown,
            })))
      }

      function apply(ctx) {
        ctx.effect(() => ctx.desktopWorkbenches.register({
          title: TITLE,
          panelTitle: '小粒宝 GranPal',
          /* 仓库地址写**字面量**而不是常量：社区静态检查与宿主 repositoryIdentity()
             都从描述符里逐字读，用常量会在静态检查里"看不见"（实测报 Canonical repository required）。 */
          repository: 'https://github.com/xyb-openharness-dsh-plugins/cml-workbench',
          description: DESCRIPTION,
          businessSide: BUSINESS_SIDE,
          businessWidth: BUSINESS_WIDTH,
          customFrame: true,
        }, Panel))
      }

      return { apply, inject: ['desktopWorkbenches'] }
    },
  })
})()
