import * as THREE from 'three';

// Cel-shading: gradient map de poucos níveis -> bandas duras de luz.
let _gradient = null;
export function gradientMap(levels = 4) {
  if (_gradient) return _gradient;
  const data = new Uint8Array(levels);
  for (let i = 0; i < levels; i++) {
    data[i] = Math.round((i / (levels - 1)) * 255);
  }
  const tex = new THREE.DataTexture(data, levels, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  _gradient = tex;
  return tex;
}

// Material toon (cel-shaded).
export function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: gradientMap(opts.levels ?? 4),
    ...opts.material,
  });
}

// Outline por inverted-hull: clona a geometria, vira as faces para dentro,
// material preto, e empurra um pouco para fora -> contorno de banda desenhada.
export function addOutline(mesh, thickness = 0.04, color = 0x0a0a12) {
  const outlineMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
  });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  // escala relativa ao tamanho do bounding sphere para contorno ~uniforme
  mesh.geometry.computeBoundingSphere();
  const r = mesh.geometry.boundingSphere.radius || 1;
  const s = 1 + thickness / r;
  outline.scale.setScalar(s);
  outline.userData.isOutline = true;
  mesh.add(outline);
  return outline;
}

// Helper: mesh cel-shaded já com contorno.
export function celMesh(geometry, color, outline = 0.05) {
  const mesh = new THREE.Mesh(geometry, toonMat(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outline > 0) addOutline(mesh, outline);
  return mesh;
}
