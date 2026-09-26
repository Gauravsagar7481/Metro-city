// player.js — original playable character: movement, collision, stamina, simple procedural animation
import * as THREE from 'three';

const WALK_SPEED = 3.2;
const RUN_SPEED = 6.8;
const CROUCH_SPEED = 1.6;
const GRAVITY = -22;
const JUMP_VELOCITY = 8.5;
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 22; // per second while sprinting
const STAMINA_REGEN = 14; // per second while not sprinting

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.position = this.group.position; // Vector3 alias for convenience
    this.velocityY = 0;
    this.heading = 0; // radians, where the character faces (world space)
    this.grounded = true;
    this.state = 'idle'; // idle | walk | run | jump | fall | crouch
    this.stamina = STAMINA_MAX;
    this.health = 100;
    this.animT = 0;
    this.radius = 0.4; // for cylinder-based collision against building boxes

    this._buildMesh();
    this.group.position.set(0, 0, 6);
    scene.add(this.group);
  }

  // Builds an original low-poly stylized character out of primitives — not a bare capsule.
  _buildMesh() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xdcae83, roughness: 0.8 });
    const jacket = new THREE.MeshStandardMaterial({ color: 0x2f4f6b, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.8 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), jacket);
    torso.position.y = 1.15;
    torso.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), skin);
    head.position.y = 1.72;
    head.castShadow = true;

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.y = 1.78;

    const hipWidth = 0.16;
    const legLength = 0.75;
    const legGeo = new THREE.CapsuleGeometry(0.11, legLength * 0.6, 4, 6);

    this.legL = new THREE.Mesh(legGeo, pants);
    this.legL.position.set(-hipWidth, 0.55, 0);
    this.legL.castShadow = true;

    this.legR = new THREE.Mesh(legGeo, pants);
    this.legR.position.set(hipWidth, 0.55, 0);
    this.legR.castShadow = true;

    const shoeGeo = new THREE.BoxGeometry(0.16, 0.1, 0.28);
    this.shoeL = new THREE.Mesh(shoeGeo, shoe);
    this.shoeL.position.set(-hipWidth, 0.08, 0.05);
    this.shoeR = new THREE.Mesh(shoeGeo, shoe);
    this.shoeR.position.set(hipWidth, 0.08, 0.05);

    const armGeo = new THREE.CapsuleGeometry(0.08, 0.45, 4, 6);
    this.armL = new THREE.Mesh(armGeo, jacket);
    this.armL.position.set(-0.38, 1.25, 0);
    this.armL.castShadow = true;

    this.armR = new THREE.Mesh(armGeo, jacket);
    this.armR.position.set(0.38, 1.25, 0);
    this.armR.castShadow = true;

    this.group.add(torso, head, hairCap, this.legL, this.legR, this.shoeL, this.shoeR, this.armL, this.armR);
    this.torso = torso;
    this.head = head;
  }

  // moveVec is {x, z} in the -1..1 range already relative to camera-facing direction.
  update(dt, { moveX, moveZ, sprint, crouch, jumpPressed, colliders, groundY = 0 }) {
    const wantsMove = Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05;
    const isSprinting = sprint && wantsMove && this.stamina > 1 && !crouch;

    let speed = crouch ? CROUCH_SPEED : (isSprinting ? RUN_SPEED : WALK_SPEED);

    if (wantsMove) {
      const targetHeading = Math.atan2(moveX, moveZ);
      this.heading = targetHeading;
      this.group.rotation.y = this.heading;

      const dx = Math.sin(this.heading) * speed * dt;
      const dz = Math.cos(this.heading) * speed * dt;
      const nextX = this.group.position.x + dx;
      const nextZ = this.group.position.z + dz;

      if (!this._collides(nextX, this.group.position.z, colliders)) this.group.position.x = nextX;
      if (!this._collides(this.group.position.x, nextZ, colliders)) this.group.position.z = nextZ;
    }

    // Stamina
    if (isSprinting) this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * dt);
    else this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);

    // Gravity & jump
    if (this.grounded && jumpPressed) {
      this.velocityY = JUMP_VELOCITY;
      this.grounded = false;
    }
    this.velocityY += GRAVITY * dt;
    this.group.position.y += this.velocityY * dt;
    if (this.group.position.y <= groundY) {
      this.group.position.y = groundY;
      this.velocityY = 0;
      this.grounded = true;
    }

    // State for animation + HUD
    if (!this.grounded) this.state = this.velocityY > 0 ? 'jump' : 'fall';
    else if (crouch) this.state = 'crouch';
    else if (isSprinting) this.state = 'run';
    else if (wantsMove) this.state = 'walk';
    else this.state = 'idle';

    this._animate(dt, wantsMove, isSprinting, crouch);
  }

  _collides(x, z, colliders) {
    if (!colliders) return false;
    for (const c of colliders) {
      const b = c.box3;
      if (x > b.min.x - this.radius && x < b.max.x + this.radius &&
          z > b.min.z - this.radius && z < b.max.z + this.radius) {
        return true;
      }
    }
    return false;
  }

  _animate(dt, moving, sprinting, crouch) {
    const speedMul = sprinting ? 2.2 : (moving ? 1.2 : 0.5);
    this.animT += dt * speedMul * 6;

    if (moving) {
      const swing = Math.sin(this.animT) * (sprinting ? 0.7 : 0.45);
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = swing * 0.8;
      this.torso.position.y = 1.15 + Math.abs(Math.sin(this.animT * 2)) * 0.03;
    } else {
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8;
      this.armR.rotation.x *= 0.8;
      this.torso.position.y += (1.15 + Math.sin(this.animT * 0.5) * 0.01 - this.torso.position.y) * 0.1;
    }

    const crouchOffset = crouch ? -0.28 : 0;
    this.group.position.y += 0; // ground handled separately
    this.torso.scale.y += ((crouch ? 0.75 : 1) - this.torso.scale.y) * 0.2;
    this.head.position.y += ((crouch ? 1.72 + crouchOffset : 1.72) - this.head.position.y) * 0.2;
  }
}
