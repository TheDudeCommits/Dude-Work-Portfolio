import type * as THREE from 'three'
import { LIVING_SUMI_ROLES, type LivingSumiRole } from './tokens'

export const LIVING_SUMI_VERSION = 3 as const

/** Canonical runtime BufferGeometry attribute names consumed by the shader. */
export const LIVING_SUMI_ATTRIBUTES = {
  dryness: 'aSumiDryness',
  pigment: 'aSumiPigment',
  stroke: 'aSumiStroke',
  wetness: 'aSumiWetness',
  wind: 'aSumiWind',
} as const

/**
 * glTF custom semantics must begin with an underscore. The asset-loader adapter
 * should preserve these values, then `ensureLivingSumiAttributes` maps common
 * GLTFLoader spellings onto the canonical runtime attribute names above.
 */
export const LIVING_SUMI_GLTF_SEMANTICS = {
  dryness: '_SUMI_DRYNESS',
  pigment: '_SUMI_PIGMENT',
  stroke: '_SUMI_STROKE',
  wetness: '_SUMI_WETNESS',
  wind: '_SUMI_WIND',
} as const

/** Stable DCC material-slot names. A node may also declare the role in extras. */
export const LIVING_SUMI_MATERIAL_SLOTS = {
  MAT_SUMI_FOLIAGE: 'pine',
  MAT_SUMI_INDIGO: 'indigo',
  MAT_SUMI_METAL: 'metal',
  MAT_SUMI_SPIRIT: 'spirit',
  MAT_SUMI_STONE: 'stone',
  MAT_SUMI_TIMBER: 'wood',
  MAT_SUMI_VERMILION: 'vermilion',
  MAT_SUMI_WASHI: 'washi',
  MAT_SUMI_WATER: 'water',
  SUMI_V3_INDIGO: 'indigo',
  SUMI_V3_METAL: 'metal',
  SUMI_V3_PINE: 'pine',
  SUMI_V3_SPIRIT: 'spirit',
  SUMI_V3_STONE: 'stone',
  SUMI_V3_VERMILION: 'vermilion',
  SUMI_V3_WASHI: 'washi',
  SUMI_V3_WATER: 'water',
  SUMI_V3_WOOD: 'wood',
} as const satisfies Readonly<Record<string, LivingSumiRole>>

export interface LivingSumiMaskDefaults {
  dryness?: number
  pigment?: number
  stroke?: readonly [x: number, y: number]
  wetness?: number
  wind?: number
}

/**
 * Optional author hint for the inexpensive grounding decal. `size` is in
 * world-space X/Z metres and `offset` is relative to the owning node origin.
 * The runtime remains responsible for resolving the actual terrain height.
 */
export interface LivingSumiContactWashMetadata {
  offset?: readonly [x: number, z: number]
  opacity?: number
  size?: readonly [width: number, depth: number]
  yaw?: number
}

/**
 * Expected node metadata, serialized under `node.extras.livingSumi` in glTF:
 *
 * - `role` selects material-specific pigment bands.
 * - `maskDefaults` is used only when a mesh omits a custom vertex channel.
 * - `brushDirection` is an XZ world-flow hint; per-vertex `_SUMI_STROKE`
 *   remains the more precise source.
 *
 * DCC export contract:
 * - apply transforms and avoid runtime non-uniform scaling;
 * - provide normals and UV0;
 * - export pigment/wetness/dryness/wind as scalar custom attributes, or pack
 *   them in COLOR_0 as R/G/B/A for the loader helper to decode;
 * - export stroke direction as a normalized vec2 custom attribute;
 * - keep collision meshes separate and invisible to this rendering stack.
 */
export interface LivingSumiNodeMetadata {
  brushDirection?: readonly [x: number, y: number]
  contactWash?: LivingSumiContactWashMetadata
  maskDefaults?: LivingSumiMaskDefaults
  role: LivingSumiRole
  version: typeof LIVING_SUMI_VERSION
}

export type LivingSumiObject = THREE.Object3D & {
  userData: {
    livingSumi?: Partial<LivingSumiNodeMetadata>
    [key: string]: unknown
  }
}

export function isLivingSumiRole(value: unknown): value is LivingSumiRole {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(LIVING_SUMI_ROLES, value)
}

export function roleFromSumiMaterialName(name: string): LivingSumiRole | null {
  return Object.prototype.hasOwnProperty.call(LIVING_SUMI_MATERIAL_SLOTS, name)
    ? LIVING_SUMI_MATERIAL_SLOTS[name as keyof typeof LIVING_SUMI_MATERIAL_SLOTS]
    : null
}

export function readLivingSumiMetadata(object: LivingSumiObject): LivingSumiNodeMetadata | null {
  const source = object.userData.livingSumi
  if (!source || !isLivingSumiRole(source.role)) return null
  return {
    brushDirection: source.brushDirection,
    contactWash: source.contactWash,
    maskDefaults: source.maskDefaults,
    role: source.role,
    version: LIVING_SUMI_VERSION,
  }
}
