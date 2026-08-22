# Dude.Work — Living Ink Journey

A wordless, true-3D Three.js/WebGL portfolio experienced as a walk through a living sumi-e garden. The visitor begins outside a torii, crosses an arched sacred bridge, follows a lantern procession to monumental koi fusuma, and walks through the pavilion into an enso mirror court containing nine project portals.

## Experience

- Perspective first-person movement along a physically authored Catmull-Rom garden route
- Original procedural torii, sacred bridge, lanterns, pavilion, fusuma, vegetation, water and mirror court
- Custom GLSL sumi materials, wet pigment flow, wind, waterfall, pond, mirror-water and full-frame ink bleed
- Instanced pines, maples, bamboo, grasses, leaves and optimized scanned moss-rock geometry
- Physical fusuma that part as the visitor climbs into and crosses the pavilion
- Nine image-only project pavilions arranged around a tapered 3D enso brushstroke
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

The experience uses a perspective React Three Fiber scene with a real moving camera, continuous world-space geometry and adaptive rendering. Project artwork and the bamboo-flute recording are user-provided assets. The linked reference experiences were used only as creative direction; no source code, shaders, camera data, models or artwork were copied from Kage or any benchmark site. See `THIRD_PARTY_NOTICES.md` and `docs/ASSET_MANIFEST.md` for provenance.
