import * as THREE from 'three';
import { addPart, toon } from './utils.js';

// Cabelo castanho espetado, com franja curta (testa visível, olhos livres).
export function buildHair(head, color = 0x53381f) {
  const mat = toon(color);
  const dark = toon(0x3a2615);

  // touca justa ao crânio (cobre topo/trás, deixa a cara livre)
  addPart(head, 'hair_cap', new THREE.SphereGeometry(0.265, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.58), mat, [0, 0.07, -0.02], [1.04, 1.0, 1.05]);

  // espigões no topo (varridos, despenteado mas contido)
  const spikes = [
    [0.00, 0.26, 0.02, -0.1, 0.0, 0.22],
    [-0.10, 0.25, 0.0, 0.0, 0.25, 0.20],
    [0.10, 0.25, 0.0, 0.0, -0.25, 0.20],
    [-0.17, 0.20, -0.04, 0.25, 0.5, 0.18],
    [0.17, 0.20, -0.04, 0.25, -0.5, 0.18],
    [-0.05, 0.25, -0.13, -0.5, 0.2, 0.18],
    [0.07, 0.25, -0.13, -0.5, -0.2, 0.18],
    [0.00, 0.22, -0.18, -0.8, 0.0, 0.18],
  ];
  spikes.forEach((s, i) => {
    const m = addPart(head, 'spike_' + i, new THREE.ConeGeometry(0.06, s[5], 7), i % 3 ? mat : dark, [s[0], s[1], s[2]], [1, 1, 0.7], [0, 0, 0], false);
    m.rotation.set(s[3], 0, s[4]);
  });

  // franja curta sobre a testa (pontas para baixo mas acima das sobrancelhas)
  const fringe = [-0.18, -0.10, -0.02, 0.06, 0.14, 0.2];
  fringe.forEach((x, i) => {
    const m = addPart(head, 'fringe_' + i, new THREE.ConeGeometry(0.05 + (i % 2) * 0.012, 0.17, 7), mat, [x, 0.21, 0.205], [0.9, 1, 0.5], [0, 0, 0], false);
    m.rotation.set(Math.PI * 0.86, 0, x * 0.7);
  });

  // patilhas curtas
  for (const s of [-1, 1]) {
    addPart(head, 'side_hair', new THREE.ConeGeometry(0.04, 0.14, 7), mat, [s * 0.245, 0.06, 0.0], [0.7, 1, 0.7], [0.1, 0, s * 0.22], false);
  }
}
