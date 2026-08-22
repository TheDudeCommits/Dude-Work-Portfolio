import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { LivingSumiContext, type LivingSumiSharedUniforms } from './context'
import { LIVING_SUMI_SCENE } from './tokens'

export interface LivingSumiProviderProps {
  brushTextureUrl?: string
  children: ReactNode
  fogColor?: THREE.ColorRepresentation
  fogFar?: number
  fogHeight?: number
  fogHeightDensity?: number
  fogNear?: number
  fogOpacity?: number
  keyDirection?: readonly [x: number, y: number, z: number]
  paperColor?: THREE.ColorRepresentation
  paperScale?: number
  paperTextureUrl?: string
  reducedMotion?: boolean
  timeScale?: number
}

export function LivingSumiProvider({
  brushTextureUrl = LIVING_SUMI_SCENE.brushTexture,
  children,
  fogColor = LIVING_SUMI_SCENE.fogColor,
  fogFar = LIVING_SUMI_SCENE.fogFar,
  fogHeight = LIVING_SUMI_SCENE.fogHeight,
  fogHeightDensity = LIVING_SUMI_SCENE.fogHeightDensity,
  fogNear = LIVING_SUMI_SCENE.fogNear,
  fogOpacity = LIVING_SUMI_SCENE.fogOpacity,
  keyDirection = LIVING_SUMI_SCENE.keyDirection,
  paperColor = LIVING_SUMI_SCENE.paperColor,
  paperScale = LIVING_SUMI_SCENE.paperScale,
  paperTextureUrl = LIVING_SUMI_SCENE.paperTexture,
  reducedMotion = false,
  timeScale = 1,
}: LivingSumiProviderProps) {
  const gl = useThree((state) => state.gl)
  const [paperTexture, brushTexture] = useTexture([paperTextureUrl, brushTextureUrl])

  useLayoutEffect(() => {
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    for (const texture of [paperTexture, brushTexture]) {
      texture.colorSpace = THREE.NoColorSpace
      texture.anisotropy = anisotropy
      texture.generateMipmaps = true
      texture.needsUpdate = true
    }
    paperTexture.wrapS = THREE.RepeatWrapping
    paperTexture.wrapT = THREE.RepeatWrapping
    brushTexture.wrapS = THREE.MirroredRepeatWrapping
    brushTexture.wrapT = THREE.MirroredRepeatWrapping
  }, [brushTexture, gl, paperTexture])

  const uniforms = useMemo<LivingSumiSharedUniforms>(() => ({
    uBrushTexture: new THREE.Uniform(brushTexture),
    uFogColor: new THREE.Uniform(new THREE.Color(fogColor)),
    uFogFar: new THREE.Uniform(Math.max(fogFar, fogNear + 0.001)),
    uFogHeight: new THREE.Uniform(fogHeight),
    uFogHeightDensity: new THREE.Uniform(Math.max(0, fogHeightDensity)),
    uFogNear: new THREE.Uniform(Math.max(0, fogNear)),
    uFogOpacity: new THREE.Uniform(THREE.MathUtils.clamp(fogOpacity, 0, 1)),
    uKeyDirection: new THREE.Uniform(new THREE.Vector3(...keyDirection).normalize()),
    uPaperColor: new THREE.Uniform(new THREE.Color(paperColor)),
    uPaperScale: new THREE.Uniform(Math.max(0.001, paperScale)),
    uPaperTexture: new THREE.Uniform(paperTexture),
    uTime: new THREE.Uniform(0),
  }), [
    brushTexture,
    fogColor,
    fogFar,
    fogHeight,
    fogHeightDensity,
    fogNear,
    fogOpacity,
    keyDirection,
    paperColor,
    paperScale,
    paperTexture,
  ])

  useEffect(() => {
    uniforms.uBrushTexture.value = brushTexture
    uniforms.uFogColor.value.set(fogColor)
    uniforms.uFogFar.value = Math.max(fogFar, fogNear + 0.001)
    uniforms.uFogHeight.value = fogHeight
    uniforms.uFogHeightDensity.value = Math.max(0, fogHeightDensity)
    uniforms.uFogNear.value = Math.max(0, fogNear)
    uniforms.uFogOpacity.value = THREE.MathUtils.clamp(fogOpacity, 0, 1)
    uniforms.uKeyDirection.value.set(...keyDirection).normalize()
    uniforms.uPaperColor.value.set(paperColor)
    uniforms.uPaperScale.value = Math.max(0.001, paperScale)
    uniforms.uPaperTexture.value = paperTexture
  }, [
    brushTexture,
    fogColor,
    fogFar,
    fogHeight,
    fogHeightDensity,
    fogNear,
    fogOpacity,
    keyDirection,
    paperColor,
    paperScale,
    paperTexture,
    uniforms,
  ])

  useFrame(({ clock }) => {
    uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime * Math.max(0, timeScale)
  }, -120)

  const contextValue = useMemo(() => ({ uniforms }), [uniforms])
  return <LivingSumiContext.Provider value={contextValue}>{children}</LivingSumiContext.Provider>
}
