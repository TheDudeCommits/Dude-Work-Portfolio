# V3 project-court frame asset contract

`project-court-frame.glb` is the original, project-authored architectural and
landscape frame for the destination court. The GLB contains no external models,
textures, characters, text, or procedurally generated runtime meshes. The full
runtime court is a composition of this asset plus nine runtime hanging-scroll
assemblies and their project images. Place `ROOT_ProjectCourtFrame_V3` at
Three.js world anchor `[12.4, 0, -10.3]`; the asset itself is authored at local
origin.

## Visual hierarchy

- `ASSET_CourtPineArch/VIS_CourtPineArch_LOD{0,1}`
- `ASSET_CourtDais/VIS_CourtDais_LOD{0,1}`
- `ASSET_CourtRockRoots/VIS_CourtRockRoots_LOD{0,1}`
- `ASSET_CourtLanterns/VIS_CourtLanterns_LOD{0,1}`

Before the first rendered frame, the runtime shows exactly one LOD from each
`ASSET_*` group. Meshes carry `COLOR_0` authored as `SumiData`: R pigment,
G wetness, B dry-edge, A wind. The loader resolves all `MAT_SUMI_*` slots through
the shared living-sumi material adapter.

## Court alignment

`SOCKET_ProjectCourt_Center`, `SOCKET_ProjectCourt_Focus`, and
`SOCKET_ProjectScreen_00` through `SOCKET_ProjectScreen_08` describe the nominal
nine-scroll fan: radius `4.6`, from `208deg` through `332deg`. `ProjectCourt.tsx`
uses the same fan as its base, then adds per-scroll radius, lift, scale, and yaw
variation. The sockets therefore define integration references, not the final
transforms of the visibly staggered scrolls. The broad center and front approach
remain open above the dais. `COL_*` nodes are coarse metadata proxies rather than
renderable geometry, and the current lean controller does not bind them.

Measured LOD0 local Three.js bounds are
`[-7.7122, -0.2463, -5.6406]` through `[7.6893, 9.7516, 5.3249]`. At the runtime
anchor the corresponding world bounds are `[4.6878, -0.2463, -15.9406]` through
`[20.0893, 9.7516, -4.9751]`.

## Measured shipping asset

| Measurement | Current report |
| --- | ---: |
| Payload | 744,752 bytes / 0.710 MiB |
| LOD0 | 30,748 triangles / 6 primitives |
| LOD1 | 7,976 triangles / 6 primitives |
| Both stored LODs | 38,724 triangles / 12 primitives |
| Mesh nodes | 8 |
| Contract nodes | 7 colliders, 11 sockets, 1 trigger, 1 effect, 1 audio |
| SHA-256 | `aea8680c5dad4bfbf9021d7f63a3d006f752c59c8e7fcc40287e945d1ce7f6d8` |

The nine portal WebPs are separate runtime assets totaling 824,286 bytes
(0.786 MiB); they are not embedded in this GLB.

## Current runtime integration

The court is genuinely deferred. `LivingScrollWorld` does not mount it until
rail progress exceeds `0.52`, or free-roam position reaches `x > 3.5` and
`z < 2`. The activation latches for the rest of the session. The frame GLB and
all nine project images are requested under the same Suspense boundary.

The generic authored-asset loader begins with LOD0, then checks distance every
0.25 seconds. The current sanctuary composition deliberately hides both the
`CourtPineArch` and `CourtDais` LOD roots: the faceted pine is replaced by the
authored foreground ink-bough matte, while the generated organic clearing owns
the floor instead of a rectangular display platform. This is a runtime
art-direction choice; both validated LOD pairs remain in the canonical GLB.

The root extras contain measured local and anchored world bounds. Regenerate the
source `.blend`, compressed canonical GLB, and JSON report with:

```sh
scripts/art/v3/build-project-court.sh
```
