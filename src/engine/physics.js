import * as THREE from 'three';

export const GRAVITY = -38;

// Mundo de colisões: lista de caixas AABB (estáticas).
export class Physics {
  constructor() {
    this.boxes = []; // { min:Vector3, max:Vector3, tag }
  }

  // Adiciona um collider a partir de centro + meio-tamanho.
  addBox(center, half, tag = 'solid') {
    const min = new THREE.Vector3().subVectors(center, half);
    const max = new THREE.Vector3().addVectors(center, half);
    const box = { min, max, tag };
    this.boxes.push(box);
    return box;
  }

  // Move uma entidade-AABB resolvendo colisões eixo a eixo.
  // entity: { position:Vector3, velocity:Vector3, half:Vector3, grounded:bool }
  moveAndCollide(entity, dt) {
    const p = entity.position;
    const v = entity.velocity;
    const h = entity.half;
    entity.grounded = false;

    // --- Y ---
    p.y += v.y * dt;
    for (const b of this.boxes) {
      if (!this._overlap(p, h, b)) continue;
      if (v.y <= 0) {
        p.y = b.max.y + h.y;
        entity.grounded = true;
      } else {
        p.y = b.min.y - h.y;
      }
      v.y = 0;
    }

    // --- X ---
    p.x += v.x * dt;
    for (const b of this.boxes) {
      if (!this._overlap(p, h, b)) continue;
      if (v.x > 0) p.x = b.min.x - h.x;
      else if (v.x < 0) p.x = b.max.x + h.x;
      v.x = 0;
    }

    // --- Z ---
    p.z += v.z * dt;
    for (const b of this.boxes) {
      if (!this._overlap(p, h, b)) continue;
      if (v.z > 0) p.z = b.min.z - h.z;
      else if (v.z < 0) p.z = b.max.z + h.z;
      v.z = 0;
    }
  }

  _overlap(p, h, b) {
    return (
      p.x - h.x < b.max.x && p.x + h.x > b.min.x &&
      p.y - h.y < b.max.y && p.y + h.y > b.min.y &&
      p.z - h.z < b.max.z && p.z + h.z > b.min.z
    );
  }
}
