import { CLUBS } from '../clubs.js';

// HUD em DOM por cima do canvas.
export class HUD {
  constructor() {
    const root = document.createElement('div');
    root.style.cssText = `position:fixed;inset:0;z-index:90;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;`;
    root.innerHTML = `
      <div style="position:absolute;top:16px;left:18px;text-shadow:0 2px 6px #0008;">
        <div style="font-weight:800;font-size:15px;letter-spacing:.5px;margin-bottom:4px;">HP</div>
        <div style="width:220px;height:18px;background:#0008;border:2px solid #fff6;border-radius:10px;overflow:hidden;">
          <div id="hpbar" style="height:100%;width:100%;background:linear-gradient(90deg,#37e06a,#9dff6a);transition:width .2s;"></div>
        </div>
        <div style="margin-top:8px;font-weight:700;font-size:16px;">⚽ <span id="coins">0</span> bolas</div>
        <div id="powers" style="display:flex;gap:6px;margin-top:8px;"></div>
      </div>

      <div id="cam" style="position:absolute;top:16px;right:18px;font-size:13px;font-weight:700;
        background:#0b1020aa;padding:6px 12px;border-radius:10px;opacity:0;transition:opacity .3s;">Câmara</div>

      <style>
        @keyframes hudspin { to { transform: rotate(360deg); } }
        @keyframes hudpulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
      </style>
      <div id="clubpop" style="position:absolute;top:32%;left:50%;transform:translate(-50%,-50%) scale(.6);
        display:flex;flex-direction:column;align-items:center;gap:14px;opacity:0;
        transition:transform .4s cubic-bezier(.2,1.5,.4,1),opacity .35s;">
        <div style="position:relative;width:210px;height:210px;display:flex;align-items:center;justify-content:center;">
          <div id="popbg" style="position:absolute;inset:0;border-radius:50%;animation:hudpulse 1s ease-in-out infinite;"></div>
          <div id="popring" style="position:absolute;inset:-8px;border-radius:50%;border:7px solid transparent;
            animation:hudspin 1.1s linear infinite;"></div>
          <img id="popemblem" style="position:relative;width:150px;height:150px;object-fit:contain;
            filter:drop-shadow(0 5px 14px #000b);" />
        </div>
        <div id="poplabel" style="font-size:46px;font-weight:900;letter-spacing:2px;color:#fff;
          text-shadow:0 4px 18px #000c, 0 0 14px currentColor;"></div>
      </div>

      <div id="msg" style="position:absolute;bottom:60px;left:50%;transform:translateX(-50%);
        background:#0b1020cc;border:2px solid #ffffff44;padding:12px 22px;border-radius:14px;
        font-size:18px;max-width:72vw;text-align:center;opacity:0;transition:opacity .3s;backdrop-filter:blur(4px);"></div>

      <div id="hint" style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);
        font-size:13px;opacity:.7;text-shadow:0 1px 3px #000;text-align:center;">
        Joystick mover · RUN correr · SALTAR · CHUTAR · arrasta à direita p/ rodar</div>

      <div id="banner" style="position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;
        flex-direction:column;background:#0b1020dd;backdrop-filter:blur(6px);text-align:center;
        padding:max(12px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));
        overflow:hidden;">
        <div id="bannerTitle" style="font-size:56px;font-weight:900;text-shadow:0 4px 18px #000a;"></div>
        <div id="bannerSub" style="font-size:20px;margin-top:8px;opacity:.9;"></div>
        <div id="bannerStats" style="margin-top:22px;display:flex;flex-direction:column;gap:12px;font-size:24px;font-weight:700;"></div>
        <button id="bannerBtn" style="display:none;pointer-events:auto;cursor:pointer;margin-top:28px;
          font-size:24px;font-weight:900;letter-spacing:2px;color:#fff;background:linear-gradient(180deg,#3aa0ff,#1f5fd0);
          border:3px solid #ffffffcc;border-radius:12px;padding:14px 40px;box-shadow:0 8px 26px #0009,0 0 22px #2f9bff88;">
          CONTINUAR</button>
      </div>`;
    document.body.appendChild(root);
    this.el = {
      status: root.firstElementChild,
      hpbar: root.querySelector('#hpbar'),
      coins: root.querySelector('#coins'),
      powers: root.querySelector('#powers'),
      cam: root.querySelector('#cam'),
      clubpop: root.querySelector('#clubpop'),
      bannerStats: root.querySelector('#bannerStats'),
      bannerBtn: root.querySelector('#bannerBtn'),
      popbg: root.querySelector('#popbg'),
      popring: root.querySelector('#popring'),
      popemblem: root.querySelector('#popemblem'),
      poplabel: root.querySelector('#poplabel'),
      msg: root.querySelector('#msg'),
      banner: root.querySelector('#banner'),
      bannerTitle: root.querySelector('#bannerTitle'),
      bannerSub: root.querySelector('#bannerSub'),
    };
    this._applyMobileScale(root);
    this._msgTimer = 0; this._popTimer = 0; this._camTimer = 0;
    this._lastPowers = -1;
    this.setGameplayVisible(false);
  }

  setGameplayVisible(visible) {
    if (this.el.status) this.el.status.style.display = visible ? 'block' : 'none';
  }

  _applyMobileScale(root) {
    const status = root.firstElementChild;
    if (status) {
      status.style.top = 'max(10px, env(safe-area-inset-top))';
      status.style.left = 'max(12px, env(safe-area-inset-left))';
      const hpLabel = status.children[0];
      const hpTrack = status.children[1];
      const coins = status.children[2];
      const powers = status.children[3];
      if (hpLabel) hpLabel.style.fontSize = 'clamp(11px, 2.1vw, 15px)';
      if (hpTrack) {
        hpTrack.style.width = 'clamp(130px, 25vw, 190px)';
        hpTrack.style.height = 'clamp(12px, 2.4vw, 16px)';
      }
      if (coins) {
        coins.style.marginTop = '5px';
        coins.style.fontSize = 'clamp(11px, 2.2vw, 15px)';
      }
      if (powers) {
        powers.style.gap = '5px';
        powers.style.marginTop = '5px';
      }
    }

    this.el.clubpop.style.top = '44%';
    this.el.clubpop.style.gap = 'clamp(6px, 1.7vh, 12px)';
    const popWrap = this.el.popbg.parentElement;
    if (popWrap) {
      popWrap.style.width = 'clamp(104px, 22vw, 170px)';
      popWrap.style.height = 'clamp(104px, 22vw, 170px)';
    }
    this.el.popring.style.inset = 'clamp(-6px, -.8vw, -3px)';
    this.el.popring.style.borderWidth = 'clamp(3px, .9vw, 6px)';
    this.el.popemblem.style.width = '72%';
    this.el.popemblem.style.height = '72%';
    this.el.poplabel.style.fontSize = 'clamp(20px, 5vw, 38px)';
    this.el.poplabel.style.letterSpacing = '.5px';

    this.el.msg.style.background = '#07122699';
    this.el.msg.style.border = '1px solid #ffffff66';
    this.el.msg.style.padding = 'clamp(7px, 1.5vh, 11px) clamp(12px, 3vw, 20px)';
    this.el.msg.style.borderRadius = '999px';
    this.el.msg.style.fontSize = 'clamp(12px, 2.6vw, 16px)';
    this.el.msg.style.maxWidth = '58vw';
    this.el.msg.style.backdropFilter = 'blur(3px)';

    const hint = root.querySelector('#hint');
    if (hint) {
      hint.style.fontSize = 'clamp(10px, 1.9vw, 12px)';
      hint.style.display = 'none';
    }

    this.el.bannerTitle.style.fontSize = 'clamp(30px, 8vw, 54px)';
    this.el.bannerSub.style.fontSize = 'clamp(14px, 3vw, 20px)';
    this.el.banner.style.justifyContent = 'center';
    this.el.bannerTitle.style.fontSize = 'clamp(24px, 6vw, 42px)';
    this.el.bannerTitle.style.lineHeight = '1';
    this.el.bannerSub.style.fontSize = 'clamp(11px, 2.4vw, 16px)';
    this.el.bannerSub.style.marginTop = '5px';
    this.el.bannerStats.style.marginTop = 'clamp(8px, 2vh, 14px)';
    this.el.bannerStats.style.gap = 'clamp(4px, 1.1vh, 7px)';
    this.el.bannerStats.style.fontSize = 'clamp(11px, 2.5vw, 16px)';
    this.el.bannerStats.style.maxHeight = '34vh';
    this.el.bannerStats.style.overflowY = 'auto';
    this.el.bannerStats.style.padding = '0 8px';
    this.el.bannerBtn.style.marginTop = 'clamp(10px, 2vh, 16px)';
    this.el.bannerBtn.style.fontSize = 'clamp(12px, 2.8vw, 18px)';
    this.el.bannerBtn.style.letterSpacing = '.5px';
    this.el.bannerBtn.style.borderWidth = '2px';
    this.el.bannerBtn.style.borderRadius = '10px';
    this.el.bannerBtn.style.padding = 'clamp(8px, 1.7vh, 12px) clamp(20px, 5vw, 34px)';
  }

  update(player, dt) {
    this.el.hpbar.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
    this.el.coins.textContent = player.coins;

    if (player.powerCount !== this._lastPowers) {
      this._lastPowers = player.powerCount;
      this.el.powers.innerHTML = player.powers.map((k) => {
        const c = CLUBS[k];
        return `<div title="${c.power}" style="width:clamp(28px,5.6vw,36px);height:clamp(28px,5.6vw,36px);border-radius:50%;
          background:radial-gradient(circle at 50% 40%, ${c.ui}, ${c.ui}88);border:2px solid #fff8;
          box-shadow:0 0 12px ${c.ui};display:flex;align-items:center;justify-content:center;">
          <img src="${c.emblem}" style="width:72%;height:72%;object-fit:contain;
          filter:drop-shadow(0 1px 2px #000a);"></div>`;
      }).join('');
    }

    if (this._msgTimer > 0) { this._msgTimer -= dt; if (this._msgTimer <= 0) this.el.msg.style.opacity = '0'; }
    if (this._popTimer > 0) {
      this._popTimer -= dt;
      if (this._popTimer <= 0) {
        this.el.clubpop.style.opacity = '0';
        this.el.clubpop.style.transform = 'translate(-50%,-50%) scale(.6)';
      }
    }
    if (this._camTimer > 0) { this._camTimer -= dt; if (this._camTimer <= 0) this.el.cam.style.opacity = '0'; }
  }

  // emblema animado com fundo da cor da bola + nome do PODER ganho
  clubPop(club) {
    const c = CLUBS[club];
    this.el.popemblem.src = c.emblem;
    this.el.poplabel.textContent = c.power;
    this.el.poplabel.style.color = c.ui;
    this.el.popbg.style.background = `radial-gradient(circle at 50% 42%, ${c.ui}, ${c.ui}66 60%, ${c.ui}00 72%)`;
    this.el.popring.style.borderTopColor = c.ui;
    this.el.popring.style.borderRightColor = c.ui + '55';
    // reflow para reiniciar a animação de entrada
    this.el.clubpop.style.transition = 'none';
    this.el.clubpop.style.transform = 'translate(-50%,-50%) scale(.4) rotate(-8deg)';
    this.el.clubpop.style.opacity = '0';
    void this.el.clubpop.offsetWidth;
    this.el.clubpop.style.transition = 'transform .45s cubic-bezier(.2,1.5,.4,1),opacity .35s';
    this.el.clubpop.style.transform = 'translate(-50%,-50%) scale(1) rotate(0deg)';
    this.el.clubpop.style.opacity = '1';
    this._popTimer = 1.8;
  }

  cameraLabel(name) {
    this.el.cam.textContent = '📷 ' + name;
    this.el.cam.style.opacity = '1';
    this._camTimer = 1.5;
  }

  message(text, dur = 5) {
    this.el.msg.textContent = text;
    this.el.msg.style.opacity = '.78';
    this._msgTimer = dur;
  }

  banner(title, sub) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    this.el.banner.style.display = 'flex';
  }
  hideBanner() { this.el.banner.style.display = 'none'; }

  // caixa de confirmação (ex.: "Queres desistir?") com SIM/NÃO
  confirm(text, onYes, onNo) {
    document.exitPointerLock?.();
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:22px;background:#0b1020cc;backdrop-filter:blur(5px);
      font-family:system-ui,sans-serif;color:#fff;`;
    const t = document.createElement('div');
    t.textContent = text; t.style.cssText = `font-size:42px;font-weight:900;text-shadow:0 4px 16px #000a;`;
    const row = document.createElement('div'); row.style.cssText = `display:flex;gap:20px;`;
    const mk = (label, bg) => { const b = document.createElement('button');
      b.textContent = label; b.style.cssText = `cursor:pointer;font-size:24px;font-weight:900;letter-spacing:2px;
        color:#fff;background:${bg};border:3px solid #ffffffcc;border-radius:12px;padding:12px 40px;
        box-shadow:0 8px 26px #0009;`; return b; };
    const yes = mk('SIM', 'linear-gradient(180deg,#ff5161,#d11a2a)');
    const no = mk('NÃO', 'linear-gradient(180deg,#3aa0ff,#1f5fd0)');
    row.append(no, yes); box.append(t, row); document.body.appendChild(box);
    const close = () => { window.removeEventListener('keydown', onKey); box.remove(); };
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'KeyN') { e.preventDefault(); close(); onNo && onNo(); }
      else if (e.code === 'KeyY' || e.code === 'KeyS') { e.preventDefault(); close(); onYes && onYes(); }
    };
    yes.onclick = () => { close(); onYes && onYes(); };
    no.onclick = () => { close(); onNo && onNo(); };
    window.addEventListener('keydown', onKey);
  }

  // ecrã final com score; onContinue chamado ao tocar/clicar CONTINUAR
  endScreen(title, stats, onContinue) {
    const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 100;
    const eP = pct(stats.enemiesKilled, stats.enemiesTotal);
    const bP = pct(stats.ballsCollected, stats.ballsTotal);
    const lvl = pct(stats.enemiesKilled + stats.ballsCollected, stats.enemiesTotal + stats.ballsTotal);
    const row = (icon, label, a, b, p) =>
      `<div>${icon} ${label}: <b>${a}/${b}</b> <span style="color:#7fd0ff;">(${p}%)</span>${p === 100 ? ' ✅' : ''}</div>`;
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = 'A LENDA CONTINUA!';
    this.el.bannerStats.innerHTML =
      row('💥', 'Inimigos destruídos', stats.enemiesKilled, stats.enemiesTotal, eP) +
      row('⚽', 'Bolas apanhadas', stats.ballsCollected, stats.ballsTotal, bP) +
      `<div style="margin-top:4px;font-size:clamp(14px,3vw,20px);">🏆 Nível: <b style="color:#9dff6a;">${lvl}%</b></div>` +
      (eP === 100 && bP === 100 ? `<div style="color:#ffd23c;font-size:clamp(12px,2.5vw,16px);">★ COMPLETO A 100%! ★</div>` : '');
    this.el.banner.style.display = 'flex';
    this.el.banner.style.pointerEvents = 'auto';
    this.el.bannerTitle.style.fontSize = 'clamp(24px, 6vw, 42px)';
    this.el.bannerStats.style.maxHeight = '34vh';
    this.el.bannerStats.style.overflowY = 'auto';
    this.el.bannerBtn.style.display = 'inline-block';
    this.el.bannerBtn.style.pointerEvents = 'auto';
    const go = () => { window.removeEventListener('keydown', onKey); onContinue && onContinue(); };
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); go(); } };
    this.el.bannerBtn.onclick = go;
    window.addEventListener('keydown', onKey);
  }
}
