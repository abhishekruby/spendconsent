// Injected into real pages: presentation cursor and privacy masks only.
export function installCursor() {
  // Apply credential masks before first paint, including HTML parsed after init.
  const privacy=document.createElement('style');
  privacy.textContent='input[type=email],input[type=password],input[autocomplete=username],input[autocomplete=one-time-code],input[readonly]{filter:blur(14px)!important}';
  const installPrivacy=()=>{if(document.documentElement && !privacy.isConnected)document.documentElement.append(privacy);};
  installPrivacy();
  new MutationObserver(installPrivacy).observe(document,{childList:true,subtree:true});
  const boot = () => {
    if (document.getElementById('film-cursor')) return;
    const css = document.createElement('style');
    css.textContent = `*{cursor:none!important} #film-cursor{position:fixed;left:0;top:0;width:23px;height:29px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px #0005);transform:translate(960px,540px)}
      .film-sensitive{filter:blur(14px)!important;user-select:none!important}
      input[type=email],input[type=password],input[readonly],a[href*="?approve="],a[href*="token="]{filter:blur(14px)!important}
      .film-ripple{position:fixed;width:48px;height:48px;margin:-24px;border:3px solid #d9481f;border-radius:50%;z-index:2147483646;pointer-events:none;animation:film-click .5s ease-out forwards}
      @keyframes film-click{from{transform:scale(.4);opacity:1}to{transform:scale(1.8);opacity:0}}`;
    document.documentElement.append(css);
    const pointer = document.createElement('div');
    pointer.id = 'film-cursor';
    pointer.innerHTML = '<svg width="23" height="29" viewBox="0 0 23 29"><path d="M2 2v23l6-7 5 10 4-2-5-10h9z" fill="#1a1714" stroke="#fffcf6" stroke-width="2"/></svg>';
    document.documentElement.append(pointer);
    let x = 960, y = 540;
    window.__filmMove = async (nx, ny, duration = 450) => {
      const animation = pointer.animate([{transform:`translate(${x}px,${y}px)`},
        {transform:`translate(${nx}px,${ny}px)`}], {duration, easing:'cubic-bezier(.2,.8,.2,1)', fill:'forwards'});
      await animation.finished;
      x = nx; y = ny;
    };
    window.__filmClick = () => {
      const ring = document.createElement('div'); ring.className = 'film-ripple';
      ring.style.left = `${x}px`; ring.style.top = `${y}px`;
      document.documentElement.append(ring); setTimeout(() => ring.remove(), 600);
    };
    let authAnnounced=false;
    const mask = () => {
      const authentication=[...document.querySelectorAll('input[type=password],input[autocomplete=username],input[autocomplete=one-time-code],input[name=login_email]')]
        .some(n=>n.getClientRects().length>0);
      if (authentication && !authAnnounced) window.__filmAuthDetected?.();
      authAnnounced=authentication;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const element = node.parentElement;
        if (!element || /^(SCRIPT|STYLE|INPUT|TEXTAREA)$/.test(element.tagName)
            || element.closest('#film-cursor,.film-sensitive')) continue;
        const text = node.textContent || '';
        if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)
            || /[?&](approve|token)=/.test(text)
            || /\b(?:[A-Z0-9]{17}|[A-Z0-9]{13})\b/.test(text)
            || /(?:ending in|••|\*\*)\s*\d{4}/i.test(text)
            || /\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(text)) element.classList.add('film-sensitive');
      }
    };
    mask();
    new MutationObserver(mask).observe(document.body, {childList:true,subtree:true,characterData:true,
      attributes:true,attributeFilter:['class','style','hidden','type']});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
}
