import bgUrl from '../../assets/menu_bg.png?url';
import vidUrl from '../../assets/menu_bg.mp4?url';
import { resumeAudio, startMenuAmbience, stopMenuAmbience } from '../engine/audio.js';
import { requestMobileAppMode } from '../engine/appMode.js';

// Mobile menu: background first, then choices after the first touch.
export function showMenu(onStart) {
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;inset:0;z-index:50;background:#04060c;overflow:hidden;
    display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,sans-serif;
    opacity:0;transition:opacity .6s ease;`;

  const vid = document.createElement('video');
  vid.src = vidUrl; vid.poster = bgUrl;
  vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true;
  vid.setAttribute('muted', ''); vid.setAttribute('playsinline', '');
  vid.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;`;
  root.appendChild(vid); vid.play().catch(() => {});

  const grad = document.createElement('div');
  grad.style.cssText = `position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(to top,#000d 0%,#0008 20%,#0000 54%);`;
  root.appendChild(grad);

  const panel = document.createElement('div');
  panel.style.cssText = `position:relative;margin-bottom:max(7vh,24px);display:flex;flex-direction:column;
    align-items:center;gap:clamp(8px,2.1vh,14px);width:min(76vw,390px);`;

  const mkBtn = (label) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `pointer-events:auto;cursor:pointer;width:100%;font-size:clamp(13px,3vw,18px);
      font-weight:900;letter-spacing:.8px;color:#e8f5ff;background:#07122699;
      border:1px solid #ffffff66;border-radius:999px;padding:clamp(9px,2vh,13px) clamp(18px,5vw,32px);
      box-shadow:0 8px 28px #0008;text-shadow:0 2px 6px #000;
      transition:transform .15s,opacity .25s;opacity:0;transform:translateY(12px);display:none;`;
    b.onmouseenter = () => { b.style.transform = 'scale(1.04)'; };
    b.onmouseleave = () => { b.style.transform = 'scale(1)'; };
    return b;
  };

  const btnCareer = mkBtn('MODO CARREIRA');
  const btnTut = mkBtn('TUTORIAL');
  const hint = document.createElement('button');
  hint.type = 'button';
  hint.textContent = 'TOCA PARA AVANÇAR';
  hint.style.cssText = `pointer-events:auto;cursor:pointer;color:#e8f5ff;background:#07122699;
    border:1px solid #ffffff66;border-radius:999px;padding:clamp(9px,2vh,13px) clamp(18px,5vw,32px);
    font-size:clamp(13px,3vw,18px);font-weight:900;letter-spacing:.8px;text-shadow:0 2px 6px #000;
    box-shadow:0 8px 28px #0008;`;

  panel.append(btnCareer, btnTut, hint);
  root.appendChild(panel);
  document.body.appendChild(root);
  startMenuAmbience();
  requestAnimationFrame(() => { root.style.opacity = '1'; });

  let choicesVisible = false, started = false;

  const showChoices = async () => {
    await requestMobileAppMode();
    resumeAudio();
    startMenuAmbience();
    if (choicesVisible) return;
    choicesVisible = true;
    hint.style.display = 'none';
    for (const b of [btnCareer, btnTut]) {
      b.style.display = 'block';
      requestAnimationFrame(() => {
        b.style.opacity = '1';
        b.style.transform = 'translateY(0)';
      });
    }
  };

  const go = async (mode) => {
    if (started) return; started = true;
    await requestMobileAppMode();
    window.removeEventListener('keydown', onKey);
    stopMenuAmbience();
    root.style.pointerEvents = 'none'; root.style.opacity = '0';
    setTimeout(() => { root.remove(); onStart && onStart(mode); }, 650);
  };

  const onKey = (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!choicesVisible) showChoices();
      else go('career');
    } else if (e.code === 'KeyT' && choicesVisible) {
      go('tutorial');
    }
  };

  hint.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); showChoices(); });
  btnCareer.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); resumeAudio(); go('career'); });
  btnTut.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); resumeAudio(); go('tutorial'); });
  root.addEventListener('pointerdown', () => { requestMobileAppMode(); }, { passive: false });
  window.addEventListener('keydown', onKey);
}
