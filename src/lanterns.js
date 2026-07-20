import * as THREE from 'three';
import { waveHeight, waveNormalTilt } from './waves.js';
import { MATERIAL_FX, LAKE_RADIUS, MAX_LEVEL } from './config.js';

const WOOD = new THREE.Color('#241a12');
const SCALE = 1.35; // overall lantern size on the water

function makePatternTexture(id) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d2d2d2';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#5c5c5c';
  ctx.fillStyle = '#5c5c5c';
  ctx.lineWidth = 5;
  if (id === 'waves') {
    for (let row = 0; row < 4; row++) {
      ctx.beginPath();
      for (let x = -4; x <= 132; x += 4) {
        const y = row * 32 + 18 + Math.sin((x / 128) * Math.PI * 4) * 7;
        x === -4 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (id === 'dots') {
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        ctx.beginPath();
        ctx.arc(gx * 32 + 16 + (gy % 2) * 8, gy * 32 + 16, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (id === 'rings') {
    for (let r = 12; r < 100; r += 22) {
      ctx.beginPath();
      ctx.arc(64, 64, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class LanternManager {
  constructor(scene) {
    this.scene = scene;
    this.lanterns = [];
    this.raycastTargets = [];
    this.ripples = [];
    this.dying = [];
    this.bursts = [];
    this.hovered = null;
    this.glowTex = makeGlowTexture();
    this.patternCache = new Map();
    this.poolGeo = new THREE.CircleGeometry(1, 24);
    this.selected = null;
    this._buildGhost();

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.62, 48),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    scene.add(this.selectionRing);
  }

  pattern(id) {
    if (!this.patternCache.has(id)) this.patternCache.set(id, makePatternTexture(id));
    return this.patternCache.get(id);
  }

  // A soft ring + glow that previews where the next lantern would land.
  _buildGhost() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.88, 40),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(2.6);
    glow.position.y = 0.3;
    group.add(ring, glow);
    this.ghost = { group, ring, glow, level: 0, color: new THREE.Color('#ffffff') };
    this.scene.add(group);
  }

  updateGhost(dt, t, target) {
    const gh = this.ghost;
    const want = target.visible ? 1 : 0;
    gh.level += (want - gh.level) * Math.min(1, dt * 9);
    if (target.visible) {
      gh.group.position.set(target.x, waveHeight(target.x, target.z, t) + 0.05, target.z);
      gh.color.set(target.ok ? target.colorHex : '#59607a');
      gh.ring.material.color.copy(gh.color);
      gh.glow.material.color.copy(gh.color);
    }
    gh.ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
    gh.ring.material.opacity = gh.level * 0.42;
    gh.glow.material.opacity = gh.level * 0.15;
  }

  setHovered(lantern) {
    this.hovered = lantern;
  }

  place(data, animate = true) {
    const lantern = {
      ...data,
      seed: data.seed ?? Math.random() * 100,
      level: data.level ?? 1,
      driftAngle: Math.random() * Math.PI * 2,
      spawnTime: animate ? 0 : 1,
      selectPulse: 1,
      hoverBoost: 0,
      rippleTimer: 1.5 + Math.random() * 2,
      wakeTimer: 4 + Math.random() * 5,
      group: new THREE.Group(),
      shadeMats: [],
      sparks: [],
    };
    this._buildMeshes(lantern);
    lantern.group.position.set(lantern.x, 0, lantern.z);
    lantern.group.scale.setScalar(animate ? 0.15 * SCALE : SCALE);
    this.scene.add(lantern.group);
    this.lanterns.push(lantern);
    if (animate) {
      this.spawnRipple(lantern.x, lantern.z, lantern.colorHex);
      this.spawnBurst(lantern.x, lantern.z, lantern.colorHex);
    }
    this._applyLevel(lantern);
    return lantern;
  }

  _shadeMaterial(lantern, { intensity = 1, flat = false } = {}) {
    const dye = new THREE.Color(lantern.colorHex);
    const mat = new THREE.MeshStandardMaterial({
      color: dye.clone().multiplyScalar(0.3),
      emissive: dye,
      emissiveMap: this.pattern(lantern.pattern),
      emissiveIntensity: 1.15 * intensity * MATERIAL_FX[lantern.material].glow,
      roughness: 0.85,
      flatShading: flat,
    });
    lantern.shadeMats.push({ mat, baseIntensity: mat.emissiveIntensity });
    return mat;
  }

  _buildMeshes(lantern) {
    const g = lantern.group;
    const woodMat = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 1 });
    const dye = new THREE.Color(lantern.colorHex);
    const bodies = [];

    if (lantern.model === 'paper') {
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.48, 0.85, 9),
        this._shadeMaterial(lantern)
      );
      shade.position.y = 0.56;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.44, 0.13, 9), woodMat);
      base.position.y = 0.07;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 9), woodMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.99;
      bodies.push(shade, base, rim);
    } else if (lantern.model === 'lotus') {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 8),
        this._shadeMaterial(lantern, { intensity: 1.25 })
      );
      core.position.y = 0.42;
      bodies.push(core);
      const petalMat = new THREE.MeshStandardMaterial({
        color: dye.clone().multiplyScalar(0.45),
        emissive: dye,
        emissiveIntensity: 0.35 * MATERIAL_FX[lantern.material].glow,
        roughness: 0.9,
        flatShading: true,
      });
      lantern.shadeMats.push({ mat: petalMat, baseIntensity: petalMat.emissiveIntensity });
      for (let i = 0; i < 8; i++) {
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.62, 4), petalMat);
        const a = (i / 8) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4);
        petal.rotation.z = Math.cos(a) * 0.85;
        petal.rotation.x = -Math.sin(a) * 0.85;
        bodies.push(petal);
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.48, 0.1, 9), woodMat);
      base.position.y = 0.05;
      bodies.push(base);
    } else if (lantern.model === 'orb') {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.44, 1),
        this._shadeMaterial(lantern, { flat: true })
      );
      orb.position.y = 0.58;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 10), woodMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.16;
      bodies.push(orb, ring);
    } else if (lantern.model === 'pagoda') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.9), woodMat);
      base.position.y = 0.07;
      const wall1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.46, 0.58),
        this._shadeMaterial(lantern)
      );
      wall1.position.y = 0.4;
      const roof1 = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.26, 4), woodMat);
      roof1.rotation.y = Math.PI / 4;
      roof1.position.y = 0.76;
      const wall2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.3, 0.36),
        this._shadeMaterial(lantern, { intensity: 1.15 })
      );
      wall2.position.y = 1.0;
      const roof2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.24, 4), woodMat);
      roof2.rotation.y = Math.PI / 4;
      roof2.position.y = 1.26;
      bodies.push(base, wall1, roof1, wall2, roof2);
    } else if (lantern.model === 'crystal') {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4, 0),
        this._shadeMaterial(lantern, { intensity: 1.4, flat: true })
      );
      crystal.scale.y = 1.7;
      crystal.position.y = 0.85;
      lantern.spinMesh = crystal;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 10), woodMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12;
      bodies.push(crystal, ring);
    }

    for (const b of bodies) {
      b.userData.lantern = lantern;
      g.add(b);
      this.raycastTargets.push(b);
    }
    lantern.bodies = bodies;

    // Halo sprite.
    const fx = MATERIAL_FX[lantern.material];
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: dye,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.position.y = 0.72;
    lantern.halo = halo;
    g.add(halo);

    // Light pool on the water.
    const pool = new THREE.Mesh(
      this.poolGeo,
      new THREE.MeshBasicMaterial({
        map: this.glowTex,
        color: dye,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.05;
    lantern.pool = pool;
    g.add(pool);
    void fx;
  }

  _applyLevel(lantern) {
    const fx = MATERIAL_FX[lantern.material];
    const lvl = lantern.level;
    const haloScale = 3.1 * fx.halo * (1 + 0.4 * (lvl - 1));
    lantern.haloBase = haloScale;
    lantern.halo.scale.set(haloScale, haloScale, 1);
    lantern.halo.material.opacity = 0.36 + 0.1 * (lvl - 1);
    const poolScale = 3.6 * fx.halo * (1 + 0.35 * (lvl - 1));
    lantern.poolBase = poolScale;
    lantern.pool.scale.setScalar(poolScale);
    for (const s of lantern.shadeMats) {
      s.mat.emissiveIntensity = s.baseIntensity * (1 + 0.3 * (lvl - 1));
    }
    // Level 3: orbiting sparks.
    if (lvl >= MAX_LEVEL && lantern.sparks.length === 0) {
      for (let i = 0; i < 5; i++) {
        const spark = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTex,
            color: new THREE.Color(lantern.colorHex).lerp(new THREE.Color('#ffffff'), 0.5),
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        spark.scale.setScalar(0.28);
        spark.userData = { phase: (i / 5) * Math.PI * 2, r: 0.85 + Math.random() * 0.4 };
        lantern.sparks.push(spark);
        lantern.group.add(spark);
      }
    }
  }

  upgrade(lantern) {
    if (lantern.level >= MAX_LEVEL) return false;
    lantern.level += 1;
    this._applyLevel(lantern);
    this.spawnRipple(lantern.group.position.x, lantern.group.position.z, lantern.colorHex);
    return true;
  }

  recolor(lantern, colorHex) {
    lantern.colorHex = colorHex;
    const dye = new THREE.Color(colorHex);
    for (const s of lantern.shadeMats) {
      s.mat.emissive.copy(dye);
      s.mat.color.copy(dye.clone().multiplyScalar(s.mat.flatShading && lantern.model === 'lotus' ? 0.45 : 0.3));
    }
    lantern.halo.material.color.copy(dye);
    lantern.pool.material.color.copy(dye);
    for (const spark of lantern.sparks) {
      spark.material.color.copy(dye.clone().lerp(new THREE.Color('#ffffff'), 0.5));
    }
  }

  repattern(lantern, patternId) {
    lantern.pattern = patternId;
    const tex = this.pattern(patternId);
    for (const s of lantern.shadeMats) {
      if (s.mat.emissiveMap) {
        s.mat.emissiveMap = tex;
        s.mat.needsUpdate = true;
      }
    }
  }

  select(lantern) {
    this.selected = lantern;
    lantern.selectPulse = 0;
  }

  deselect() {
    if (this.selected) {
      const s = this.selected;
      this.spawnRipple(s.group.position.x, s.group.position.z, '#ffffff', {
        maxScale: 2.6,
        opacity: 0.22,
        duration: 1.1,
      });
    }
    this.selected = null;
  }

  release(lantern) {
    if (this.selected === lantern) this.deselect();
    if (this.hovered === lantern) this.hovered = null;
    const i = this.lanterns.indexOf(lantern);
    if (i >= 0) this.lanterns.splice(i, 1);
    for (const b of lantern.bodies) {
      const j = this.raycastTargets.indexOf(b);
      if (j >= 0) this.raycastTargets.splice(j, 1);
    }
    lantern.fade = 1;
    this.dying.push(lantern);
  }

  spawnRipple(x, z, colorHex = '#ffffff', opts = {}) {
    const { maxScale = 4.6, opacity = 0.45, duration = 2.2 } = opts;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.0, 40),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.06, z);
    ring.scale.setScalar(0.4);
    this.scene.add(ring);
    this.ripples.push({ mesh: ring, life: 0, maxScale, opacity, duration });
  }

  // A short spray of rising sparks when a lantern lands on the water.
  spawnBurst(x, z, colorHex) {
    const color = new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.35);
    for (let i = 0; i < 8; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const a = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.random() * 0.35;
      sprite.position.set(x + Math.cos(a) * r, 0.25, z + Math.sin(a) * r);
      sprite.scale.setScalar(0.16 + Math.random() * 0.18);
      this.scene.add(sprite);
      this.bursts.push({
        sprite,
        vx: Math.cos(a) * (0.3 + Math.random() * 0.5),
        vy: 1.1 + Math.random() * 1.3,
        vz: Math.sin(a) * (0.3 + Math.random() * 0.5),
        life: 0,
        duration: 0.7 + Math.random() * 0.4,
      });
    }
  }

  update(dt, t) {
    for (const l of this.lanterns) {
      // Spawn pop and select pulse together set the visual scale.
      let scaleK = 1;
      if (l.spawnTime < 1) {
        l.spawnTime = Math.min(1, l.spawnTime + dt * 1.6);
        const k = 1 - Math.pow(1 - l.spawnTime, 3);
        scaleK *= 0.15 + 0.85 * k;
      }
      if (l.selectPulse < 1) {
        l.selectPulse = Math.min(1, l.selectPulse + dt * 2.8);
        scaleK *= 1 + Math.sin(l.selectPulse * Math.PI) * 0.07;
      }
      l.group.scale.setScalar(scaleK * SCALE);

      // Hovered lanterns glow a little brighter.
      const hoverTarget = this.hovered === l ? 1 : 0;
      l.hoverBoost += (hoverTarget - l.hoverBoost) * Math.min(1, dt * 8);

      // Slow drift, curving gently, held inside the lake.
      const fx = MATERIAL_FX[l.material];
      l.driftAngle += Math.sin(t * 0.1 + l.seed) * dt * 0.08;
      const speed = 0.14 * fx.drift;
      let nx = l.group.position.x + Math.cos(l.driftAngle) * speed * dt;
      let nz = l.group.position.z + Math.sin(l.driftAngle) * speed * dt;
      const dist = Math.hypot(nx, nz);
      if (dist > LAKE_RADIUS - 3) {
        // Steer back toward the center.
        const inward = Math.atan2(-nz, -nx);
        l.driftAngle += (inward - l.driftAngle) * dt * 0.5;
        const k = (LAKE_RADIUS - 3) / dist;
        nx *= k;
        nz *= k;
      }
      l.group.position.x = nx;
      l.group.position.z = nz;
      l.x = nx;
      l.z = nz;

      // Bob on the shared wave field.
      l.group.position.y = waveHeight(nx, nz, t);
      const tilt = waveNormalTilt(nx, nz, t);
      l.group.rotation.x = tilt.rx + Math.sin(t * 0.6 + l.seed) * 0.02;
      l.group.rotation.z = tilt.rz + Math.cos(t * 0.5 + l.seed * 1.3) * 0.02;
      l.group.rotation.y += dt * 0.05;

      // Breathing glow, lifted while hovered.
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.1 + l.seed * 7);
      l.halo.material.opacity = (0.32 + 0.1 * (l.level - 1)) + pulse * 0.1 + l.hoverBoost * 0.2;
      l.pool.material.opacity = 0.24 + pulse * 0.1 + l.hoverBoost * 0.12;
      const haloK = 1 + l.hoverBoost * 0.14 + pulse * 0.03;
      l.halo.scale.set(l.haloBase * haloK, l.haloBase * haloK, 1);
      l.pool.scale.setScalar(l.poolBase * (1 + l.hoverBoost * 0.08));

      // A faint white wake ripple now and then while drifting.
      l.wakeTimer -= dt;
      if (l.wakeTimer <= 0) {
        l.wakeTimer = 6 + Math.random() * 5;
        this.spawnRipple(nx, nz, '#ffffff', { maxScale: 2.1, opacity: 0.13, duration: 1.9 });
      }

      if (l.spinMesh) l.spinMesh.rotation.y += dt * 0.5;

      // Level 2+: periodic ripples.
      if (l.level >= 2) {
        l.rippleTimer -= dt;
        if (l.rippleTimer <= 0) {
          l.rippleTimer = 3 + Math.random() * 2.5;
          this.spawnRipple(nx, nz, l.colorHex);
        }
      }

      // Level 3: orbiting sparks.
      for (const spark of l.sparks) {
        const u = spark.userData;
        spark.position.set(
          Math.cos(t * 0.7 + u.phase) * u.r,
          0.7 + Math.sin(t * 1.1 + u.phase * 2) * 0.3,
          Math.sin(t * 0.7 + u.phase) * u.r
        );
        spark.material.opacity = 0.5 + 0.35 * Math.sin(t * 2 + u.phase * 3);
      }
    }

    // Selection ring follows its lantern.
    if (this.selected) {
      const s = this.selected;
      this.selectionRing.position.set(s.group.position.x, s.group.position.y + 0.08, s.group.position.z);
      this.selectionRing.material.opacity = 0.35 + 0.15 * Math.sin(t * 2.4);
    } else {
      this.selectionRing.material.opacity = 0;
    }

    // Expanding ripples.
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life += dt;
      const k = r.life / r.duration;
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        r.mesh.geometry.dispose();
        this.ripples.splice(i, 1);
      } else {
        r.mesh.scale.setScalar(0.4 + k * (r.maxScale - 0.4));
        r.mesh.material.opacity = r.opacity * (1 - k);
      }
    }

    // Placement sparks rise, slow, and fade.
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life += dt;
      const k = b.life / b.duration;
      if (k >= 1) {
        this.scene.remove(b.sprite);
        b.sprite.material.dispose();
        this.bursts.splice(i, 1);
      } else {
        b.sprite.position.x += b.vx * dt;
        b.sprite.position.y += b.vy * dt;
        b.sprite.position.z += b.vz * dt;
        b.vy -= 2.6 * dt;
        b.sprite.material.opacity = 0.85 * (1 - k * k);
      }
    }

    // Released lanterns sink and fade.
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const l = this.dying[i];
      l.fade -= dt * 0.8;
      if (l.fade <= 0) {
        this.scene.remove(l.group);
        l.group.traverse((o) => {
          if (o.material) o.material.dispose();
          if (o.geometry && o.geometry !== this.poolGeo) o.geometry.dispose();
        });
        this.dying.splice(i, 1);
      } else {
        l.group.scale.setScalar(l.fade * SCALE);
        l.group.position.y -= dt * 0.3;
        l.halo.material.opacity = l.fade * 0.3;
        l.pool.material.opacity = l.fade * 0.2;
      }
    }
  }

  serialize() {
    return this.lanterns.map((l) => ({
      model: l.model,
      material: l.material,
      colorHex: l.colorHex,
      pattern: l.pattern,
      level: l.level,
      x: l.x,
      z: l.z,
      seed: l.seed,
    }));
  }

  restore(list) {
    for (const data of list) this.place({ ...data }, false);
  }

  count() {
    return this.lanterns.length;
  }
}
