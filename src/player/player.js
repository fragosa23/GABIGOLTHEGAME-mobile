import * as THREE from 'three';
import { GRAVITY } from '../engine/physics.js';
import { CLUBS } from '../clubs.js';
import { buildPlayerSkeleton } from '../character/skeleton.js';
import { PlayerModel } from '../character/playerModel.js';
import { ballTexture } from '../entities/ball.js';
import { playJump, playSiii, playKick, playHurt, playPickup } from '../engine/audio.js';

const SHIRT = 0x9fd6ff; // azul claro (equipamento base G.CALDEIRA)

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

    // bolas de futebol a orbitar o jogador — uma por poder (até 3)
    this.orbit3 = new THREE.Group(); this.orbit3.position.y = 1.15; this.model.add(this.orbit3);
    this.glow = new THREE.PointLight(0xffffff, 0, 6); this.glow.position.y = 1.0; this.model.add(this.glow);
    // efeito de "chute forte": onda que expande à frente do jogador
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

    this.powers = [];
    this.maxHp = 100; this.hp = 100; this.invuln = 0; this.coins = 0;

    this.kickCd = 0; this.kickTimer = 0; this.kickActive = false; this.kickHits = new Set();
    this._idleT = Math.random() * 10; this._runPhase = 0;
    this._baseHipsY = this.parts.hips.position.y;

    this._spawn = this.position.clone();
  }

  setSpawn(v) { this._spawn = v.clone(); this.position.copy(v); }
  get powerCount() { return this.powers.length; }
  get topClub() { return this.powers[this.powers.length - 1] || null; }
  // habilidades por cor de bola (um poder de cada, no máximo)
  get hasSpeed() { return this.powers.includes('speed'); } // PORTO (azul)
  get hasKick() { return this.powers.includes('kick'); }   // BRAGA (vermelho)
  get hasJump() { return this.powers.includes('jump'); }   // S.PEDRO (verde)
  get maxJumps() { return this.hasJump ? 2 : 1; }           // duplo salto só com o poder
  get kickRange() { return 3.4 + (this.hasKick ? 1.2 : 0); }
  get kickForce() { return this.hasKick ? 2 : 1; }          // chute forte = dobro do dano/knockback

  update(dt) {
    this._jumpEvent = false;
    if (!this.controllable) {
      // intro/cutscene: sem controlo — travar e ficar parado (idle)
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
    // corrida normal por defeito; o poder AZUL (velocidade) torna-o mais rápido
    const speed = (this.sprinting ? 7.5 : 5) * (this.hasSpeed ? 1.5 : 1);
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
      // 2º salto só existe com o poder VERDE (maxJumps=2): salto duplo + SIUUU
      if (this.jumps >= 2) { this.velocity.y = 15; playSiii(); }
      else { this.velocity.y = 14; playJump(); }
    }
    return this._postUpdate(dt);
  }

  // gravidade + física + modelo + animação (corre sempre, com ou sem controlo)
  _postUpdate(dt) {
    this.velocity.y += GRAVITY * dt;
    if (this.velocity.y < -45) this.velocity.y = -45;
    this.physics.moveAndCollide(this, dt);
    if (this.position.y < -25) this.respawn(true);

    this.model.position.set(this.position.x, this.position.y - this.half.y, this.position.z);
    this.model.rotation.y = THREE.MathUtils.damp(this.model.rotation.y, this.facing, 12, dt);

    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    // temporizadores de chuto: têm de correr sempre (antes só viviam em _animate,
    // que deixa de ser chamado com o modelo 3D -> o chuto bloqueava após o 1º)
    if (this.kickCd > 0) this.kickCd -= dt;
    if (this.kickTimer > 0) { this.kickTimer -= dt; if (this.kickTimer <= 0) this.kickActive = false; }
    if (this.useModel) {
      const sp = Math.hypot(this.velocity.x, this.velocity.z);
      this.pmodel.update(dt, {
        speed: sp,
        grounded: this.grounded,
        sprint: this.sprinting,
        fastRun: this.hasSpeed, // corrida Naruto só com o poder de velocidade (PORTO)
        jumps: this.jumps,
        jumpEvent: this._jumpEvent,
        kickEvent: this._kickEvent,
        hurtEvent: this._hurtEvent,
      });
    } else {
      this._animate(dt);
    }
    // eventos de animação são "one-shot": consumir após passar ao modelo
    this._kickEvent = false; this._hurtEvent = false;

    // bolas-poder a orbitar o jogador
    if (this.powerCount > 0) {
      this.orbit3.rotation.y += dt * 1.8;
      this.orbit3.position.y = 1.15 + Math.sin(performance.now() * 0.003) * 0.06;
      for (const b of this.orbit3.children) b.rotation.y += dt * 4;
      this.glow.intensity = (0.4 + this.powerCount * 0.35) * (1 + Math.sin(performance.now() * 0.006) * 0.2);
    }
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

  // animação por "pose alvo" + damp: idle / run, com chuto sobreposto.
  _animate(dt) {
    const p = this.parts;
    const sp = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = this.grounded && sp > 0.6;
    this._idleT += dt;
    if (moving) this._runPhase += dt * (6 + sp * 0.4);

    // pose alvo (canais não definidos = 0)
    const T = {
      torsoX: 0, torsoY: 0, torsoZ: 0, headY: 0,
      lShX: 0, lShZ: 0, rShX: 0, rShZ: 0, lFore: -0.12, rFore: -0.12,
      lHipX: 0, rHipX: 0, lShinX: 0, rShinX: 0, hipsY: this._baseHipsY,
    };

    if (moving) {
      const ph = this._runPhase, s = Math.sin(ph), c = Math.cos(ph);
      T.torsoX = 0.12 + Math.abs(s) * 0.05;
      T.lShX = s * 0.75; T.rShX = -s * 0.75;
      T.lFore = -0.9 - Math.max(0, s) * 0.4; T.rFore = -0.9 - Math.max(0, -s) * 0.4; // cotovelos dobrados
      T.lHipX = -s * 0.75; T.rHipX = s * 0.75;
      T.lShinX = Math.max(0, c) * 0.9; T.rShinX = Math.max(0, -c) * 0.9;
      T.hipsY = this._baseHipsY + Math.abs(s) * 0.03;
    } else {
      const t = this._idleT;
      T.torsoX = Math.sin(t * 1.3) * 0.025;
      T.headY = Math.sin(t * 0.8) * 0.08;
      T.lShX = Math.sin(t) * 0.05; T.rShX = -Math.sin(t) * 0.05;
    }

    // chuto sobreposto (perna direita). Os temporizadores são decrementados em update().
    let kicking = false;
    if (this.kickTimer > 0) {
      kicking = true;
      const prog = Math.min(Math.max(1 - this.kickTimer / 0.22, 0), 1);
      const k = Math.sin(prog * Math.PI); // 0→1→0
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
    if (this.kickCd > 0) return false;
    this.kickCd = 0.45; this.kickTimer = 0.22; this.kickActive = true; this.kickHits.clear();
    this._kickEvent = true; // dispara a animação de chuto (toca por inteiro)
    playKick();
    if (this.hasKick) this.kickFxT = 0.35; // onda de chute forte
    return true;
  }

  // cada poder = uma bola de futebol dessa cor a orbitar (um de cada, máx 3)
  givePower(club) {
    if (!this.powers.includes(club)) this.powers.push(club);
    this.refreshPowers(); playPickup();
  }
  loseTopPower() {
    const lost = this.powers.pop() || null;
    this.refreshPowers();
    return lost;
  }

  refreshPowers() {
    // reconstruir as bolas a orbitar
    while (this.orbit3.children.length) {
      const c = this.orbit3.children.pop();
      c.geometry.dispose(); c.material.dispose(); this.orbit3.remove(c);
    }
    const n = this.powers.length;
    this.powers.forEach((key, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 16, 16),
        new THREE.MeshBasicMaterial({ map: ballTexture(), color: CLUBS[key].ball })
      );
      const a = (i / Math.max(n, 1)) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
      this.orbit3.add(m);
    });
    if (n === 0) { this.glow.intensity = 0; return; }
    this.glow.color.setHex(CLUBS[this.topClub].ring);
  }

  hit(enemyPos) {
    if (this.invuln > 0) return false;
    const away = new THREE.Vector3().subVectors(this.position, enemyPos); away.y = 0;
    if (away.lengthSq() < 0.001) away.set(0, 0, 1);
    away.normalize().multiplyScalar(7);
    this.velocity.x = away.x; this.velocity.z = away.z; this.velocity.y = 6;
    this.invuln = 1.1; this.hurtTimer = 0.55; this._hurtEvent = true; playHurt();
    if (this.powers.length > 0) { this.loseTopPower(); return 'power'; }
    this.hp -= 22;
    if (this.hp <= 0) { this.hp = this.maxHp; this.respawn(true); return 'down'; }
    return 'hp';
  }

  respawn(toSpawn) {
    if (toSpawn) this.position.copy(this._spawn);
    this.velocity.set(0, 0, 0);
  }
}
