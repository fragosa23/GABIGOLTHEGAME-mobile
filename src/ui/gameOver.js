export function showGameOver({ onRetry, onMenu } = {}) {
  document.getElementById('gameOverOverlay')?.remove();
  document.exitPointerLock?.();

  const overlay = document.createElement('div');
  overlay.id = 'gameOverOverlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:170;display:flex;align-items:center;justify-content:center;
    pointer-events:auto;background:radial-gradient(circle at 50% 40%, #6b000f66 0 22%, #050913f2 62%);
    backdrop-filter:blur(7px);font-family:system-ui,sans-serif;color:#fff;text-align:center;`;

  const panel = document.createElement('div');
  panel.style.cssText = `width:min(86vw,430px);display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2.2vh,16px);
    padding:clamp(18px,4vw,30px);border:2px solid #ff516188;border-radius:22px;
    background:linear-gradient(180deg,#220814e8,#070b17f0);box-shadow:0 20px 60px #000d,0 0 40px #d11a2a55;`;

  const title = document.createElement('div');
  title.textContent = 'GAME OVER';
  title.style.cssText = `font-size:clamp(36px,9vw,72px);font-weight:1000;line-height:.95;letter-spacing:2px;
    color:#ff5161;text-shadow:0 7px 24px #000,0 0 28px #d11a2a;`;

  const sub = document.createElement('div');
  sub.textContent = 'G. Caldeira foi derrotado.';
  sub.style.cssText = `font-size:clamp(13px,3vw,18px);font-weight:800;opacity:.9;margin-bottom:4px;`;

  const makeBtn = (label, bg) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `cursor:pointer;width:100%;pointer-events:auto;font-size:clamp(14px,3.2vw,20px);font-weight:1000;
      letter-spacing:1px;color:#fff;background:${bg};border:2px solid #ffffffcc;border-radius:999px;
      padding:clamp(10px,2vh,14px) clamp(20px,5vw,36px);box-shadow:0 10px 26px #0009;text-shadow:0 2px 6px #000;`;
    return b;
  };

  const retry = makeBtn('RETRY', 'linear-gradient(180deg,#ff5161,#b70718)');
  const menu = makeBtn('MENU PRINCIPAL', 'linear-gradient(180deg,#2b385a,#11182b)');
  retry.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onRetry && onRetry(); });
  menu.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onMenu && onMenu(); });

  panel.append(title, sub, retry, menu);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const onKey = (e) => {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') {
      e.preventDefault(); cleanup(); onRetry && onRetry();
    } else if (e.code === 'Escape' || e.code === 'KeyM') {
      e.preventDefault(); cleanup(); onMenu && onMenu();
    }
  };
  const cleanup = () => window.removeEventListener('keydown', onKey);
  window.addEventListener('keydown', onKey);
  return overlay;
}
