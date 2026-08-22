# Living Scroll art bible

The active visual target is a dimensional Japanese sumi-e garden painted on living washi: pale after-rain dawn, celadon atmosphere, teal water, concentrated soot silhouettes, and rare vermilion or aged-gold interaction pigment. The runtime must remain recognizably three-dimensional and freely explorable from every camera angle.

## Approved target frames

- `docs/art-direction/living-scroll-free-roam-target.png` — normal exploration state.
- `docs/art-direction/living-scroll-project-court-target.png` — peak shrine-awakening state. Its gold density is temporary interaction feedback, not the normal world balance.

These images are art-direction references generated for this project. They are not runtime screenshots and must never be used as panoramic scenery or presented as implemented output.

## Palette and frame balance

| Role | Color |
| --- | --- |
| Warm washi | `#E8E0D0` |
| Mist | `#C9D0C5` |
| Celadon | `#91AAA0` |
| Water teal | `#496F70` |
| Pine | `#314D43` |
| Granite | `#747D76` |
| Indigo | `#2D4350` |
| Soot | `#272825` |
| Vermilion | `#A64A37` |
| Aged gold | `#B39455` |

Normal gameplay cameras should contain roughly 45–55% paper, sky, and mist; 35–45% subdued stone, timber, water, and vegetation; 5–10% soot; and 2–5% interaction accent. Pure black, pure white, chrome, neon, and photographic saturation are prohibited.

## Shape language

- Use one dominant calligraphic mass, one secondary counter-mass, and sparse fine detail.
- Hero geometry carries 2–7% deliberate asymmetry and 3–8% taper.
- Architecture is bowed, softened, irregular, and handmade rather than CAD-perfect.
- Repeated assets vary 3–8% in lean, scale, or silhouette while retaining one species grammar.
- A hero asset must remain readable in silhouette at 128 pixels.
- Visible hero torii, bridge, lantern, shrine, tree, and architecture may not ship as untouched runtime primitives.

## Runtime material contract

Shipping GLBs use semantic slots only: `MAT_SUMI_WASHI`, `MAT_SUMI_STONE`, `MAT_SUMI_TIMBER`, `MAT_SUMI_VERMILION`, `MAT_SUMI_FOLIAGE`, `MAT_SUMI_WATER`, `MAT_SUMI_SPIRIT`, and `MAT_SUMI_METAL`. The runtime resolves these through the shared material registry; imported assets may not bring arbitrary final PBR materials into the garden.

Authoring data:

- `COLOR_0.rgb`: approved-palette variation.
- `COLOR_0.a`: outline weight or suppression.
- `TEXCOORD_1.x`: wind deformation weight.
- `TEXCOORD_1.y`: interaction displacement weight.
- `INKMASK.r`: cavity and pigment pooling.
- `INKMASK.g`: dry-brush breakup.
- `INKMASK.b`: wetness and ink reactivity.
- `INKMASK.a`: opacity or cutout.

## Asset naming

```text
VIS_<asset>_LOD0
COL_<asset>_<role>_00
TRG_<asset>_<event>
SOCKET_<asset>_<purpose>
FX_<asset>_<effect>
AUD_<asset>_<event>
ANIM_<asset>_<action>
```

Every runtime asset records its palette roles, LODs, collider proxies, interaction sockets, surface-audio tag, wind profile, ink response, streaming zone, provenance, license, and checksum.

## Consistency gates

- All active colors originate in `src/art/artTokens.ts`.
- All active scene materials originate in the shared art-material system.
- Water, transparent VFX, fog, and portal interiors do not receive generic outlines.
- Wind phase derives from world position; repeated plants do not sway in lockstep.
- Footsteps, water, bells, doors, koi, foliage, and project rituals emit through one living-ink event field.
- Every project receives a unique sculpture but shares the same shrine proportions, material grammar, activation timing, and wordless interaction feedback.
- Assets are reviewed together from fixed gameplay cameras, never approved only as isolated turntables.

## Generation record

The target frames were produced with the built-in image-generation workflow from two linked prompts: a normal third-person free-roaming garden and the same character and material language at the activated Enso project court. Both prompts explicitly prohibit visible text, HUD, gallery walls, generic low-poly primitives, mixed asset-pack styling, black-and-white presentation, and a camera-wide ink filter.
