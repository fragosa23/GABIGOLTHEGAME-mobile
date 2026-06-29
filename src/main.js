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
import { showMenu } from './ui/menu.js';
import { runIntro } from './ui/intro.js';

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
window.addEventListener('click', resumeAudio);

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
      e.takeKick(player.position, player.kickForce);
    }
  }
}

let won = false;
let phase = 'menu';    // 'menu' | 'intro' | 'play'
let introT = 0;
let prevPowers = 0, prevHp = player.hp;
const clock = new THREE.Clock();
const tmpVec = new THREE.Vector3();

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
  level.gate.introT = 0;
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
    g.spawnT = 1;
    phase = 'play';
    player.controllable = true;
    orbit.snapBehind(player.facing);
  }
}

function spawnGateEnemy(isBoss = false) {
  const g = level.gate;
  const idx = g.spawned;
  const size = isBoss ? 3.0 : 1.08 + idx * 0.035;
  const width = isBoss ? 3.45 : size * (1.05 + idx * 0.008);
  const pos = g.spawn.clone();
  pos.x += (Math.random() - 0.5) * 5.5;
  pos.z += Math.random() * 3.5;
  const enemy = new Enemy(scene, pos, {
    number: isBoss ? 99 : 2 + (idx % 9),
    speed: isBoss ? 4.2 : 5.1 + Math.min(idx * 0.04, 0.9),
    detect: isBoss ? 28 : 20,
    hp: isBoss ? 18 : 3 + Math.floor(idx / 6),
    scale: size,
    widthScale: width,
    radius: isBoss ? 1.7 : 0.75,
  });
  enemy.isGateSpawn = true;
  enemy.isBoss = isBoss;
  level.enemies.push(enemy);
  g.spawned++;
  if (isBoss) {
    g.bossSpawned = true;
    playWhistle();
    centerCallout('BOSS FINAL', '#ff4d5d', '#ff1238');
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
    if (!e.alive && !e._countedDefeat) {
      e._countedDefeat = true;
      g.defeated++;
    }
  }

  if (g.active && !g.destroyed) {
    const open = 0.35 + Math.sin(performance.now() * 0.005) * 0.12;
    g.leftDoor.position.x = -1.55 - open;
    g.rightDoor.position.x = 1.55 + open;
    g.glow.intensity = 10 + Math.sin(performance.now() * 0.012) * 4;
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.spawned < g.totalExtraSpawns) {
      const next = g.spawned + 1;
      spawnGateEnemy(next === g.totalExtraSpawns);
      g.spawnT = 5;
    }
    if (g.defeated >= g.totalToDefeat) {
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
  const pos = p.pos.clone();
  pos.x += (Math.random() - 0.5) * 6;
  pos.z += (Math.random() - 0.5) * 2.5;
  level.balls.push(new PowerBall(scene, pos, type));
}

function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(clock.getDelta(), 0.05);

  if (phase !== 'menu' && !won) player.update(dt);   // intro: idle; play: controlado

  if (phase === 'play' && !won) {
    orbit.setTarget(player.position);
    // câmara segue atrás do jogador; volta às costas ao mover-se
    orbit.setFollow(player.facing, Math.hypot(player.velocity.x, player.velocity.z) > 1.2);
    // em 1ª pessoa, o corpo não aparece à frente da câmara
    player.model.visible = !orbit.firstPerson;

    if (input.attack()) player.tryKick();
    if (player.kickActive) doKick();

    sun.position.set(player.position.x + 20, 35, player.position.z + 15);
    sun.target.position.copy(player.position);

    // efeito de velocidade SÓ com o poder de velocidade (PORTO/azul): linhas + FOV
    const sp = Math.hypot(player.velocity.x, player.velocity.z);
    const running = player.sprinting && sp > 5 && player.hasSpeed;
    speedFx.update(dt, player.position, new THREE.Vector3(player.velocity.x, 0, player.velocity.z), sp, running);
    const wantFov = running ? SPRINT_FOV : BASE_FOV;
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

    // feedback quando perde poder / HP
    if (player.powerCount < prevPowers) hud.message('⚠️ Roubaram-te um poder!', 2.5);
    else if (player.hp < prevHp) hud.message('💔 Sem poderes — estás a perder HP! Apanha bolas.', 2.5);
    prevPowers = player.powerCount; prevHp = player.hp;

    // todos os inimigos eliminados -> a baliza-objetivo acende e o golo passa a contar
    if (!level.gate && level.requireClear && !level.goalActive &&
        level.enemies.length && level.enemies.every((e) => !e.alive)) {
      level.goalActive = true;
      playWhistle();
      centerCallout('PROCURA A BALIZA DOURADA', '#ffe66b', '#ffd23c');
    }
    if (level.goalActive) {
      const pulse = 0.6 + Math.sin(performance.now() * 0.006) * 0.4; // 0.2..1.0
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
      if (t.type === 'goal' && level.requireClear && !level.goalActive) continue; // baliza fechada até limpar
      if (Math.hypot(player.position.x - t.pos.x, player.position.z - t.pos.z) < t.r) {
        t.fired = true;
        if (t.type === 'msg') continue;
        if (t.type === 'goal') win();
      }
    }
  }

  if (phase === 'intro') { introT += dt; introCamera(); }
  else if (phase === 'gateIntro') updateGateIntro(dt);
  else if (phase === 'play') orbit.update(dt);
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
    () => {
      if (level?.gate) startGateIntro();
      else { phase = 'play'; player.controllable = true; orbit.snapBehind(player.facing); }
    } // câmara nas costas
  );
}

function win() {
  won = true;
  document.exitPointerLock?.();
  const stats = {
    enemiesKilled: level.enemies.filter((e) => !e.alive).length,
    enemiesTotal: level.enemies.length,
    ballsCollected: player.coins,
    ballsTotal: level.balls.length,
  };
  // CONTINUAR -> volta ao menu inicial (recarrega para um jogo limpo)
  hud.endScreen('GOLO! 🥅', stats, () => location.reload());
}

loop();
// menu inicial: escolhe TUTORIAL ou MODO CARREIRA -> constrói o nível -> intro
showMenu((mode) => setupWorld(mode, startIntro));
window.__startGame = (mode) => setupWorld(mode || 'career', startIntro); // hook p/ testes
console.log('%cG.CALDEIRA 8 — Prologue', 'color:#3fae4a;font-weight:bold');
