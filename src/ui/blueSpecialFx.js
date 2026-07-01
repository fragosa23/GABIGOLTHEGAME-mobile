import * as THREE from 'three';
import { Enemy } from '../entities/enemy.js';

const BLUE = 0x2f7be0;
const BLUE_LIGHT = 0x66b7ff;
const trackedEnemies = new Set();

if (!Enemy.prototype.__blueRepulseTracker) {
  Enemy.prototype.__blueRepulseTracker = true;
  const oldUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function trackedUpdate(dt, player) {
    if (this.alive) trackedEnemies.add(this);
    return oldUpdate.call(this, dt, player);
  };
}

function cleanEnemies() {
  for (const e of trackedEnemies) {
    if (!e?.alive || !e.model?.parent) trackedEnemies.delete(e);
  }
}

function repulseEnemies(player, radius = 12, force = 13) {
  cleanEnemies();
  for (const e of trackedEnemies) {
    if (!e.alive || e.spawnPhase !== 'idle') continue;
    const dx = e.position.x - player.position.x;
    const dz = e.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (d <= 0.001 || d > radius) continue;

    const strength = 1 - d / radius;
    const nx = dx / d;
    const nz = dz / d;
    e.position.x += nx * (0.45 + strength * 0.55);
    e.position.z += nz * (0.45 + strength * 0.55);
    e.model.position.copy(e.position);
    e.kb?.set(nx * force * (0.45 + strength), 0, nz * force * (0.45 + strength));
    e.vy = Math.max(e.vy || 0, 4.5 + strength * 3.5);
    e.stun = Math.max(e.stun || 0, 0.55 + strength * 0.5);
  }
}

function spawnAuraRing(scene, player, delay = 0, vertical = false, radius = 7) {
  setTimeout(() => {
    if (!scene || !player || player.dead) return;

    const mat = new THREE.MeshBasicMaterial({
      color: vertical ? BLUE_LIGHT : BLUE,
      transparent: true,
      opacity: vertical ? 0.62 : 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.055, 8, 34), mat);
    if (!vertical) ring.rotation.x = Math.PI / 2;
    else ring.rotation.y = Math.PI / 2;
    scene.add(ring);

    const started = performance.now();
    const duration = vertical ? 620 : 760;
    const loop = () => {
      const k = Math.min((performance.now() - started) / duration, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      ring.position.set(player.position.x, player.position.y + (vertical ? 1.35 : 0.12), player.position.z);
      ring.scale.setScalar(1 + ease * radius);
      ring.material.opacity = (1 - k) * (vertical ? 0.62 : 0.78);
      ring.rotation.z += 0.022;
      if (k < 1) {
        requestAnimationFrame(loop);
        return;
      }
      scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    };
    repulseEnemies(player, 12 + radius * 0.5, 12);
    requestAnimationFrame(loop);
  }, delay);
}

function blueSpecialBurst(player) {
  const scene = window.__scene;
  if (!scene || !player) return;
  repulseEnemies(player, 16, 16);
  spawnAuraRing(scene, player, 0, false, 8.5);
  spawnAuraRing(scene, player, 120, true, 5.8);
  spawnAuraRing(scene, player, 310, false, 10.5);
  spawnAuraRing(scene, player, 520, true, 6.6);
  spawnAuraRing(scene, player, 760, false, 12.0);
}

function installBlueSpecialPatch(player) {
  if (!player || player.__blueSpecialFxPatch) return;
  player.__blueSpecialFxPatch = true;

  const oldActivateSpecial = player.activateSpecial.bind(player);
  player.activateSpecial = function patchedBlueActivateSpecial(type) {
    const hpBefore = this.hp;
    const ok = oldActivateSpecial(type);
    if (ok && type === 'speed') {
      // O especial azul deixa de curar tudo de uma vez: passa a regenerar durante o estado gigante.
      this.hp = Math.min(this.maxHp, hpBefore);
      this.invuln = 0;
      this.blueRegenT = Math.max(this.blueRegenT || 0, this.giantT || 20);
      blueSpecialBurst(this);
    }
    return ok;
  };

  const oldHit = player.hit.bind(player);
  player.hit = function patchedBlueShieldHit(enemyPos) {
    if (!this.dead && this.giantT > 0) return 'shield';
    return oldHit(enemyPos);
  };

  const oldPostUpdate = player._postUpdate.bind(player);
  player._postUpdate = function patchedBluePostUpdate(dt) {
    const r = oldPostUpdate(dt);
    if (!this.dead && this.giantT > 0) {
      this.maxHp = Math.max(this.maxHp, 180);
      this.hp = Math.min(this.maxHp, this.hp + dt * 10);
      if (this.shieldFx) {
        this.shieldFx.visible = true;
        this.shieldFx.scale.setScalar(1.12 + Math.sin(performance.now() * 0.007) * 0.035);
        this.shieldFx.material.color.setHex(BLUE_LIGHT);
        this.shieldFx.material.opacity = 0.24 + Math.sin(performance.now() * 0.01) * 0.06;
      }
    } else if (this.shieldFx) {
      this.shieldFx.scale.setScalar(1);
      this.shieldFx.material.color.setHex(BLUE_LIGHT);
    }
    return r;
  };
}

const timer = setInterval(() => {
  installBlueSpecialPatch(window.__player);
  if (window.__player?.__blueSpecialFxPatch) clearInterval(timer);
}, 50);
installBlueSpecialPatch(window.__player);
