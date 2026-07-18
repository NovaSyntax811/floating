import * as THREE from 'three';
import { WAVE_GLSL } from './waves.js';

export function createWater() {
  const geo = new THREE.PlaneGeometry(420, 420, 150, 150);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#0a1830') },
    uShallow: { value: new THREE.Color('#1a3a58') },
    uSky: { value: new THREE.Color('#27346a') },
    uMoonDir: { value: new THREE.Vector3(-0.45, 0.42, -0.65).normalize() },
    uMoonColor: { value: new THREE.Color('#b9c8ff') },
    uMoonStrength: { value: 1.0 },
    uFogColor: { value: new THREE.Color('#161e40') },
    uFogNear: { value: 70 },
    uFogFar: { value: 260 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      ${WAVE_GLSL}
      void main() {
        vec3 p = position;
        p.y += waveHeight(p.xz, uTime);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uMoonDir;
      uniform vec3 uMoonColor;
      uniform float uMoonStrength;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorldPos;

      void main() {
        // Flat shaded low poly normals from screen space derivatives.
        vec3 dx = dFdx(vWorldPos);
        vec3 dy = dFdy(vWorldPos);
        vec3 n = normalize(cross(dx, dy));
        if (n.y < 0.0) n = -n;

        vec3 viewDir = normalize(cameraPosition - vWorldPos);

        // Base water: facets tilted toward the viewer read lighter.
        float facet = clamp(dot(n, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
        float tilt = pow(1.0 - facet, 1.1);
        vec3 col = mix(uDeep, uShallow, clamp(tilt * 1.1, 0.0, 1.0));

        // Sky reflection toward the horizon.
        float fresnel = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 3.5);
        col = mix(col, uSky, fresnel * 0.4);

        // Moon glints: sharp sparse sparkles instead of a broad path.
        vec3 h = normalize(uMoonDir + viewDir);
        float spec = pow(clamp(dot(n, h), 0.0, 1.0), 260.0);
        spec = smoothstep(0.18, 0.9, spec);
        col += uMoonColor * spec * 0.38 * uMoonStrength;

        // Manual fog to match the scene fog.
        float dist = distance(cameraPosition, vWorldPos);
        float fogF = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, fogF);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);

  function update(t, env) {
    uniforms.uTime.value = t;
    const c = env.current;
    uniforms.uDeep.value.copy(c.waterDeep);
    uniforms.uShallow.value.copy(c.waterShallow);
    uniforms.uSky.value.copy(c.horizon);
    uniforms.uFogColor.value.copy(c.fog);
    uniforms.uMoonStrength.value = c.moon;
  }

  return { mesh, update };
}
