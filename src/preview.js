import * as THREE from 'three';
import { buildPlayerSkeleton } from './character/skeleton.js';

const W = 420, H = 760; // por painel
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc9d2dc);

// luz tipo folha de personagem (frente-cima)
scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7480, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(2, 5, 6); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd6ff, 0.6); fill.position.set(-4, 2, 3); scene.add(fill);

// câmara ortográfica (turnaround limpo)
const fr6 = 1.35; // meia-altura do frustum
let aspect = W / H;
const cam = new THREE.OrthographicCamera(-fr6 * aspect, fr6 * aspect, fr6, -fr6, 0.1, 50);
cam.position.set(0, 1.0, 8);
cam.lookAt(0, 1.0, 0);

const rig = buildPlayerSkeleton({ shirt: 0x57a8ea, name: 'G. CALDEIRA', number: 8 });
// escalar para ~2.0 e pousar os pés em y=0 (enquadramento consistente)
{
  const box = new THREE.Box3().setFromObject(rig);
  const s = 2.0 / (box.max.y - box.min.y);
  rig.scale.setScalar(s);
  rig.position.y = -box.min.y * s;
}
scene.add(rig);
const P = rig.userData.parts;

// chão subtil
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshBasicMaterial({ color: 0xb3bcc7 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; scene.add(floor);

function reset() {
  const z = (g) => { if (g) { g.rotation.set(0, 0, 0); } };
  [P.torso, P.head, P.hips, P.leftArm.shoulder, P.rightArm.shoulder, P.leftArm.fore, P.rightArm.fore,
   P.leftLeg.hip, P.rightLeg.hip, P.leftLeg.shin, P.rightLeg.shin].forEach(z);
  P.hips.position.y = 1.05;
}

function applyPose(name) {
  reset();
  const p = P;
  if (name === 'idle') {
    p.leftArm.shoulder.rotation.z = 0.06; p.rightArm.shoulder.rotation.z = -0.06;
    p.leftArm.shoulder.rotation.x = 0.04; p.rightArm.shoulder.rotation.x = 0.04;
  } else if (name === 'run') {
    const s = 0.8, c = 0.6;
    p.torso.rotation.x = 0.18;
    p.leftArm.shoulder.rotation.x = s; p.rightArm.shoulder.rotation.x = -s;
    p.leftArm.fore.rotation.x = -0.9; p.rightArm.fore.rotation.x = -0.9;
    p.leftLeg.hip.rotation.x = -s; p.rightLeg.hip.rotation.x = s;
    p.leftLeg.shin.rotation.x = 0.2; p.rightLeg.shin.rotation.x = c;
  } else if (name === 'kick') {
    p.torso.rotation.y = -0.25; p.torso.rotation.x = 0.1;
    p.leftArm.shoulder.rotation.z = -0.5; p.rightArm.shoulder.rotation.z = 0.45;
    p.leftLeg.hip.rotation.x = -0.3; p.rightLeg.hip.rotation.x = -1.2;
    p.rightLeg.shin.rotation.x = 0.7;
  }
}

let azimuth = 0;
function setView(azDeg) { azimuth = THREE.MathUtils.degToRad(azDeg); rig.rotation.y = azimuth; }

applyPose('idle');
setView(0);

function render() { renderer.render(scene, cam); }
function loop() { requestAnimationFrame(loop); render(); }
loop();

window.__preview = {
  setView, applyPose,
  shot() { render(); return renderer.domElement.toDataURL('image/png'); },
};
window.__ready = true;
