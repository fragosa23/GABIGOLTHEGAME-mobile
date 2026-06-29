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
  constructor(scene, pos, type = 'braga') {
    this.type = type;
    const club = CLUBS[type];
    this.alive = true;
    this.group = new THREE.Group();
    this.group.position.copy(pos);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 24),
      new THREE.MeshToonMaterial({ map: ballTexture() })
    );
    ball.castShadow = true;
    addOutline(ball, 0.04);
    this.ball = ball;
    this.group.add(ball);

    // aura de cor consoante o poder
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 20, 20),
      new THREE.MeshBasicMaterial({
        color: club.ball, transparent: true, opacity: 0.32,
        side: THREE.BackSide,
      })
    );
    this.group.add(aura);
    this.aura = aura;

    this.baseY = pos.y;
    this.t = Math.random() * 6;
    scene.add(this.group);
    this.scene = scene;
  }

  update(dt, player) {
    if (!this.alive) return null;
    this.t += dt;
    this.ball.rotation.y += dt * 1.5;
    this.ball.rotation.x += dt * 0.6;
    this.group.position.y = this.baseY + Math.sin(this.t * 2) * 0.18;
    const s = 1 + Math.sin(this.t * 3) * 0.04;
    this.aura.scale.setScalar(s);

    // apanhar
    const d = this.group.position.distanceTo(player.position);
    if (d < 1.2) {
      this.collect();
      player.givePower(this.type);
      player.coins++;
      return this.type;
    }
    return null;
  }

  collect() {
    this.alive = false;
    this.scene.remove(this.group);
  }
}
