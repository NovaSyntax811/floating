// Shared wave math. The GLSL chunk and the JS function must stay identical
// so lanterns bob exactly on the displaced water surface.

export const WAVES = [
  { dx: 1.0, dz: 0.3, freq: 0.25, amp: 0.16, speed: 0.55 },
  { dx: -0.6, dz: 1.0, freq: 0.19, amp: 0.13, speed: 0.42 },
  { dx: 0.2, dz: -1.0, freq: 0.55, amp: 0.05, speed: 0.9 },
  { dx: -1.0, dz: -0.4, freq: 0.9, amp: 0.025, speed: 1.3 },
];

export function waveHeight(x, z, t) {
  let y = 0;
  for (const w of WAVES) {
    y += Math.sin((x * w.dx + z * w.dz) * w.freq + t * w.speed) * w.amp;
  }
  return y;
}

// Approximate surface tilt for lantern rocking.
export function waveNormalTilt(x, z, t) {
  const e = 0.6;
  const hx = waveHeight(x + e, z, t) - waveHeight(x - e, z, t);
  const hz = waveHeight(x, z + e, t) - waveHeight(x, z - e, t);
  return { rx: hz * 0.5, rz: -hx * 0.5 };
}

export const WAVE_GLSL = `
float waveHeight(vec2 p, float t) {
  float y = 0.0;
  ${WAVES.map(
    (w) =>
      `y += sin((p.x * ${w.dx.toFixed(2)} + p.y * ${w.dz.toFixed(2)}) * ${w.freq.toFixed(3)} + t * ${w.speed.toFixed(3)}) * ${w.amp.toFixed(3)};`
  ).join('\n  ')}
  return y;
}
`;
