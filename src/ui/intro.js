import { playWhistle } from '../engine/audio.js';

// Cutscene de diálogo: caixas de texto por toque/click; no fim, apito + "COMEÇA O DESAFIO!".
export function runIntro(lines, onDone) {
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:50%;bottom:9vh;transform:translateX(-50%);z-index:60;
    max-width:min(68vw,520px);background:linear-gradient(180deg,#0e1830dd,#0a1224dd);border:2px solid #3aa0ffbb;
    border-radius:14px;padding:clamp(14px,2.5vh,20px) clamp(18px,4vw,28px) clamp(12px,2vh,16px);
    box-shadow:0 10px 40px #000a,0 0 26px #2f9bff55;
    font-family:system-ui,sans-serif;color:#fff;opacity:0;transition:opacity .25s;`;

  const who = document.createElement('div');
  who.textContent = 'G. CALDEIRA';
  who.style.cssText = `position:absolute;top:-16px;left:22px;background:#1f5fd0;border:2px solid #fff;
    border-radius:8px;padding:2px 10px;font-weight:900;font-size:clamp(10px,2vw,13px);letter-spacing:.5px;box-shadow:0 4px 12px #0008;`;

  const txt = document.createElement('div');
  txt.style.cssText = `font-size:clamp(14px,3vw,21px);font-weight:600;line-height:1.32;min-height:1.4em;text-shadow:0 2px 6px #0008;`;

  const prompt = document.createElement('div');
  prompt.textContent = 'TOCA PARA AVANÇAR';
  prompt.style.cssText = `margin-top:10px;text-align:right;font-size:clamp(10px,2vw,12px);letter-spacing:.8px;color:#9dd0ff;
    animation:hudpulse 1s ease-in-out infinite;`;

  box.appendChild(who); box.appendChild(txt); box.appendChild(prompt);
  document.body.appendChild(box);
  requestAnimationFrame(() => { box.style.opacity = '1'; });

  let i = 0;
  const show = () => {
    txt.style.opacity = '0';
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
    box.removeEventListener('pointerdown', onTouch);
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 250);
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
  box.addEventListener('pointerdown', onTouch);
  window.addEventListener('keydown', onKey);
}
