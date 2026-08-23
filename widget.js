/**
 * CallCatch widget — single <script> tag, no build step, no framework.
 *
 *   <script src="https://your-host/widget.js" data-client="protech"></script>
 *
 * Optional attributes:
 *   data-api="https://your-host"   API origin (defaults to the script's origin)
 *   data-color="#1f3864"           accent colour
 *   data-name="Pro-Tech"           header label
 *   data-greeting="..."            first message shown
 *   data-open="1"                  start open (used by the demo shim)
 *
 * Everything is scoped inside a shadow root so it cannot inherit or leak the
 * host site's CSS. That matters: these are 10-year-old WordPress themes.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var clientId = script.getAttribute('data-client');
  if (!clientId) return console.error('[astro-assistant] missing data-client');

  var api = script.getAttribute('data-api') || new URL(script.src).origin;
  var accent = script.getAttribute('data-color') || '#1f3864';
  var label = script.getAttribute('data-name') || 'Questions?';
  var greeting = script.getAttribute('data-greeting') ||
    'Hi! Ask me anything about our services, hours, or pricing — I can also have someone call you back.';
  var startOpen = script.getAttribute('data-open') === '1';

  var conversationId = null;
  var busy = false;

  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:0;right:0;z-index:2147483000;';
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML = [
    '<style>',
    ':host,*{box-sizing:border-box;}',
    '.wrap{font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    '  position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;align-items:flex-end;gap:10px;}',
    '.bubble{background:' + accent + ';color:#fff;border:none;border-radius:999px;padding:13px 20px;',
    '  font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.22);}',
    '.bubble:hover{filter:brightness(1.08);}',
    '.panel{display:none;flex-direction:column;width:360px;max-width:calc(100vw - 32px);height:480px;',
    '  max-height:calc(100vh - 120px);background:#fff;border-radius:14px;overflow:hidden;',
    '  box-shadow:0 18px 50px rgba(0,0,0,.28);}',
    '.panel.open{display:flex;}',
    '.head{background:' + accent + ';color:#fff;padding:12px 14px;font-weight:600;',
    '  display:flex;justify-content:space-between;align-items:center;}',
    '.head button{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;}',
    '.log{flex:1;overflow-y:auto;padding:14px;background:#f7f8fa;display:flex;flex-direction:column;gap:9px;}',
    '.msg{max-width:85%;padding:9px 12px;border-radius:13px;white-space:pre-wrap;word-wrap:break-word;}',
    '.bot{background:#fff;border:1px solid #e3e6ec;align-self:flex-start;border-bottom-left-radius:4px;}',
    '.me{background:' + accent + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}',
    '.dots{align-self:flex-start;color:#8b91a0;font-size:13px;padding:4px 12px;}',
    '.form{display:flex;gap:8px;padding:10px;border-top:1px solid #e6e8ee;background:#fff;}',
    '.form input{flex:1;border:1px solid #d5d9e0;border-radius:9px;padding:10px 11px;font:inherit;outline:none;}',
    '.form input:focus{border-color:' + accent + ';}',
    '.form button{background:' + accent + ';color:#fff;border:none;border-radius:9px;padding:0 15px;',
    '  font-weight:600;cursor:pointer;}',
    '.form button:disabled{opacity:.5;cursor:default;}',
    '.foot{font-size:10.5px;color:#9aa0ac;text-align:center;padding:0 0 7px;background:#fff;}',
    '</style>',
    '<div class="wrap">',
    '  <div class="panel" part="panel">',
    '    <div class="head"><span></span><button aria-label="Close">&times;</button></div>',
    '    <div class="log"></div>',
    '    <form class="form"><input type="text" placeholder="Type your question..." autocomplete="off">',
    '      <button type="submit">Send</button></form>',
    '    <div class="foot">Answers come from this business’s own information.</div>',
    '  </div>',
    '  <button class="bubble"></button>',
    '</div>',
  ].join('\n');

  var panel = root.querySelector('.panel');
  var log = root.querySelector('.log');
  var form = root.querySelector('.form');
  var input = root.querySelector('.form input');
  var send = root.querySelector('.form button');
  root.querySelector('.bubble').textContent = label;
  root.querySelector('.head span').textContent = label;

  function add(text, who) {
    var el = document.createElement('div');
    el.className = 'msg ' + (who === 'me' ? 'me' : 'bot');
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function open() {
    panel.classList.add('open');
    if (!log.children.length) add(greeting, 'bot');
    input.focus();
  }

  root.querySelector('.bubble').addEventListener('click', function () {
    panel.classList.contains('open') ? panel.classList.remove('open') : open();
  });
  root.querySelector('.head button').addEventListener('click', function () {
    panel.classList.remove('open');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;

    input.value = '';
    add(text, 'me');
    busy = true;
    send.disabled = true;

    var typing = document.createElement('div');
    typing.className = 'dots';
    typing.textContent = 'typing...';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    fetch(api + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId,
        conversationId: conversationId,
        message: text,
        pageUrl: location.href,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing.remove();
        if (data.conversationId) conversationId = data.conversationId;
        add(data.reply || "Sorry — something went wrong. Please give us a call.", 'bot');
      })
      .catch(function () {
        typing.remove();
        add("Sorry — I can't reach our system right now. Please give us a call.", 'bot');
      })
      .finally(function () {
        busy = false;
        send.disabled = false;
        input.focus();
      });
  });

  function mount() {
    document.body.appendChild(host);
    if (startOpen) setTimeout(open, 700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
