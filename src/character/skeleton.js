import * as THREE from 'three';
import { addPart, toon, makeTextTexture } from './utils.js';
import { buildHair } from './hair.js';
import { buildFace } from './face.js';

// Esqueleto procedural anatómico do jogador.
// Muitas peças separadas + juntas esféricas para ligações realistas.
// Devolve THREE.Group com userData.parts (ossos) e userData.mats (materiais).
export function buildPlayerSkeleton(config = {}) {
  const root = new THREE.Group();
  root.name = 'PlayerRoot';

  const M = {
    skin: toon(config.skinColor || 0xe3a878),
    skinDark: toon(0xc98a5f),
    shirt: toon(config.shirt || 0x57a8ea),
    trim: toon(config.trim || 0x14171c),
    shorts: toon(config.shorts || 0x0e0f12),
    socks: toon(config.socks || 0x0c0c0e),
    sockTrim: toon(0x24242a),
    boot: toon(config.boots || 0x1f5fd0),
    bootDark: toon(0x14161a),
    white: toon(0xf2f2f2),
    black: toon(0x0a0a0c),
  };

  const G = (name, parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g;
  };

  // ---------- PÉLVIS / ancas ----------
  const hips = G('hips', root, 0, 1.0, 0);
  // calções fitados, assentes na anca (cintura estreita + perneiras curtas)
  addPart(hips, 'shorts_core', new THREE.BoxGeometry(0.34, 0.2, 0.26), M.shorts, [0, -0.02, 0], [1, 1, 1]);
  addPart(hips, 'shorts_legL', new THREE.CylinderGeometry(0.125, 0.155, 0.24, 18), M.shorts, [-0.11, -0.15, 0], [1, 1, 0.92]);
  addPart(hips, 'shorts_legR', new THREE.CylinderGeometry(0.125, 0.155, 0.24, 18), M.shorts, [0.11, -0.15, 0], [1, 1, 0.92]);
  // número branco no calção (frente esquerda)
  const shNum = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13),
    new THREE.MeshBasicMaterial({ map: makeNumTexture('8'), transparent: true }));
  shNum.position.set(-0.1, -0.14, 0.15); hips.add(shNum);

  // ---------- TORSO (alongado e mais magro) ----------
  const torso = G('torso', hips, 0, 0.12, 0);
  // abdómen e peito (camisola, em camadas com taper)
  addPart(torso, 'abdomen', new THREE.CapsuleGeometry(0.17, 0.22, 10, 20), M.shirt, [0, 0.12, 0], [1.04, 1, 0.66]);
  addPart(torso, 'chest', new THREE.CapsuleGeometry(0.20, 0.14, 12, 24), M.shirt, [0, 0.34, 0], [1.18, 1, 0.68]);
  // costas: nome + número
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.38),
    new THREE.MeshBasicMaterial({ map: makeTextTexture(config.name || 'G. CALDEIRA', config.number || 8, config.darkText !== false), transparent: true }));
  back.position.set(0, 0.34, -0.17); back.rotation.y = Math.PI; torso.add(back);
  // gola em V (preta)
  addPart(torso, 'collar_ring', new THREE.TorusGeometry(0.105, 0.018, 8, 28), M.trim, [0, 0.52, 0.02], [1.25, 0.8, 0.9], [Math.PI / 2, 0, 0], false);
  for (const s of [-1, 1]) {
    addPart(torso, 'vneck', new THREE.BoxGeometry(0.024, 0.14, 0.02), M.trim, [s * 0.04, 0.46, 0.15], [1, 1, 1], [0, 0, s * 0.5], false);
  }

  // ---------- PESCOÇO / CABEÇA (cabeça mais pequena, pescoço visível) ----------
  const neck = G('neck', torso, 0, 0.56, 0);
  addPart(neck, 'neck_mesh', new THREE.CylinderGeometry(0.07, 0.085, 0.19, 16), M.skin, [0, 0.01, 0]);
  const head = G('head', neck, 0, 0.15, 0);
  head.scale.setScalar(0.62); // proporção realista (~7,5 cabeças)
  addPart(head, 'skull', new THREE.SphereGeometry(0.255, 32, 32), M.skin, [0, 0.05, 0.01], [0.94, 1.08, 0.97]);
  addPart(head, 'jaw', new THREE.SphereGeometry(0.165, 24, 20), M.skin, [0, -0.12, 0.04], [0.9, 0.82, 0.84], [0.2, 0, 0]);
  for (const s of [-1, 1]) addPart(head, 'ear', new THREE.SphereGeometry(0.05, 12, 12), M.skin, [s * 0.235, -0.02, 0.01], [0.45, 1, 0.7], [0, 0, 0], false);
  buildFace(head, { skinDark: 0xc98a5f });
  buildHair(head, config.hairColor || 0x53381f);

  // ---------- BRAÇOS ----------
  function arm(side) {
    const sh = G(side < 0 ? 'leftShoulder' : 'rightShoulder', torso, side * 0.2, 0.34, 0);
    addPart(sh, 'deltoid', new THREE.SphereGeometry(0.062, 18, 16), M.shirt, [side * 0.012, 0.03, 0], [1.05, 0.85, 0.92]); // ombro (slope)
    const upper = G(side < 0 ? 'leftUpperArm' : 'rightUpperArm', sh, 0, -0.05, 0);
    addPart(upper, 'sleeve', new THREE.CylinderGeometry(0.078, 0.066, 0.15, 16), M.shirt, [0, -0.07, 0], [1, 1, 0.92]); // manga curta cónica
    addPart(upper, 'cuff', new THREE.TorusGeometry(0.066, 0.013, 8, 20), M.trim, [0, -0.145, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false); // punho preto
    addPart(upper, 'biceps', new THREE.CapsuleGeometry(0.054, 0.26, 8, 16), M.skin, [0, -0.28, 0]);
    const fore = G(side < 0 ? 'leftForearm' : 'rightForearm', upper, 0, -0.46, 0);
    addPart(fore, 'elbow', new THREE.SphereGeometry(0.06, 14, 14), M.skin, [0, 0, 0]);
    addPart(fore, 'forearm', new THREE.CapsuleGeometry(0.052, 0.28, 8, 16), M.skin, [0, -0.18, 0]);
    addPart(fore, 'wrist', new THREE.SphereGeometry(0.045, 12, 12), M.skin, [0, -0.35, 0], [1, 1, 1], [0, 0, 0], false);
    addPart(fore, 'palm', new THREE.BoxGeometry(0.07, 0.12, 0.045), M.skin, [0, -0.43, 0.01], [1, 1, 1]);
    addPart(fore, 'thumb', new THREE.CapsuleGeometry(0.02, 0.05, 6, 8), M.skin, [side * 0.045, -0.40, 0.02], [1, 1, 1], [0, 0, side * 0.7], false);
    return { shoulder: sh, upper, fore };
  }
  const leftArm = arm(-1), rightArm = arm(1);

  // ---------- PERNAS ----------
  function leg(side) {
    const hip = G(side < 0 ? 'leftHip' : 'rightHip', hips, side * 0.13, -0.02, 0);
    addPart(hip, 'hip_joint', new THREE.SphereGeometry(0.115, 16, 16), M.shorts, [0, -0.04, 0], [1, 1, 0.95], [0, 0, 0], false);
    const thigh = G(side < 0 ? 'leftThigh' : 'rightThigh', hip, 0, -0.08, 0);
    addPart(thigh, 'thigh_short', new THREE.CapsuleGeometry(0.115, 0.06, 8, 16), M.shorts, [0, -0.02, 0], [1, 1, 0.95]); // bainha do calção
    addPart(thigh, 'thigh_skin', new THREE.CapsuleGeometry(0.09, 0.38, 8, 16), M.skin, [0, -0.34, 0]);
    const shin = G(side < 0 ? 'leftShin' : 'rightShin', thigh, 0, -0.60, 0);
    addPart(shin, 'knee', new THREE.SphereGeometry(0.082, 16, 16), M.skin, [0, 0, 0]);
    addPart(shin, 'sock', new THREE.CapsuleGeometry(0.078, 0.40, 8, 16), M.socks, [0, -0.28, 0]);
    addPart(shin, 'sock_top', new THREE.TorusGeometry(0.082, 0.018, 8, 20), M.sockTrim, [0, -0.08, 0], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    const foot = G(side < 0 ? 'leftFoot' : 'rightFoot', shin, 0, -0.56, 0.0);
    buildBoot(foot, M, side);
    return { hip, thigh, shin, foot };
  }
  const leftLeg = leg(-1), rightLeg = leg(1);

  root.userData.parts = { hips, torso, neck, head, leftArm, rightArm, leftLeg, rightLeg };
  root.userData.mats = M;
  return root;
}

// Bota de futebol: sola + parte de cima + biqueira + atacadores + pitons.
function buildBoot(foot, M, side) {
  addPart(foot, 'boot_sole', new THREE.BoxGeometry(0.15, 0.045, 0.42), M.bootDark, [0, -0.05, 0.10], [1, 1, 1]);
  addPart(foot, 'boot_upper', new THREE.BoxGeometry(0.15, 0.1, 0.28), M.boot, [0, 0.0, 0.06], [1, 1, 1]);
  addPart(foot, 'boot_toe', new THREE.SphereGeometry(0.085, 16, 12), M.boot, [0, -0.01, 0.24], [0.9, 0.7, 1.0], [0, 0, 0]);
  addPart(foot, 'boot_heel', new THREE.SphereGeometry(0.08, 14, 12), M.boot, [0, 0.02, -0.06], [1, 1, 0.9], [0, 0, 0], false);
  // atacadores
  for (let i = 0; i < 3; i++) addPart(foot, 'lace_' + i, new THREE.BoxGeometry(0.07, 0.012, 0.012), M.white, [0, 0.05 - i * 0.005, 0.08 + i * 0.05], [1, 1, 1], [0, 0, 0], false);
  // pitons
  for (const dx of [-0.045, 0.045]) for (const dz of [0.0, 0.14, 0.28]) {
    addPart(foot, 'stud', new THREE.CylinderGeometry(0.02, 0.016, 0.03, 8), M.bootDark, [dx, -0.085, dz], [1, 1, 1], [0, 0, 0], false);
  }
}

// Número branco (calção / etc.)
function makeNumTexture(n) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#f2f2f2'; ctx.font = 'bold 96px Arial'; ctx.textAlign = 'center';
  ctx.fillText(n, 64, 96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
