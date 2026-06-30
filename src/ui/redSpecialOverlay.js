import redSpecialPortrait from '../../assets/IMG_1805.png?url';

let activeOverlay = null;

function showRedSpecialOverlay() {
  activeOverlay?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'redSpecialOverlay';
  wrap.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 88;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    transition: opacity .28s ease;
  `;

  const stage = document.createElement('div');
  stage.style.cssText = `
    position: relative;
    width: min(54vw, 520px);
    height: min(54vw, 520px);
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(.86);
    animation: redSpecialPop .25s ease-out forwards, redSpecialPulse .75s ease-in-out infinite alternate;
  `;

  const flareBack = document.createElement('div');
  flareBack.style.cssText = `
    position: absolute;
    inset: -8%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,70,55,.36) 0%, rgba(230,20,30,.16) 42%, rgba(255,0,0,0) 72%);
    filter: blur(8px);
  `;

  const flareA = document.createElement('div');
  flareA.style.cssText = `
    position: absolute;
    width: 108%;
    height: 108%;
    border-radius: 50%;
    border: 3px solid rgba(255,70,70,.70);
    box-shadow: 0 0 18px rgba(255,45,45,.92), 0 0 38px rgba(255,15,15,.65);
    animation: redSpecialSpin 1.8s linear infinite;
  `;

  const flareB = document.createElement('div');
  flareB.style.cssText = `
    position: absolute;
    width: 86%;
    height: 86%;
    border-radius: 50%;
    border-top: 3px solid rgba(255,180,160,.9);
    border-right: 2px solid rgba(255,50,50,.68);
    border-bottom: 2px solid rgba(255,0,0,.26);
    border-left: 2px solid rgba(255,0,0,.12);
    box-shadow: 0 0 16px rgba(255,50,50,.8);
    animation: redSpecialSpinReverse 1.15s linear infinite;
  `;

  const img = document.createElement('img');
  img.src = redSpecialPortrait;
  img.alt = '';
  img.style.cssText = `
    position: relative;
    width: 80%;
    height: 80%;
    object-fit: contain;
    opacity: .70;
    filter: drop-shadow(0 0 14px rgba(255,50,50,.9)) drop-shadow(0 0 32px rgba(255,0,0,.55));
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes redSpecialPop {
      from { transform: scale(.72); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes redSpecialPulse {
      from { transform: scale(1); }
      to { transform: scale(1.045); }
    }
    @keyframes redSpecialSpin {
      from { transform: rotate(0deg) scale(1); }
      to { transform: rotate(360deg) scale(1.04); }
    }
    @keyframes redSpecialSpinReverse {
      from { transform: rotate(360deg) scale(1); }
      to { transform: rotate(0deg) scale(1.05); }
    }
  `;

  stage.append(flareBack, flareA, flareB, img);
  wrap.append(stage, style);
  document.body.appendChild(wrap);
  activeOverlay = wrap;

  setTimeout(() => { wrap.style.opacity = '0'; }, 1200);
  setTimeout(() => {
    wrap.remove();
    if (activeOverlay === wrap) activeOverlay = null;
  }, 1500);
}

function patchRedSpecialCallout(node) {
  if (!node || node.nodeType !== 1) return;
  if ((node.textContent || '').trim() !== 'ESPECIAL VERMELHO') return;
  node.textContent = 'PÉ REMATADOR!';
  node.style.zIndex = '96';
  node.style.color = '#ff5161';
  node.style.textShadow = '0 6px 24px #000b, 0 0 30px #ff1028, 0 0 54px #d11a2a';
  showRedSpecialOverlay();
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) patchRedSpecialCallout(node);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
