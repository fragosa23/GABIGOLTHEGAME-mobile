import * as THREE from 'three';
import { toonMat } from '../engine/toon.js';

// material cel-shaded (com gradient map, consistente com o resto do jogo)
export function toon(color) { return toonMat(color); }

// Adiciona uma peça e (opcionalmente) o seu contorno inverted-hull.
export function addPart(group, name, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], outline = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (outline) {
    const o = mesh.clone();
    o.material = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide });
    o.scale.multiplyScalar(1.06);
    o.name = name + '_outline';
    group.add(o);
  }
  return mesh;
}

// Nome+número nas costas. dark=true → texto escuro (como na referência) com
// contorno claro fino (mantém-se legível mesmo em camisola escura).
export function makeTextTexture(name, number, dark = true) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const fill = dark ? '#0b1430' : '#ffffff';
  const edge = dark ? '#cfe0ff' : '#0a1622';
  const stroke = (t, x, y, lw, font) => {
    ctx.font = font; ctx.lineWidth = lw; ctx.strokeStyle = edge; ctx.fillStyle = fill;
    ctx.strokeText(t, x, y); ctx.fillText(t, x, y);
  };
  stroke(name, 512, 250, 10, 'bold 110px Arial');
  stroke(String(number), 512, 740, 16, 'bold 430px Arial');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
