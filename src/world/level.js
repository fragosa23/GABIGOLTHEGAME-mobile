import * as THREE from 'three';
import { celMesh, toonMat } from '../engine/toon.js';
import { PowerBall } from '../entities/ball.js';
import { Enemy } from '../entities/enemy.js';

// Constrói o nível prologue: balneário -> túnel -> relvado.
export function buildLevel(scene, physics) {
  const balls = [];
  const enemies = [];
  const triggers = [];

  // helper: caixa visual + collider
  function solid(cx, cy, cz, sx, sy, sz, color, outline = 0.05) {
    const mesh = celMesh(new THREE.BoxGeometry(sx, sy, sz), color, outline);
    mesh.position.set(cx, cy, cz);
    scene.add(mesh);
    physics.addBox(new THREE.Vector3(cx, cy, cz), new THREE.Vector3(sx / 2, sy / 2, sz / 2));
    return mesh;
  }
  // chão só visual (collider fino próprio)
  function floor(cx, cz, sx, sz, color) {
    const mesh = celMesh(new THREE.BoxGeometry(sx, 1, sz), color, 0);
    mesh.position.set(cx, -0.5, cz);
    scene.add(mesh);
    physics.addBox(new THREE.Vector3(cx, -0.5, cz), new THREE.Vector3(sx / 2, 0.5, sz / 2));
  }

  // ---------- BALNEÁRIO ----------
  floor(0, -15, 22, 16, 0x6d5b8a);            // chão de azulejo roxo
  // paredes
  solid(0, 2.5, -23, 22, 6, 0.6, 0xb3a6cf, 0);   // fundo
  solid(-11, 2.5, -15, 0.6, 6, 16, 0xb3a6cf, 0); // esquerda
  solid(11, 2.5, -15, 0.6, 6, 16, 0xb3a6cf, 0);  // direita
  // parede da frente com abertura (duas metades, buraco ao centro p/ túnel)
  solid(-7, 2.5, -7, 8, 6, 0.6, 0xb3a6cf, 0);
  solid(7, 2.5, -7, 8, 6, 0.6, 0xb3a6cf, 0);
  solid(0, 5, -7, 6, 1, 0.6, 0xb3a6cf, 0);       // verga por cima da porta
  // teto
  const ceil = celMesh(new THREE.BoxGeometry(22, 0.4, 16), 0x4a3f63, 0);
  ceil.position.set(0, 5.8, -15); scene.add(ceil);
  physics.addBox(new THREE.Vector3(0, 5.8, -15), new THREE.Vector3(11, 0.2, 8)); // colisor (a câmara deteta interior)

  // cacifos (lockers)
  for (let i = -4; i <= 4; i++) {
    const c = solid(i * 2, 1.4, -22.2, 1.7, 2.8, 0.8, i % 2 ? 0x2e6db4 : 0x244f86, 0.04);
  }
  // bancos
  solid(-6, 0.5, -13, 5, 0.6, 1, 0x8a5a2b);
  solid(6, 0.5, -13, 5, 0.6, 1, 0x8a5a2b);

  // pedestal + primeira bola (tutorial power-up)
  solid(0, 0.5, -12, 1.2, 1, 1.2, 0xf0d24a);
  balls.push(new PowerBall(scene, new THREE.Vector3(0, 1.7, -12), 'kick'));

  // ---------- TÚNEL ----------
  floor(0, -3.5, 6, 9, 0x3a3a44);
  solid(-3, 2.5, -3.5, 0.6, 6, 9, 0x2b2b33, 0);
  solid(3, 2.5, -3.5, 0.6, 6, 9, 0x2b2b33, 0);
  const tunnelCeil = celMesh(new THREE.BoxGeometry(6.5, 0.4, 9), 0x1f1f27, 0);
  tunnelCeil.position.set(0, 5.5, -3.5); scene.add(tunnelCeil);
  physics.addBox(new THREE.Vector3(0, 5.5, -3.5), new THREE.Vector3(3.25, 0.2, 4.5));

  // ---------- RELVADO ----------
  const pitchZ = 32, pitchHalf = 40;
  floor(0, pitchZ, 80, 64, 0x3fae4a);
  // linhas / círculo central (só visual)
  const ringGeo = new THREE.RingGeometry(7.6, 8, 48);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xeafff0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, pitchZ);
  scene.add(ring);

  // bancadas (fundo) - decorativas + colisor
  solid(0, 4, pitchZ + 33, 80, 8, 4, 0x9aa7b5, 0);
  for (let i = 0; i < 5; i++) {
    solid(0, 1 + i * 1.4, pitchZ + 28 + i * 2, 80, 0.6, 2, i % 2 ? 0xcfd8e2 : 0xb9c4d0, 0);
  }
  // muros laterais do relvado
  solid(-40, 2, pitchZ, 0.8, 5, 64, 0x2e8b3a, 0);
  solid(40, 2, pitchZ, 0.8, 5, 64, 0x2e8b3a, 0);
  solid(0, 2, 64, 80, 5, 0.8, 0x2e8b3a, 0);

  // --- plataformas para saltar (painéis publicitários e blocos) ---
  const platColors = [0xff5a3c, 0xffd23c, 0x3ca0ff, 0xff5a3c];
  const plats = [
    [-12, 1.2, 12, 4, 0.6, 4],
    [-6, 2.6, 18, 4, 0.6, 4],
    [0, 4.0, 22, 4, 0.6, 4],
    [8, 3.0, 16, 4, 0.6, 4],
    [16, 1.6, 22, 5, 0.6, 5],
    [12, 5.2, 30, 4, 0.6, 4],
    [4, 6.4, 34, 4, 0.6, 4],
  ];
  plats.forEach((p, i) => solid(p[0], p[1], p[2], p[3], p[4], p[5], platColors[i % platColors.length]));

  // bolas-power (clubes) espalhadas no relvado
  balls.push(new PowerBall(scene, new THREE.Vector3(-6, 3.6, 18), 'jump'));
  balls.push(new PowerBall(scene, new THREE.Vector3(0, 5.0, 22), 'speed'));
  balls.push(new PowerBall(scene, new THREE.Vector3(4, 7.4, 34), 'kick'));
  balls.push(new PowerBall(scene, new THREE.Vector3(-18, 1.2, 8), 'speed'));
  balls.push(new PowerBall(scene, new THREE.Vector3(20, 1.2, 10), 'jump'));

  // --- baliza-objetivo no fundo ---
  const goalPos = new THREE.Vector3(0, 0, 56);
  buildGoal(scene, goalPos);
  // gatilho do objetivo
  triggers.push({ type: 'goal', pos: goalPos.clone(), r: 3.5, fired: false });

  // --- adversários no relvado (Nível 1: BENFICA) ---
  enemies.push(new Enemy(scene, new THREE.Vector3(-8, 0, 14), { number: 7 }));
  enemies.push(new Enemy(scene, new THREE.Vector3(10, 0, 20), { number: 10, speed: 6 }));
  enemies.push(new Enemy(scene, new THREE.Vector3(0, 0, 40), { number: 9, detect: 18 }));

  // --- gatilhos de tutorial (zonas) ---
  triggers.push({ type: 'msg', pos: new THREE.Vector3(0, 0, -16), r: 4, fired: false,
    text: 'Bem-vindo ao balneário! WASD/setas para andar, SHIFT para correr, rato para a câmara.' });
  triggers.push({ type: 'msg', pos: new THREE.Vector3(0, 0, -12), r: 3, fired: false,
    text: 'Apanha as bolas! AZUL(Porto)=velocidade, VERMELHA(Braga)=chute forte, VERDE(S.Pedro)=salto duplo. As bolas a orbitar-te mostram os poderes!' });
  triggers.push({ type: 'msg', pos: new THREE.Vector3(0, 0, -4), r: 3, fired: false,
    text: 'SALTAR para saltar. CHUTAR ataca os monstros. (O salto duplo precisa do poder VERDE!)' });
  triggers.push({ type: 'msg', pos: new THREE.Vector3(0, 0, 4), r: 5, fired: false,
    text: 'Nível 1: BENFICA! Os monstros de vermelho roubam-te um poder a cada toque. CTRL para chutar!' });
  triggers.push({ type: 'msg', pos: new THREE.Vector3(0, 0, 22), r: 6, fired: false,
    text: 'Quantas mais bolas da mesma cor, mais forte o poder! Os monstros roubam-te um poder a cada toque.' });

  return {
    spawn: new THREE.Vector3(0, 2, -16),
    balls, enemies, triggers, goal: goalPos,
  };
}

function buildGoal(scene, pos) {
  const mat = toonMat(0xffffff);
  const post = (x) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 12), mat);
    m.position.set(pos.x + x, 2.5, pos.z); m.castShadow = true; scene.add(m);
  };
  post(-3.5); post(3.5);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7.4, 12), mat);
  bar.position.set(pos.x, 5, pos.z); bar.rotation.z = Math.PI / 2; scene.add(bar);
  // rede (plano semi-transparente)
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, wireframe: true })
  );
  net.position.set(pos.x, 2.5, pos.z + 1.2); scene.add(net);
}
