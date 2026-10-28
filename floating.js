// Resize the in-page studio without closing it or changing the Amazon window.
if (new URLSearchParams(location.search).get('surface') === 'overlay' && globalThis.chrome?.runtime?.id) {
  const tabId = Number(new URLSearchParams(location.search).get('tabId'));
  let drag, pending, timer;
  function flush() {
    clearTimeout(timer); timer = null;
    if (!pending) return;
    const message = pending; pending = null;
    chrome.runtime.sendMessage(message).catch(() => {});
  }
  function resize(width,height,corner) {
    pending = {type:'mmResizeOverlay',tabId,corner,bounds:{width:Math.max(360,width),height:Math.max(320,height)}};
    if (!timer) timer = setTimeout(flush,30);
  }
  for (const grip of document.querySelectorAll('.floating-corner')) {
    grip.addEventListener('pointerdown',e => {
      if(e.button!==0)return;
      e.preventDefault();grip.focus({preventScroll:true});grip.setPointerCapture(e.pointerId);
      drag={id:e.pointerId,x:e.screenX,y:e.screenY,width:innerWidth,height:innerHeight+34,corner:grip.dataset.corner};
      document.documentElement.classList.add('resizing');
    });
    grip.addEventListener('pointermove',e => {
      if(!drag || drag.id!==e.pointerId)return;
      resize(drag.width+(e.screenX-drag.x)*(drag.corner==='left'?-1:1),drag.height+e.screenY-drag.y,drag.corner);
    });
    const stop=()=>{drag=null;document.documentElement.classList.remove('resizing');flush();};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])grip.addEventListener(event,stop);
    grip.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();const step=e.shiftKey?40:10;
      const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;
      const dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
      resize(innerWidth+dx*(grip.dataset.corner==='left'?-1:1),innerHeight+34+dy,grip.dataset.corner);flush();
    });
  }
}
