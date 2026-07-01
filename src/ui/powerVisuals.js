import * as THREE from 'three';
import { CLUBS } from '../clubs.js';
import { ballTexture } from '../entities/ball.js';
import blueSpecialPortrait from '../../assets/IMG_1807.png?url';
import greenSpecialPortrait from '../../assets/IMG_1809.png?url';

const POWER_KEYS = ['speed', 'kick', 'jump'];

function disposeObject(obj) {
  obj.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose?.();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) m?.dispose?.();
  });
}

function makeSimpleAura(color, size) {
  const group = new THREE.Group();
  group.userData.simpleAura = true;

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 1.45, size * 0.045, 6, 32), mat);
  ring.rotation.x = Math.PI / 2;
  ring.userData.simpleAuraRing = true;
  group.add(ring);

  return group;
}

function showSpecialPortraitCutscene({ id, portrait, text, color, glow }) {
  const old = document.getElementById(id);
  old?.remove();

  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = `position:fixed;inset:0;z-index:92;display:flex;align-items:center;justify-content:center;
    pointer-events:none;font-family:system-ui,sans-serif;overflow:hidden;`;

  el.innerHTML = `
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 48%, ${glow}38 0 24%, #06120a00 58%);"></div>
    <img src="${portrait}" style="position:absolute;right:clamp(12px,6vw,70px);bottom:0;
      max-height:min(82vh,560px);max-width:min(46vw,430px);object-fit:contain;
      filter:drop-shadow(0 12px 28px #000d) drop-shadow(0 0 22px ${glow}cc);
      transform:translateX(38px) scale(.88);opacity:0;transition:transform .28s cubic-bezier(.2,1.5,.4,1),opacity .18s;" />
    <div style="position:absolute;left:50%;top:48%;transform:translate(-50%,-50%) scale(.55);
      color:${color};font-size:clamp(34px,8vw,76px);font-weight:1000;letter-spacing:2px;text-align:center;
      text-shadow:0 7px 24px #000e,0 0 22px ${glow},0 0 42px ${glow};
      opacity:0;transition:transform .36s cubic-bezier(.2,1.7,.4,1),opacity .18s;">${text}</div>`;

  document.body.appendChild(el);
  const img = el.querySelector('img');
  const title = el.querySelector('div:last-child');
  requestAnimationFrame(() => {
    if (img) { img.style.opacity = '1'; img.style.transform = 'translateX(0) scale(1)'; }
    if (title) { title.style.opacity = '1'; title.style.transform = 'translate(-50%,-50%) scale(1)'; }
  });
  setTimeout(() => {
    if (img) { img.style.opacity = '0'; img.style.transform = 'translateX(28px) scale(.96)'; }
    if (title) title.style.opacity = '0';
  }, 1450);
  setTimeout(() => el.remove(), 1900);
}

function showBlueSpecialCutscene() {
  showSpecialPortraitCutscene({
    id: 'blueSpecialPortraitFx',
    portrait: blueSpecialPortrait,
    text: 'Super Caldeira',
    color: '#66b7ff',
    glow: '#2f7be0',
  });
}

function showGreenSpecialCutscene() {
  showSpecialPortraitCutscene({
    id: 'greenSpecialPortraitFx',
    portrait: greenSpecialPortrait,
    text: 'SIIIIIIIIIIII',
    color: '#6dff84',
    glow: '#27c24a',
  });
}

function installPlayerSpecialPatch(player) {
  if (!player || player.__specialPortraitPatch) return;
  player.__specialPortraitPatch = true;
  const oldActivateSpecial = player.activateSpecial.bind(player);
  player.activateSpecial = function patchedActivateSpecial(type) {
    const ok = oldActivateSpecial(type);
    if (!ok) return ok;
    if (type === 'speed') showBlueSpecialCutscene();
    if (type === 'jump') showGreenSpecialCutscene();
    return ok;
  };
}

function installPlayerOrbitPatch(player) {
  if (!player || player.__powerVisualPatch) return;
  player.__powerVisualPatch = true;

  player.refreshPowers = function refreshPowers() {
    this.powers = [];
    for (const key of POWER_KEYS) {
      const count = Math.max(0, Math.min(3, this.powerCounts[key] || 0));
      for (let i = 0; i < count; i++) this.powers.push(key);
    }

    while (this.orbit3.children.length) {
      const child = this.orbit3.children.pop();
      disposeObject(child);
      this.orbit3.remove(child);
    }

    const active = POWER_KEYS.filter((key) => (this.powerCounts[key] || 0) > 0);
    const n = active.length;

    active.forEach((key, i) => {
      const count = Math.max(1, Math.min(3, this.powerCounts[key] || 0));
      const cfg = CLUBS[key];
      const group = new THREE.Group();
      group.userData.powerVisual = true;
      group.userData.powerType = key;
      group.userData.powerCount = count;
      group.userData.powerColor = cfg.ring;

      const baseSize = count >= 3 ? 0.31 : count === 2 ? 0.235 : 0.18;
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(baseSize, 18, 18),
        new THREE.MeshBasicMaterial({ map: ballTexture(), color: cfg.ball })
      );
      ball.userData.powerBall = true;
      group.add(ball);

      if (count >= 3) group.add(makeSimpleAura(cfg.ring, baseSize));

      const a = (i / Math.max(n, 1)) * Math.PI * 2;
      const r = n === 1 ? 0.88 : n === 2 ? 0.98 : 1.12;
      group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      this.orbit3.add(group);
    });

    if (!active.length) {
      this.glow.intensity = 0;
      return;
    }
    const top = this.topClub || active[active.length - 1];
    this.glow.color.setHex(CLUBS[top].ring);
    this.glow.intensity = Math.min(this.glow.intensity, 0.45);
  };

  player.refreshPowers();
}

function renderHudPowers(hud, player) {
  if (!hud?.el?.powers || !player?.powerCounts) return;
  const sig = POWER_KEYS.map((key) => player.powerCounts[key] || 0).join('|');
  if (hud.__powerSig === sig) return;
  hud.__powerSig = sig;

  hud.el.powers.style.display = 'flex';
  hud.el.powers.style.alignItems = 'center';
  hud.el.powers.style.gap = 'clamp(6px, 1.2vw, 10px)';

  hud.el.powers.innerHTML = POWER_KEYS.map((key) => {
    const cfg = CLUBS[key];
    const count = Math.max(0, Math.min(3, player.powerCounts[key] || 0));
    const ready = count >= 3;
    const opacity = count > 0 ? 1 : 0.28;
    const scale = ready ? 1.08 : 1;
    const shadow = ready
      ? `0 0 8px ${cfg.ui}, 0 0 16px ${cfg.ui}`
      : count > 0
        ? `0 0 8px ${cfg.ui}99`
        : '0 0 4px #0008';
    const label = count === 0 ? '' : count < 3 ? `<span style="margin-left:3px;font-weight:900;font-size:clamp(10px,2vw,13px);text-shadow:0 2px 5px #000;">x${count}</span>` : '';
    const aura = ready ? `<span style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${cfg.ui};box-shadow:0 0 12px ${cfg.ui};animation:hudpulse .85s ease-in-out infinite;"></span>` : '';

    return `<div title="${cfg.power}" style="position:relative;display:flex;align-items:center;gap:2px;opacity:${opacity};transform:scale(${scale});">
      <div style="position:relative;width:clamp(25px,5vw,34px);height:clamp(25px,5vw,34px);border-radius:50%;
        background:radial-gradient(circle at 36% 28%, #ffffffdd 0 12%, ${cfg.ui} 38%, ${cfg.ui}99 70%, #101827 100%);
        border:2px solid ${ready ? '#fff' : '#ffffff88'};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;">
        ${aura}
        <img src="${cfg.emblem}" style="position:relative;width:70%;height:70%;object-fit:contain;filter:drop-shadow(0 1px 2px #000c);">
      </div>
      ${label}
    </div>`;
  }).join('');
}

function installHudPatch(hud) {
  if (!hud || hud.__powerHudPatch) return;
  hud.__powerHudPatch = true;
  const oldUpdate = hud.update.bind(hud);
  hud.update = function patchedUpdate(player, dt) {
    oldUpdate(player, dt);
    renderHudPowers(this, player);
  };
  if (window.__player) renderHudPowers(hud, window.__player);
}

function animatePowerVisuals() {
  const player = window.__player;
  if (player?.orbit3) {
    const t = performance.now() * 0.0035;
    for (const group of player.orbit3.children) {
      if (!group.userData.powerVisual) continue;
      const count = group.userData.powerCount || 1;
      if (count >= 3) {
        const pulse = 1 + Math.sin(t * 1.9) * 0.04;
        group.scale.setScalar(pulse);
        for (const child of group.children) {
          if (child.userData.simpleAura) {
            child.rotation.y += 0.018;
            child.rotation.z += 0.012;
          }
        }
      } else {
        group.scale.setScalar(1);
      }
    }
  }
  requestAnimationFrame(animatePowerVisuals);
}

function tryInstall() {
  installPlayerSpecialPatch(window.__player);
  installPlayerOrbitPatch(window.__player);
  installHudPatch(window.__hud);
}

const timer = setInterval(() => {
  tryInstall();
  if (window.__player?.__specialPortraitPatch && window.__player?.__powerVisualPatch && window.__hud?.__powerHudPatch) clearInterval(timer);
}, 50);
tryInstall();
animatePowerVisuals();
