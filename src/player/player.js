import * as THREE from 'three';
import { GRAVITY } from '../engine/physics.js';
import { CLUBS } from '../clubs.js';
import { buildPlayerSkeleton } from '../character/skeleton.js';
import { PlayerModel } from '../character/playerModel.js';
import { ballTexture } from '../entities/ball.js';
import { playJump, playSiii, playKick, playHurt, playPickup } from '../engine/audio.js';

const SHIRT = 0x9fd6ff; // azul claro (equipamento base G.CALDEIRA)
const POWER_KEYS = ['speed', 'kick', 'jump'];

// Riscas verticais (Porto): azul/branco.
let _stripeTex = null;
function stripeTexture() {
  if (_stripeTex) return _stripeTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  const n = 7;
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#1f5fd0'; ctx.fillRect((i / n) * 256, 0, 256 / n + 1, 64); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  _stripeTex = tex; return tex;
}

function runPlayerSpecialCamera(player, type, duration = 1.25) {
  const camera = window.__camera;
  const orbit = window.__orbit;
  if (!camera || !orbit) return;

  const started = performance.now();
  const wasControllable = player.controllable;
  player.controllable = false;
  player.specialCameraLock = true;

  const loop = () => {
    const t = (performance.now() - started) / 1000;
    const k = Math.min(t / duration, 1);
    const a = -Math.PI * 0.65 + k * Math.PI * 2.25;
    const radius = type === 'jump' ? 7.2 : 5.7;
    const h = type === 'jump' ? 2.8 + Math.sin(k * Math.PI) * 1.5 : 2.2;
    const targetY = type === 'jump' ? player.position.y + 1.7 : player.position.y + 1.25;

    camera.position.set(
      player.position.x + Math.sin(a) * radius,
      targetY + h,
      player.position.z + Math.cos(a) * radius
    );
    camera.lookAt(player.position.x, targetY, player.position.z);

    if (k < 1) {
      requestAnimationFrame(loop);
      return;
    }

    player.specialCameraLock = false;
    player.controllable = wasControllable;
    orbit.snapBehind?.(player.facing);
  };
  requestAnimationFrame(loop);
}

export class Player {
  constructor(scene, physics, input, orbit) {
    this.physics = physics; this.input = input; this.orbit = orbit;

    // grupo exterior sincronizado com a física (pés em y=0)
    this.model = new THREE.Group();
    this.rig = buildPlayerSkeleton({ shirt: SHIRT, name: 'G. CALDEIRA', number: 8 });
    this.parts = this.rig.userData.parts;
    this.mat = this.rig.userData.mats;

    // escalar/pousar o rig para caber na cápsula de física
    const box = new THREE.Box3().setFromObject(this.rig);
    const s = 2.05 / (box.max.y - box.min.y);
    this.rig.scale.setScalar(s);
    this.rig.position.y = -box.min.y * s;
    this.model.add(this.rig);

    // modelo 3D realista (riggado em Blender) — substitui o rig procedural quando carregar
    this.useModel = false;
    this.pmodel = new PlayerModel(2.05, () => {
      this.rig.visible = false;
      this.useModel = true;
    });
    this.model.add(this.pmodel.group);
    this.hurtTimer = 0; this._jumpEvent = false; this._kickEvent = false; this._hurtEvent = false;
    this.sprinting = false; this.controllable = false; // ativado quando o jogo começa (após a intro)
    this.specialCameraLock = false;

    // bolas de futebol a orbitar o jogador — agora podem acumular até 3 por cor
    this.orbit3 = new THREE.Group(); this.orbit3.position.y = 1.15; this.model.add(this.orbit3);
    this.glow = new THREE.PointLight(0xffffff, 0, 6); this.glow.position.y = 1.0; this.model.add(this.glow);
    this.shieldFx = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0, wireframe: true, depthWrite: false })
    );
    this.shieldFx.visible = false; this.model.add(this.shieldFx);

    // efeito de chuto forte / especial vermelho
    this.kickFx = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.08, 10, 36),
      new THREE.MeshBasicMaterial({ color: 0xff5530, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.kickFx.rotation.x = Math.PI / 2; this.kickFx.visible = false; this.model.add(this.kickFx);
    this.kickFxT = 0;

    scene.add(this.model);

    this.position = new THREE.Vector3(0, 2, 0);
    this.velocity = new THREE.Vector3();
    this.half = new THREE.Vector3(0.4, 1.05, 0.4);
    this.grounded = false;
    this.facing = 0;
    this.jumps = 0;

    this.powerCounts = { speed: 0, kick: 0, jump: 0 };
    this.powers = [];
    this.lastPower = null;
    this.baseMaxHp = 100;
    this.maxHp = 100; this.hp = 100; this.invuln = 0; this.coins = 0;
    this.dead = false;
    this.giantT = 0;
    this.greenMegaLanding = false;
    this.greenAirInvuln = false;
    this.didDoubleJump = false;
    this.landingShockwave = null;

    this.kickCd = 0; this.kickTimer = 0; this.kickActive = false; this.kickHits = new Set();
    this._idleT = Math.random() * 10; this._runPhase = 0;
    this._baseHipsY = this.parts.hips.position.y;

    this._spawn = this.position.clone();
  }

  setSpawn(v) { this._spawn = v.clone(); this.position.copy(v); }
  get powerCount() { return this.powers.length; }
  get topClub() { return this.lastPower || this.powers[this.powers.length - 1] || null; }
  get blue() { return this.powerCounts.speed || 0; }
  get red() { return this.powerCounts.kick || 0; }
  get green() { return this.powerCounts.jump || 0; }
  get hasSpeed() { return this.blue > 0; }
  get hasShield() { return this.blue >= 2; }
  get hasKick() { return this.red > 0; }
  get hasJump() { return this.green > 0; }
  get maxJumps() { return this.hasJump ? 2 : 1; }
  get kickRange() { return 3.4 + (this.red > 0 ? 0.8 : 0) + (this.red >= 2 ? 0.4 : 0); }
  get kickDamage() { return this.red >= 2 ? 3 : this.red >= 1 ? 2 : 1; }
  get kickForce() { return this.red >= 2 ? 2.2 : this.red >= 1 ? 1.7 : 1; }
  get specialReadyType() {
    if (this.lastPower && this.powerCounts[this.lastPower] >= 3) return this.lastPower;
    return POWER_KEYS.find((k) => this.powerCounts[k] >= 3) || null;
  }

  update(dt) {
    this._jumpEvent = false;
    if (this.dead) {
      this.sprinting = false;
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 10, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 10, dt);
      return this._postUpdate(dt);
    }
    if (!this.controllable) {
      // intro/cutscene: sem controlo — travar X/Z, mas deixar a física vertical funcionar.
      this.sprinting = false;
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 12, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 12, dt);
      if (this.grounded) this.jumps = 0;
      return this._postUpdate(dt);
    }
    const ax = this.input.axis();
    const len = Math.hypot(ax.x, ax.y);
    const fwd = this.orbit.forward(), right = this.orbit.right();
    this.sprinting = this.input.sprint() && len > 0.001;
    const speedBoost = this.hasSpeed ? 1.5 : 1;
    const giantBoost = this.giantT > 0 ? 1.12 : 1;
    const speed = (this.sprinting ? 7.5 : 5) * speedBoost * giantBoost;
    const accel = 60, friction = 12;

    const wish = new THREE.Vector3();
    if (len > 0.001) {
      const nx = ax.x / Math.max(len, 1), ny = ax.y / Math.max(len, 1);
      wish.addScaledVector(right, nx).addScaledVector(fwd, -ny).normalize();
      this.facing = Math.atan2(wish.x, wish.z);
    }
    const tvx = wish.x * speed * Math.min(len, 1), tvz = wish.z * speed * Math.min(len, 1);
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, tvx, len > 0 ? accel * 0.05 : friction, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, tvz, len > 0 ? accel * 0.05 : friction, dt);

    if (this.grounded) this.jumps = 0;
    if (this.input.jump() && this.jumps < this.maxJumps) {
      this.jumps++; this.grounded = false; this._jumpEvent = true;
      if (this.jumps >= 2) {
        this.velocity.y = 15;
        this.didDoubleJump = true;
        this.greenAirInvuln = true;
        playSiii();
      } else { this.velocity.y = 14; playJump(); }
    }
    return this._postUpdate(dt);
  }

  // gravidade + física + modelo + animação (corre sempre, com ou sem controlo)
  _postUpdate(dt) {
    const wasGrounded = this.grounded;
    this.velocity.y += GRAVITY * dt;
    if (this.velocity.y < -45) this.velocity.y = -45;
    this.physics.moveAndCollide(this, dt);
    if (!wasGrounded && this.grounded) this._onLand();
    if (this.position.y < -25) this.respawn(true);

    this.model.position.set(this.position.x, this.position.y - this.half.y, this.position.z);
    this.model.rotation.y = THREE.MathUtils.damp(this.model.rotation.y, this.facing, 12, dt);

    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.kickCd > 0) this.kickCd -= dt;
    if (this.kickTimer > 0) { this.kickTimer -= dt; if (this.kickTimer <= 0) this.kickActive = false; }

    if (this.giantT > 0) {
      this.giantT -= dt;
      this.maxHp = 180;
      this.model.scale.setScalar(THREE.MathUtils.damp(this.model.scale.x, 1.55, 8, dt));
      if (this.giantT <= 0) {
        this.maxHp = this.baseMaxHp;
        this.hp = Math.min(this.hp, this.maxHp);
      }
    } else {
      this.maxHp = this.baseMaxHp;
      this.model.scale.setScalar(THREE.MathUtils.damp(this.model.scale.x, 1, 8, dt));
    }

    if (this.useModel) {
      const sp = Math.hypot(this.velocity.x, this.velocity.z);
      this.pmodel.update(dt, {
        speed: sp,
        grounded: this.grounded,
        sprint: this.sprinting,
        fastRun: this.hasSpeed,
        jumps: this.jumps,
        jumpEvent: this._jumpEvent,
        kickEvent: this._kickEvent,
        hurtEvent: this._hurtEvent,
      });
    } else {
      this._animate(dt);
    }
    this._kickEvent = false; this._hurtEvent = false;

    // bolas-poder a orbitar o jogador
    if (this.powerCount > 0) {
      this.orbit3.rotation.y += dt * 1.8;
      this.orbit3.position.y = 1.15 + Math.sin(performance.now() * 0.003) * 0.06;
      for (const b of this.orbit3.children) b.rotation.y += dt * 4;
      this.glow.intensity = (0.35 + Math.min(this.powerCount, 6) * 0.22) * (1 + Math.sin(performance.now() * 0.006) * 0.2);
    }

    this.shieldFx.visible = this.hasShield;
    this.shieldFx.material.opacity = this.hasShield ? 0.18 + Math.sin(performance.now() * 0.006) * 0.06 : 0;
    this.shieldFx.rotation.y += dt * 0.8;

    // efeito de chute forte (onda a expandir à frente)
    if (this.kickFxT > 0) {
      this.kickFxT -= dt;
      const k = 1 - Math.max(this.kickFxT, 0) / 0.35;
      this.kickFx.visible = true;
      this.kickFx.scale.setScalar(0.5 + k * 3.2);
      this.kickFx.material.opacity = (1 - k) * 0.85;
      this.kickFx.position.set(0, 0.5, 1.0 + k * 0.6);
    } else if (this.kickFx.visible) {
      this.kickFx.visible = false;
    }

    const body = this.useModel ? this.pmodel.group : this.rig;
    if (this.invuln > 0) {
      this.invuln -= dt;
      body.visible = Math.floor(performance.now() * 0.02) % 2 === 0;
    } else {
      body.visible = true;
    }
  }

  _onLand() {
    this.greenAirInvuln = false;
    if (this.greenMegaLanding) {
      this.greenMegaLanding = false;
      this.didDoubleJump = false;
      this.landingShockwave = { damage: 3, radius: 22, force: 7.0, color: 0x27c24a, mega: true };
      window.__hud?.message?.('🌪️ Shockwave verde gigante!', 2.0);
      return;
    }
    if (this.didDoubleJump && this.green >= 2) {
      this.didDoubleJump = false;
      this.landingShockwave = { damage: 1, radius: 6.5, force: 1.6, color: 0x27c24a, mega: false };
    } else {
      this.didDoubleJump = false;
    }
  }

  consumeLandingShockwave() {
    const s = this.landingShockwave;
    this.landingShockwave = null;
    return s;
  }

  // animação por "pose alvo" + damp: idle / run, com chuto sobreposto.
  _animate(dt) {
    const p = this.parts;
    const sp = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = this.grounded && sp > 0.6;
    this._idleT += dt;
    if (moving) this._runPhase += dt * (6 + sp * 0.4);

    const T = {
      torsoX: 0, torsoY: 0, torsoZ: 0, headY: 0,
      lShX: 0, lShZ: 0, rShX: 0, rShZ: 0, lFore: -0.12, rFore: -0.12,
      lHipX: 0, rHipX: 0, lShinX: 0, rShinX: 0, hipsY: this._baseHipsY,
    };

    if (moving) {
      const ph = this._runPhase, s = Math.sin(ph), c = Math.cos(ph);
      T.torsoX = 0.12 + Math.abs(s) * 0.05;
      T.lShX = s * 0.75; T.rShX = -s * 0.75;
      T.lFore = -0.9 - Math.max(0, s) * 0.4; T.rFore = -0.9 - Math.max(0, -s) * 0.4;
      T.lHipX = -s * 0.75; T.rHipX = s * 0.75;
      T.lShinX = Math.max(0, c) * 0.9; T.rShinX = Math.max(0, -c) * 0.9;
      T.hipsY = this._baseHipsY + Math.abs(s) * 0.03;
    } else {
      const t = this._idleT;
      T.torsoX = Math.sin(t * 1.3) * 0.025;
      T.headY = Math.sin(t * 0.8) * 0.08;
      T.lShX = Math.sin(t) * 0.05; T.rShX = -Math.sin(t) * 0.05;
    }

    let kicking = false;
    if (this.kickTimer > 0) {
      kicking = true;
      const prog = Math.min(Math.max(1 - this.kickTimer / 0.22, 0), 1);
      const k = Math.sin(prog * Math.PI);
      T.torsoY = -0.25 * k;
      T.lShZ = -0.55 * k; T.rShZ = 0.45 * k;
      T.lHipX = -0.25 * k;
      T.rHipX = -1.3 * k;
      T.rShinX = 0.8 * k;
    }

    const L = kicking ? 22 : 12;
    const d = (obj, prop, target) => { obj[prop] = THREE.MathUtils.damp(obj[prop], target, L, dt); };
    d(p.torso.rotation, 'x', T.torsoX); d(p.torso.rotation, 'y', T.torsoY); d(p.torso.rotation, 'z', T.torsoZ);
    d(p.head.rotation, 'y', T.headY);
    d(p.leftArm.shoulder.rotation, 'x', T.lShX); d(p.leftArm.shoulder.rotation, 'z', T.lShZ);
    d(p.rightArm.shoulder.rotation, 'x', T.rShX); d(p.rightArm.shoulder.rotation, 'z', T.rShZ);
    d(p.leftArm.fore.rotation, 'x', T.lFore); d(p.rightArm.fore.rotation, 'x', T.rFore);
    d(p.leftLeg.hip.rotation, 'x', T.lHipX); d(p.rightLeg.hip.rotation, 'x', T.rHipX);
    d(p.leftLeg.shin.rotation, 'x', T.lShinX); d(p.rightLeg.shin.rotation, 'x', T.rShinX);
    d(p.hips.position, 'y', T.hipsY);
  }

  tryKick() {
    if (this.dead || this.kickCd > 0) return false;
    this.kickCd = 0.45; this.kickTimer = 0.22; this.kickActive = true; this.kickHits.clear();
    this._kickEvent = true;
    playKick();
    if (this.red > 0) this.kickFxT = 0.35;
    return true;
  }

  givePower(club) {
    if (this.dead) return;
    if (!this.powerCounts[club] && this.powerCounts[club] !== 0) return;
    this.powerCounts[club] = Math.min(3, this.powerCounts[club] + 1);
    this.lastPower = club;
    this.refreshPowers(); playPickup();
  }

  consumePower(club, n = 1) {
    if ((this.powerCounts[club] || 0) < n) return false;
    this.powerCounts[club] -= n;
    if (this.lastPower === club && this.powerCounts[club] <= 0) this.lastPower = this.powers[this.powers.length - 1] || null;
    this.refreshPowers();
    return true;
  }

  loseTopPower() {
    const key = [...this.powers].reverse().find((k) => this.powerCounts[k] > 0) || null;
    if (key) this.consumePower(key, 1);
    return key;
  }

  refreshPowers() {
    this.powers = [];
    for (const k of POWER_KEYS) for (let i = 0; i < this.powerCounts[k]; i++) this.powers.push(k);

    while (this.orbit3.children.length) {
      const c = this.orbit3.children.pop();
      c.geometry.dispose(); c.material.dispose(); this.orbit3.remove(c);
    }
    const n = this.powers.length;
    this.powers.forEach((key, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshBasicMaterial({ map: ballTexture(), color: CLUBS[key].ball })
      );
      const a = (i / Math.max(n, 1)) * Math.PI * 2;
      const r = n > 6 ? 1.12 : 0.95;
      const y = n > 6 ? ((i % 2) * 0.18 - 0.09) : 0;
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      this.orbit3.add(m);
    });
    if (n === 0) { this.glow.intensity = 0; return; }
    this.glow.color.setHex(CLUBS[this.topClub || this.powers[0]].ring);
  }

  activateSpecial(type) {
    if (this.dead || !type || this.powerCounts[type] < 3) return false;
    this.consumePower(type, 3);
    if (type === 'speed') {
      this.giantT = 20;
      this.maxHp = 180;
      this.hp = Math.min(this.maxHp, this.hp + 80);
      this.invuln = Math.max(this.invuln, 1.2);
      runPlayerSpecialCamera(this, 'speed', 1.25);
      return true;
    }
    if (type === 'kick') {
      this.tryKick();
      this.kickFxT = 0.35;
      return true;
    }
    if (type === 'jump') {
      this.greenMegaLanding = true;
      this.greenAirInvuln = true;
      this.didDoubleJump = false;
      this.landingShockwave = null;
      this.grounded = false;
      this.jumps = 99;
      this.position.y += 0.35;
      this.velocity.y = 32;
      this.invuln = Math.max(this.invuln, 1.8);
      this._jumpEvent = true;
      playSiii();
      runPlayerSpecialCamera(this, 'jump', 1.6);
      return true;
    }
    return false;
  }

  hit(enemyPos) {
    if (this.dead || this.invuln > 0 || (this.greenAirInvuln && !this.grounded)) return false;
    const away = new THREE.Vector3().subVectors(this.position, enemyPos); away.y = 0;
    if (away.lengthSq() < 0.001) away.set(0, 0, 1);
    away.normalize().multiplyScalar(7);
    this.velocity.x = away.x; this.velocity.z = away.z; this.velocity.y = 6;
    this.invuln = 1.1; this.hurtTimer = 0.55; this._hurtEvent = true; playHurt();

    if (this.hasShield) {
      this.consumePower('speed', 1);
      return 'shield';
    }

    this.hp = Math.max(0, this.hp - 22);
    if (this.hp <= 0) {
      this.dead = true;
      this.controllable = false;
      this.sprinting = false;
      this.greenAirInvuln = false;
      this.giantT = 0;
      window.__gameOver?.();
      return 'down';
    }
    return 'hp';
  }

  respawn(toSpawn) {
    if (toSpawn) this.position.copy(this._spawn);
    this.greenAirInvuln = false;
    this.velocity.set(0, 0, 0);
  }
}
