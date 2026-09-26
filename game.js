import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";


/* =========================================================
   DOM HELPER
========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   THREE.JS
========================================================= */

let scene;
let camera;
let renderer;
let clock;


/* =========================================================
   GAME OBJECTS
========================================================= */

let player;
let car;


/* =========================================================
   GAME STATE
========================================================= */

let started = false;
let driving = false;

let jumping = false;
let jumpVelocity = 0;


/* =========================================================
   CAMERA TOUCH STATE
========================================================= */

let cameraPointerId = null;
let lastLookX = 0;
let lastLookY = 0;


/* =========================================================
   JOYSTICK STATE
========================================================= */

let joystickPointerId = null;

let joystickCenterX = 0;
let joystickCenterY = 0;

const joystickMaxDistance = 48;


/* =========================================================
   INPUT STATE
========================================================= */

const input = {

  x: 0,
  y: 0,

  run: false,

  gas: false,
  brake: false

};


/* =========================================================
   PLAYER STATE
========================================================= */

const playerState = {

  speed: 6.5,
  runSpeed: 11,

  health: 100,
  stamina: 100,

  yaw: 0,
  pitch: 0

};


/* =========================================================
   CAR STATE
========================================================= */

const carState = {

  speed: 0,

  max: 24,
  reverse: 8,

  accel: 16,
  friction: 7,

  turn: 1.7

};


/* =========================================================
   START
========================================================= */

init();
animate();


/* =========================================================
   INITIALIZE
========================================================= */

function init() {

  scene = new THREE.Scene();

  scene.background =
    new THREE.Color(0x8fc7ef);

  scene.fog =
    new THREE.Fog(
      0x8fc7ef,
      80,
      270
    );


  /* CAMERA */

  camera =
    new THREE.PerspectiveCamera(
      67,
      innerWidth / innerHeight,
      0.1,
      500
    );


  /* RENDERER */

  renderer =
    new THREE.WebGLRenderer({

      antialias: true,

      powerPreference:
        "high-performance"

    });


  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.5
    )
  );


  renderer.setSize(
    innerWidth,
    innerHeight
  );


  renderer.shadowMap.enabled =
    true;

  renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


  $("game-container")
    .appendChild(
      renderer.domElement
    );


  clock =
    new THREE.Clock();


  /* WORLD */

  lights();

  world();

  makePlayer();

  makeCar();


  /* TOUCH CONTROLS */

  setupMobileControls();


  /* KEYBOARD */

  setupKeyboardControls();


  /* RESIZE */

  window.addEventListener(
    "resize",
    resize
  );


  /* START */

  $("startButton").addEventListener(
    "click",
    startGame
  );
}


/* =========================================================
   START GAME
========================================================= */

function startGame() {

  started = true;

  $("start-screen")
    .style.display = "none";

  resetTouchState();

  clock.getDelta();
}


/* =========================================================
   LIGHTS
========================================================= */

function lights() {

  const hemisphere =
    new THREE.HemisphereLight(
      0xdff4ff,
      0x4a603e,
      2
    );

  scene.add(hemisphere);


  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      2.2
    );


  sun.position.set(
    80,
    120,
    60
  );


  sun.castShadow = true;


  sun.shadow.mapSize.set(
    1024,
    1024
  );


  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;


  scene.add(sun);
}


/* =========================================================
   WORLD
========================================================= */

function world() {

  const ground =
    new THREE.Mesh(

      new THREE.PlaneGeometry(
        320,
        320
      ),

      new THREE.MeshStandardMaterial({
        color: 0x4e7549,
        roughness: 1
      })

    );


  ground.rotation.x =
    -Math.PI / 2;


  ground.receiveShadow = true;

  scene.add(ground);


  road(0, 0, 320, 18, true);
  road(0, 0, 18, 320, false);

  road(0, -70, 320, 14, true);
  road(-75, 0, 14, 180, false);

  road(55, 45, 110, 10, true);
  road(55, 90, 110, 10, true);
  road(100, 67, 10, 55, false);


  building(
    -38,
    -35,
    22,
    16,
    18,
    0x9aa9bd
  );

  building(
    38,
    -35,
    24,
    17,
    24,
    0x7c8fa7
  );

  building(
    -42,
    38,
    20,
    18,
    12,
    0xd0b08a
  );

  building(
    40,
    38,
    18,
    16,
    14,
    0xb78670
  );


  building(
    -65,
    115,
    24,
    22,
    55,
    0x53677e
  );

  building(
    -32,
    120,
    20,
    18,
    42,
    0x687d96
  );

  building(
    5,
    118,
    24,
    22,
    68,
    0x455b74
  );

  building(
    42,
    120,
    20,
    18,
    50,
    0x73869c
  );

  building(
    75,
    118,
    24,
    22,
    78,
    0x4b6077
  );


  house(75, 35);
  house(75, 75);

  house(115, 35);
  house(115, 75);


  park(
    -95,
    -35,
    45,
    55
  );


  trees();
}


/* =========================================================
   ROAD
========================================================= */

function road(
  x,
  z,
  w,
  d,
  horizontal
) {

  const roadMesh =
    new THREE.Mesh(

      new THREE.BoxGeometry(
        w,
        0.12,
        d
      ),

     
