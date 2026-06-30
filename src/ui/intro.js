import { playWhistle } from '../engine/audio.js';
import { invadedPortrait, savePortrait } from './introPortraits.js';

// Cutscene de diálogo: retrato + caixa de texto por toque/click; no fim, apito + "COMEÇA O DESAFIO!".
export function runIntro(lines, onDone) {
  const portraits = [invadedPortrait, savePortrait];

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;left:50%;bottom:7vh;transform:translateX(-50%);z-index:60;
    width:min(94vw,980px);display:flex;align-items:flex-end;justify-content:center;gap:clamp(8px,2vw,18px);
    pointer-events:auto;font-family:system-ui,sans-serif;color:#fff;opacity:0;transition:opacity .25s;`;

  const portraitBox = document.createElement('div');
  portraitBox.style.cssText = `width:clamp(120px,24vw,260px);height:clamp(150px,44vh,380px);
    display:flex;align-items:flex-end;justify-content:center;pointer-events:none;
    filter:drop-shadow(0 12px 24px #000a);`;

  const portrait = document.createElement('img');
  portrait.alt = 'G. Caldeira';
  portrait.style.cssText = `max-width:100%;max-height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none;`;
  portraitBox.appendChild(portrait);

  const box = document.createElement('div');
  box.style.cssText = `flex:1;max-width:min(68vw,620px);background:#071226bb;border:1px solid #ffffff66;
    border-radius:26px;padding:clamp(12px,2.3vh,18px) clamp(18px,4vw,30px) clamp(11px,2vh,15px);
    box-shadow:0 8px 28px #0008;backdrop-filter:blur(5px);`;

  const who = document.createElement('div');
  who.textContent = 'G. CALDEIRA';
  who.style.cssText = `margin-bottom:5px;color:#9dd0ff;font-weight:900;font-size:clamp(9px,1.8vw,12px);
    letter-spacing:.8px;text-shadow:0 2px 6px #000;`;

  const txt = document.createElement('div');
  txt.style.cssText = `font-size:clamp(13px,2.6vw,20px);font-weight:650;line-height:1.32;min-height:1.4em;text-shadow:0 2px 6px #0008;`;

  const prompt = document.createElement('div');
  prompt.textContent = 'TOCA PARA AVANÇAR';
  prompt.style.cssText = `margin-top:10px;text-align:right;font-size:clamp(10px,2vw,12px);letter-spacing:.8px;color:#9dd0ff;
    animation:hudpulse 1s ease-in-out infinite;`;

  box.appendChild(who); box.appendChild(txt); box.appendChild(prompt);
  wrap.appendChild(portraitBox); wrap.appendChild(box);
  document.body.appendChild(wrap);
  requestAnimationFrame(() => { wrap.style.opacity = '1'; });

  let i = 0;
  const show = () => {
    txt.style.opacity = '0';
    const p = portraits[i] || portraits[portraits.length - 1];
    portrait.src = p || '';
    portraitBox.style.display = p ? 'flex' : 'none';
    setTimeout(() => { txt.textContent = lines[i]; txt.style.transition = 'opacity .2s'; txt.style.opacity = '1'; }, 90);
  };
  show();

  const advance = () => {
    i++;
    if (i < lines.length) show();
    else finish();
  };

  const finish = () => {
    window.removeEventListener('keydown', onKey);
    wrap.removeEventListener('pointerdown', onTouch);
    wrap.style.opacity = '0';
    setTimeout(() => wrap.remove(), 250);
    playWhistle(); // apito do árbitro

    const go = document.createElement('div');
    go.textContent = 'COMEÇA O DESAFIO!';
    go.style.cssText = `position:fixed;left:50%;top:50%;width:100vw;height:40vh;z-index:60;display:flex;align-items:center;justify-content:center;
      font-family:system-ui,sans-serif;font-size:clamp(34px,8vw,64px);font-weight:900;letter-spacing:1px;color:#fff;
      text-shadow:0 6px 24px #000b,0 0 26px #2f9bff;pointer-events:none;
      opacity:0;transform:translate(-50%,-50%) scale(.6);transition:transform .5s cubic-bezier(.2,1.5,.4,1),opacity .4s;`;
    document.body.appendChild(go);
    requestAnimationFrame(() => { go.style.opacity = '1'; go.style.transform = 'translate(-50%,-50%) scale(1)'; });
    onDone && onDone();                  // começa o jogo (controlo) já com o "COMEÇA O DESAFIO!" no ecrã
    setTimeout(() => { go.style.opacity = '0'; }, 1500);
    setTimeout(() => go.remove(), 2000);
  };

  const onKey = (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    e.preventDefault();
    advance();
  };
  const onTouch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    advance();
  };
  wrap.addEventListener('pointerdown', onTouch);
  window.addEventListener('keydown', onKey);
}
