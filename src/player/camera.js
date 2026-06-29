import * as THREE from 'three';

// Níveis de câmara (C cicla entre eles). Inclui 1ª pessoa.
const PRESETS = [
  { name: 'Longe',      dist: 12, height: 2.8, fp: false },
  { name: 'Normal',     dist: 3.25, height: 1.55, fp: false },
  { name: 'Perto',      dist: 3.25, height: 1.55, fp: false },
  { name: '1ª Pessoa',  dist: 0,  height: 1.7, fp: true  },
];

// Câmara orbital tipo "Lakitu" (Mario 64): segue o player, roda com o rato.
export class OrbitCamera {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.target = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.32;
    this.level = 1;
    this.distance = PRESETS[1].dist;
    this.height = PRESETS[1].height;
    this.firstPerson = false;
    this._pos = new THREE.Vector3();
    this._onChange = null;
    this.colliders = [];        // THREE.Box3[] para a câmara não atravessar paredes
    this._ray = new THREE.Ray();
    this._hit = new THREE.Vector3();
    this._indoor = 0;           // 0 = exterior, 1 = interior (teto baixo) -> câmara mais perto
    this.occluders = null;      // malha visual extra p/ oclusão (ex.: GLB do estádio)
    this._raycaster = new THREE.Raycaster();
  }

  onChange(fn) { this._onChange = fn; }
  setColliders(boxes) { this.colliders = boxes; }
  setOccluders(obj) { this.occluders = obj; }   // câmara também não atravessa esta malha

  // distância máxima livre entre a cabeça e a posição desejada da câmara
  _clampDistance(origin, desired) {
    const dir = new THREE.Vector3().subVectors(desired, origin);
    const dist = dir.length();
    if (dist < 1e-4) return dist;
    dir.divideScalar(dist);
    this._ray.set(origin, dir);
    let closest = dist;
    for (const box of this.colliders) {
      if (this._ray.intersectBox(box, this._hit)) {
        const hd = this._hit.distanceTo(origin);
        if (hd < closest) closest = hd;
      }
    }
    // oclusão contra a malha visual (paredes/teto do estádio que não têm colisor AABB)
    if (this.occluders) {
      this._raycaster.set(origin, dir);
      this._raycaster.far = dist;
      const hits = this._raycaster.intersectObject(this.occluders, true);
      if (hits.length && hits[0].distance < closest) closest = hits[0].distance;
    }
    return Math.max(closest - 0.5, 0.5); // margem maior p/ não ver através de paredes finas
  }

  setTarget(v) { this.target.copy(v); }

  // distância até ao teto acima do jogador (Infinity se céu aberto)
  _ceilingDistance(origin) {
    this._ray.set(origin, new THREE.Vector3(0, 1, 0));
    let nearest = Infinity;
    for (const box of this.colliders) {
      if (this._ray.intersectBox(box, this._hit)) {
        const d = this._hit.y - origin.y;
        if (d > 0.1 && d < nearest) nearest = d;
      }
    }
    return nearest;
  }

  cycle() {
    this.level = (this.level + 1) % PRESETS.length;
    const p = PRESETS[this.level];
    this.distance = p.dist;
    this.height = p.height;
    this.firstPerson = p.fp;
    if (this.firstPerson) this.pitch = 0.25;
    if (this._onChange) this._onChange(p.name);
  }

  // o jogo informa para onde o jogador está virado e se está em movimento
  setFollow(facing, moving) { this._followYaw = facing; this._followMoving = moving; }
  snapBehind(facing) { this.yaw = facing + Math.PI; }   // pôr já atrás das costas

  update(dt) {
    // Mobile build: camera distance is fixed on the normal/intermediate preset.

    // controlo manual (Q/E ou rato) — pausa o auto-retorno enquanto se usa
    const manual = Math.abs(this.input.mouseDX) > 0.4 || this.input.down('KeyQ') || this.input.down('KeyE');
    this.yaw -= this.input.mouseDX * 0.0025;
    this.pitch += this.input.mouseDY * (this.firstPerson ? 0.0024 : 0.0018);
    if (this.input.down('KeyQ')) this.yaw += 1.8 * dt;
    if (this.input.down('KeyE')) this.yaw -= 1.8 * dt;
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.firstPerson ? -0.5 : 0.08, 1.1);

    // auto-retorno: ao mover-se (e sem mexer manualmente), a câmara volta para trás do jogador
    if (!this.firstPerson && this._followMoving && !manual && this._followYaw != null) {
      const behind = this._followYaw + Math.PI;
      let d = behind - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));          // caminho mais curto
      this.yaw += d * (1 - Math.exp(-3.5 * dt));         // suave
    }

    if (this.firstPerson) {
      // câmara na "cabeça", a olhar na direção do yaw/pitch
      const eye = new THREE.Vector3(this.target.x, this.target.y + this.height, this.target.z);
      this.camera.position.lerp(eye, 1 - Math.pow(0.0001, dt));
      if (this._pos.lengthSq() === 0) this.camera.position.copy(eye);
      const look = new THREE.Vector3(
        eye.x - Math.sin(this.yaw) * Math.cos(this.pitch),
        eye.y + Math.sin(this.pitch),
        eye.z - Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.camera.lookAt(look);
      this._pos.copy(this.camera.position);
      return;
    }

    // interior (teto baixo, ex.: balneário/túnel) -> aproximar e baixar a câmara (quase OTS)
    const indoorTarget = 0;
    this._indoor += (indoorTarget - this._indoor) * Math.min(dt * 4, 1);

    const eDist = THREE.MathUtils.lerp(this.distance, Math.min(this.distance, 3.4), this._indoor);
    const eHeight = THREE.MathUtils.lerp(this.height, 1.5, this._indoor);
    const ePitch = THREE.MathUtils.lerp(this.pitch, Math.min(this.pitch, 0.12), this._indoor);

    const horiz = Math.cos(ePitch) * eDist;
    const desired = new THREE.Vector3(
      this.target.x + Math.sin(this.yaw) * horiz,
      this.target.y + eHeight + Math.sin(ePitch) * eDist,
      this.target.z + Math.cos(this.yaw) * horiz
    );

    // não atravessar paredes: encurtar a partir da "cabeça"
    const head = new THREE.Vector3(this.target.x, this.target.y + 1.4, this.target.z);
    const maxDist = this._clampDistance(head, desired);
    const dir = new THREE.Vector3().subVectors(desired, head);
    const want = dir.length() > maxDist
      ? head.clone().add(dir.setLength(maxDist))
      : desired;

    if (this._pos.lengthSq() === 0) this._pos.copy(want);
    // aproximar da parede = INSTANTÂNEO (nunca ver através); afastar = suave (sem "pop")
    const closer = want.distanceToSquared(head) < this._pos.distanceToSquared(head);
    if (closer) this._pos.copy(want);
    else this._pos.lerp(want, 1 - Math.pow(0.02, dt));
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this.target.x, this.target.y + 1.2, this.target.z);
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }
  right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }
}
