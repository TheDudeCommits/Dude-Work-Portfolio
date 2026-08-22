/**
 * The single source of truth for the Living Scroll visual language.
 * Runtime components should consume semantic roles from this file rather than
 * introducing their own colors or material values.
 */
export const ART_PALETTE = {
  washi: '#e8e0d0',
  mist: '#c9d0c5',
  celadon: '#91aaa0',
  water: '#496f70',
  pine: '#314d43',
  granite: '#747d76',
  indigo: '#2d4350',
  soot: '#272825',
  vermilion: '#a64a37',
  oldGold: '#b39455',
  warmLight: '#f0d8ae',
  coolLight: '#718f88',
  deepWater: '#203f42',
  paleWater: '#89aaa4',
  inkFieldClear: '#000000',
  nightZenith: '#050810',
  nightHorizon: '#142631',
  nightMist: '#33484d',
  moonCrimson: '#b44a46',
  moonGlow: '#dc8b76',
  firefly: '#e4bd68',
  mapleCrimson: '#842f2e',
  nightEarth: '#111a1c',
  nightEarthLift: '#26363a',
  nightStone: '#3f4b4d',
  moonlitStone: '#647173',
  nightMoss: '#20352e',
  gardenGreen: '#48624b',
  moonGreen: '#8ca382',
  lanternAmber: '#f0aa62',
  inkFog: '#1c2c32',
} as const

export type ArtPaletteRole = keyof typeof ART_PALETTE

export const ART_SCENE = {
  background: ART_PALETTE.mist,
  fog: ART_PALETTE.mist,
  fogDensity: 0.0125,
  exposure: 0.78,
  ritualExposureLift: 0.12,
  keyLight: ART_PALETTE.warmLight,
  fillLight: ART_PALETTE.coolLight,
  hemisphereSky: ART_PALETTE.washi,
  hemisphereGround: ART_PALETTE.soot,
  ritualLight: ART_PALETTE.oldGold,
  outline: ART_PALETTE.soot,
} as const

/**
 * Shared cinematic treatment. These values deliberately keep the world close
 * to monochrome while protecting the two ceremonial pigments from the grade.
 */
export const ART_CINEMA = {
  accentGold: ART_PALETTE.oldGold,
  accentVermilion: ART_PALETTE.vermilion,
  atmosphereInk: ART_PALETTE.soot,
  atmosphereMist: ART_PALETTE.mist,
  atmospherePaper: ART_PALETTE.washi,
  atmospherePine: ART_PALETTE.pine,
  backlight: ART_PALETTE.warmLight,
  backlightIntensity: 3.35,
  edgeInkStrength: 0.58,
  exposureBreath: 0.024,
  filmDesaturation: 0.68,
  fogBreath: 0.12,
  letterboxWash: 0.048,
  paperGrainStrength: 0.016,
  rimLight: ART_PALETTE.coolLight,
  rimLightIntensity: 0.32,
} as const

export const ART_ASSETS = {
  washiPaper: '/assets/kozo-washi.webp',
} as const

export const ART_RUNTIME = {
  inkResolution: 512,
  maxInkEventsPerFrame: 8,
  maxQueuedInkEvents: 96,
  broadPaperScale: 0.8,
  fineFiberScale: 0.025,
  ritualEase: 3.8,
  timeScale: 1,
} as const

export const ART_WATER = {
  alpha: 0.82,
  alphaAtGrazing: 0.89,
  caustic: ART_PALETTE.washi,
  causticStrength: 0.28,
  deep: ART_PALETTE.deepWater,
  disturbanceResponse: 0.82,
  fresnelStrength: 0.72,
  light: ART_PALETTE.warmLight,
  lightDirection: [-0.36, 0.82, 0.44] as const,
  paperBreakup: 0.2,
  shallow: ART_PALETTE.paleWater,
  skyReflection: ART_PALETTE.mist,
  waveStrength: 0.078,
} as const

export const ART_OUTLINE_PROFILES = {
  hero: { opacity: 0.88, widthPx: 2.05 },
  architecture: { opacity: 0.76, widthPx: 1.35 },
  vegetation: { opacity: 0.54, widthPx: 0.78 },
  detail: { opacity: 0.66, widthPx: 0.92 },
} as const

export type ArtOutlineProfile = keyof typeof ART_OUTLINE_PROFILES

export const SUMI_MATERIAL_ROLES = {
  washi: {
    base: ART_PALETTE.washi,
    emissive: ART_PALETTE.washi,
    emissiveIntensity: 0.015,
    inkResponse: 0.18,
    metalness: 0,
    paperResponse: 0.9,
    ritualResponse: 0.15,
    roughness: 0.98,
  },
  stone: {
    base: ART_PALETTE.granite,
    emissive: ART_PALETTE.soot,
    emissiveIntensity: 0,
    inkResponse: 0.62,
    metalness: 0,
    paperResponse: 0.56,
    ritualResponse: 0.18,
    roughness: 0.96,
  },
  timber: {
    base: ART_PALETTE.soot,
    emissive: ART_PALETTE.soot,
    emissiveIntensity: 0,
    inkResponse: 0.7,
    metalness: 0,
    paperResponse: 0.46,
    ritualResponse: 0.2,
    roughness: 0.9,
  },
  vermilion: {
    base: ART_PALETTE.vermilion,
    emissive: ART_PALETTE.vermilion,
    emissiveIntensity: 0.025,
    inkResponse: 0.46,
    metalness: 0,
    paperResponse: 0.44,
    ritualResponse: 0.4,
    roughness: 0.84,
  },
  foliage: {
    base: ART_PALETTE.pine,
    emissive: ART_PALETTE.pine,
    emissiveIntensity: 0.01,
    inkResponse: 0.58,
    metalness: 0,
    paperResponse: 0.62,
    ritualResponse: 0.16,
    roughness: 0.94,
  },
  water: {
    base: ART_PALETTE.water,
    emissive: ART_PALETTE.paleWater,
    emissiveIntensity: 0.045,
    inkResponse: 0.82,
    metalness: 0,
    paperResponse: 0.12,
    ritualResponse: 0.34,
    roughness: 0.38,
  },
  spirit: {
    base: ART_PALETTE.celadon,
    emissive: ART_PALETTE.oldGold,
    emissiveIntensity: 0.16,
    inkResponse: 0.24,
    metalness: 0,
    paperResponse: 0.34,
    ritualResponse: 0.9,
    roughness: 0.72,
  },
  metal: {
    base: ART_PALETTE.oldGold,
    emissive: ART_PALETTE.oldGold,
    emissiveIntensity: 0.02,
    inkResponse: 0.38,
    metalness: 0,
    paperResponse: 0.28,
    ritualResponse: 0.62,
    roughness: 0.86,
  },
  indigo: {
    base: ART_PALETTE.indigo,
    emissive: ART_PALETTE.indigo,
    emissiveIntensity: 0.01,
    inkResponse: 0.54,
    metalness: 0,
    paperResponse: 0.52,
    ritualResponse: 0.3,
    roughness: 0.92,
  },
} as const

export type SumiMaterialRole = keyof typeof SUMI_MATERIAL_ROLES

export const SUMI_GLTF_MATERIAL_SLOTS = {
  MAT_SUMI_WASHI: 'washi',
  MAT_SUMI_STONE: 'stone',
  MAT_SUMI_TIMBER: 'timber',
  MAT_SUMI_VERMILION: 'vermilion',
  MAT_SUMI_FOLIAGE: 'foliage',
  MAT_SUMI_WATER: 'water',
  MAT_SUMI_SPIRIT: 'spirit',
  MAT_SUMI_METAL: 'metal',
  MAT_SUMI_INDIGO: 'indigo',
} as const satisfies Record<string, SumiMaterialRole>

export type SumiGltfMaterialSlot = keyof typeof SUMI_GLTF_MATERIAL_SLOTS

export function isSumiGltfMaterialSlot(value: string): value is SumiGltfMaterialSlot {
  return Object.prototype.hasOwnProperty.call(SUMI_GLTF_MATERIAL_SLOTS, value)
}
