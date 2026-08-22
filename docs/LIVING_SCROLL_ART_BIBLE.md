# Living Scroll art bible

The active visual target is a dimensional Japanese sumi-e garden painted on living washi: pale after-rain dawn, celadon atmosphere, teal water, concentrated soot silhouettes, and rare vermilion or aged-gold interaction pigment. The runtime must remain recognizably three-dimensional and freely explorable within its authored first-person bounds.

## Reference frames, not parity claims

- `docs/art-direction/living-scroll-free-roam-target.png` — normal exploration state.
- `docs/art-direction/living-scroll-project-court-target.png` — legacy peak shrine-awakening reference. Its gold density is temporary interaction feedback, not the normal world balance.

These images are art-direction references generated for this project. They are not runtime screenshots and must never be used as panoramic scenery or presented as implemented output.

The current V3 runtime is first-person and renders no character. Any figure,
third-person framing, Enso court, or shrine ritual visible in an older target
image is reference mood only, not a claim about the checked-in composition. The
runtime is accepted through direct browser QA, not visual similarity asserted in
this document.

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
- Visible hero torii, bridge, lantern, tree, and court-frame architecture may not ship as untouched runtime primitives. Runtime-generated support ground, water, ink rings, contact washes, and hanging-scroll assemblies are allowed when they follow the same material and shape grammar.

## Runtime material contract

Shipping GLBs use semantic slots only: `MAT_SUMI_WASHI`, `MAT_SUMI_STONE`, `MAT_SUMI_TIMBER`, `MAT_SUMI_VERMILION`, `MAT_SUMI_FOLIAGE`, `MAT_SUMI_WATER`, `MAT_SUMI_SPIRIT`, and `MAT_SUMI_METAL`. The runtime resolves these through the shared material registry; imported assets may not bring arbitrary final PBR materials into the garden.

Current authored vertex data uses Blender attribute `SumiData`, exported as
`COLOR_0`:

- R: pigment density and pooling;
- G: wetness and ink-field response;
- B: dry-edge breakup;
- A: wind deformation weight.

The GLB loader clones `COLOR_0.a` into the runtime `aSumiWind` attribute. Other
living-sumi attributes are derived or defaulted by the shared material adapter;
the active V3 assets do not rely on the former `TEXCOORD_1` or `INKMASK`
contract.

## Asset naming

```text
ROOT_<zone>_V3
ASSET_<asset>
VIS_<asset>_LOD0
VIS_<asset>_LOD1
COL_<asset>_<role>_00
TRG_<asset>_<event>
SOCKET_<asset>_<purpose>
FX_<asset>_<effect>
AUD_<asset>_<event>
ANIM_<asset>_<action>
```

Each authored V3 GLB records semantic palette roles, two LODs, vertex-mask
semantics, contract nodes, streaming zone, provenance, license, and checksum.
Contract nodes may exist ahead of runtime integration; their presence does not
mean collision, triggers, effects, or spatial audio are already wired.

## Consistency gates

- Environment material bands and authored semantic roles originate in the shared art tokens. Supplied project images and audited HTML/CSS overlays are explicit exceptions.
- Authored GLBs and runtime ground/water supports resolve through the shared living-sumi adapter. Project artwork and ink rings use dedicated shaders because their sampling and transparency contracts differ.
- Water, transparent VFX, fog, and portal interiors do not receive generic outlines.
- Wind phase derives from world position; repeated plants do not sway in lockstep.
- Current motion is limited to vertex-weighted wind, water rings, court-scroll breathing/hover, rail camera motion, and HTML/CSS foreground parallax. Do not document unimplemented footsteps, doors, koi, or ritual event systems as shipping behavior.
- Every project uses the same hanging-scroll grammar with its own supplied artwork; the staggered scale, lift, radius, length, and yaw create hierarchy without claiming nine unique sculptures.
- Assets are reviewed together from fixed gameplay cameras, never approved only as isolated turntables.

## Generation record

The two older target frames were produced with the built-in image-generation
workflow from linked third-person garden and Enso-court prompts. They remain a
record of palette, material, and compositional intent. V3 subsequently moved to
a disembodied first-person camera and a nine-hanging-scroll sanctuary. The
current page keeps visible project labels out of the artwork while retaining
ARIA labels and screen-reader-only links for accessibility.
