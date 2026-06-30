import { makeOptionsPanel } from './options.js';

export function installPauseButton({ isPlaying, pause, resume, goMenu }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '⏸';
  btn.setAttribute('aria-label', 'Pausa');
  btn.style.cssText = `position:fixed;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));
    z-index:180;display:none;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;
    width:clamp(34px,7vw,42px);height:clamp(34px,7vw,42px);font-family:system-ui,sans-serif;
    color:#e8f5ff;background:#07122688;border:1px solid #ffffff55;border-radius:50%;
    padding:0;font-size:clamp(15px,3.2vw,19px);font-weight:900;line-height:1;
    text-shadow:0 2px 6px #000;box-shadow:0 6px 18px #0006;opacity:.72;`;
  document.body.appendChild(btn);

  let overlay = null;

  const closeOverlay = () => {
    overlay?.remove();
    overlay = null;
  };

  const mkBtn = (label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `cursor:pointer;width:100%;font-size:clamp(14px,3vw,18px);font-weight:900;
      color:#e8f5ff;background:#0b1020;border:2px solid #ffffff88;border-radius:999px;
      padding:clamp(10px,2vh,14px) clamp(18px,5vw,32px);box-shadow:0 8px 22px #0007;`;
    return b;
  };

  const openOverlay = () => {
    closeOverlay();
    overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:140;display:flex;align-items:center;justify-content:center;
      background:#050913dd;backdrop-filter:blur(6px);font-family:system-ui,sans-serif;color:#fff;pointer-events:auto;`;

    const panel = document.createElement('div');
    panel.style.cssText = `width:min(84vw,390px);display:flex;flex-direction:column;gap:12px;background:#071226ee;
      border:2px solid #ffffff55;border-radius:18px;padding:clamp(16px,4vw,26px);box-shadow:0 16px 46px #000b;`;

    const title = document.createElement('div');
    title.textContent = 'PAUSE';
    title.style.cssText = `font-size:clamp(28px,7vw,46px);font-weight:900;text-align:center;letter-spacing:1px;margin-bottom:4px;`;

    const resumeBtn = mkBtn('CONTINUAR');
    const optionsBtn = mkBtn('OPÇÕES');
    const menuBtn = mkBtn('VOLTAR AO MENU');
    panel.append(title, resumeBtn, optionsBtn, menuBtn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    resumeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); closeOverlay(); resume(); });
    optionsBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); makeOptionsPanel({ title: 'OPÇÕES' }); });
    menuBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); goMenu(); });
  };

  const triggerPause = () => {
    if (!isPlaying()) return;
    pause();
    openOverlay();
  };

  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); triggerPause(); });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' && e.code !== 'KeyP') return;
    if (isPlaying()) { e.preventDefault(); triggerPause(); }
    else if (overlay) { e.preventDefault(); closeOverlay(); resume(); }
  });

  return {
    update(visible) { btn.style.display = visible ? 'flex' : 'none'; },
    close: closeOverlay,
  };
}
