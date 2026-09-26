// world.js — Phase 1 playable city block: ground, roads, buildings, props, lighting
import * as THREE from 'three';

const COLORS = {
  road: 0x2b2e33,
  roadLine: 0xdedede,
  sidewalk: 0x9a9a92,
  grass: 0x4c7a45,
  buildingBase: [0x8a8f99, 0x76766e, 0x6f7a86, 0x9a8f7c, 0x7f8a7f],
  glass: 0x3b556b,
  roof: 0x40444b,
};

// Reusable geometries/materials so many buildings share GPU resources (basic instancing-style reuse).
function makeMaterials() {
  return {
    road: new THREE.MeshStandardMaterial({ color: COLORS.road, roughness: 0.95 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: COLORS.glass, roughness: 0.3, metalness: 0.4 }),
    roof: new THREE.MeshStandardMaterial({ color: COLORS.roof, roughness: 0.8 }),
    poleMetal: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.6 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdd88, emissiveIntensity: 1.2 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5b4230, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x2f5d2a, roughness: 1 }),
    bench: new THREE.MeshStandardMaterial({ color: 0x3d3120, roughness: 0.9 }),
  };
}

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.mats = makeMaterials();
    this.colliders = []; // { box3, mesh }
    this.minimapObjects = []; // { x, z, w, d } for HUD minimap
    this.streetlights = [];
    this.blockSize = 60; // one "city block" unit
    this._buildEverything();
  }

  _buildEverything() {
    this._addLighting();
    this._addGround();
    this._addRoadGrid();
    this._addBuildingsRing();
    this._addPark();
    this._addProps();
  }

  _addLighting() {
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x33361f, 0.9);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d9, 1.4);
    this.sun.position.set(120, 180, 80);
    this.sun.target.position.set(0, 0, 0);
    if (this.quality.shadowsEnabled) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
      const d = 140;
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.camera.far = 500;
      this.sun.shadow.bias = -0.0015;
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.scene.fog = new THREE.Fog(0x9fb8cc, this.quality.fog * 0.5, this.quality.fog);
    this.scene.background = new THREE.Color(0x9fc4e0);
  }

  _addGround() {
    const geo = new THREE.PlaneGeometry(2000, 2000);
    const mesh = new THREE.Mesh(geo, this.mats.grass);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // Simple 3x3 grid of roads forming city blocks, with sidewalks bordering each block.
  _addRoadGrid() {
    const roadWidth = 10;
    const span = this.blockSize * 3 + roadWidth * 2;
    const roadGeo = new THREE.PlaneGeometry(span, roadWidth);
    for (let i = -1; i <= 1; i++) {
      const z = i * (this.blockSize + roadWidth);
      const road = new THREE.Mesh(roadGeo, this.mats.road);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.01, z);
      road.receiveShadow = true;
      this.scene.add(road);
      this._addLaneMarkings(0, z, span, true);

      const roadV = new THREE.Mesh(roadGeo, this.mats.road);
      roadV.rotation.x = -Math.PI / 2;
      roadV.rotation.z = Math.PI / 2;
      roadV.position.set(z, 0.01, 0);
      roadV.receiveShadow = true;
      this.scene.add(roadV);
      this._addLaneMarkings(z, 0, span, false);
    }
  }

  _addLaneMarkings(cx, cz, length, horizontal) {
    const dashGeo = new THREE.PlaneGeometry(horizontal ? 2 : 0.3, horizontal ? 0.3 : 2);
    const count = Math.floor(length / 6);
    for (let i = 0; i < count; i++) {
      const dash = new THREE.Mesh(dashGeo, new THREE.MeshBasicMaterial({ color: COLORS.roadLine }));
      dash.rotation.x = -Math.PI / 2;
      const offset = -length / 2 + i * 6 + 3;
      if (horizontal) dash.position.set(cx + offset, 0.02, cz);
      else dash.position.set(cx, 0.02, cz + offset);
      this.scene.add(dash);
    }
  }

  // Places varied-height buildings around the perimeter of the central block (the playable park stays open).
  _addBuildingsRing() {
    const roadWidth = 10;
    const lots = [];
    // 8 lots surrounding the central block, skipping the very center.
    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        if (gx === 0 && gz === 0) continue;
        lots.push({
          x: gx * (this.blockSize + roadWidth),
          z: gz * (this.blockSize + roadWidth),
        });
      }
    }

    lots.forEach((lot, idx) => {
      this._addSidewalk(lot.x, lot.z);
      const buildingsPerLot = 2 + (idx % 2);
      for (let b = 0; b < buildingsPerLot; b++) {
        const w = 8 + Math.random() * 6;
        const d = 8 + Math.random() * 6;
        const h = 14 + Math.random() * 46;
        const offsetX = (b - (buildingsPerLot - 1) / 2) * 14;
        this._addBuilding(lot.x + offsetX, lot.z, w, h, d, idx + b);
      }
      this._addStreetlightsAround(lot.x, lot.z);
    });
  }

  _addSidewalk(cx, cz) {
    const size = this.blockSize - 4;
    const geo = new THREE.PlaneGeometry(size, size);
    const mesh = new THREE.Mesh(geo, this.mats.sidewalk);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.02, cz);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  _addBuilding(x, z, w, h, d, colorIdx) {
    const baseColor = COLORS.buildingBase[colorIdx % COLORS.buildingBase.length];
    const bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85 });
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, bodyMat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = this.quality.shadowsEnabled;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Glass band + roof cap for visual interest (still low-poly, but not a bare box).
    const bandGeo = new THREE.BoxGeometry(w * 1.001, Math.min(h * 0.55, h - 2), d * 1.001);
    const band = new THREE.Mesh(bandGeo, this.mats.glass);
    band.position.set(x, h * 0.5, z);
    this.scene.add(band);

    const roofGeo = new THREE.BoxGeometry(w + 0.6, 1.2, d + 0.6);
    const roof = new THREE.Mesh(roofGeo, this.mats.roof);
    roof.position.set(x, h + 0.6, z);
    this.scene.add(roof);

    const box = new THREE.Box3(
      new THREE.Vector3(x - w / 2, 0, z - d / 2),
      new THREE.Vector3(x + w / 2, h, z + d / 2)
    );
    this.colliders.push({ box3: box });
    this.minimapObjects.push({ x, z, w, d });
  }

  _addStreetlightsAround(cx, cz) {
    const half = this.blockSize / 2;
    const corners = [
      [cx - half, cz - half], [cx + half, cz - half],
      [cx - half, cz + half], [cx + half, cz + half],
    ];
    corners.forEach(([x, z]) => this._addStreetlight(x, z));
  }

  _addStreetlight(x, z) {
    const group = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 8);
    const pole = new THREE.Mesh(poleGeo, this.mats.poleMetal);
    pole.position.y = 3;
    group.add(pole);

    const armGeo = new THREE.BoxGeometry(1.6, 0.12, 0.12);
    const arm = new THREE.Mesh(armGeo, this.mats.poleMetal);
    arm.position.set(0.8, 5.9, 0);
    group.add(arm);

    const lampGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const lamp = new THREE.Mesh(lampGeo, this.mats.lampGlow);
    lamp.position.set(1.5, 5.9, 0);
    group.add(lamp);

    const light = new THREE.PointLight(0xffdd99, 0, 14, 2); // intensity turned on at night by main.js
    light.position.set(1.5, 5.7, 0);
    group.add(light);

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.streetlights.push(light);
  }

  _addPark() {
    // Central block is a small open park/plaza — safe starting area with trees and benches.
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const r = 14 + (i % 3) * 4;
      this._addTree(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    this._addBench(6, 0, 0);
    this._addBench(-6, 0, Math.PI);
  }

  _addTree(x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), this.mats.trunk);
    trunk.position.y = 1.5;
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 8), this.mats.leaves);
    leaves.position.y = 3.6;
    leaves.castShadow = this.quality.shadowsEnabled;
    group.add(leaves);
    group.position.set(x, 0, z);
    this.scene.add(group);

    this.colliders.push({
      box3: new THREE.Box3(
        new THREE.Vector3(x - 0.35, 0, z - 0.35),
        new THREE.Vector3(x + 0.35, 3, z + 0.35)
      ),
    });
  }

  _addBench(x, z, rotY) {
    const group = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.6), this.mats.bench);
    seat.position.y = 0.45;
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.1), this.mats.bench);
    back.position.set(0, 0.75, -0.25);
    group.add(back);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.scene.add(group);
  }

  _addProps() {
    // A few simple bus-stop-style props to fill the plaza edge (kept lightweight for mobile).
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), this.mats.poleMetal);
    post.position.y = 1.2;
    sign.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05), new THREE.MeshStandardMaterial({ color: 0x1c5fae }));
    board.position.y = 2.2;
    sign.add(board);
    sign.position.set(3, 0, 8);
    this.scene.add(sign);
  }

  // Call once per frame with the current hour (0-24) to fade streetlights on/off.
  updateDayNight(hour) {
    const isNight = hour < 6 || hour > 18.5;
    const targetIntensity = isNight ? 1.1 : 0;
    this.streetlights.forEach((l) => { l.intensity += (targetIntensity - l.intensity) * 0.1; });

    // Sun position sweeps across the sky based on hour.
    const angle = ((hour - 6) / 12) * Math.PI; // 6am -> 0, 6pm -> PI
    const radius = 200;
    this.sun.position.set(Math.cos(angle) * radius, Math.max(20, Math.sin(angle) * radius), 80);
    const dayColor = new THREE.Color(0x9fc4e0);
    const nightColor = new THREE.Color(0x0c1220);
    const t = isNight ? 1 : 0;
    this.scene.background.copy(dayColor).lerp(nightColor, t * 0.85);
    this.scene.fog.color.copy(this.scene.background);
    this.sun.intensity = isNight ? 0.15 : 1.4;
    this.hemi.intensity = isNight ? 0.25 : 0.9;
  }
}
