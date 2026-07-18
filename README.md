# Floating Lantern

A zen shortgame for the browser, based on the HFM concept deck `floating_lantern_v1.key`.

You place glowing lanterns on a quiet low-poly lake at night, shape their color, pattern and material, and slowly unlock new lantern models and atmospheric effects. There is no timer, no score and no way to lose. The visual style follows the concept's references: minimalism and low poly, in the spirit of Journey and Sky.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in a browser.

`npm run build` creates a static production build in `dist/` that can be hosted anywhere.

## How to play

- Click the water to release a lantern at that spot.
- The dock at the bottom sets what you place next: lantern model, material (paper, silk or bamboo, each behaves differently on the water), dye and pattern.
- Click a floating lantern to select it. You can re-dye it, change its pattern, raise its light (three levels, with ripples and orbiting sparks) or let it go.
- Drag to orbit the camera, scroll to zoom. Press Escape to deselect.
- The moon button (top right) opens the ambience panel: time of day, mist, fireflies, falling stars, and generative ambient sound with volume control.

## Systems from the concept

- **Resources**: placing and upgrading costs light essence, which slowly returns over time (capped, so the pace stays calm).
- **Progression (harmony)**: every placement and upgrade grows harmony. Thresholds unlock new lantern models, dyes, patterns and ambience effects. The progress bar in the top left shows the next unlock.
- **Materials**: paper gives a balanced warm glow, silk a wide soft halo and slow drift, bamboo a brighter framed light that travels farther.
- **Meditation focus**: no time limits, no points. Lanterns drift, bob on the waves and stay inside the lake by themselves.
- **Persistence**: the scene, resources and settings are saved in the browser (localStorage). "Start over" in the ambience panel resets everything.

## Tech

- [Three.js](https://threejs.org) with a custom low-poly water shader (shared wave math between GPU and CPU so lanterns bob exactly on the surface), bloom post-processing, and a keyframed time-of-day palette.
- Generative audio with the Web Audio API: a low drone, filtered water noise and occasional pentatonic bells. No audio files.
- Vanilla JS + Vite, no framework.

## Out of scope for v1

From the concept deck, the storyline (the stolen ability to light the lanterns) and the shared multiplayer space are not part of this version. Additional landscapes (forest, coast) are prepared conceptually by the environment palette system but only the mountain lake is built.
