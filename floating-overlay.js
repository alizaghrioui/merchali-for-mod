// Isolated content-script controller. Credentials stay inside the extension iframe.
(() => {
  if (globalThis.__mmOverlayLoaded) return;
  globalThis.__mmOverlayLoaded = true;
  let host, box, frame, saveTimer;
  async function send(message) {
    if (!chrome.runtime?.id) return;
    return await chrome.runtime.sendMessage(message);
  }
  const clamp = (n, low, high) => Math.max(Math.min(low, high), Math.min(high, n));
  function apply(width, height, left, top) {
    const margin = 8;
    width = clamp(width, 360, innerWidth - margin * 2);
    height = clamp(height, 320, innerHeight - margin * 2);
    left = clamp(left, margin, innerWidth - width - margin);
    top = clamp(top, margin, innerHeight - height - margin);
    Object.assign(box.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` });
  }
  async function open(tabId) {
    if (host) { host.hidden = false; return; }
    const { mmOverlaySize } = await chrome.storage.local.get('mmOverlaySize');
    if (host) { host.hidden = false; return; }
    host = document.createElement('div');
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      :host([hidden]){display:none!important}*{box-sizing:border-box}
      .studio{position:absolute;display:flex;flex-direction:column;pointer-events:auto;background:#090909;border:1px solid #414141;border-radius:12px;overflow:hidden;box-shadow:0 12px 55px #0009;color:#fff;font:12px system-ui,sans-serif}
      header{height:32px;flex:0 0 32px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;background:#171717;cursor:move;user-select:none;touch-action:none}
      header span{font-weight:600;letter-spacing:.3px}button{border:0;background:transparent;color:#ddd;font-size:22px;cursor:pointer;padding:0 6px}button:hover{color:#fff;background:#333;border-radius:4px}
      iframe{display:block;width:100%;flex:1;min-height:0;border:0;background:#090909}
    </style><section class="studio" role="dialog" aria-label="MERCHALI for MOD"><header><span>MERCHALI for MOD · v${chrome.runtime.getManifest().version}</span><button aria-label="Close studio" title="Close">×</button></header><iframe title="MERCHALI for MOD prompt studio" allow="clipboard-write"></iframe></section>`;
    box = root.querySelector('.studio'); frame = root.querySelector('iframe');
    const query = new URLSearchParams({ surface: 'overlay', tabId: String(tabId), origin: location.origin });
    frame.src = chrome.runtime.getURL(`panel.html?${query}`);
    document.documentElement.append(host);
    const width = mmOverlaySize?.width || 760, height = mmOverlaySize?.height || innerHeight - 32;
    apply(width, height, innerWidth - Math.min(width, innerWidth - 16) - 16, 16);
    root.querySelector('button').onclick = () => {
      host.hidden = true;
      send({ type: 'mmOverlayClose' }).catch(() => {});
    };
    const header = root.querySelector('header');
    let drag;
    header.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.button !== 0) return;
      e.preventDefault(); header.setPointerCapture(e.pointerId);
      const r = box.getBoundingClientRect(); drag = { x:e.clientX,y:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height };
    });
    header.addEventListener('pointermove', e => { if (drag) apply(drag.width,drag.height,drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y); });
    header.addEventListener('pointerup', () => { drag = null; });
    header.addEventListener('pointercancel', () => { drag = null; });
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'mmToggleOverlay') {
      if (host && !host.hidden) { host.hidden = true; respond({ok:true,visible:false}); }
      else open(message.tabId).then(() => respond({ok:true,visible:true}), () => respond({ok:false,visible:false}));
      return true;
    }
    if (message.type === 'mmOpenOverlay') {
      open(message.tabId).then(() => respond({ok:true}), () => respond({ok:false})); return true;
    }
    if (message.type === 'mmResizeOverlay' && box) {
      const r = box.getBoundingClientRect();
      const width = message.corner === 'left' ? clamp(message.bounds.width,360,r.right-8) : clamp(message.bounds.width,360,innerWidth-r.left-8);
      apply(width, Math.min(message.bounds.height,innerHeight-r.top-8), message.corner === 'left' ? r.right-width : r.left, r.top);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => { try { if (!chrome.runtime?.id) return; const r = box.getBoundingClientRect(); await chrome.storage.local.set({mmOverlaySize:{width:r.width,height:r.height}}); } catch (_) {} },200);
      respond({ok:true});
    }
  });
  addEventListener('resize', () => { if (box) { const r=box.getBoundingClientRect();apply(r.width,r.height,r.left,r.top); } });
  if (!globalThis.__mmOverlayActionInjection) {
    send({type:'mmOverlayReady'}).then(result => { if(result?.visible) return open(result.tabId); }).catch(()=>{});
  }
  delete globalThis.__mmOverlayActionInjection;
})();
