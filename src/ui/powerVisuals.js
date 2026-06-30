import * as THREE from 'three';
import { CLUBS } from '../clubs.js';
import { ballTexture } from '../entities/ball.js';

const POWER_KEYS = ['speed', 'kick', 'jump'];

function disposeObject(obj) {
  obj.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose?.();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) m?.dispose?.();
  });
}

function makeEnergyAura(color, size) {
  const group = new THREE.Group();
  group.userData.energyAura = true;

  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(size * 1.42, 24, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  aura.userData.auraBody = true;
  group.add(aura);

  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const r1 = new THREE.Mesh(new THREE.TorusGeometry(size * 1.42, size * 0.055, 8, 48), ringMat.clone());
  r1.rotation.x = Math.PI / 2;
  r1.userData.auraRing = 1;
  group.add(r1);

  const r2 = new THREE.Mesh(new THREE.TorusGeometry(size * 1.72, size * 0.038, 8, 48), ringMat.clone());
  r2.rotation.y = Math.PI / 2.7;
  r2.userData.auraRing = -1;
  group.add(r2);

  return group;
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
        new THREE.SphereGeometry(baseSize, 22, 22),
        new THREE.MeshBasicMaterial({ map: ballTexture(), color: cfg.ball })
      );
      ball.userData.powerBall = true;
      group.add(ball);

      if (count >= 3) {
        group.add(makeEnergyAura(cfg.ring, baseSize));
        const light = new THREE.PointLight(cfg.ring, 0.75, 2.8);
        light.userData.powerLight = true;
        group.add(light);
      }

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
    const scale = ready ? 1.12 : 1;
    const shadow = ready
      ? `0 0 8px ${cfg.ui}, 0 0 18px ${cfg.ui}, 0 0 30px ${cfg.ui}, inset 0 0 12px ${cfg.ui}`
      : count > 0
        ? `0 0 10px ${cfg.ui}99`
        : '0 0 4px #0008';
    const label = count === 0 ? '' : count < 3 ? `<span style="margin-left:3px;font-weight:900;font-size:clamp(10px,2vw,13px);text-shadow:0 2px 5px #000;">x${count}</span>` : '';
    const aura = ready ? `<span style="position:absolute;inset:-7px;border-radius:50%;border:2px solid ${cfg.ui};box-shadow:0 0 14px ${cfg.ui},0 0 28px ${cfg.ui};animation:hudspin 1.4s linear infinite,hudpulse .75s ease-in-out infinite;"></span>` : '';

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
    const t = performance.now() * 0.004;
    for (const group of player.orbit3.children) {
      if (!group.userData.powerVisual) continue;
      const count = group.userData.powerCount || 1;
      if (count >= 3) {
        const pulse = 1 + Math.sin(t * 2.2) * 0.09;
        group.scale.setScalar(pulse);
        group.traverse((child) => {
          if (child.userData.auraRing) child.rotation.z += child.userData.auraRing * 0.055;
          if (child.userData.auraBody && child.material) child.material.opacity = 0.17 + Math.sin(t * 2.8) * 0.07;
          if (child.userData.powerLight) child.intensity = 0.65 + Math.sin(t * 3.2) * 0.25;
        });
      } else {
        group.scale.setScalar(1);
      }
    }
  }
  requestAnimationFrame(animatePowerVisuals);
}

function tryInstall() {
  installPlayerOrbitPatch(window.__player);
  installHudPatch(window.__hud);
}

const timer = setInterval(() => {
  tryInstall();
  if (window.__player?.__powerVisualPatch && window.__hud?.__powerHudPatch) clearInterval(timer);
}, 50);
tryInstall();
animatePowerVisuals();
