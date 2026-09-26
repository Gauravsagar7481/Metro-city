// ui.js — menus, HUD, and mobile touch controls
// Exposes a single UI object that main.js wires into the game loop.

import { settings } from './settings.js';
import { hasSave } from './save.js';

const $ = (id) => document.getElementById(id);

export const input = {
  moveX: 0,       // -1..1 from joystick or keyboard
  moveY: 0,       // -1..1
  lookDX: 0,      // per-frame look delta from touch drag (reset each frame)
  lookDY: 0,
  jumpPressed: false,
  sprintHeld: false,
  crouchHeld: false,
  interactPressed: false,
};

export const ui = {
  onPlay: null,
  onSettingsChanged: null,

  init() {
    this._wireMenus();
    this._wireJoystick();
    this._wireLookZone();
    this._wireActionButtons();
    this._wireKeyboard();
  },

  showLoading(pct, text) {
    $('loading-bar-fill').style.width = `${Math.min(100, pct)}%`;
    if (text) $('loading-text').textContent = text;
  },

  hideLoadingShowMenu() {
    $('loading-screen').classList.add('hidden');
    $('start-menu').classList.remove('hidden');
    $('btn-continue').disabled = !hasSave();
    $('btn-continue').style.opacity = hasSave() ? '1' : '0.4';
  },

  startGameplay() {
    document.querySelectorAll('#start-menu, #settings-menu, #about-menu, #pause-menu')
      .forEach((el) => el.classList.add('hidden'));
    $('hud').classList.remove('hidden');
  },

  pause() {
    $('pause-menu').classList.remove('hidden');
  },

  resume() {
    $('pause-menu').classList.add('hidden');
  },

  setHealth(pct) { $('health-fill').style.width = `${pct}%`; },
  setStamina(pct) { $('stamina-fill').style.width = `${pct}%`; },
  setMoney(v) { $('money-value').textContent = Math.floor(v); },

  setMission(title, desc) {
    const box = $('hud-mission-box');
    if (!title) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    $('mission-title').textContent = title;
    $('mission-desc').textContent = desc || '';
  },

  showInteractPrompt(show, label = 'Tap INTERACT') {
    const el = $('interact-prompt');
    el.textContent = label;
    el.classList.toggle('hidden', !show);
  },

  notify(text) {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = text;
    $('notifications').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },

  updateFPS(fps) {
    $('fps-counter').textContent = `${fps} FPS`;
  },

  // -- Minimap: draws a simple top-down dot map each frame --
  drawMinimap(playerX, playerZ, heading, worldObjects) {
    const canvas = $('minimap-canvas');
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const scale = 0.6; // world units -> minimap pixels
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-heading);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    (worldObjects || []).forEach((o) => {
      const dx = (o.x - playerX) * scale;
      const dz = (o.z - playerZ) * scale;
      ctx.strokeRect(dx - o.w * scale / 2, dz - o.d * scale / 2, o.w * scale, o.d * scale);
    });

    ctx.restore();

    // player dot always centered, pointing up
    ctx.fillStyle = '#ffb400';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    $('minimap-arrow').style.transform = `translate(-50%, -50%) rotate(0deg)`;
  },

  _wireMenus() {
    $('btn-play').onclick = () => this.onPlay && this.onPlay({ continueSave: false });
    $('btn-continue').onclick = () => hasSave() && this.onPlay && this.onPlay({ continueSave: true });
    $('btn-settings').onclick = () => { $('start-menu').classList.add('hidden'); $('settings-menu').classList.remove('hidden'); };
    $('btn-settings-back').onclick = () => { $('settings-menu').classList.add('hidden'); $('start-menu').classList.remove('hidden'); };
    $('btn-about').onclick = () => { $('start-menu').classList.add('hidden'); $('about-menu').classList.remove('hidden'); };
    $('btn-about-back').onclick = () => { $('about-menu').classList.add('hidden'); $('start-menu').classList.remove('hidden'); };

    $('quality-select').onchange = (e) => {
      settings.setQuality(e.target.value);
      this.onSettingsChanged && this.onSettingsChanged();
    };
    $('sensitivity-range').oninput = (e) => settings.setSensitivity(e.target.value);

    $('btn-pause').onclick = () => { this.pause(); this._paused = true; this.onPauseToggle && this.onPauseToggle(true); };
    $('btn-resume').onclick = () => { this.resume(); this._paused = false; this.onPauseToggle && this.onPauseToggle(false); };
    $('btn-pause-settings').onclick = () => { $('pause-menu').classList.add('hidden'); $('settings-menu').classList.remove('hidden'); };
    $('btn-quit').onclick = () => { this.onQuit && this.onQuit(); };
  },

  _wireJoystick() {
    const zone = $('joystick-zone');
    const knob = $('joystick-knob');
    let activeId = null;
    const maxDist = 40;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    zone.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      zone.setPointerCapture(activeId);
      handleMove(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      handleMove(e);
    });
    const end = (e) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      input.moveX = 0; input.moveY = 0;
      setKnob(0, 0);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    function handleMove(e) {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const dist = Math.min(maxDist, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist;
      setKnob(dx, dy);
      input.moveX = dx / maxDist;
      input.moveY = -dy / maxDist; // invert so up = forward
    }
  },

  _wireLookZone() {
    const zone = $('look-zone');
    let activeId = null;
    let lastX = 0, lastY = 0;

    zone.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      lastX = e.clientX; lastY = e.clientY;
      zone.setPointerCapture(activeId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      input.lookDX += (e.clientX - lastX) * 0.01 * settings.sensitivity;
      input.lookDY += (e.clientY - lastY) * 0.01 * settings.sensitivity;
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = (e) => { if (e.pointerId === activeId) activeId = null; };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  },

  _wireActionButtons() {
    const bind = (id, downFn, upFn) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); downFn(); });
      if (upFn) el.addEventListener('pointerup', upFn);
      if (upFn) el.addEventListener('pointercancel', upFn);
    };
    bind('btn-jump', () => { input.jumpPressed = true; });
    bind('btn-sprint', () => { input.sprintHeld = true; }, () => { input.sprintHeld = false; });
    bind('btn-crouch', () => { input.crouchHeld = !input.crouchHeld; });
    bind('btn-interact', () => { input.interactPressed = true; });
  },

  _wireKeyboard() {
    const keys = new Set();
    window.addEventListener('keydown', (e) => {
      keys.add(e.code);
      if (e.code === 'Space') input.jumpPressed = true;
      if (e.code === 'KeyE') input.interactPressed = true;
      if (e.code === 'Escape') {
        this._paused = !this._paused;
        this._paused ? this.pause() : this.resume();
        this.onPauseToggle && this.onPauseToggle(this._paused);
      }
      updateAxesFromKeys();
    });
    window.addEventListener('keyup', (e) => {
      keys.delete(e.code);
      updateAxesFromKeys();
    });
    function updateAxesFromKeys() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      input.moveX = x; input.moveY = y;
      input.sprintHeld = keys.has('ShiftLeft') || keys.has('ShiftRight');
      input.crouchHeld = keys.has('ControlLeft') || keys.has('KeyC');
    }

    // mouse-look for desktop (drag on canvas)
    let dragging = false, lastX = 0, lastY = 0;
    const canvas = $('game-canvas');
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('pointerup', () => dragging = false);
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      input.lookDX += (e.clientX - lastX) * 0.01 * settings.sensitivity;
      input.lookDY += (e.clientY - lastY) * 0.01 * settings.sensitivity;
      lastX = e.clientX; lastY = e.clientY;
    });
  },

  // call once per frame after camera/player consume the deltas
  clearFrameDeltas() {
    input.lookDX = 0;
    input.lookDY = 0;
    input.jumpPressed = false;
    input.interactPressed = false;
  },
};
