import * as THREE from 'three';
import { addPart, toon } from './utils.js';

// Cara estilo anime: olhos grandes com íris castanha, pálpebra, sobrancelhas,
// nariz, boca. Detalhes pequenos sem contorno (para não ganharem halo preto).
export function buildFace(head, opts = {}) {
  const skinDark = toon(opts.skinDark || 0xc98a5f);
  const browCol = toon(opts.brow || 0x3a2616);
  const lash = toon(0x140d08);
  const white = toon(0xffffff);
  const iris = toon(opts.eye || 0x5a3a22);
  const pupil = toon(0x0a0705);

  const ex = 0.115, ey = 0.0, ez = 0.30; // posição base dos olhos
  for (const s of [-1, 1]) {
    const x = s * ex;
    // globo branco (amendoado)
    addPart(head, 'eye_white', new THREE.SphereGeometry(0.058, 18, 12), white, [x, ey, ez], [1.25, 1.08, 0.5], [0, 0, s * 0.06], false);
    // íris castanha (preenche bem o olho)
    addPart(head, 'iris', new THREE.SphereGeometry(0.046, 16, 12), iris, [x, ey - 0.004, ez + 0.026], [0.95, 1.05, 0.5], [0, 0, 0], false);
    // pupila
    addPart(head, 'pupil', new THREE.SphereGeometry(0.022, 12, 10), pupil, [x, ey - 0.004, ez + 0.044], [0.95, 1.05, 0.5], [0, 0, 0], false);
    // brilho
    addPart(head, 'glint', new THREE.SphereGeometry(0.011, 8, 8), white, [x + s * -0.014, ey + 0.028, ez + 0.05], [1, 1, 1], [0, 0, 0], false);
    // linha da pálpebra superior (lash) — define olhar
    addPart(head, 'lid', new THREE.BoxGeometry(0.135, 0.026, 0.03), lash, [x, ey + 0.042, ez + 0.014], [1, 1, 1], [0, 0, s * -0.1], false);
    // sobrancelha (mais baixa/decidida)
    addPart(head, 'brow', new THREE.BoxGeometry(0.12, 0.022, 0.02), browCol, [x, ey + 0.095, ez + 0.022], [1, 1, 1], [0, 0, s * -0.26], false);
  }

  // nariz subtil
  addPart(head, 'nose', new THREE.ConeGeometry(0.028, 0.07, 10), skinDark, [0, -0.075, ez + 0.05], [0.8, 1, 0.6], [Math.PI / 2, 0, 0], false);
  // boca
  addPart(head, 'mouth', new THREE.BoxGeometry(0.085, 0.016, 0.012), toon(0x7a3b30), [0, -0.17, ez - 0.01], [1, 1, 1], [0, 0, 0], false);
}
