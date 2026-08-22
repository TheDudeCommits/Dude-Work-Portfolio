import type { ThreeElements } from '@react-three/fiber'
import { useEffect, useMemo, type Ref } from 'react'
import * as THREE from 'three'
import {
  LIVING_SUMI_VERSION,
  type LivingSumiMaskDefaults,
  type LivingSumiNodeMetadata,
} from './contract'
import { ensureLivingSumiAttributes } from './geometry'
import { LivingSumiMaterial, type LivingSumiMaterialProps } from './LivingSumiMaterial'
import type { LivingSumiRole } from './tokens'

export interface LivingSumiMeshProps extends Omit<
  ThreeElements['mesh'],
  'children' | 'geometry' | 'material' | 'ref'
> {
  cloneGeometry?: boolean
  geometry: THREE.BufferGeometry
  maskDefaults?: LivingSumiMaskDefaults
  material?: Omit<LivingSumiMaterialProps, 'maskDefaults' | 'role'>
  meshRef?: Ref<THREE.Mesh>
  metadata?: Omit<Partial<LivingSumiNodeMetadata>, 'role' | 'version'>
  role: LivingSumiRole
}

/**
 * Convenience wrapper for a single-material mesh. Complex GLBs can instead use
 * `ensureLivingSumiAttributes` during traversal and mount `LivingSumiMaterial`
 * directly into their generated component tree.
 */
export function LivingSumiMesh({
  cloneGeometry = false,
  geometry,
  maskDefaults,
  material,
  meshRef,
  metadata,
  role,
  userData,
  ...meshProps
}: LivingSumiMeshProps) {
  const preparedGeometry = useMemo(() => ensureLivingSumiAttributes(geometry, {
    clone: cloneGeometry,
    ...maskDefaults,
  }), [cloneGeometry, geometry, maskDefaults])
  const livingUserData = useMemo(() => ({
    ...userData,
    livingSumi: {
      ...metadata,
      maskDefaults,
      role,
      version: LIVING_SUMI_VERSION,
    },
  }), [maskDefaults, metadata, role, userData])

  useEffect(() => () => {
    if (cloneGeometry) preparedGeometry.dispose()
  }, [cloneGeometry, preparedGeometry])

  return (
    <mesh
      {...meshProps}
      geometry={preparedGeometry}
      ref={meshRef}
      userData={livingUserData}
    >
      <LivingSumiMaterial {...material} maskDefaults={maskDefaults} role={role} />
    </mesh>
  )
}
