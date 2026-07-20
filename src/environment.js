import * as THREE from 'three';

// Time-of-day keyframes across the slider: dusk, night, deep night, dawn.
const KEYS = [
  {
    t: 0.0,
    skyTop: '#2b3364', horizon: '#d98a58',
    waterDeep: '#122642', waterShallow: '#274e6e',
    fog: '#3a3a5e', ambient: 0.34, stars: 0.15, moon: 0.35,
  },
  {
    t: 0.35,
    skyTop: '#0b1134', horizon: '#27346a',
    waterDeep: '#0a1830', waterShallow: '#1a3a58',
    fog: '#161e40', ambient: 0.22, stars: 0.9, moon: 1.0,
  },
  {
    t: 0.65,
    skyTop: '#05081f', horizon: '#131b40',
    waterDeep: '#060f22', waterShallow: '#122c46',
    fog: '#0c1230', ambient: 0.16, stars: 1.0, moon: 1.0,
  },
  {
    t: 1.0,
    skyTop: '#3a4472', horizon: '#eda06c',
    waterDeep: '#16304c', waterShallow: '#2e587a',
    fog: '#4a4468', ambient: 0.38, stars: 0.05, moon: 0.25,
  },
];

function makeGlowTexture(size = 128, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.28)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.current = {
      skyTop: new THREE.Color(),
      horizon: new THREE.Color(),
      waterDeep: new THREE.Color(),
      waterShallow: new THREE.Color(),
      fog: new THREE.Color(),
      ambient: 0.25,
      stars: 0.9,
      moon: 1.0,
    };
    this.moonDir = new THREE.Vector3(-0.45, 0.42, -0.65).normalize();
    this.moonColor = new THREE.Color('#cdd8ff');
    this.glowTex = makeGlowTexture();

    scene.fog = new THREE.Fog(0x161e40, 70, 260);

    this._buildSky();
    this._buildStars();
    this._buildMoon();
    this._buildTerrain();
    this._buildLights();
    this._buildMist();
    this._buildFireflies();
    this._shootingTimer = 6;
    this._shootingActive = null;
    this._shootingEnabled = false;

    this.setTimeOfDay(0.35);
  }

  _buildSky() {
    this.skyUniforms = {
      uTop: { value: new THREE.Color('#0b1134') },
      uHorizon: { value: new THREE.Color('#27346a') },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.62));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 18), mat);
    this.scene.add(sky);
  }

  _buildStars() {
    const count = 700;
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Upper hemisphere, biased upward so the horizon stays clean.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.08 + Math.random() * 0.9);
      const r = 440;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTwinkle', new THREE.BufferAttribute(sizes, 1));
    this.starUniforms = {
      uOpacity: { value: 0.9 },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: this.starUniforms,
      vertexShader: `
        attribute float aTwinkle;
        varying float vTwinkle;
        void main() {
          vTwinkle = aTwinkle;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 1.4 + aTwinkle * 1.8;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uTime;
        varying float vTwinkle;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = smoothstep(0.5, 0.05, length(uv));
          float tw = 0.6 + 0.4 * sin(uTime * (0.8 + vTwinkle * 2.0) + vTwinkle * 40.0);
          gl_FragColor = vec4(vec3(0.9, 0.93, 1.0), d * uOpacity * tw);
        }
      `,
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _buildMoon() {
    const pos = this.moonDir.clone().multiplyScalar(430);
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(17, 40),
      new THREE.MeshBasicMaterial({ color: '#e8eeff', fog: false, transparent: true })
    );
    moon.position.copy(pos);
    moon.lookAt(0, 0, 0);
    this.moonMesh = moon;
    this.scene.add(moon);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#a9baf5',
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        fog: false,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(150);
    glow.position.copy(pos);
    this.moonGlow = glow;
    this.scene.add(glow);
  }

  _buildTerrain() {
    // Rings of low poly ridges around the lake.
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: '#101830',
      roughness: 1,
      flatShading: true,
    });
    const matFar = new THREE.MeshStandardMaterial({
      color: '#0c1228',
      roughness: 1,
      flatShading: true,
    });
    const rand = mulberry(7);
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + rand() * 0.25;
      const far = i % 2 === 0;
      const dist = far ? 200 + rand() * 60 : 120 + rand() * 40;
      const h = far ? 34 + rand() * 42 : 14 + rand() * 20;
      const w = far ? 60 + rand() * 60 : 30 + rand() * 30;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(w, h, 4 + Math.floor(rand() * 3)), far ? matFar : mat);
      cone.position.set(Math.cos(angle) * dist, h / 2 - 3 - rand() * 2, Math.sin(angle) * dist);
      cone.rotation.y = rand() * Math.PI;
      cone.scale.z = 0.55 + rand() * 0.5;
      group.add(cone);
    }
    // A few dark rocks closer to the water.
    for (let i = 0; i < 7; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 50 + rand() * 26;
      const s = 1.2 + rand() * 2.6;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
      rock.position.set(Math.cos(angle) * dist, s * 0.25 - 0.4, Math.sin(angle) * dist);
      rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      rock.scale.y = 0.6 + rand() * 0.5;
      group.add(rock);
    }
    this.scene.add(group);
  }

  _buildLights() {
    this.ambient = new THREE.AmbientLight('#7080c0', 0.25);
    this.moonLight = new THREE.DirectionalLight('#8fa3e8', 0.55);
    this.moonLight.position.copy(this.moonDir.clone().multiplyScalar(100));
    this.scene.add(this.ambient, this.moonLight);
  }

  _buildMist() {
    this.mistGroup = new THREE.Group();
    const mat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color: '#7c88b8',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.mistSprites = [];
    const rand = mulberry(21);
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(mat.clone());
      const angle = rand() * Math.PI * 2;
      const dist = 20 + rand() * 55;
      s.position.set(Math.cos(angle) * dist, 1.2 + rand() * 2, Math.sin(angle) * dist);
      s.scale.set(30 + rand() * 40, 7 + rand() * 6, 1);
      s.userData = { speed: 0.15 + rand() * 0.3, phase: rand() * 100, base: 0.055 + rand() * 0.05 };
      this.mistSprites.push(s);
      this.mistGroup.add(s);
    }
    this._mistTarget = 0;
    this._mistLevel = 0;
    this.scene.add(this.mistGroup);
  }

  _buildFireflies() {
    const count = 70;
    const pos = new Float32Array(count * 3);
    this.fireflySeeds = [];
    const rand = mulberry(33);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 24 + rand() * 46;
      pos[i * 3] = Math.cos(angle) * dist;
      pos[i * 3 + 1] = 0.8 + rand() * 3;
      pos[i * 3 + 2] = Math.sin(angle) * dist;
      this.fireflySeeds.push({ a: rand() * 100, b: rand() * 100, s: 0.3 + rand() * 0.7 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      color: '#d8ffa0',
      size: 0.45,
      map: this.glowTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this._fireflyTarget = 0;
    this._fireflyLevel = 0;
    this.scene.add(this.fireflies);
  }

  setTimeOfDay(t) {
    // Find surrounding keyframes and lerp.
    let a = KEYS[0];
    let b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (t >= KEYS[i].t && t <= KEYS[i + 1].t) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    const c = this.current;
    c.skyTop.set(a.skyTop).lerp(new THREE.Color(b.skyTop), f);
    c.horizon.set(a.horizon).lerp(new THREE.Color(b.horizon), f);
    c.waterDeep.set(a.waterDeep).lerp(new THREE.Color(b.waterDeep), f);
    c.waterShallow.set(a.waterShallow).lerp(new THREE.Color(b.waterShallow), f);
    c.fog.set(a.fog).lerp(new THREE.Color(b.fog), f);
    c.ambient = a.ambient + (b.ambient - a.ambient) * f;
    c.stars = a.stars + (b.stars - a.stars) * f;
    c.moon = a.moon + (b.moon - a.moon) * f;

    this.skyUniforms.uTop.value.copy(c.skyTop);
    this.skyUniforms.uHorizon.value.copy(c.horizon);
    this.scene.fog.color.copy(c.fog);
    this.starUniforms.uOpacity.value = c.stars;
    this.ambient.intensity = c.ambient;
    this.moonLight.intensity = 0.25 + c.moon * 0.4;
    this.moonMesh.material.opacity = 0.4 + c.moon * 0.6;
    this.moonGlow.material.opacity = c.moon * 0.5;
  }

  setMist(on) { this._mistTarget = on ? 1 : 0; }
  setFireflies(on) { this._fireflyTarget = on ? 1 : 0; }
  setShooting(on) { this._shootingEnabled = on; }

  update(dt, t) {
    this.starUniforms.uTime.value = t;

    // Moon halo breathes very slowly.
    const breath = 1 + Math.sin(t * 0.12) * 0.05;
    this.moonGlow.scale.setScalar(150 * breath);

    // Mist drift and fade.
    this._mistLevel += (this._mistTarget - this._mistLevel) * Math.min(1, dt * 1.2);
    if (this._mistLevel > 0.005) {
      for (const s of this.mistSprites) {
        s.position.x += Math.sin(t * 0.05 + s.userData.phase) * s.userData.speed * dt;
        s.position.z += Math.cos(t * 0.04 + s.userData.phase) * s.userData.speed * dt;
        s.material.opacity = s.userData.base * this._mistLevel * (0.75 + 0.25 * Math.sin(t * 0.1 + s.userData.phase));
      }
    } else {
      for (const s of this.mistSprites) s.material.opacity = 0;
    }

    // Fireflies wander.
    this._fireflyLevel += (this._fireflyTarget - this._fireflyLevel) * Math.min(1, dt * 1.5);
    this.fireflyMat.opacity = this._fireflyLevel * 0.85;
    if (this._fireflyLevel > 0.005) {
      const pos = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < this.fireflySeeds.length; i++) {
        const s = this.fireflySeeds[i];
        pos.array[i * 3] += Math.sin(t * s.s + s.a) * dt * 0.6;
        pos.array[i * 3 + 1] += Math.cos(t * s.s * 0.7 + s.b) * dt * 0.25;
        pos.array[i * 3 + 2] += Math.cos(t * s.s + s.b) * dt * 0.6;
      }
      pos.needsUpdate = true;
    }

    // Shooting stars.
    if (this._shootingActive) {
      const sh = this._shootingActive;
      sh.life += dt;
      const k = sh.life / sh.duration;
      if (k >= 1) {
        this.scene.remove(sh.sprite);
        sh.sprite.material.dispose();
        this._shootingActive = null;
      } else {
        sh.sprite.position.addScaledVector(sh.velocity, dt);
        sh.sprite.material.opacity = Math.sin(k * Math.PI) * 0.9;
      }
    } else if (this._shootingEnabled) {
      this._shootingTimer -= dt;
      if (this._shootingTimer <= 0) {
        this._shootingTimer = 7 + Math.random() * 12;
        this._spawnShootingStar();
      }
    }
  }

  _spawnShootingStar() {
    const mat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color: '#dfe8ff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      fog: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const angle = Math.random() * Math.PI * 2;
    const start = new THREE.Vector3(
      Math.cos(angle) * 260,
      170 + Math.random() * 90,
      Math.sin(angle) * 260
    );
    sprite.position.copy(start);
    sprite.scale.set(14, 2.2, 1);
    const dir = new THREE.Vector3(Math.cos(angle + 2.3), -0.45, Math.sin(angle + 2.3)).normalize();
    sprite.material.rotation = Math.atan2(-dir.y, Math.hypot(dir.x, dir.z)) * (Math.random() > 0.5 ? 1 : -1);
    this.scene.add(sprite);
    this._shootingActive = {
      sprite,
      velocity: dir.multiplyScalar(110),
      life: 0,
      duration: 1.6,
    };
  }
}

// Deterministic PRNG so the terrain looks the same every visit.
function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
