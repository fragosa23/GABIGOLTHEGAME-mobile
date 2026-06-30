import * as THREE from 'three';
import { buildPlayerSkeleton } from '../character/skeleton.js';
import { addPart, toon } from '../character/utils.js';

const EGRAV = -28;
const HP_DOT_GEO = new THREE.SphereGeometry(0.045, 10, 10);
const HP_DOT_MAT = new THREE.MeshBasicMaterial({ color: 0xff1e2d, transparent: true, opacity: 0.95, depthTest: true });
const HP_DOT_EMPTY_MAT = new THREE.MeshBasicMaterial({ color: 0x1a0508, transparent: true, opacity: 0.28, depthTest: true });

// Equipamento do Benfica (1º nível): camisola vermelha, calções brancos, meias vermelhas.
const BENFICA = {
  shirt: 0xe30613, shorts: 0xf2f2f2, socks: 0xe30613, boots: 0x141414,
  skinColor: 0x6abf3f,   // pele verde monstruosa
  hairColor: 0x141414,
};

// Monstro com equipamento de futebol: usa o mesmo engine de personagem do player.
export class Enemy {
  constructor(scene, pos, opts = {}) {
    this.alive = true;
    this.scene = scene;
    this.home = pos.clone();
    this.spawnFrom = opts.spawnFrom ? opts.spawnFrom.clone() : null;
    this.position = this.spawnFrom ? this.spawnFrom.clone() : pos.clone();
    this.speed = opts.speed ?? 5.5;
    this.detect = opts.detect ?? 14;
    this.hp = opts.hp ?? 3;
    this.maxHp = this.hp;
    this.radius = opts.radius ?? 0.7;
    this.facing = 0;
    this.wanderT = 0;
    this.wanderDir = new THREE.Vector3(1, 0, 0);

    this.spawnPhase = this.spawnFrom ? 'charging' : 'idle';
    this.spawnT = 0;
    this.chargeTime = opts.chargeTime ?? 1.1;
    this.flightTime = opts.flightTime ?? 1.0;
    this.trailFade = 1;

    this.stun = 0; this.vy = 0;
    this.kb = new THREE.Vector3();
    this._runPhase = Math.random() * 6;

    this.model = this._build(opts);
    if (opts.scale || opts.widthScale) {
      const s = opts.scale ?? 1;
      const w = opts.widthScale ?? s;
      this.model.scale.set(w, s, w);
      this._finalScale = new THREE.Vector3(w, s, w);
      this.radius *= w;
    } else {
      this._finalScale = new THREE.Vector3(1, 1, 1);
    }
    if (this.spawnFrom) this.model.scale.copy(this._finalScale).multiplyScalar(0.08);
    this.parts = this.model.userData.parts;
    this._baseHipsY = this.parts.hips.position.y;
    this.hpDots = [];
    this.hpBar = this._buildHpBar();
    this.model.add(this.hpBar);
    this._updateHpDots();
    this.model.position.copy(this.position);
    scene.add(this.model);

    this.trail = null;
    this.trailMat = null;
    if (this.spawnFrom) {
      const geom = new THREE.BufferGeometry().setFromPoints([this.spawnFrom, this.spawnFrom]);
      this.trailMat = new THREE.LineBasicMaterial({ color: 0xe30613, transparent: true, opacity: 0, depthWrite: false });
      this.trail = new THREE.Line(geom, this.trailMat);
      scene.add(this.trail);
    }
  }

  _build(opts) {
    const cfg = { ...BENFICA, name: 'BENFICA', number: opts.number ?? (2 + Math.floor(Math.random() * 9)) };
    const rig = buildPlayerSkeleton(cfg);

    // toque monstruoso: cornos + olhos amarelos
    const head = rig.userData.parts.head;
    const bone = toon(0xf0eada);
    addPart(head, 'horn_L', new THREE.ConeGeometry(0.07, 0.3, 8), bone, [-0.18, 0.42, 0.02], [1, 1, 1], [0, 0, 0.3]);
    addPart(head, 'horn_R', new THREE.ConeGeometry(0.07, 0.3, 8), bone, [0.18, 0.42, 0.02], [1, 1, 1], [0, 0, -0.3]);
    const eye = new THREE.MeshBasicMaterial({ color: 0xffee33 });
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eye).translateX(-0.095).translateY(0.02).translateZ(0.34));
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eye).translateX(0.095).translateY(0.02).translateZ(0.34));

    // escalar para ~2.1 de altura e pousar os pés em y=0
    const box = new THREE.Box3().setFromObject(rig);
    const s = 2.1 / (box.max.y - box.min.y);
    const wrap = new THREE.Group();
    rig.scale.setScalar(s);
    rig.position.y = -box.min.y * s;
    wrap.add(rig);
    wrap.userData.parts = rig.userData.parts;
    return wrap;
  }

  _buildHpBar() {
    const bar = new THREE.Group();
    const perRow = 10;
    const gap = 0.115;
    const rows = Math.ceil(this.maxHp / perRow);
    const baseY = 2.65 + rows * 0.055;
    bar.position.set(0, baseY, 0);

    for (let i = 0; i < this.maxHp; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const countThisRow = Math.min(perRow, this.maxHp - row * perRow);
      const x = (col - (countThisRow - 1) / 2) * gap;
      const y = row * 0.105;

      const dot = new THREE.Mesh(HP_DOT_GEO, HP_DOT_MAT.clone());
      dot.position.set(x, y, 0);
      dot.renderOrder = 20;
      bar.add(dot);
      this.hpDots.push(dot);
    }

    return bar;
  }

  _updateHpDots() {
    for (let i = 0; i < this.hpDots.length; i++) {
      const active = i < Math.max(0, this.hp);
      const dot = this.hpDots[i];
      dot.material = active ? HP_DOT_MAT.clone() : HP_DOT_EMPTY_MAT.clone();
      dot.visible = active;
    }
  }

  _updateSpawn(dt) {
    if (this.spawnPhase === 'idle') return false;
    this.spawnT += dt;
    if (this.spawnPhase === 'charging') {
      const k = Math.min(this.spawnT / this.chargeTime, 1);
      const ease = 1 - Math.pow(1 - k, 3);
      this.model.scale.copy(this._finalScale).multiplyScalar(0.08 + ease * 0.92);
      this.model.rotation.y += dt * (2 + ease * 5);
      this.model.position.y = this.spawnFrom.y + Math.sin(performance.now() * 0.014) * 0.16;
      if (k >= 1) {
        this.spawnPhase = 'flying';
        this.spawnT = 0;
        if (this.trailMat) this.trailMat.opacity = 0.78;
      }
      return true;
    }

    if (this.spawnPhase === 'flying') {
      const k = Math.min(this.spawnT / this.flightTime, 1);
      const ease = 1 - Math.pow(1 - k, 2);
      const p = new THREE.Vector3().lerpVectors(this.spawnFrom, this.home, ease);
      p.y += Math.sin(k * Math.PI) * 7.5;
      this.position.copy(p);
      this.model.position.copy(this.position);
      this.model.rotation.x = Math.sin(k * Math.PI * 2) * 0.35;
      this.model.rotation.z = Math.sin(k * Math.PI * 3) * 0.22;
      if (this.trail) this.trail.geometry.setFromPoints([this.spawnFrom, p.clone()]);
      if (k >= 1) {
        this.position.copy(this.home);
        this.model.position.copy(this.position);
        this.model.rotation.x = 0;
        this.model.rotation.z = 0;
        this.spawnPhase = 'idle';
        this.spawnT = 0;
      }
      return true;
    }
    return false;
  }

  takeKick(fromPos, force = 1, damageOverride = null, knockMult = 1) {
    if (!this.alive || this.spawnPhase !== 'idle') return null;
    const damage = damageOverride ?? (force >= 1.5 ? 2 : 1);
    this.hp -= damage;
    this._updateHpDots();
    const away = new THREE.Vector3().subVectors(this.position, fromPos); away.y = 0;
    if (away.lengthSq() < 0.001) away.set(0, 0, 1);
    away.normalize();
    if (this.hp <= 0) { this.defeat(); return 'defeat'; }
    this.kb.copy(away).multiplyScalar(9 * force * knockMult);
    this.vy = 6.5 * Math.min(force, 2.2); this.stun = 0.6 + Math.min(force * 0.08, 0.25);
    return 'hit';
  }

  update(dt, player) {
    if (!this.alive) return;
    if (this._updateSpawn(dt)) return;
    if (this.trailMat && this.trailFade > 0) {
      this.trailFade -= dt * 0.45;
      this.trailMat.opacity = Math.max(0, this.trailFade) * 0.78;
    }

    // atordoado: salta para trás, treme, não persegue
    if (this.stun > 0) {
      this.stun -= dt;
      this.position.x += this.kb.x * dt; this.position.z += this.kb.z * dt;
      this.kb.multiplyScalar(1 - Math.min(dt * 6, 1));
      this.vy += EGRAV * dt; this.position.y += this.vy * dt;
      if (this.position.y <= this.home.y) { this.position.y = this.home.y; this.vy = 0; }
      this.model.position.copy(this.position);
      this.model.rotation.z = Math.sin(performance.now() * 0.03) * 0.25;
      return;
    }
    this.model.rotation.z = THREE.MathUtils.damp(this.model.rotation.z, 0, 12, dt);

    const toPlayer = new THREE.Vector3().subVectors(player.position, this.position); toPlayer.y = 0;
    const dist = toPlayer.length();

    const dir = new THREE.Vector3();
    if (dist < this.detect) {
      dir.copy(toPlayer).normalize();
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 1.5 + Math.random() * 2;
        const a = Math.random() * Math.PI * 2;
        this.wanderDir.set(Math.cos(a), 0, Math.sin(a));
      }
      const home = new THREE.Vector3().subVectors(this.home, this.position); home.y = 0;
      dir.copy(home.length() > 10 ? home.normalize() : this.wanderDir);
    }

    const sp = dist < this.detect ? this.speed : this.speed * 0.45;
    this.position.x += dir.x * sp * dt;
    this.position.z += dir.z * sp * dt;
    this.position.y = this.home.y;

    if (dir.lengthSq() > 0.001) this.facing = Math.atan2(dir.x, dir.z);
    this.model.position.copy(this.position);
    this.model.rotation.y = THREE.MathUtils.damp(this.model.rotation.y, this.facing, 10, dt);

    this._animate(dt, sp);

    if (dist < 1.25) {
      const r = player.hit(this.position);
      if (r) { const away = toPlayer.clone().multiplyScalar(-1).normalize(); this.kb.copy(away).multiplyScalar(6); this.vy = 4; this.stun = 0.5; }
    }
  }

  // ciclo de corrida do monstro (mesmos ossos do engine)
  _animate(dt, sp) {
    const p = this.parts;
    this._runPhase += dt * (6 + sp * 0.4);
    const ph = this._runPhase, s = Math.sin(ph), c = Math.cos(ph);
    const d = (o, prop, t) => { o[prop] = THREE.MathUtils.damp(o[prop], t, 12, dt); };
    d(p.torso.rotation, 'x', 0.14 + Math.abs(s) * 0.05);
    d(p.leftArm.shoulder.rotation, 'x', s * 0.8);
    d(p.rightArm.shoulder.rotation, 'x', -s * 0.8);
    d(p.leftArm.fore.rotation, 'x', -1.0); d(p.rightArm.fore.rotation, 'x', -1.0);
    d(p.leftLeg.hip.rotation, 'x', -s * 0.8);
    d(p.rightLeg.hip.rotation, 'x', s * 0.8);
    d(p.leftLeg.shin.rotation, 'x', Math.max(0, c) * 0.9);
    d(p.rightLeg.shin.rotation, 'x', Math.max(0, -c) * 0.9);
    d(p.hips.position, 'y', this._baseHipsY + Math.abs(s) * 0.03);
  }

  defeat() {
    this.alive = false;
    this.scene.remove(this.model);
    if (this.trail) this.scene.remove(this.trail);
  }
}
