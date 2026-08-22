import { createContext } from 'react'
import type * as THREE from 'three'

export interface LivingSumiSharedUniforms {
  uBrushTexture: THREE.Uniform<THREE.Texture>
  uFogColor: THREE.Uniform<THREE.Color>
  uFogFar: THREE.Uniform<number>
  uFogHeight: THREE.Uniform<number>
  uFogHeightDensity: THREE.Uniform<number>
  uFogNear: THREE.Uniform<number>
  uFogOpacity: THREE.Uniform<number>
  uKeyDirection: THREE.Uniform<THREE.Vector3>
  uPaperColor: THREE.Uniform<THREE.Color>
  uPaperScale: THREE.Uniform<number>
  uPaperTexture: THREE.Uniform<THREE.Texture>
  uTime: THREE.Uniform<number>
}

export interface LivingSumiContextValue {
  uniforms: LivingSumiSharedUniforms
}

export const LivingSumiContext = createContext<LivingSumiContextValue | null>(null)
