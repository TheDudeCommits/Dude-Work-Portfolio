# Dude.Work — Living Ink Journey

A wordless Three.js/WebGL portfolio experienced as a walk through a living sumi-e garden. The visitor begins outside a torii, follows a lantern-lit stone path through animated water, mist, pigment and foliage, then reaches a temple whose shoji doors reveal nine project portals.

## Experience

- Procedural torii, temple, mountains, pines, bamboo, rocks and lanterns
- Custom GLSL living-ink water and breathing-mist materials
- Keyboard, mouse, wheel and responsive touch controls
- Spatially rising ambient music sourced from the existing Dude.Work dashboard
- Automatic shoji-door reveal and nine clickable project portals
- Wordless visual interface with symbolic audio, journey and social controls
- Responsive desktop and mobile sanctuary compositions
- Adaptive pixel density, reduced-motion support and WebGL context diagnostics

## Controls

- Move: `WASD`, arrow keys, mouse wheel or the touch joystick
- Look: pointer/touch drag
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

The environment is original procedural geometry and shader work. The linked reference experiences were used only as creative direction; no source code or artwork was copied from Kage or the other benchmark sites. Project artwork and the bamboo-flute recording are user-provided assets. See `THIRD_PARTY_NOTICES.md` for dependency and asset provenance.
