// main.js — METRO CITY Phase 1 entry point
// Wires together world, player, camera, UI and the save system into one game loop.

import * as THREE from 'three';
import { settings } from './settings.js';
import { ui, input } from './ui.js';
import { World } from './world.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { hasSave, loadGame, saveGame, buildSaveState } from './save.js';

const canvas = document.getElementById('game-canvas');
let renderer, scene, camera, world, player, tpCamera;
let clock = new THREE.Clock();
let running = false;
let paused = false;
let money = 500;
let gameHour = 9; // start mid-morning
let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;

function boot() {
  // Fake-but-honest asset loading progress (Phase 1 has no external assets to fetch yet).
  let pct = 0;
  ui.showLoading(0, 'Preparing renderer...');
  const steps = [
    [20, 'Building city block...'],
    [45, 'Placing streetlights & props...'],
    [70, 'Spawning player...'],
    [90, 'Warming up shaders...'],
    [100, 'Ready.'],
  ];
  let i = 0;
  const interval = setInterval(() => {
    if (i >= steps.length) {
      clearInterval(interval);
      ui.hideLoadingShowMenu();
      return;
    }
    ui.showLoading(steps[i][0], steps[i][1]);
    i++;
  }, 220);
}

function initEngine() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  applyQualityToRenderer();
  renderer.shadowMap.enabled = settings.preset.shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
  tpCamera = new ThirdPersonCamera(camera, scene);

  world = new World(scene, settings.preset);
  player = new Player(scene);
  tpCamera.snapTo(player.position);

  window.addEventListener('resize', onResize);
  onResize();
}

function applyQualityToRenderer() {
  const preset = settings.preset;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatioCap));
  renderer.shadowMap.enabled = preset.shadowsEnabled;
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function startGame({ continueSave }) {
  if (!renderer) initEngine();

  if (continueSave) {
    const data = loadGame();
    if (data) {
      player.position.set(...data.player.position);
      player.heading = data.player.heading || 0;
      money = data.money ?? 500;
      if (data.settings) settings.fromJSON(data.settings);
      tpCamera.snapTo(player.position);
      ui.notify('Save loaded');
    }
  }

  ui.startGameplay();
  ui.setMission(null);
  running = true;
  paused = false;
  clock.getDelta(); // reset delta so the menu time doesn't count
  requestAnimationFrame(loop);
}

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());

  if (!paused) {
    update(dt);
    render();
  }

  // FPS counter (updates ~2x/sec)
  fpsFrames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    ui.updateFPS(Math.round(fpsFrames / fpsTimer));
    fpsFrames = 0; fpsTimer = 0;
  }
}

function update(dt) {
  // Day/night cycle: a full day every 24 real minutes (adjustable).
  gameHour = (gameHour + dt / 60) % 24;
  world.updateDayNight(gameHour);

  // Camera look from touch/mouse deltas
  tpCamera.addLook(input.lookDX, input.lookDY);

  // Convert input axes into world-space move direction relative to camera yaw.
  let moveX = 0, moveZ = 0;
  if (Math.abs(input.moveX) > 0.05 || Math.abs(input.moveY) > 0.05) {
    const camYaw = tpCamera.yaw;
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = Math.sin(camYaw + Math.PI / 2), rz = Math.cos(camYaw + Math.PI / 2);
    moveX = fx * input.moveY + rx * input.moveX;
    moveZ = fz * input.moveY + rz * input.moveX;
  }

  player.update(dt, {
    moveX, moveZ,
    sprint: input.sprintHeld,
    crouch: input.crouchHeld,
    jumpPressed: input.jumpPressed,
    colliders: world.colliders,
    groundY: 0,
  });

  tpCamera.update(dt, player.position, world.colliders);

  ui.setHealth(player.health);
  ui.setStamina(player.stamina);
  ui.setMoney(money);
  ui.drawMinimap(player.position.x, player.position.z, tpCamera.yaw, world.minimapObjects);

  // Simple interact prompt: show near the plaza sign as a Phase-1 placeholder interaction point.
  const distToSign = Math.hypot(player.position.x - 3, player.position.z - 8);
  ui.showInteractPrompt(distToSign < 2.2, 'Tap INTERACT to read city notice');
  if (distToSign < 2.2 && input.interactPressed) {
    ui.notify('Welcome to Metro City. More districts unlock in later phases.');
  }

  ui.clearFrameDeltas();
}

function render() {
  renderer.render(scene, camera);
}

function doSave() {
  const ok = saveGame(buildSaveState({ player, money, settings }));
  ui.notify(ok ? 'Game saved' : 'Save failed');
}

// ---- Wire UI callbacks ----
ui.onPlay = (opts) => startGame(opts);
ui.onSettingsChanged = () => { if (renderer) { applyQualityToRenderer(); } };
ui.onPauseToggle = (isPaused) => {
  paused = isPaused;
  if (isPaused) doSave();
};
ui.onQuit = () => {
  doSave();
  running = false;
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
};

// Autosave every 30s during gameplay
setInterval(() => { if (running && !paused) doSave(); }, 30000);

ui.init();
boot();
