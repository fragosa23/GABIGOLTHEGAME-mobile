import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import glbUrl from '../../assets/player.glb?url';

// Carrega o modelo 3D realista (PLAYER) riggado em Blender e gere as animações:
// idle / walk / run / kick / jump / double_jump / hurt.
const ONCE = new Set(['kick', 'jump', 'double_jump', 'hurt']);

export class PlayerModel {
  constructor(targetHeight = 2.05, onReady = null) {
    this.group = new THREE.Group();
    this.ready = false;
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.currentName = null;
    this.mats = [];
    new GLTFLoader().load(glbUrl, (gltf) => {
      this._setup(gltf, targetHeight);
      onReady && onReady(this);
    }, undefined, (err) => console.error('Falha a carregar player.glb', err));
  }

  _setup(gltf, targetHeight) {
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const s = targetHeight / (box.max.y - box.min.y);
    root.scale.setScalar(s);
    root.position.y = -box.min.y * s;
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mm) {
          if (!m) continue;
          // glTF importa metalness=1/roughness=1 -> fica preto sem env map; normalizar
          if ('metalness' in m) m.metalness = 0.0;
          if ('roughness' in m) m.roughness = 0.85;
          if ('envMapIntensity' in m) m.envMapIntensity = 0.6;
          m.needsUpdate = true;
          this.mats.push(m);
        }
      }
    });
    this.group.add(root);

    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.lock = null;       // animação one-shot a decorrer (kick/hurt/jump/double_jump)
    this.lockT = 0;         // tempo restante dessa one-shot
    this._fadeTo('idle', 0);
    this.ready = true;
  }

  _fadeTo(name, dur = 0.2, force = false) {
    const a = this.actions[name];
    if (!a) return;
    if (this.currentName === name && !force) return;
    const once = ONCE.has(name);
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once;
    a.setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(dur).play();
    if (this.current && this.current !== a) this.current.fadeOut(dur);
    this.current = a; this.currentName = name;
  }

  // inicia uma one-shot que toca por inteiro (independente dos timers de jogo)
  _startOnce(name) {
    const a = this.actions[name];
    if (!a) return;
    this.lock = name;
    this.lockT = a.getClip().duration;
    this._fadeTo(name, name === 'kick' || name === 'hurt' ? 0.06 : 0.1, true);
  }

  // st: { speed, grounded, sprint, jumps, jumpEvent, kickEvent, hurtEvent }
  update(dt, st) {
    if (!this.ready) return;
    if (this.lockT > 0) this.lockT -= dt;

    // ao aterrar, larga já o lock de salto para retomar locomoção
    if (st.grounded && (this.lock === 'jump' || this.lock === 'double_jump')) { this.lock = null; this.lockT = 0; }

    // eventos (prioridade: hurt > kick > salto). Tocam a animação por inteiro.
    if (st.hurtEvent) this._startOnce('hurt');
    else if (st.kickEvent) this._startOnce('kick');
    else if (st.jumpEvent && !st.grounded) this._startOnce(st.jumps >= 2 ? 'double_jump' : 'jump');

    let want;
    if (this.lock && this.lockT > 0) {
      want = this.lock;                       // a decorrer uma one-shot
    } else {
      this.lock = null;
      if (!st.grounded) want = 'jump';        // no ar sem evento (ex.: caiu de uma borda)
      else if (st.speed > 0.6) want = st.sprint ? (st.fastRun ? 'run_fast' : 'run') : 'walk';
      else want = 'idle';
    }

    // ritmo dos ciclos acompanha a velocidade real
    if (want === 'run') this.actions.run.setEffectiveTimeScale(THREE.MathUtils.clamp(st.speed / 8, 1.05, 2.2));
    else if (want === 'run_fast') this.actions.run_fast.setEffectiveTimeScale(THREE.MathUtils.clamp(st.speed / 9, 1.1, 2.2));
    else if (want === 'walk') this.actions.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(st.speed / 5, 0.7, 1.5));

    this._fadeTo(want, 0.16);
    this.mixer.update(dt);
  }

  // power-ups: tinge o equipamento (o GLB tem textura própria)
  setTint(hex) {
    for (const m of this.mats) {
      if (!m.color) continue;
      if (hex == null) m.color.setRGB(1, 1, 1);
      else m.color.setHex(hex).lerp(new THREE.Color(1, 1, 1), 0.45);
      m.needsUpdate = true;
    }
  }
}
