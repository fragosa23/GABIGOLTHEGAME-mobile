import * as THREE from 'three';
import { createRenderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { Physics } from './engine/physics.js';
import { OrbitCamera } from './player/camera.js';
import { Player } from './player/player.js';
import { buildLevel } from './world/level.js';
import { buildDragaoLevel } from './world/dragao.js';
import { HUD } from './ui/hud.js';
import { SpeedFx } from './engine/speedFx.js';
import { resumeAudio, startCrowd } from './engine/audio.js';
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
    if (d - ENEMY_RADIUS > player.kickRange) continue;
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

// câmara a orbitar lentamente o jogador durante a intro (estilo Matrix)
function introCamera() {
  const m = player.model.position;
  const a = introT * 0.5;                   // rotação lenta
  const R = 3.4, h = 1.7;
  camera.position.set(m.x + Math.sin(a) * R, m.y + h, m.z + Math.cos(a) * R);
  camera.lookAt(m.x, m.y + 1.4, m.z);
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

    // feedback quando perde poder / HP
    if (player.powerCount < prevPowers) hud.message('⚠️ Roubaram-te um poder!', 2.5);
    else if (player.hp < prevHp) hud.message('💔 Sem poderes — estás a perder HP! Apanha bolas.', 2.5);
    prevPowers = player.powerCount; prevHp = player.hp;

    // todos os inimigos eliminados -> a baliza-objetivo acende e o golo passa a contar
    if (level.requireClear && !level.goalActive &&
        level.enemies.length && level.enemies.every((e) => !e.alive)) {
      level.goalActive = true;
      hud.message('🥅 Inimigos eliminados! A baliza brilha — entra nela para marcar!', 5);
    }
    if (level.goalActive) {
      const pulse = 0.6 + Math.sin(performance.now() * 0.006) * 0.4; // 0.2..1.0
      if (level.goalGlow) level.goalGlow.intensity = 8 + pulse * 12;
      if (level.goalParts) for (const m of level.goalParts) m.material.emissiveIntensity = pulse;
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
  else if (phase === 'play') orbit.update(dt);
  hud.update(player, dt);
  input.endFrame();
  renderer.render(scene, camera);
}

// intro (cutscene) -> jogo
function startIntro() {
  phase = 'intro'; introT = 0;
  player.controllable = false;
  startCrowd();
  runIntro(
    ['Parece que o estádio foi invadido por jogadores do Benfica que viraram monstros!',
     'Vou ter de salvar o futebol!'],
    () => { phase = 'play'; player.controllable = true; orbit.snapBehind(player.facing); } // câmara nas costas
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
