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
 *   data-theme="dark"              dark panel (default light — client sites are light)
 *   data-accent-ink="#0F1412"      text colour on the accent; override for a pale accent
 *
 * On a pale accent (lime, yellow) white text is unreadable — #B8F03A with white
 * is 1.35:1. data-theme="dark" flips accent text to near-black, which is 14:1.
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

  // Light is the default and must stay byte-identical: client sites are light,
  // and /demo/:clientId renders the prospect's own homepage around this widget.
  var dark = script.getAttribute('data-theme') === 'dark';
  var accentInk = script.getAttribute('data-accent-ink') || (dark ? '#0F1412' : '#fff');
  // botInk/inputSkin/placeholder stay EMPTY in light so the light CSS is
  // byte-identical to before this attribute existed — .bot and the input kept
  // inheriting, and a client page that sets its own text colour still wins.
  var t = dark
    ? { panel: '#151B18', logBg: '#0F1412', botBg: '#1B2320', botLine: '#26302B',
        formBg: '#151B18', formLine: '#26302B', inputLine: '#26302B',
        dots: '#9AA69F', foot: '#9AA69F',
        brand: '#6E7B74', brandHover: '#9AA69F',
        botInk: 'color:#E9EEE7;',
        inputSkin: 'background:#0F1412;color:#E9EEE7;',
        placeholder: '.form input::placeholder{color:#6E7B74;}' }
    : { panel: '#fff', logBg: '#f7f8fa', botBg: '#fff', botLine: '#e3e6ec',
        formBg: '#fff', formLine: '#e6e8ee', inputLine: '#d5d9e0',
        dots: '#8b91a0', foot: '#9aa0ac',
        brand: '#b3b8c2', brandHover: '#7d8494',
        botInk: '', inputSkin: '', placeholder: '' };

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
    '.bubble{background:' + accent + ';color:' + accentInk + ';border:none;border-radius:999px;padding:13px 20px;',
    '  font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.22);}',
    '.bubble:hover{filter:brightness(1.08);}',
    '.panel{display:none;flex-direction:column;width:360px;max-width:calc(100vw - 32px);height:480px;',
    '  max-height:calc(100vh - 120px);background:' + t.panel + ';border-radius:14px;overflow:hidden;',
    '  box-shadow:0 18px 50px rgba(0,0,0,.28);}',
    '.panel.open{display:flex;}',
    '.head{background:' + accent + ';color:' + accentInk + ';padding:12px 14px;font-weight:600;',
    '  display:flex;justify-content:space-between;align-items:center;}',
    '.head button{background:none;border:none;color:' + accentInk + ';font-size:20px;cursor:pointer;line-height:1;}',
    '.log{flex:1;overflow-y:auto;padding:14px;background:' + t.logBg + ';display:flex;flex-direction:column;gap:9px;}',
    '.msg{max-width:85%;padding:9px 12px;border-radius:13px;white-space:pre-wrap;word-wrap:break-word;}',
    '.bot{background:' + t.botBg + ';border:1px solid ' + t.botLine + ';' + t.botInk + 'align-self:flex-start;border-bottom-left-radius:4px;}',
    '.me{background:' + accent + ';color:' + accentInk + ';align-self:flex-end;border-bottom-right-radius:4px;}',
    '.dots{align-self:flex-start;color:' + t.dots + ';font-size:13px;padding:4px 12px;}',
    '.form{display:flex;gap:8px;padding:10px;border-top:1px solid ' + t.formLine + ';background:' + t.formBg + ';}',
    // 16px input font is load-bearing: below that, iOS zooms the page on focus.
    '.form input{flex:1;border:1px solid ' + t.inputLine + ';border-radius:9px;padding:10px 11px;font:inherit;font-size:16px;outline:none;' + t.inputSkin + '}',
    t.placeholder,
    '.form input:focus{border-color:' + accent + ';}',
    '.form button{background:' + accent + ';color:' + accentInk + ';border:none;border-radius:9px;padding:0 15px;',
    '  font-weight:600;cursor:pointer;}',
    '.form button:disabled{opacity:.5;cursor:default;}',
    '.foot{font-size:10.5px;color:' + t.foot + ';text-align:center;padding:0 0 7px;background:' + t.panel + ';}',
    '.brand{font-size:10px;text-align:center;padding:0 0 8px;background:' + t.panel + ';letter-spacing:.2px;}',
    '.brand a{color:' + t.brand + ';text-decoration:none;}',
    '.brand a:hover{color:' + t.brandHover + ';text-decoration:underline;}',
    '@media (max-width:480px){',
    '  .wrap{left:12px;right:12px;bottom:12px;align-items:stretch;}',
    '  .panel{width:100%;height:calc(100dvh - 110px);max-height:560px;}',
    '  .bubble{align-self:flex-end;}',
    '}',
    '</style>',
    '<div class="wrap">',
    '  <div class="panel" part="panel">',
    '    <div class="head"><span></span><button aria-label="Close">&times;</button></div>',
    '    <div class="log"></div>',
    '    <form class="form"><input type="text" placeholder="Type your question..." autocomplete="off">',
    '      <button type="submit">Send</button></form>',
    '    <div class="foot">Answers come from this business’s own information.</div>',
    '    <div class="brand"><a href="https://rogueriverlabs.dev/" target="_blank" rel="noopener">Powered by Rogue River Labs</a></div>',
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
