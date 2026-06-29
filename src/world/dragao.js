import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Enemy } from '../entities/enemy.js';
import { PowerBall } from '../entities/ball.js';
import glbUrl from '../../assets/dragao.glb?url';
import seatData from '../../assets/seats.json';

// Converte coordenadas Blender (Z-up) -> three.js (Y-up), como no export_yup
const P = (x, y, z) => new THREE.Vector3(x, z, -y);

// Constrói o nível MODO CARREIRA (estádio do Dragão). Carrega GLB async.
export function buildDragaoLevel(scene, physics, onReady) {
  const balls = [], enemies = [], triggers = [];
  // estádio é enorme (271×304 m) -> afastar a névoa para não embranquecer tudo
  scene.fog = new THREE.Fog(0x8fd0ff, 220, 1100);

  // NOTA: não carregamos os colisores do meta.json no modo carreira. As proxies COL
  // estavam todas na origem (cubo gigante a meio-campo a +8.5 m) e a placa este ficava
  // a +0.5 m — davam "degraus" e faziam o jogador flutuar. O campo é plano e fechado
  // pelo muro (perímetro), por isso basta o chão a y=0 + as 4 paredes do perímetro.
  // chão plano ao nível 0 (relvado) — jogador anda à altura da relva (y≈0)
  physics.addBox(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(60, 0.5, 80));

  // MURO do campo — paredes altas e invisíveis a toda a volta do relvado para o
  // jogador não poder sair do campo (o limite é o muro em redor: x±37.65, z±56.15).
  const WX = 37.65, WZ = 56.15, WH = 5; // semieixos do retângulo do campo + altura
  physics.addBox(new THREE.Vector3( WX, WH, 0), new THREE.Vector3(0.3, WH, WZ)); // lado este
  physics.addBox(new THREE.Vector3(-WX, WH, 0), new THREE.Vector3(0.3, WH, WZ)); // lado oeste (fecha o túnel)
  physics.addBox(new THREE.Vector3(0, WH,  WZ), new THREE.Vector3(WX, WH, 0.3)); // fundo norte
  physics.addBox(new THREE.Vector3(0, WH, -WZ), new THREE.Vector3(WX, WH, 0.3)); // fundo sul (baliza-objetivo)

  // LUZES do balneário + túnel (zona interior, escura)
  const lamp = (x, z, inten = 12, dist = 16) => {
    const l = new THREE.PointLight(0xfff2d8, inten, dist, 2);
    l.position.set(x, 3.0, z); scene.add(l);
  };
  lamp(-83, 11); lamp(-83, 17); lamp(-75, 11); lamp(-75, 17);  // balneário (~18×13 m)
  lamp(-66, 0); lamp(-56, 0); lamp(-46, 0);                    // túnel até ao campo

  // CADEIRAS AZUIS — 14 984 lugares como InstancedMesh (1 draw call, dá vida ao estádio)
  const sGeo = new THREE.BoxGeometry(0.45, 0.4, 0.45);
  const sMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const nSeats = seatData.n, sp = seatData.p;
  const seats = new THREE.InstancedMesh(sGeo, sMat, nSeats);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < nSeats; i++) {
    m4.makeTranslation(sp[i * 3], sp[i * 3 + 2], -sp[i * 3 + 1]); // Blender -> three
    seats.setMatrixAt(i, m4);
    col.setHSL(0.585, 0.72, 0.40 + Math.random() * 0.18);          // azul com variação
    seats.setColorAt(i, col);
  }
  seats.instanceMatrix.needsUpdate = true;
  if (seats.instanceColor) seats.instanceColor.needsUpdate = true;
  scene.add(seats);

  // posições-chave (Blender -> three)
  const spawn = new THREE.Vector3(0, 1.1, 30);                  // no relvado, virado para a baliza (-z)

  // objetivo: a baliza Goal_Right, agora no lado -z (centro real ~ (0.67, _, -52.6))
  const goal = new THREE.Vector3(0.67, 1.5, -52.6);
  // brilho da baliza — acende quando todos os inimigos morrem (peças preenchidas no load)
  const goalGlow = new THREE.PointLight(0xffe14d, 0, 30, 2);
  goalGlow.position.set(goal.x, 3, goal.z); scene.add(goalGlow);
  const goalParts = [];
  const goalAura = new THREE.Group();
  goalAura.position.set(goal.x, 2.8, goal.z);
  goalAura.visible = false;
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xffd23c,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const auraRingA = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.08, 12, 96), auraMat.clone());
  const auraRingB = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.06, 12, 96), auraMat.clone());
  const auraHalo = new THREE.Mesh(new THREE.RingGeometry(2.2, 4.8, 96), auraMat.clone());
  auraRingA.rotation.x = Math.PI / 2;
  auraRingB.rotation.y = Math.PI / 2;
  auraHalo.rotation.y = Math.PI / 2;
  goalAura.add(auraRingA, auraRingB, auraHalo);
  scene.add(goalAura);

  // GLB visual
  new GLTFLoader().load(glbUrl, (gltf) => {
    const root = gltf.scene;
    root.traverse((o) => {
      if (o.isMesh) {
        o.receiveShadow = true; o.castShadow = false; o.frustumCulled = true;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mm) { if (m && 'metalness' in m) { m.metalness = 0; m.roughness = 0.9; } }
      }
    });
    // a baliza Goal_Right ficou no meio-campo (z≈0); a Goal_Left está correta em z≈+52.5.
    // Mover a Goal_Right para o lado oposto (z≈-52.5) e guardar as peças para o brilho.
    for (const o of root.children) {
      if (!o.name || !o.name.startsWith('Goal_Right_')) continue;
      o.position.z -= 52.5;
      o.traverse((c) => {
        if (!c.isMesh) return;
        c.material = c.material.clone();                 // material próprio p/ poder brilhar
        if ('emissive' in c.material) c.material.emissive = new THREE.Color(0xffe14d);
        if ('emissiveIntensity' in c.material) c.material.emissiveIntensity = 0;
        goalParts.push(c);
      });
    }
    scene.add(root);
    onReady && onReady(root);
  }, undefined, (e) => { console.error('Falha a carregar dragao.glb', e); onReady && onReady(null); });

  // inimigos (Benfica) no relvado
  enemies.push(new Enemy(scene, P(-20, 8, 0), { number: 7 }));
  enemies.push(new Enemy(scene, P(10, -6, 0), { number: 10, speed: 6 }));
  enemies.push(new Enemy(scene, P(0, 30, 0), { number: 9, detect: 18 }));
  enemies.push(new Enemy(scene, P(18, 20, 0), { number: 4 }));

  // bolas-poder: espalhadas pelo relvado
  balls.push(new PowerBall(scene, P(-25, -25, 1.5), 'kick'));
  balls.push(new PowerBall(scene, P(-30, 0, 1.5), 'speed'));
  balls.push(new PowerBall(scene, P(-10, 18, 1.5), 'jump'));
  balls.push(new PowerBall(scene, P(15, -15, 1.5), 'speed'));
  balls.push(new PowerBall(scene, P(0, 40, 1.5), 'kick'));

  // objetivo: entrar na baliza (só conta depois de matar todos os inimigos)
  triggers.push({ type: 'goal', pos: goal.clone(), r: 4, fired: false });
  // mensagem de entrada
  triggers.push({ type: 'msg', pos: spawn.clone(), r: 6, fired: false,
    text: 'Estás no relvado do Dragão! Elimina todos os inimigos e marca golo. SHIFT corre, CTRL chuta.' });

  return {
    spawn, facing: Math.PI,       // virado para -z (a baliza-objetivo)
    balls, enemies, triggers, goal,
    goalParts, goalGlow, goalAura, // peças/luz/aura da baliza para o brilho
    requireClear: true,           // a baliza só conta com todos os inimigos mortos
    goalActive: false,
  };
}
