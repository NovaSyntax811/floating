import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { GameState } from './state.js';
import { Environment } from './environment.js';
import { createWater } from './water.js';
import { LanternManager } from './lanterns.js';
import { ZenAudio } from './audio.js';
import { UI } from './ui.js';
import { MODELS, LAKE_RADIUS, UPGRADE_COST, MAX_LEVEL, FEATURES } from './config.js';

// ---------- core setup ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(15, 11, 27);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 9;
controls.maxDistance = 70;
controls.maxPolarAngle = 1.42;
controls.minPolarAngle = 0.25;
controls.target.set(0, 0.8, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.12;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55, // strength
  0.5, // radius
  0.55 // threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- game objects ----------
const state = new GameState();
const env = new Environment(scene);
const water = createWater();
scene.add(water.mesh);
const manager = new LanternManager(scene);
const audio = new ZenAudio();
const ui = new UI(state, audio);

// Keep lantern positions inside every save.
const origSave = state.save.bind(state);
state.save = () => {
  state.lanterns = manager.serialize();
  origSave();
};

state.onChange = () => ui.refresh();
state.onUnlock = (labels) => {
  ui.toast(`Something new: ${labels}`);
  audio.unlockSound();
  ui.refresh();
};
state.onLightGain = () => ui.pulseLight();
state.onHarmonyGain = () => ui.pulseHarmony();

ui.onTimeChange = (t) => env.setTimeOfDay(t);
ui.onWeatherChange = (key, on) => {
  if (key === 'mist') env.setMist(on);
  if (key === 'fireflies') env.setFireflies(on);
  if (key === 'shooting') env.setShooting(on);
};

// Restore a previous visit.
manager.restore(state.lanterns);
env.setTimeOfDay(state.settings.time);
for (const f of FEATURES) {
  if (state.isUnlocked(f) && state.settings[f.id === 'shooting' ? 'shooting' : f.id]) {
    ui.onWeatherChange(f.id, true);
  }
}

// ---------- intro ----------
let introActive = true;
const intro = document.getElementById('intro');
document.getElementById('begin-btn').addEventListener('click', () => {
  introActive = false;
  intro.style.opacity = '0';
  setTimeout(() => intro.remove(), 1300);
  ui.showGameUI();
  state.introSeen = true;
  // The click is a user gesture, so saved sound settings may resume here.
  if (state.settings.sound) {
    document.getElementById('sound-toggle').checked = true;
    audio.setVolume(state.settings.volume);
    audio.enable();
  }
  state.save();
});

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

// Live pointer state for the hover glow and placement ghost.
const livePointer = { x: 0, y: 0, onCanvas: false, isMouse: false };
window.addEventListener('pointermove', (e) => {
  livePointer.x = e.clientX;
  livePointer.y = e.clientY;
  livePointer.onCanvas = e.target === canvas;
  livePointer.isMouse = e.pointerType === 'mouse';
});
canvas.addEventListener('pointerleave', () => {
  livePointer.onCanvas = false;
});

const ghostTarget = { visible: false, x: 0, z: 0, colorHex: '#ffb45e', ok: true };

function updatePointerFeedback() {
  ghostTarget.visible = false;
  ghostTarget.colorHex = ui.selection.color.hex;
  if (introActive || !livePointer.onCanvas || !livePointer.isMouse) {
    manager.setHovered(null);
    return;
  }
  pointer.x = (livePointer.x / window.innerWidth) * 2 - 1;
  pointer.y = -(livePointer.y / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(manager.raycastTargets, false);
  const hovered = hits.length ? hits[0].object.userData.lantern : null;
  manager.setHovered(hovered);
  canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
  if (hovered || manager.selected) return;

  const waterHits = raycaster.intersectObject(water.mesh, false);
  if (!waterHits.length) return;
  const p = waterHits[0].point;
  if (Math.hypot(p.x, p.z) > LAKE_RADIUS) return;
  const model = MODELS.find((m) => m.id === ui.selection.model);
  ghostTarget.visible = true;
  ghostTarget.x = p.x;
  ghostTarget.z = p.z;
  ghostTarget.ok = state.canAfford(model.cost);
}

canvas.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
});

canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  const held = performance.now() - downAt.t;
  downAt = null;
  if (moved > 7 || held > 600) return; // that was a camera drag
  handleClick(e.clientX, e.clientY);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') deselect();
});

function handleClick(cx, cy) {
  pointer.x = (cx / window.innerWidth) * 2 - 1;
  pointer.y = -(cy / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // Lanterns first.
  const hits = raycaster.intersectObjects(manager.raycastTargets, false);
  if (hits.length > 0) {
    selectLantern(hits[0].object.userData.lantern);
    return;
  }

  // Then the water.
  const waterHits = raycaster.intersectObject(water.mesh, false);
  if (waterHits.length === 0) return;

  if (manager.selected) {
    deselect();
    return;
  }

  const p = waterHits[0].point;
  if (Math.hypot(p.x, p.z) > LAKE_RADIUS) {
    ui.toast('Closer to the heart of the lake');
    return;
  }

  const model = MODELS.find((m) => m.id === ui.selection.model);
  if (!state.canAfford(model.cost)) {
    ui.toast('The light is still returning');
    return;
  }

  state.spend(model.cost);
  manager.place({
    model: model.id,
    material: ui.selection.material,
    colorHex: ui.selection.color.hex,
    pattern: ui.selection.pattern,
    x: p.x,
    z: p.z,
  });
  audio.placeSound();
  state.save();
}

function selectLantern(lantern) {
  manager.select(lantern);
  ui.showEdit(lantern, {
    onColor: (hex) => {
      manager.recolor(lantern, hex);
      state.save();
    },
    onPattern: (id) => {
      manager.repattern(lantern, id);
      state.save();
    },
    onUpgrade: () => {
      if (lantern.level >= MAX_LEVEL || !state.canAfford(UPGRADE_COST)) return;
      state.spend(UPGRADE_COST);
      manager.upgrade(lantern);
      audio.upgradeSound();
      state.save();
    },
    onRelease: () => {
      manager.release(lantern);
      ui.hideEdit();
      state.save();
    },
  });
}

function deselect() {
  manager.deselect();
  ui.hideEdit();
}

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  state.tick(dt);
  env.update(dt, t);
  water.update(t, env);
  manager.update(dt, t);
  updatePointerFeedback();
  manager.updateGhost(dt, t, ghostTarget);
  controls.update();
  composer.render();
}

animate();

// Debug handle for development.
window.FL = { state, manager, env, ui };
