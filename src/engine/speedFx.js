import * as THREE from 'three';

// Linhas de velocidade: tiras que passam À VOLTA do jogador (num tubo em torno
// do eixo de movimento) — não convergem no centro do ecrã.
export class SpeedFx {
  constructor(scene) {
    this.N = 90;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xdff0ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.N);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    // cada tira: posição ao longo do eixo (along) + deslocamento perpendicular fixo (ang, rad)
    this.along = new Float32Array(this.N);
    this.ang = new Float32Array(this.N);
    this.rad = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      this.along[i] = -7 + Math.random() * 18;
      this.ang[i] = Math.random() * Math.PI * 2;
      this.rad[i] = 2.6 + Math.random() * 4.4;   // raio: sempre afastado do eixo (não no centro)
    }
    this.intensity = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    this._u = new THREE.Vector3(); this._v = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  // center: posição do jogador; dir: direção do movimento; speed; on?
  update(dt, center, dir, speed, on) {
    const target = (on && speed > 5) ? Math.min((speed - 5) / 5, 1) : 0;
    this.intensity += (target - this.intensity) * Math.min(dt * 6, 1);
    this.mat.opacity = this.intensity * 0.5;
    if (this.intensity < 0.01) { this.mesh.visible = false; return; }
    this.mesh.visible = true;

    const move = (dir.lengthSq() > 1e-4 ? dir.clone().normalize() : this._up.clone());
    // base perpendicular ao movimento (tubo à volta do jogador)
    this._u.copy(move).cross(this._up);
    if (this._u.lengthSq() < 1e-4) this._u.set(1, 0, 0);
    this._u.normalize();
    this._v.copy(move).cross(this._u).normalize();
    this._q.setFromUnitVectors(this._up, move); // tira alinhada com o movimento

    const fly = 12 + speed * 1.7;
    const len = 1.0 + speed * 0.16;
    this._s.set(0.04, len, 1);

    for (let i = 0; i < this.N; i++) {
      this.along[i] -= fly * dt;
      if (this.along[i] < -7) this.along[i] += 18;   // recicla à frente, mesmo raio
      const r = this.rad[i], a = this.ang[i];
      this._p.copy(center)
        .addScaledVector(move, this.along[i])
        .addScaledVector(this._u, Math.cos(a) * r)
        .addScaledVector(this._v, Math.sin(a) * r);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
