# Living Sumi Garden — V3 gate-to-sanctuary slice

V3 is the current first-person portfolio journey: the visitor enters outside a
monumental torii, follows the wet-stone and pond composition to the moon bridge,
crosses into the far bank, and arrives at a sanctuary of nine hanging project
scrolls. No avatar or visible project label is rendered. Project titles remain
available through the screen-reader-only navigation in `App.tsx`.

This document describes the checked-in runtime. The reference frames establish
art direction; they are not runtime screenshots, browser-performance evidence,
or proof of parity with any external benchmark.

## Current composition

The opening composition follows `docs/art-direction/v3-golden-frame.png`: pale
washi and mist, a single restrained vermilion torii, asymmetrical soot and pine
framing, shallow water, a smaller bridge destination, and separate near/middle/
far depth planes.

The implemented journey is:

1. A visual entry seal holds the veil until the opening GLB has loaded and its
   semantic materials have been replaced.
2. The authored rail starts at `[-6.8, 2.32, 27.8]` and stages ten uneven shots:
   arrival, distant gate, torii crown, threshold parallax, pond reveal, bridge
   profile, left landing, crest, right descent, and project reliquary.
3. The authored gate/bridge GLB supplies the torii, rope and bells, moon bridge,
   old pine, rock composition, stepping approach, and surrounding garden frame.
4. Two runtime support carriers supply the sculpted ground/path and the water
   sheet. Up to eight small ink-ring meshes respond to shallow-water movement
   and, when reduced motion is off, three ambient emitter positions.
5. The destination activates near the latter half of the journey. Its authored
   GLB frames the court with stone, roots, lanterns, and a monumental pine arch;
   the project paintings, torn paper backings, rods, clearing, and five approach
   stones are deliberately generated at runtime; repeated supports are instanced.
6. The court presents Omni, vPay, Cloak, Relay, WishGalaxy, IdeaFarm,
   BetweenTheLines, PodRacing, and WeAreOnTheCruise as nine staggered hanging
   scrolls. The center scroll is larger and closer than the flanking scrolls.
7. The ambient bamboo-flute track starts only after the entry gesture. Its gain
   and low-pass filter open as the visitor approaches the court; the symbolic
   HUD includes a mute control and reveals social glyphs at journey depth 0.96.

The visible page background uses `mountain-valley.webp`, while
`foreground-pine-frame.webp` is an HTML/CSS opening wipe that fades and shifts
with journey depth. The optional Three.js `WorldMatteCards` layer exists but is
disabled by the current `LivingScrollWorld` integration.

## Controls and interaction

- Mouse wheel or trackpad scroll moves forward and backward on the cinematic
  rail. Scrolling while freely roaming first reattaches to the nearest sampled
  rail position, then resumes authored travel.
- `W`, `A`, `S`, `D` or the arrow keys immediately leave the rail for first-
  person free roam. Hold either `Shift` key to sprint.
- Press the canvas and move the pointer, or drag on it, to look. The runtime
  requests pointer lock; drag look remains available when the browser refuses
  it. During rail travel, look input is intentionally limited and eases back to
  the authored framing.
- In the project court, click a hanging-scroll artwork to open its project. With
  pointer lock active, aim at a scroll and press `E`, `F`, or `Enter`.
- Touch devices use the left movement joystick and the right look pad. Moving
  the joystick leaves the rail in the same way as keyboard movement; a project
  scroll can be tapped directly.

The controller is disembodied and allocation-light. It does not mount Rapier or
implement jumping in the active V3 path. World bounds, torii posts, the old-pine
area, and one large rock are resolved through the current lean controller's
hard-coded limits and circular obstacles. `COL_*` nodes in the GLBs are authored
metadata but are not bound to runtime collision yet.

## Material and geometry boundary

Hero environment silhouettes are authored in Blender and exported with stable
LOD nodes. The runtime is still responsible for the two broad support carriers,
ink rings, contact washes, the nine hanging scroll assemblies, and the HTML/CSS
paper and foreground layers. Those pieces are intentional runtime systems, not
claims that every visible triangle comes from a DCC asset.

GLB materials are semantic preview slots. The loader clones each geometry,
derives `aSumiWind` from `COLOR_0.a`, and resolves the material through the
shared living-sumi adapter. The current vertex contract is:

- R — pigment density;
- G — wetness and ink-field response;
- B — dry-edge breakup;
- A — wind deformation weight.

Paper and brush textures are sampled in object/world space, and the material
palette comes from the shared art tokens. The runtime uses custom banded sumi
shaders rather than a full-screen posterization pass.

## Loading and LOD behavior

- The gate/bridge GLB is part of the opening render tree. It is wrapped in
  Suspense, but it is not proximity-lazy-loaded; the entry seal waits for this
  asset to be synchronously styled before revealing the experience.
- The project court remains unmounted until rail progress exceeds `0.52`, or a
  free-roaming visitor reaches `x > 3.5` and `z < 2`. Activation is one-way for
  the current session. Mounting the court requests both its frame GLB and all
  nine project portal images under the same Suspense boundary.
- Both canonical GLBs use `EXT_meshopt_compression` and therefore require a
  Meshopt-capable glTF loader. Their cache-busted URLs include the leading eight
  characters of the checked-in SHA-256.
- The loader starts with LOD0 visible and LOD1 hidden, then reevaluates each LOD
  group every `0.25` seconds using camera distance and the authored
  `screen_coverage` extra. Normally exactly one LOD root is visible per group.
- The gate old-pine LODs are both hidden within seven metres of the runtime pine
  center to avoid camera-intersection clutter. The gate `GardenFrame` is also
  suppressed after the right-side approach so its bamboo does not obstruct the
  sanctuary. Both `CourtPineArch` and `CourtDais` LOD roots remain stored in the
  court GLB but are hidden at runtime; the authored ink-bough matte and organic
  generated clearing own those roles in the final composition.
- Asset geometry clones are disposed when their loader instance unmounts. Once
  activated, the court currently remains mounted, so it is not streamed out
  again.

## Checked-in static measurements

These are build/report measurements, not browser-submitted triangle counts or
network transfer timings.

| Payload | Bytes | MiB | LOD0 triangles / primitives | LOD1 triangles / primitives |
| --- | ---: | ---: | ---: | ---: |
| Gate and bridge GLB | 1,014,004 | 0.967 | 47,455 / 16 | 10,540 / 16 |
| Project-court frame GLB | 744,752 | 0.710 | 30,748 / 6 | 7,976 / 6 |
| Both GLBs | 1,758,756 | 1.677 | 78,203 / 22 | 18,516 / 22 |

The nine deferred portal WebPs total 824,286 bytes (0.786 MiB). The two GLBs
plus those portal images total 2,583,042 bytes (2.463 MiB), though they are not
all requested at opening. Other checked-in on-disk sizes relevant to startup are
190,318 bytes for the mountain background, 557,872 for the foreground pine
frame, 218,176 for the shared brush field, and 68,776 for the washi texture. The
bamboo-flute file is 5,312,130 bytes and uses `preload="metadata"`; media range
requests and eventual transfer depend on the browser/server.

The GLB figures come from `gate-bridge.report.json` and
`project-court-frame.report.json`. They include both LODs stored in each file.
Runtime submitted triangles can differ because only one LOD per group is shown,
some contours add geometry, and the support/court systems are runtime meshes.

## Runtime constraints and acceptance

The current Canvas starts at DPR `1`, disables antialiasing and shadow maps, and
uses `PerformanceMonitor` to step down to `0.78` or recover up to the lower of
device DPR and `1.18`. Reduced-motion mode freezes living-sumi time/wind and
project-scroll breathing, disables ambient ring emissions, and shortens the
entry transition.

The runtime exposes sampled FPS, frame time, draw calls, and submitted triangles
through `window.__DUDE_WORK_DIAGNOSTICS__`. The repository does not currently
contain a committed browser trace establishing those values across devices.
Therefore the earlier design targets of 180 desktop draw calls, 90 mobile draw
calls, and 600k desktop submitted triangles remain acceptance targets, not
verified current measurements. No claim of external benchmark parity is made.

Acceptance requires browser QA of the entire moving journey, both navigation
modes, project opening, deferred court activation, reduced motion, context-loss
handling, and measured performance on representative desktop and mobile GPUs.
