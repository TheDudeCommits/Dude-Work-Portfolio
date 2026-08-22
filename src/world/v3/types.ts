import type * as THREE from 'three'
import type { ArtOutlineProfile } from '../../art'

export type V3Vector3Tuple = readonly [x: number, y: number, z: number]

export type V3OutlineProfile = ArtOutlineProfile | 'none'

/** Five authored pigment roles plus the specialized living surface roles. */
export type V3SumiMaterialRole =
  | 'wood'
  | 'earth'
  | 'stone'
  | 'vermilion'
  | 'pine'
  | 'washi'
  | 'water'
  | 'spirit'
  | 'metal'
  | 'indigo'

export interface V3MaterialRequest {
  mesh: THREE.Mesh
  meshName: string
  outlineProfile: V3OutlineProfile
  role: V3SumiMaterialRole
  sourceMaterial: THREE.Material | null
  sourceMaterialName: string
  /**
   * A normalized response authored from COLOR_0 alpha. Zero means the asset is
   * intentionally still. The adapter owns the actual shader deformation.
   */
  windResponse: number
}

export interface V3MaterialFrame {
  delta: number
  elapsed: number
  reducedMotion: boolean
}

/**
 * The art package implements this small boundary. It lets the world loader
 * stay independent from the concrete shader implementation while guaranteeing
 * that every imported material becomes a semantic sumi role.
 */
export interface V3SumiMaterialAdapter {
  readonly id?: string
  dispose?: () => void
  resolve: (request: V3MaterialRequest) => THREE.Material
  update?: (frame: V3MaterialFrame) => void
}

export interface V3WaterRegion {
  maxX: number
  maxZ: number
  minX: number
  minZ: number
  surfaceY: number
}

export interface V3InkRingEmitter {
  position: V3Vector3Tuple
  strength?: number
}
