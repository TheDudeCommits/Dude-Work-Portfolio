# V3 gate-and-bridge authored asset contract

The gate-and-bridge asset is the opening DCC-authored zone of the current
gate-to-sanctuary journey. Its source of truth is
`art/blender/gate_bridge_vertical_slice.py`; the checked-in `.blend` and shipping
GLB are deterministic build products. Runtime ground, water, ink rings, contact
washes, and the later hanging-scroll court remain separate systems.

## Space and placement

- Blender authors in meters with Z up.
- glTF exports Y up.
- The exporter maps Blender `(X, Y, Z)` to Three.js `(X, Z, -Y)`.
- The asset is loaded at world origin. The torii aligns near Three.js `z = 11.7`; the moon bridge aligns near `z = -3.4`.
- Visual pivots are stable. Runtime code must not bend, rescale, or reconstruct hero meshes to correct authoring errors.

## Stable nodes

Every hero asset has exactly two mutually exclusive visual LOD nodes:

```text
VIS_Torii_LOD0                 VIS_Torii_LOD1
VIS_RopeBells_LOD0             VIS_RopeBells_LOD1
VIS_MoonBridge_LOD0            VIS_MoonBridge_LOD1
VIS_RockComposition_LOD0       VIS_RockComposition_LOD1
VIS_OldPine_LOD0               VIS_OldPine_LOD1
VIS_SteppingApproach_LOD0      VIS_SteppingApproach_LOD1
VIS_GardenFrame_LOD0           VIS_GardenFrame_LOD1
```

The loader makes LOD0 visible and LOD1 hidden before the first rendered frame,
then reevaluates the pair at 0.25-second intervals. Camera distance is the main
selector; `screen_coverage` expands the high-detail distance. Exactly one LOD
root normally remains visible per asset group. The runtime old-pine safety rule
is the deliberate exception: it hides both pine LODs within seven metres of the
pine center to prevent camera-intersection clutter. `GardenFrame` is likewise
hidden once the arriving camera passes `x > 3.5`, `z < 8`, handing the final
frame to the authored 2D ink bough. `COL_*`, `TRG_*`, `SOCKET_*`,
`FX_*`, and `AUD_*` are contract nodes, never visible geometry.

## Materials

The GLB contains semantic preview slots only. Runtime replaces them with the shared sumi material registry:

- `MAT_SUMI_WASHI`
- `MAT_SUMI_STONE`
- `MAT_SUMI_TIMBER`
- `MAT_SUMI_VERMILION`
- `MAT_SUMI_FOLIAGE`
- `MAT_SUMI_WATER`
- `MAT_SUMI_METAL`

No image texture is embedded. Pigment variation is geometric and vertex-authored so the shipped asset remains small and visually coherent under the project's living-ink shader.

## Ink vertex data

Blender attribute `SumiData` exports as `COLOR_0`:

| Channel | Meaning | Range |
| --- | --- | --- |
| R | pigment density / pooling | 0–1 |
| G | wetness and ink-field reactivity | 0–1 |
| B | dry-edge breakup | 0–1 |
| A | world-space wind deformation weight | 0–1 |

Architecture and stone carry near-zero wind. Rope, paper prayers, pine branches, and foliage carry height-weighted wind. The runtime must preserve this channel layout when cloning or merging meshes.

## Build and validation

```sh
scripts/art/v3/build-gate-bridge.sh
```

The command runs Blender in a clean background scene, saves the authored `.blend`, exports GLB, then applies only hierarchy-safe deduplication and Meshopt compression with pinned glTF Transform. It validates node names, semantic materials, `COLOR_0`, triangles, extensions, and a 3 MiB web-payload ceiling. The machine running the build needs Blender and Node/npm on `PATH`.

## Measured shipping asset

The canonical shipping asset is
`public/art/v3/gate-bridge/gate-bridge.glb`; its generated inspection record is
`gate-bridge.report.json`.

| Measurement | Current report |
| --- | ---: |
| Payload | 1,014,004 bytes / 0.967 MiB |
| LOD0 | 47,455 triangles / 16 primitives |
| LOD1 | 10,540 triangles / 16 primitives |
| Both stored LODs | 57,995 triangles / 32 primitives |
| Mesh nodes | 14 |
| Contract nodes | 11 colliders, 2 sockets, 1 trigger, 1 effect, 1 audio |
| SHA-256 | `0bca02d2fdc986994e7faf0530982c7de001cddbbaea7fa16e55f26a53db6082` |

These counts describe the GLB, not total runtime submissions. The material
adapter may add contour meshes, and the base environment remains runtime
geometry.

## Current runtime integration

The optimized GLB requires Meshopt decoder support. It is mounted immediately
inside the opening Suspense tree rather than proximity-lazy-loaded; the entry
veil stays up until the cloned scene has been styled. The loader clones geometry,
copies `COLOR_0.a` into `aSumiWind`, replaces semantic preview materials, and
activates one LOD per asset group.

The current lean controller uses explicit world bounds and four circular
obstacles. It does not bind the GLB's `COL_*`, `TRG_*`, `SOCKET_*`, `FX_*`, or
`AUD_*` metadata yet. Those nodes remain stable authoring/integration contracts,
not evidence that physics, triggers, effects, or spatial audio are currently
wired from the file.
