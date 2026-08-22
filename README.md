# Dude.Work — Living Ink Journey

A wordless Three.js/WebGL portfolio experienced as a passage through a living sumi-e painting. The visitor begins outside a torii, follows an ink-washed garden toward a monumental koi fusuma, then crosses through the painting itself into an enso sanctuary containing nine project portals.

## Experience

- Four original, high-resolution sumi-e environment paintings composed as a continuous cinematic journey
- Custom GLSL wet-ink transitions, pigment diffusion, paper grain, water shimmer and parallax depth
- A painterly fusuma threshold that physically parts into the final sanctuary
- A constellation of nine irregular, living-ink project portals arranged around the enso
- Keyboard, mouse, wheel and responsive touch controls
- Spatially rising ambient music sourced from the existing Dude.Work dashboard
- Wordless visual interface with symbolic audio, journey and social controls
- Responsive desktop and mobile sanctuary compositions
- Adaptive pixel density, reduced-motion support and WebGL context diagnostics

## Controls

- Move: `WASD`, arrow keys, mouse wheel or the touch joystick
- Shift the painted perspective: pointer movement or horizontal movement
- Move faster: `Shift`
- Open a project: select its artwork inside the sanctuary

## Local development

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
```

## Implementation notes

The experience uses an orthographic 2.5D WebGL stage: authored paintings carry the environmental detail while custom fragment shaders make the ink breathe, pool, shimmer and dissolve from one scene into the next. The linked reference experiences were used only as creative direction; no source code or artwork was copied from Kage or the other benchmark sites. Project artwork and the bamboo-flute recording are user-provided assets. See `THIRD_PARTY_NOTICES.md` for dependency and asset provenance.
