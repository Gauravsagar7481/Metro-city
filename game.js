import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const $ = id => document.getElementById(id);

let scene;
let camera;
let renderer;
let clock;

let player;
let car;

let started = false;
let driving = false;
let jumping = false;

let jumpVelocity = 0;

let lookPointerId = null;
let lastLookX = 0;
let lastLookY = 0;


/* =========================
   INPUT
========================= */

const input = {
  x: 0,
  y: 0,

  run: false,

  gas: false,
  brake: false,

  left: false,
  right: false
};


/* =========================
   PLAYER STATE
========================= */

const playerState = {
  speed: 6.5,
  runSpeed: 11,

  health: 100,
  stamina: 100,

  yaw: 0,
  pitch: 0
};


/* =========================
   CAR STATE
========================= */

const carState = {
  speed: 0,

  max: 24,
  reverse: 8,

  accel: 16,
  friction: 7,

  turn: 1.7
};


/* =========================
   START GAME
========================= */

init();
animate();


/* =========================
   INITIALIZE
========================= */

function init() {

  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x8fc7ef);

  scene.fog = new THREE.Fog(
    0x8fc7ef,
    80,
    270
  );


  /* CAMERA */

  camera = new THREE.PerspectiveCamera(
    67,
    innerWidth / innerHeight,
    0.1,
    500
  );


  /* RENDERER */

  renderer = new THREE.WebGLRenderer({
    antialias: true,
   
