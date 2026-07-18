// Game content and unlock ladder. Unlock values are harmony thresholds.

export const LIGHT = { start: 10, cap: 12, regenSeconds: 4.5 };
export const UPGRADE_COST = 3;
export const MAX_LEVEL = 3;
export const LAKE_RADIUS = 42;

const svg = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;

export const MODELS = [
  {
    id: 'paper', name: 'Paper Lantern', cost: 2, unlock: 0,
    icon: svg('<path d="M9 4h6l2 6c0 5-2 9-5 9s-5-4-5-9l2-6z"/><path d="M9 4h6"/><path d="M10.5 19h3"/>'),
  },
  {
    id: 'lotus', name: 'Lotus Lantern', cost: 3, unlock: 6,
    icon: svg('<path d="M12 6c1.8 2 2.6 4.4 2.6 6.5C14.6 16 13.5 18 12 18s-2.6-2-2.6-5.5C9.4 10.4 10.2 8 12 6z"/><path d="M5 11c2.5.3 4.4 1.7 5.4 3.8"/><path d="M19 11c-2.5.3-4.4 1.7-5.4 3.8"/><path d="M4 15c2.6 0 4.8 1.1 6 3"/><path d="M20 15c-2.6 0-4.8 1.1-6 3"/>'),
  },
  {
    id: 'orb', name: 'Moon Orb', cost: 3, unlock: 20,
    icon: svg('<circle cx="12" cy="11" r="6.5"/><path d="M9.5 19.5h5"/>'),
  },
  {
    id: 'pagoda', name: 'Pagoda Lantern', cost: 4, unlock: 30,
    icon: svg('<path d="M6 9l6-4 6 4H6z"/><path d="M8 9v3h8V9"/><path d="M6.5 14.5L12 12l5.5 2.5h-11z"/><path d="M9 14.5V18h6v-3.5"/><path d="M8 18h8"/>'),
  },
  {
    id: 'crystal', name: 'Spirit Crystal', cost: 4, unlock: 42,
    icon: svg('<path d="M12 3l4.5 8L12 21l-4.5-10L12 3z"/><path d="M7.5 11h9"/>'),
  },
];

export const MATERIALS = [
  { id: 'paper', name: 'Paper', desc: 'a soft and warm glow' },
  { id: 'silk', name: 'Silk', desc: 'a wide gentle halo, drifts slowly' },
  { id: 'bamboo', name: 'Bamboo', desc: 'a framed light, travels farther' },
];

export const COLORS = [
  { id: 'amber', name: 'Amber', hex: '#ffb45e', unlock: 0 },
  { id: 'coral', name: 'Coral', hex: '#ff7b5a', unlock: 0 },
  { id: 'gold', name: 'Gold', hex: '#ffd76a', unlock: 0 },
  { id: 'rose', name: 'Rose', hex: '#ff5e8a', unlock: 6 },
  { id: 'jade', name: 'Jade', hex: '#63f0a8', unlock: 12 },
  { id: 'aqua', name: 'Aqua', hex: '#5ec8ff', unlock: 20 },
  { id: 'lavender', name: 'Lavender', hex: '#b08aff', unlock: 30 },
  { id: 'moonlight', name: 'Moonlight', hex: '#f2f4ff', unlock: 42 },
];

export const PATTERNS = [
  { id: 'plain', name: 'Plain', unlock: 0 },
  { id: 'waves', name: 'Waves', unlock: 12 },
  { id: 'dots', name: 'Dots', unlock: 12 },
  { id: 'rings', name: 'Rings', unlock: 42 },
];

export const FEATURES = [
  { id: 'fireflies', name: 'Fireflies', unlock: 20 },
  { id: 'mist', name: 'Mist', unlock: 30 },
  { id: 'shooting', name: 'Falling stars', unlock: 42 },
];

// Everything that can be unlocked, for toasts and the progress label.
export const ALL_UNLOCKABLES = [
  ...MODELS.map((m) => ({ unlock: m.unlock, label: m.name })),
  ...COLORS.map((c) => ({ unlock: c.unlock, label: `${c.name} dye` })),
  ...PATTERNS.map((p) => ({ unlock: p.unlock, label: `${p.name} pattern` })),
  ...FEATURES.map((f) => ({ unlock: f.unlock, label: f.name })),
].filter((u) => u.unlock > 0);

export const MATERIAL_FX = {
  paper: { glow: 1.0, halo: 1.0, drift: 1.0 },
  silk: { glow: 0.9, halo: 1.45, drift: 0.55 },
  bamboo: { glow: 1.15, halo: 0.75, drift: 1.6 },
};
