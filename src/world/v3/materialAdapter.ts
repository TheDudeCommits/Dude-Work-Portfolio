import * as THREE from 'three'
import type { ArtOutlineProfile } from '../../art'
import type { V3MaterialRequest, V3OutlineProfile, V3SumiMaterialRole } from './types'

const SLOT_ROLES = {
  SUMI_V3_PINE: 'pine',
  SUMI_V3_STONE: 'stone',
  SUMI_V3_VERMILION: 'vermilion',
  SUMI_V3_WASHI: 'washi',
  SUMI_V3_WOOD: 'wood',
  MAT_SUMI_WASHI: 'washi',
  MAT_SUMI_STONE: 'stone',
  MAT_SUMI_TIMBER: 'wood',
  MAT_SUMI_VERMILION: 'vermilion',
  MAT_SUMI_FOLIAGE: 'pine',
  MAT_SUMI_WATER: 'water',
  MAT_SUMI_SPIRIT: 'spirit',
  MAT_SUMI_METAL: 'metal',
  MAT_SUMI_INDIGO: 'indigo',
} as const satisfies Readonly<Record<string, V3SumiMaterialRole>>

const V3_ROLES = new Set<V3SumiMaterialRole>([
  'wood',
  'earth',
  'stone',
  'vermilion',
  'pine',
  'washi',
  'water',
  'spirit',
  'metal',
  'indigo',
])

const ROLE_HINTS: ReadonlyArray<readonly [RegExp, V3SumiMaterialRole]> = [
  [/WATER|POND|POOL|RIVER/i, 'water'],
  [/FOLIAGE|LEAF|LEAVES|PINE|BAMBOO|MOSS|GRASS|REED/i, 'pine'],
  [/VERMILION|TORII|LACQUER|AKA_/i, 'vermilion'],
  [/TIMBER|WOOD|BEAM|BRIDGE|DECK|POST/i, 'wood'],
  [/WASHI|PAPER|SHOJI|SHIDE/i, 'washi'],
  [/SPIRIT|RITUAL|GLOW|AURA/i, 'spirit'],
  [/METAL|GOLD|BELL|BRASS/i, 'metal'],
  [/INDIGO|AI_/i, 'indigo'],
  [/STONE|ROCK|GRANITE|GRAVEL|STEP/i, 'stone'],
]

const OUTLINE_BY_ROLE: Record<V3SumiMaterialRole, V3OutlineProfile> = {
  earth: 'none',
  pine: 'vegetation',
  indigo: 'detail',
  metal: 'detail',
  spirit: 'detail',
  stone: 'architecture',
  wood: 'architecture',
  vermilion: 'hero',
  washi: 'detail',
  water: 'none',
}

function validRole(value: unknown): value is V3SumiMaterialRole {
  return typeof value === 'string' && V3_ROLES.has(value as V3SumiMaterialRole)
}

export function resolveV3SumiRole(
  material: THREE.Material,
  mesh: THREE.Mesh,
): V3SumiMaterialRole {
  const metadataRole = material.userData.livingSumi?.role
    ?? mesh.userData.livingSumi?.role
    ?? material.userData.sumiRole
    ?? mesh.userData.sumiRole
  if (validRole(metadataRole)) return metadataRole
  if (Object.prototype.hasOwnProperty.call(SLOT_ROLES, material.name)) {
    return SLOT_ROLES[material.name as keyof typeof SLOT_ROLES]
  }

  const searchable = `${material.name} ${mesh.name}`
  return ROLE_HINTS.find(([pattern]) => pattern.test(searchable))?.[1] ?? 'stone'
}

export function outlineForV3Role(
  role: V3SumiMaterialRole,
  authoredValue?: unknown,
): V3OutlineProfile {
  if (authoredValue === 'none') return 'none'
  if (
    authoredValue === 'hero'
    || authoredValue === 'architecture'
    || authoredValue === 'vegetation'
    || authoredValue === 'detail'
  ) return authoredValue satisfies ArtOutlineProfile
  return OUTLINE_BY_ROLE[role]
}

export function windResponseForV3Mesh(mesh: THREE.Mesh, role: V3SumiMaterialRole) {
  const authored = Number(mesh.userData.sumiWindResponse ?? mesh.userData.windResponse)
  if (Number.isFinite(authored)) return THREE.MathUtils.clamp(authored, 0, 1)
  if (!mesh.geometry.getAttribute('aSumiWind')) return 0
  if (role === 'pine') return 0.78
  if (role === 'washi') return 0.24
  return 0
}

export function createV3MaterialRequest(
  mesh: THREE.Mesh,
  sourceMaterial: THREE.Material,
): V3MaterialRequest {
  const role = resolveV3SumiRole(sourceMaterial, mesh)
  return {
    mesh,
    meshName: mesh.name,
    outlineProfile: outlineForV3Role(
      role,
      sourceMaterial.userData.sumiOutline ?? mesh.userData.sumiOutline,
    ),
    role,
    sourceMaterial,
    sourceMaterialName: sourceMaterial.name,
    windResponse: windResponseForV3Mesh(mesh, role),
  }
}
