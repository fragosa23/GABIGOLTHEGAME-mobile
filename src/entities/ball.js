import * as THREE from 'three';
import { addOutline } from '../engine/toon.js';
import { CLUBS } from '../clubs.js';

// Textura de bola de futebol (branco com manchas pretas).
let _ballTex = null;
export function ballTexture() {
  if (_ballTex) return _ballTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#15151c';
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 14 + Math.random() * 10;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    for (let k = 1; k <= 5; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _ballTex = tex;
  return tex;
}

export class PowerBall {
  constructor(scene, pos, type = 'braga', opts = {}) {
    this.type = type;
    const club = CLUBS[type];
    this.alive = true;
    this.scene = scene;
    this.target = pos.clone();
    this.spawnFrom = opts.spawnFrom ? opts.spawnFrom.clone() : null;
    this.spawnPhase = this.spawnFrom ? 'charging' : 'idle';
    this.spawnT = 0;
    this.chargeTime = opts.chargeTime ?? 1.2;
    this.flightTime = opts.flightTime ?? 1.05;
    this.trailFade = 1;

    this.group = new THREE.Group();
    this.group.position.copy(this.spawnFrom || pos);
    this.group.scale.setScalar(this.spawnFrom ? 0.08 : 1);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 24),
      new THREE.MeshToonMaterial({ map: ballTexture(), transparent: true, opacity: this.spawnFrom ? 0 : 1 })
    );
    ball.castShadow = true;
    addOutline(ball, 0.04);
    this.ball = ball;
    this.group.add(ball);

    // aura de cor consoante o poder
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 20, 20),
      new THREE.MeshBasicMaterial({
        color: club.ball, transparent: true, opacity: this.spawnFrom ? 0 : 0.32,
        side: THREE.BackSide,
      })
    );
    this.group.add(aura);
    this.aura = aura;

    this.trail = null;
    this.trailMat = null;
    if (this.spawnFrom) {
      const geom = new THREE.BufferGeometry().setFromPoints([this.spawnFrom, this.spawnFrom]);
      this.trailMat = new THREE.LineBasicMaterial({ color: club.ball, transparent: true, opacity: 0, depthWrite: false });
      this.trail = new THREE.Line(geom, this.trailMat);
      scene.add(this.trail);
    }

    this.baseY = pos.y;
    this.t = Math.random() * 6;
    scene.add(this.group);
  }

  _setOpacity(opacity) {
    this.ball.material.opacity = opacity;
    this.aura.material.opacity = 0.32 * opacity;
  }

  _updateSpawn(dt) {
    if (this.spawnPhase === 'idle') return;
    this.spawnT += dt;

    if (this.spawnPhase === 'charging') {
      const k = Math.min(this.spawnT / this.chargeTime, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      this._setOpacity(ease);
      this.group.scale.setScalar(0.08 + ease * 0.92);
      this.group.rotation.y += dt * (2 + ease * 5);
      this.group.position.y = this.spawnFrom.y + Math.sin(performance.now() * 0.012) * 0.12;
      if (k >= 1) {
        this.spawnPhase = 'flying';
        this.spawnT = 0;
        if (this.trailMat) this.trailMat.opacity = 0.78;
      }
      return;
    }

    if (this.spawnPhase === 'flying') {
      const k = Math.min(this.spawnT / this.flightTime, 1);
      const ease = 1 - Math.pow(1 - k, 2);
      const p = new THREE.Vector3().lerpVectors(this.spawnFrom, this.target, ease);
      p.y += Math.sin(k * Math.PI) * 8.5;
      this.group.position.copy(p);
      this.group.rotation.x += dt * 9;
      this.group.rotation.z += dt * 6;
      if (this.trail) this.trail.geometry.setFromPoints([this.spawnFrom, p.clone()]);
      if (k >= 1) {
        this.group.position.copy(this.target);
        this.baseY = this.target.y;
        this.spawnPhase = 'idle';
        this.spawnT = 0;
      }
      return;
    }
  }

  update(dt, player) {
    if (!this.alive) return null;
    this.t += dt;
    this._updateSpawn(dt);

    this.ball.rotation.y += dt * 1.5;
    this.ball.rotation.x += dt * 0.6;

    if (this.spawnPhase === 'idle') {
      this.group.position.y = this.baseY + Math.sin(this.t * 2) * 0.18;
      if (this.trailMat && this.trailFade > 0) {
        this.trailFade -= dt * 0.55;
        this.trailMat.opacity = Math.max(0, this.trailFade) * 0.78;
      }
    }

    const s = 1 + Math.sin(this.t * 3) * 0.04;
    this.aura.scale.setScalar(s);

    // apanhar só depois de aterrar
    if (this.spawnPhase !== 'idle') return null;
    const d = this.group.position.distanceTo(player.position);
    if (d < 1.2) {
      this.collect();
      player.givePower(this.type);
      player.coins++;
      return { type: this.type, count: Math.max(1, Math.min(3, player.powerCounts?.[this.type] || 1)) };
    }
    return null;
  }

  collect() {
    this.alive = false;
    this.scene.remove(this.group);
    if (this.trail) this.scene.remove(this.trail);
  }
}
