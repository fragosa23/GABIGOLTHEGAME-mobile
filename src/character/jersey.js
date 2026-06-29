import * as THREE from 'three';
import { makeTextTexture } from './utils.js';

export function addJerseyBack(torso, name, number) {
  const mat = new THREE.MeshBasicMaterial({ map: makeTextTexture(name, number), transparent: true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), mat);
  plane.name = 'jersey_back_name_number';
  plane.position.set(0, 0.08, -0.337);
  plane.rotation.y = Math.PI;
  torso.add(plane);
  return plane;
}
