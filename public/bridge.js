/* 宿主桥：把 iframe 内的业务事件转给 lib/client.js（外框）。
 *
 * 为什么单独一个文件而不塞进 app.js：app.js 是原型唯一实体，`scripts/build-public.mjs`
 * 每次原样复制它；桥只存在于装进 Desktop 的这一份，所以逻辑必须和原型分开，
 * 否则"本地原型"和"装机版"会变成两份行为不同的代码。
 *
 * 只做三件事，且都必须在 iframe 里才生效（window.parent === window 时直接返回）：
 * 1. 监听 app.js 派发的 cml:agent-draft → postMessage 给外框（只填草稿，不发送）；
 * 2. 收外框的 cml:agent-state → 更新页面顶栏的连接状态文字；
 * 3. 收外框的 cml:agent-toggle-result 之类的回执不做——页面不依赖回执。
 */
(function () {
  if (window.parent === window) return; // 本地直接打开原型：桥不介入

  document.addEventListener('cml:agent-draft', function (ev) {
    try {
      window.parent.postMessage({ type: 'cml:agent-draft', draft: ev.detail }, window.location.origin);
    } catch (e) { /* 外框收不到时提示词仍留在页面输入框里 */ }
  });

  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin) return; // 同源校验
    var d = ev.data || {};
    if (d.type !== 'cml:agent-state') return;
    /* 顶栏只有一颗 AI 入口：状态文字只写状态本身（标签「AI 对话」固定在外层按钮里），
       圆点随状态变色；页面依旧不自建聊天窗。 */
    var node = document.getElementById('connState');
    if (node) node.textContent = d.state || '未连接';
    var dot = document.getElementById('agentDot');
    if (dot) dot.className = 'dot' + (/未|错|断|离线/.test(String(d.state || '未连接')) ? ' grey' : '');
  });

  /* 告诉外框"页面已就绪"，外框据此把五态同步过来 */
  try {
    window.parent.postMessage({ type: 'cml:ui-ready' }, window.location.origin);
  } catch (e) { /* ignore */ }
})();
