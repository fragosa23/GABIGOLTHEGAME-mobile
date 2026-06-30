import * as THREE from 'three';
import { createRenderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { Physics } from './engine/physics.js';
import { OrbitCamera } from './player/camera.js';
import { Player } from './player/player.js';
import { buildLevel } from './world/level.js';
import { buildDragaoLevel } from './world/dragao.js';
import { Enemy } from './entities/enemy.js';
import { PowerBall } from './entities/ball.js';
import { HUD } from './ui/hud.js';
import { SpeedFx } from './engine/speedFx.js';
import { playWhistle, resumeAudio, startGameplayMusic } from './engine/audio.js';
import { makeOptionsPanel } from './engine/options.js';
import { showMenu } from './ui/menu.js';
import { runIntro } from './ui/intro.js';
import { CLUBS } from './clubs.js';

const container = document.getElementById('app');
const { renderer, scene, camera, sun } = createRenderer(container);
const input = new Input(renderer.domElement);
const physics = new Physics();
const orbit = new OrbitCamera(camera, input);
const hud = new HUD();
orbit.onChange((name) => hud.cameraLabel(name));

let level = null;          // construído ao escolher o modo no menu
const player = new Player(scene, physics, input, orbit);
window.__player = player; // debug/test hook
window.__renderer = renderer; window.__scene = scene; window.__camera = camera;

// efeito de velocidade (linhas) + desbloqueio de áudio no clique
const speedFx = new SpeedFx(scene); window.__speedFx = speedFx; window.__hud = hud; window.__orbit = orbit;
const BASE_FOV = camera.fov, SPRINT_FOV = 72;
const NORMAL_CAM_DISTANCE = 3.25;
const NORMAL_CAM_HEIGHT = 1.55;
const NORMAL_CAM_PITCH = 0.32;
window.addEventListener('click', resumeAudio);

function randomFieldPoint(y = 1.5) {
  return new THREE.Vector3(
    (Math.random() - 0.5) * 62,
    y,
    -42 + Math.random() * 82
  );
}

// constrói o nível escolhido (tutorial=procedural | career=estádio Dragão, async)
function setupWorld(mode, onReady) {
  const afterBuild = () => {
    player.setSpawn(level.spawn);
    if (level.facing != null) { player.facing = level.facing; player.model.rotation.y = level.facing; }
    orbit.setColliders(physics.boxes.map((b) =>
      new THREE.Box3(b.min.clone(), b.max.clone()).expandByScalar(0.25)));
    prevHp = player.hp; prevPowers = player.powerCount;
  };
  if (mode === 'tutorial') {
    level = buildLevel(scene, physics); afterBuild(); onReady();
  } else {
    level = buildDragaoLevel(scene, physics, (root) => {
      if (root) orbit.setOccluders(root);   // câmara não atravessa as paredes/teto do estádio
      onReady();
    });
    afterBuild();   // colisores/spawn já prontos; intro arranca quando o GLB carregar
  }
}

// chuto: acerta inimigos à frente do player enquanto o golpe está ativo.
const ENEMY_RADIUS = 0.7;
function doKick() {
  const fwd = new THREE.Vector3(Math.sin(player.model.rotation.y), 0, Math.cos(player.model.rotation.y));
  for (const e of level.enemies) {
    if (!e.alive || player.kickHits.has(e)) continue;
    const to = new THREE.Vector3().subVectors(e.position, player.position); to.y = 0;
    const d = to.length();
    // distância já a contar com o corpo do inimigo
    if (d - (e.radius ?? ENEMY_RADIUS) > player.kickRange) continue;
    // muito perto (à queima-roupa) acerta em qualquer direção; senão, arco largo (~150°)
    const dir = to.clone().normalize();
    if (d < 1.6 || dir.dot(fwd) > -0.25) {
      player.kickHits.add(e);
      e.takeKick(player.position, player.kickForce, player.kickDamage);
    }
  }
}

let won = false;
let phase = 'menu';    // 'menu' | 'intro' | 'gateIntro' | 'bossIntro' | 'redSpecial' | 'play' | 'pause'
let introT = 0;
let bossIntro = null;
let redSpecial = null;
let prevPowers = 0, prevHp = player.hp;
const clock = new THREE.Clock();
const tmpVec = new THREE.Vector3();
const bossFocusTarget = new THREE.Vector3();
const shockwaves = [];

const pauseBtn = document.createElement('button');
pauseBtn.type = 'button';
pauseBtn.textContent = '||';
pauseBtn.style.cssText = `position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));
  z-index:120;display:none;pointer-events:auto;cursor:pointer;font-family:system-ui,sans-serif;
  width:clamp(52px,8.4vw,66px);height:clamp(52px,8.4vw,66px);aspect-ratio:1/1;padding:0;
  color:#fff;background:radial-gradient(circle at 35% 24%, #ffffff28, #ffffff00 28%), linear-gradient(180deg, #2b385a82, #11182b5f);
  border:2px solid #ffffff52;border-radius:50%;opacity:.66;font-size:clamp(16px,4vw,22px);
  font-weight:900;line-height:1;letter-spacing:0;text-shadow:0 2px 6px #000;box-shadow:0 8px 18px #0005, inset 0 4px 12px #ffffff12, inset 0 -8px 14px #0005;
  align-items:center;justify-content:center;backdrop-filter:blur(4px);`;
document.body.appendChild(pauseBtn);

let pauseOverlay = null;
function makePauseButton(label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `cursor:pointer;width:100%;font-size:clamp(14px,3vw,18px);font-weight:900;
    color:#e8f5ff;background:#0b1020;border:2px solid #ffffff88;border-radius:999px;
    padding:clamp(10px,2vh,14px) clamp(18px,5vw,32px);box-shadow:0 8px 22px #0007;`;
  return b;
}

function showPauseMenu() {
  pauseOverlay?.remove();
  pauseOverlay = document.createElement('div');
  pauseOverlay.style.cssText = `position:fixed;inset:0;z-index:140;display:flex;align-items:center;justify-content:center;
    background:#050913dd;backdrop-filter:blur(6px);font-family:system-ui,sans-serif;color:#fff;pointer-events:auto;`;

  const panel = document.createElement('div');
  panel.style.cssText = `width:min(84vw,390px);display:flex;flex-direction:column;gap:12px;background:#071226ee;
    border:2px solid #ffffff55;border-radius:18px;padding:clamp(16px,4vw,26px);box-shadow:0 16px 46px #000b;`;

  const title = document.createElement('div');
  title.textContent = 'PAUSE';
  title.style.cssText = `font-size:clamp(28px,7vw,46px);font-weight:900;text-align:center;letter-spacing:1px;margin-bottom:4px;`;

  const resume = makePauseButton('CONTINUAR');
  const options = makePauseButton('OPÇÕES');
  const menu = makePauseButton('VOLTAR AO MENU');
  panel.append(title, resume, options, menu);
  pauseOverlay.appendChild(panel);
  document.body.appendChild(pauseOverlay);

  resume.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); resumeGame(); });
  options.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); makeOptionsPanel({ title: 'OPÇÕES' }); });
  menu.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); location.reload(); });
}

function pauseGame() {
  if (phase !== 'play' || won) return;
  phase = 'pause';
  player.controllable = false;
  document.exitPointerLock?.();
  showPauseMenu();
}

function resumeGame() {
  if (phase !== 'pause') return;
  pauseOverlay?.remove();
  pauseOverlay = null;
  phase = 'play';
  player.controllable = true;
  clock.getDelta();
}

pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pauseGame(); });
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' && e.code !== 'KeyP') return;
  if (phase === 'play') { e.preventDefault(); pauseGame(); }
  else if (phase === 'pause') { e.preventDefault(); resumeGame(); }
});

function centerCallout(text, color = '#fff', glow = '#2f9bff') {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:fixed;left:50%;top:50%;width:100vw;height:40vh;z-index:60;
    display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%) scale(.6);
    font-family:system-ui,sans-serif;font-size:clamp(30px,7vw,58px);font-weight:900;letter-spacing:1px;
    color:${color};text-align:center;text-shadow:0 6px 24px #000b,0 0 28px ${glow};
    pointer-events:none;opacity:0;transition:transform .5s cubic-bezier(.2,1.5,.4,1),opacity .4s;`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
  });
  setTimeout(() => { el.style.opacity = '0'; }, 1700);
  setTimeout(() => el.remove(), 2200);
}

// câmara a orbitar lentamente o jogador durante a intro (estilo Matrix)
function introCamera() {
  const m = player.model.position;
  const a = introT * 0.5;                   // rotação lenta
  const R = 3.4, h = 1.7;
  camera.position.set(m.x + Math.sin(a) * R, m.y + h, m.z + Math.cos(a) * R);
  camera.lookAt(m.x, m.y + 1.4, m.z);
}

function startGateIntro() {
  if (!level?.gate) {
    phase = 'play';
    player.controllable = true;
    orbit.snapBehind(player.facing);
    return;
  }
  phase = 'gateIntro';
  player.controllable = false;
  level.gate.intro = true;
  level.gate.pending = false;
  level.gate.introT = 0;
  level.gate.group.visible = true;
  level.gate.group.position.y = -5.8;
  level.gate.glow.intensity = 0;
  centerCallout('O PORTAO MALEFICO DESPERTA', '#ff4d5d', '#ff1238');
}

function updateGateIntro(dt) {
  const g = level.gate;
  g.introT += dt;
  const t = Math.min(g.introT / 3.2, 1);
  const rise = 1 - Math.pow(1 - t, 3);
  g.group.position.y = THREE.MathUtils.lerp(-5.8, 0, rise);
  g.glow.intensity = 8 + Math.sin(performance.now() * 0.012) * 3;
  camera.position.lerp(tmpVec.set(g.spawn.x, 3.6, g.spawn.z + 13), 1 - Math.pow(0.0004, dt));
  camera.lookAt(level.goal.x, 3.2, level.goal.z + 1.4);
  if (t >= 1) {
    g.intro = false;
    g.active = true;
    g.spawnT = 0.6;
    phase = 'play';
    player.controllable = true;
    orbit.snapBehind(player.facing);
  }
}

function startBossIntro(enemy) {
  bossIntro = { enemy, t: 0, duration: 5.8 };
  phase = 'bossIntro';
  player.controllable = false;
  document.exitPointerLock?.();
  centerCallout('BOSS FINAL', '#ff4d5d', '#ff1238');
}

function updateBossIntro(dt) {
  if (!bossIntro?.enemy?.alive) {
    bossIntro = null;
    phase = 'play';
    player.controllable = true;
    orbit.snapBehind(player.facing);
    return;
  }

  const e = bossIntro.enemy;
  bossIntro.t += dt;
  e.update(dt, player); // deixa o boss terminar carregamento e lançamento durante a cutscene

  const k = Math.min(bossIntro.t / bossIntro.duration, 1);
  const a = -Math.PI * 0.55 + k * Math.PI * 2.15;
  const radius = THREE.MathUtils.lerp(34, 22, Math.sin(k * Math.PI) * 0.45 + k * 0.25);
  const height = THREE.MathUtils.lerp(18, 10.5, k);
  const target = tmpVec.set(e.position.x, e.position.y + 5.0, e.position.z);

  camera.position.set(
    target.x + Math.sin(a) * radius,
    target.y + height,
    target.z + Math.cos(a) * radius
  );
  camera.lookAt(target);

  if (bossIntro.t >= bossIntro.duration) {
    bossIntro = null;
    phase = 'play';
    player.controllable = true;
    orbit.snapBehind(player.facing);
    orbit.distance = 12;
    orbit.height = 4.2;
    orbit.pitch = 0.48;
    hud.message('⚠️ Derrota o boss final!', 2.5);
  }
}

function updateBossCombatCamera(dt) {
  if (!level?.enemies || orbit.firstPerson) {
    orbit.setTarget(player.position);
    return false;
  }

  const boss = level.enemies.find((e) => e.isBoss && e.alive);
  const d = boss ? Math.hypot(boss.position.x - player.position.x, boss.position.z - player.position.z) : Infinity;
  const active = boss && d < 28;
  const smooth = 1 - Math.pow(0.025, dt);

  if (!active) {
    orbit.setTarget(player.position);
    orbit.distance = THREE.MathUtils.lerp(orbit.distance, NORMAL_CAM_DISTANCE, smooth);
    orbit.height = THREE.MathUtils.lerp(orbit.height, NORMAL_CAM_HEIGHT, smooth);
    orbit.pitch = THREE.MathUtils.lerp(orbit.pitch, NORMAL_CAM_PITCH, smooth * 0.45);
    return false;
  }

  const strength = THREE.MathUtils.clamp(1 - (d - 7) / 21, 0.25, 1);
  bossFocusTarget.lerpVectors(player.position, boss.position, 0.35 + strength * 0.25);
  bossFocusTarget.y = 1.1 + strength * 1.6;
  orbit.setTarget(bossFocusTarget);
  orbit.distance = THREE.MathUtils.lerp(orbit.distance, 10.5 + strength * 4.5, smooth);
  orbit.height = THREE.MathUtils.lerp(orbit.height, 3.4 + strength * 2.0, smooth);
  orbit.pitch = THREE.MathUtils.lerp(orbit.pitch, 0.46 + strength * 0.18, smooth * 0.8);
  return true;
}

function updateSpecialButton() {
  const btn = document.querySelector('[data-action="special"]');
  if (!btn) return;
  const type = player.specialReadyType;
  if (!type) {
    btn.textContent = 'ESP.';
    btn.style.opacity = '.28';
    btn.style.borderColor = '#ffffff33';
    btn.style.boxShadow = '0 8px 18px #0005, inset 0 4px 12px #ffffff12, inset 0 -8px 14px #0005';
    btn.style.background = 'linear-gradient(180deg,#2b385a55,#11182b44)';
    return;
  }
  const c = CLUBS[type];
  btn.textContent = type === 'speed' ? 'AZUL' : type === 'kick' ? 'VERM.' : 'VERDE';
  btn.style.opacity = '.92';
  btn.style.borderColor = '#ffffffcc';
  btn.style.background = `radial-gradient(circle at 35% 24%, #ffffff55, #ffffff00 28%), linear-gradient(180deg, ${c.ui}, ${c.ui}88)`;
  btn.style.boxShadow = `0 0 18px ${c.ui}, 0 8px 18px #0007`;
}

function startSpecial() {
  const type = player.specialReadyType;
  if (!type) { hud.message('Especial precisa de 3 bolas iguais.', 1.4); return false; }
  if (type === 'speed') {
    if (!player.activateSpecial(type)) return false;
    centerCallout('ESPECIAL AZUL', '#66b7ff', '#2f7be0');
    hud.message('Gigante azul: +HP e corpo maior durante 20s!', 2.5);
    return true;
  }
  if (type === 'jump') {
    if (!player.activateSpecial(type)) return false;
    centerCallout('ESPECIAL VERDE', '#6dff84', '#27c24a');
    hud.message('Salto sísmico: aterra para rebentar a área!', 2.5);
    return true;
  }
  if (type === 'kick') {
    if (!player.activateSpecial(type)) return false;
    redSpecial = { t: 0, duration: 1.75, hit: false };
    phase = 'redSpecial';
    player.controllable = false;
    document.exitPointerLock?.();
    centerCallout('ESPECIAL VERMELHO', '#ff5161', '#d11a2a');
    return true;
  }
  return false;
}

function damageEnemiesInFront(damage = 3) {
  const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  for (const e of level.enemies) {
    if (!e.alive) continue;
    const to = new THREE.Vector3().subVectors(e.position, player.position); to.y = 0;
    const d = to.length();
    if (d > 14) continue;
    const dir = to.clone().normalize();
    if (d < 2.2 || dir.dot(fwd) > 0.2) e.takeKick(player.position, 2.8, damage, 2.2);
  }
}

function damageEnemiesRadial(pos, radius, damage, force, mega = false) {
  for (const e of level.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
    if (d > radius) continue;
    e.takeKick(pos, force, damage, mega ? 2.8 : 1.4);
  }
}

function spawnShockwave(pos, color, radius) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.075, 12, 80), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(pos.x, pos.y + 0.08, pos.z);
  scene.add(mesh);
  shockwaves.push({ mesh, t: 0, duration: 0.55, radius });
}

function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.t += dt;
    const k = Math.min(s.t / s.duration, 1);
    s.mesh.scale.setScalar(1 + k * s.radius);
    s.mesh.material.opacity = (1 - k) * 0.85;
    if (k >= 1) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      shockwaves.splice(i, 1);
    }
  }
}

function updateRedSpecial(dt) {
  if (!redSpecial) return;
  redSpecial.t += dt;
  const k = Math.min(redSpecial.t / redSpecial.duration, 1);
  const a = -Math.PI * 0.5 + k * Math.PI * 2.35;
  const target = tmpVec.set(player.position.x, player.position.y + 1.3, player.position.z);
  const radius = 6.5;
  camera.position.set(target.x + Math.sin(a) * radius, target.y + 2.6, target.z + Math.cos(a) * radius);
  camera.lookAt(target.x, target.y + 0.35, target.z);

  if (!redSpecial.hit && redSpecial.t >= 0.78) {
    redSpecial.hit = true;
    player.tryKick();
    damageEnemiesInFront(3);
    const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
    spawnShockwave(player.position.clone().addScaledVector(fwd, 2.4), 0xff3040, 8);
  }

  if (k >= 1) {
    redSpecial = null;
    phase = 'play';
    player.controllable = true;
    orbit.snapBehind(player.facing);
  }
}

function spawnGateEnemy(isBoss = false) {
  const g = level.gate;
  const idx = isBoss ? g.totalExtraSpawns : g.spawned;
  const size = isBoss ? 3.0 : 1.08 + idx * 0.035;
  const width = isBoss ? 3.45 : size * (1.05 + idx * 0.008);
  const pos = randomFieldPoint(0);
  pos.z = THREE.MathUtils.clamp(pos.z, -35, 42);
  const enemy = new Enemy(scene, pos, {
    number: isBoss ? 99 : 2 + (idx % 9),
    speed: isBoss ? 4.2 : 5.1 + Math.min(idx * 0.04, 0.9),
    detect: isBoss ? 28 : 20,
    hp: isBoss ? 18 : 3 + Math.floor(idx / 6),
    scale: size,
    widthScale: width,
    radius: isBoss ? 1.7 : 0.75,
    spawnFrom: g.spawn,
    chargeTime: isBoss ? 1.55 : 1.0,
    flightTime: isBoss ? 1.25 : 0.9,
  });
  enemy.isGateSpawn = true;
  enemy.isBoss = isBoss;
  level.enemies.push(enemy);
  if (isBoss) {
    g.bossSpawned = true;
    playWhistle();
    startBossIntro(enemy);
  } else {
    g.spawned++;
  }
}

function destroyGate() {
  const g = level.gate;
  if (g.destroyed) return;
  g.destroyed = true;
  g.active = false;
  g.glow.intensity = 0;
  playWhistle();
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0x2b0610,
    emissive: 0xff1028,
    emissiveIntensity: 0.5,
    roughness: 0.9,
  });
  for (let i = 0; i < 24; i++) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(0.25 + Math.random() * 0.45, 0.35 + Math.random() * 0.7, 0.2), shardMat.clone());
    shard.position.set(level.goal.x + (Math.random() - 0.5) * 6.2, 2 + Math.random() * 4.5, level.goal.z + 1.4 + (Math.random() - 0.5) * 1.2);
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shard.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 9, 3 + Math.random() * 7, 3 + Math.random() * 5);
    scene.add(shard);
    g.shards.push(shard);
  }
  g.group.visible = false;
}

function updateGateEvent(dt) {
  const g = level.gate;
  if (!g) return;

  for (const e of level.enemies) {
    if (e.isGateSpawn && !e.alive && !e._countedDefeat) {
      e._countedDefeat = true;
      g.defeated++;
    }
  }

  if (g.active && !g.destroyed) {
    const open = 0.35 + Math.sin(performance.now() * 0.005) * 0.12;
    g.leftDoor.position.x = -1.55 - open;
    g.rightDoor.position.x = 1.55 + open;
    g.glow.intensity = 10 + Math.sin(performance.now() * 0.012) * 4;

    const normalGateEnemies = level.enemies.filter((e) => e.isGateSpawn && !e.isBoss);
    const allNormalSpawned = g.spawned >= g.totalExtraSpawns;
    const allNormalDefeated = allNormalSpawned && normalGateEnemies.length >= g.totalExtraSpawns && normalGateEnemies.every((e) => !e.alive);
    const boss = level.enemies.find((e) => e.isGateSpawn && e.isBoss);

    g.spawnT -= dt;
    if (g.spawnT <= 0 && !allNormalSpawned) {
      spawnGateEnemy(false);
      g.spawnT = g.spawned > 24 ? 2.2 : 2.8;
    } else if (!g.bossSpawned && allNormalDefeated) {
      spawnGateEnemy(true);
    }

    if (g.bossSpawned && boss && !boss.alive) {
      g.bossDefeated = true;
      destroyGate();
      level.goalActive = true;
      centerCallout('PROCURA A BALIZA DOURADA', '#ffe66b', '#ffd23c');
    }
  }

  for (const s of g.shards) {
    s.userData.vel.y -= 18 * dt;
    s.position.addScaledVector(s.userData.vel, dt);
    s.rotation.x += dt * 4;
    s.rotation.z += dt * 5;
    if (s.position.y < -1) s.visible = false;
  }
}

function updatePowerSpawns(dt) {
  const p = level.powerSpawn;
  if (!p) return;
  p.t -= dt;
  if (p.t > 0) return;
  p.t = p.interval;
  const type = p.types[p.index++ % p.types.length];
  const pos = randomFieldPoint(1.5);
  level.balls.push(new PowerBall(scene, pos, type, {
    spawnFrom: p.source || level.ballSpawnSource || level.goal?.clone().add(new THREE.Vector3(0, 1.2, 2.8)) || pos,
    chargeTime: 1.15,
    flightTime: 1.0,
  }));
}

function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(clock.getDelta(), 0.05);

  if (phase !== 'menu' && phase !== 'bossIntro' && phase !== 'pause' && !won) player.update(dt);   // intro/redSpecial: sem controlo; play: controlado

  if (phase === 'play' && !won) {
    const bossFocus = updateBossCombatCamera(dt);
    orbit.setFollow(player.facing, Math.hypot(player.velocity.x, player.velocity.z) > 1.2 && !bossFocus);
    player.model.visible = !orbit.firstPerson;

    if (input.special()) startSpecial();
    if (input.attack()) player.tryKick();
    if (player.kickActive) doKick();

    const shock = player.consumeLandingShockwave();
    if (shock) {
      spawnShockwave(player.position, shock.color, shock.radius);
      damageEnemiesRadial(player.position, shock.radius, shock.damage, shock.force, shock.mega);
    }

    sun.position.set(player.position.x + 20, 35, player.position.z + 15);
    sun.target.position.copy(player.position);

    const sp = Math.hypot(player.velocity.x, player.velocity.z);
    const running = player.sprinting && sp > 5 && player.hasSpeed;
    speedFx.update(dt, player.position, new THREE.Vector3(player.velocity.x, 0, player.velocity.z), sp, running);
    const wantFov = bossFocus ? Math.max(70, running ? SPRINT_FOV : BASE_FOV) : (running ? SPRINT_FOV : BASE_FOV);
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov += (wantFov - camera.fov) * Math.min(dt * 5, 1);
      camera.updateProjectionMatrix();
    }

    for (const b of level.balls) {
      const got = b.update(dt, player);
      if (got) hud.clubPop(got);
    }
    for (const e of level.enemies) e.update(dt, player);
    updateGateEvent(dt);
    updatePowerSpawns(dt);

    if (level.gate?.pending && level.enemies.some((e) => e.isInitialEnemy) &&
        level.enemies.filter((e) => e.isInitialEnemy).every((e) => !e.alive)) {
      startGateIntro();
    }

    if (player.powerCount < prevPowers) hud.message(player.hasShield ? '🛡️ Escudo azul ativo.' : '⚠️ Poder consumido!', 2.0);
    else if (player.hp < prevHp) hud.message('💔 Sem escudo — estás a perder HP! Apanha bolas.', 2.5);
    prevPowers = player.powerCount; prevHp = player.hp;

    if (!level.gate && level.requireClear && !level.goalActive &&
        level.enemies.length && level.enemies.every((e) => !e.alive)) {
      level.goalActive = true;
      playWhistle();
      centerCallout('PROCURA A BALIZA DOURADA', '#ffe66b', '#ffd23c');
    }
    if (level.goalActive) {
      const pulse = 0.6 + Math.sin(performance.now() * 0.006) * 0.4;
      if (level.goalGlow) level.goalGlow.intensity = 18 + pulse * 28;
      if (level.goalParts) for (const m of level.goalParts) m.material.emissiveIntensity = 1.2 + pulse * 2.8;
      if (level.goalAura) {
        level.goalAura.visible = true;
        level.goalAura.rotation.y += dt * 0.9;
        level.goalAura.rotation.z -= dt * 0.45;
        const s = 0.92 + pulse * 0.18;
        level.goalAura.scale.setScalar(s);
        for (const c of level.goalAura.children) c.material.opacity = 0.16 + pulse * 0.22;
      }
    }

    for (const t of level.triggers) {
      if (t.fired) continue;
      if (t.type === 'goal' && level.requireClear && !level.goalActive) continue;
      if (Math.hypot(player.position.x - t.pos.x, player.position.z - t.pos.z) < t.r) {
        t.fired = true;
        if (t.type === 'msg') continue;
        if (t.type === 'goal') win();
      }
    }
  }

  updateShockwaves(dt);
  updateSpecialButton();

  if (phase === 'intro') { introT += dt; introCamera(); }
  else if (phase === 'gateIntro') updateGateIntro(dt);
  else if (phase === 'bossIntro') updateBossIntro(dt);
  else if (phase === 'redSpecial') updateRedSpecial(dt);
  else if (phase === 'play') orbit.update(dt);
  hud.setGameplayVisible((phase === 'play' || phase === 'pause' || phase === 'redSpecial') && !won);
  pauseBtn.style.display = phase === 'play' && !won ? 'flex' : 'none';
  hud.update(player, dt);
  input.endFrame();
  renderer.render(scene, camera);
}

// intro (cutscene) -> jogo
function startIntro() {
  phase = 'intro'; introT = 0;
  player.controllable = false;
  startGameplayMusic(level?.gate ? 'career' : 'tutorial');
  runIntro(
    ['Parece que o estádio foi invadido por jogadores do Benfica que viraram monstros!',
     'Vou ter de salvar o futebol!'],
    () => { phase = 'play'; player.controllable = true; orbit.snapBehind(player.facing); }
  );
}

function win() {
  won = true;
  document.exitPointerLock?.();
  pauseOverlay?.remove();
  pauseOverlay = null;
  pauseBtn.style.display = 'none';
  const stats = {
    enemiesKilled: level.enemies.filter((e) => !e.alive).length,
    enemiesTotal: level.enemies.length,
    ballsCollected: player.coins,
    ballsTotal: level.balls.length,
  };
  hud.endScreen('GOLO! 🥅', stats, () => location.reload());
}

loop();
showMenu((mode) => setupWorld(mode, startIntro));
window.__startGame = (mode) => setupWorld(mode || 'career', startIntro);
console.log('%cG.CALDEIRA 8 — Prologue', 'color:#3fae4a;font-weight:bold');
