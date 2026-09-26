// camera.js — third-person follow camera with smoothing, collision, and zoom
import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.yaw = 0;      // orbit around player
    this.pitch = 0.35; // looking slightly down
    this.distance = 6;
    this.minDistance = 2.2;
    this.maxDistance = 9;
    this.raycaster = new THREE.Raycaster();
    this._currentPos = new THREE.Vector3();
    this._shakeT = 0;
    this._shakeStrength = 0;
  }

  addLook(dx, dy) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -0.5, 1.1);
  }

  addZoom(delta) {
    this.distance = THREE.MathUtils.clamp(this.distance + delta, this.minDistance, this.maxDistance);
  }

  shake(strength = 0.15, duration = 0.3) {
    this._shakeStrength = strength;
    this._shakeT = duration;
  }

  // targetPos: player position Vector3-like {x,y,z}; colliders: array of {box3}
  update(dt, targetPos, colliders) {
    const pivot = new THREE.Vector3(targetPos.x, targetPos.y + 1.5, targetPos.z);

    const desired = new THREE.Vector3(
      pivot.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      pivot.y + Math.sin(this.pitch) * this.distance,
      pivot.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance
    );

    // Collision: raycast from pivot toward desired camera pos, pull camera closer if blocked.
    let finalDist = this.distance;
    const dir = desired.clone().sub(pivot).normalize();
    this.raycaster.set(pivot, dir);
    this.raycaster.far = this.distance;
    const meshes = (colliders || []).map((c) => c.mesh).filter(Boolean);
    if (meshes.length) {
      const hits = this.raycaster.intersectObjects(meshes, false);
      if (hits.length) finalDist = Math.max(this.minDistance, hits[0].distance * 0.9);
    }

    const finalPos = pivot.clone().add(dir.multiplyScalar(finalDist));

    // Smooth follow (critically-damped-ish lerp).
    const smooth = 1 - Math.pow(0.001, dt);
    this._currentPos.lerp(finalPos, smooth);

    // Camera shake
    let shakeOffset = new THREE.Vector3();
    if (this._shakeT > 0) {
      this._shakeT -= dt;
      const s = this._shakeStrength * (this._shakeT > 0 ? 1 : 0);
      shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
    }

    this.camera.position.copy(this._currentPos).add(shakeOffset);
    this.camera.lookAt(pivot);
  }

  snapTo(targetPos) {
    const pivot = new THREE.Vector3(targetPos.x, targetPos.y + 1.5, targetPos.z);
    const desired = new THREE.Vector3(
      pivot.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      pivot.y + Math.sin(this.pitch) * this.distance,
      pivot.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance
    );
    this._currentPos.copy(desired);
    this.camera.position.copy(desired);
    this.camera.lookAt(pivot);
  }
}
