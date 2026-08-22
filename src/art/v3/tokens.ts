import { ART_ASSETS, ART_PALETTE } from '../artTokens'

export type LivingSumiRole =
  | 'wood'
  | 'earth'
  | 'stone'
  | 'vermilion'
  | 'pine'
  | 'washi'
  | 'water'
  | 'metal'
  | 'spirit'
  | 'indigo'

export interface LivingSumiRoleTokens {
  absorbency: number
  alphaFeather: number
  brushDirection: readonly [x: number, y: number]
  brushScale: number
  brushScatter: number
  contourWidth: number
  dryGranulation: number
  dryLift: number
  inkLoad: number
  light: string
  lightResponse: number
  mid: string
  opacity: number
  paperResponse: number
  pigmentDepth: number
  shadow: string
  silhouetteStrength: number
  weathering: number
  wetDarkening: number
}

/**
 * These are material-specific value masses, not a global posterization ramp.
 * The shader moves smoothly through each role's three authored pigment bands.
 */
export const LIVING_SUMI_ROLES = {
  earth: {
    absorbency: 0.72,
    alphaFeather: 0,
    brushDirection: [0.94, 0.34],
    brushScale: 0.11,
    brushScatter: 0.08,
    contourWidth: 0.08,
    dryGranulation: 0.74,
    dryLift: 0.5,
    inkLoad: 0.48,
    light: ART_PALETTE.washi,
    lightResponse: 0.08,
    mid: ART_PALETTE.mist,
    opacity: 1,
    paperResponse: 0.82,
    pigmentDepth: 0.5,
    shadow: ART_PALETTE.granite,
    silhouetteStrength: 0.18,
    weathering: 0.7,
    wetDarkening: 0.34,
  },
  wood: {
    absorbency: 0.78,
    alphaFeather: 0,
    brushDirection: [0.92, 0.38],
    brushScale: 0.46,
    brushScatter: 0.2,
    contourWidth: 0.78,
    dryGranulation: 0.82,
    dryLift: 0.42,
    inkLoad: 1,
    light: ART_PALETTE.warmLight,
    lightResponse: 0.66,
    mid: ART_PALETTE.pine,
    opacity: 1,
    paperResponse: 0.34,
    pigmentDepth: 0.86,
    shadow: ART_PALETTE.soot,
    silhouetteStrength: 0.92,
    weathering: 0.76,
    wetDarkening: 0.72,
  },
  stone: {
    absorbency: 0.52,
    alphaFeather: 0,
    brushDirection: [0.71, 0.7],
    brushScale: 0.72,
    brushScatter: 0.28,
    contourWidth: 0.76,
    dryGranulation: 0.96,
    dryLift: 0.3,
    inkLoad: 1,
    light: ART_PALETTE.warmLight,
    lightResponse: 0.16,
    mid: ART_PALETTE.granite,
    opacity: 1,
    paperResponse: 0.52,
    pigmentDepth: 0.9,
    shadow: ART_PALETTE.soot,
    silhouetteStrength: 0.86,
    weathering: 0.88,
    wetDarkening: 0.48,
  },
  vermilion: {
    absorbency: 0.66,
    alphaFeather: 0,
    brushDirection: [0.96, 0.28],
    brushScale: 0.52,
    brushScatter: 0.34,
    contourWidth: 0.84,
    dryGranulation: 0.9,
    dryLift: 0.26,
    inkLoad: 1.12,
    light: ART_PALETTE.warmLight,
    lightResponse: 0.56,
    mid: ART_PALETTE.vermilion,
    opacity: 1,
    paperResponse: 0.58,
    pigmentDepth: 0.92,
    shadow: ART_PALETTE.soot,
    silhouetteStrength: 0.94,
    weathering: 0.94,
    wetDarkening: 0.76,
  },
  pine: {
    absorbency: 0.82,
    alphaFeather: 0.06,
    brushDirection: [0.82, 0.57],
    brushScale: 0.66,
    brushScatter: 0.56,
    contourWidth: 0.9,
    dryGranulation: 0.72,
    dryLift: 0.08,
    inkLoad: 1.08,
    light: ART_PALETTE.celadon,
    lightResponse: 0.18,
    mid: ART_PALETTE.pine,
    opacity: 1,
    paperResponse: 0.34,
    pigmentDepth: 0.98,
    shadow: ART_PALETTE.soot,
    silhouetteStrength: 1,
    weathering: 0.42,
    wetDarkening: 0.82,
  },
  washi: {
    absorbency: 0.94,
    alphaFeather: 0.12,
    brushDirection: [0.64, 0.77],
    brushScale: 0.27,
    brushScatter: 0.62,
    contourWidth: 0.32,
    dryGranulation: 0.84,
    dryLift: 0.72,
    inkLoad: 0.4,
    light: ART_PALETTE.washi,
    lightResponse: 0.12,
    mid: ART_PALETTE.warmLight,
    opacity: 0.96,
    paperResponse: 0.95,
    pigmentDepth: 0.48,
    shadow: ART_PALETTE.oldGold,
    silhouetteStrength: 0.38,
    weathering: 0.26,
    wetDarkening: 0.34,
  },
  water: {
    absorbency: 0.22,
    alphaFeather: 0.04,
    brushDirection: [0.98, 0.18],
    brushScale: 0.22,
    brushScatter: 0.18,
    contourWidth: 0.08,
    dryGranulation: 0.18,
    dryLift: 0.04,
    inkLoad: 0.22,
    light: ART_PALETTE.paleWater,
    lightResponse: 0.46,
    mid: ART_PALETTE.water,
    opacity: 0.86,
    paperResponse: 0.12,
    pigmentDepth: 0.48,
    shadow: ART_PALETTE.deepWater,
    silhouetteStrength: 0.18,
    weathering: 0.08,
    wetDarkening: 0.28,
  },
  metal: {
    absorbency: 0.34,
    alphaFeather: 0,
    brushDirection: [0.88, 0.47],
    brushScale: 0.37,
    brushScatter: 0.3,
    contourWidth: 0.72,
    dryGranulation: 0.54,
    dryLift: 0.28,
    inkLoad: 0.76,
    light: ART_PALETTE.warmLight,
    lightResponse: 0.7,
    mid: ART_PALETTE.oldGold,
    opacity: 1,
    paperResponse: 0.18,
    pigmentDepth: 0.54,
    shadow: ART_PALETTE.soot,
    silhouetteStrength: 0.72,
    weathering: 0.62,
    wetDarkening: 0.44,
  },
  spirit: {
    absorbency: 0.48,
    alphaFeather: 0.28,
    brushDirection: [0.56, 0.83],
    brushScale: 0.29,
    brushScatter: 0.58,
    contourWidth: 0.18,
    dryGranulation: 0.28,
    dryLift: 0.36,
    inkLoad: 0.14,
    light: ART_PALETTE.warmLight,
    lightResponse: 0.12,
    mid: ART_PALETTE.celadon,
    opacity: 0.76,
    paperResponse: 0.44,
    pigmentDepth: 0.26,
    shadow: ART_PALETTE.pine,
    silhouetteStrength: 0.34,
    weathering: 0.16,
    wetDarkening: 0.22,
  },
  indigo: {
    absorbency: 0.7,
    alphaFeather: 0,
    brushDirection: [0.79, 0.61],
    brushScale: 0.41,
    brushScatter: 0.4,
    contourWidth: 0.72,
    dryGranulation: 0.58,
    dryLift: 0.34,
    inkLoad: 0.86,
    light: ART_PALETTE.coolLight,
    lightResponse: 0.42,
    mid: ART_PALETTE.indigo,
    opacity: 1,
    paperResponse: 0.38,
    pigmentDepth: 0.82,
    shadow: ART_PALETTE.soot,
    silhouetteStrength: 0.8,
    weathering: 0.54,
    wetDarkening: 0.68,
  },
} as const satisfies Readonly<Record<LivingSumiRole, LivingSumiRoleTokens>>

export const LIVING_SUMI_SCENE = {
  brushTexture: '/art/v3/textures/living-brush-field.webp',
  fogColor: ART_PALETTE.mist,
  fogFar: 104,
  fogHeight: 1.72,
  fogHeightDensity: 0.11,
  fogNear: 24,
  fogOpacity: 0.54,
  keyDirection: [-0.36, 0.82, 0.44] as const,
  paperColor: ART_PALETTE.washi,
  paperScale: 0.34,
  paperTexture: ART_ASSETS.washiPaper,
} as const
