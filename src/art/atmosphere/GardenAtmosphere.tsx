import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { ART_SCENE } from '../artTokens'

export interface GardenAtmosphereProps {
  densityScale?: number
}

/**
 * Establishes the shared paper-mist baseline without a full-screen effect
 * stack. Pair it with selective InkOutlineShell instances on hero silhouettes.
 */
export function GardenAtmosphere({ densityScale = 1 }: GardenAtmosphereProps) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const { uniforms } = useArtDirector()

  useEffect(() => {
    const previousBackground = scene.background
    const previousFog = scene.fog
    const previousColorSpace = gl.outputColorSpace
    const previousToneMapping = gl.toneMapping
    const previousExposure = gl.toneMappingExposure

    scene.background = new THREE.Color(ART_SCENE.background)
    scene.fog = new THREE.FogExp2(ART_SCENE.fog, ART_SCENE.fogDensity * densityScale)
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.NeutralToneMapping
    gl.toneMappingExposure = ART_SCENE.exposure

    return () => {
      scene.background = previousBackground
      scene.fog = previousFog
      gl.outputColorSpace = previousColorSpace
      gl.toneMapping = previousToneMapping
      gl.toneMappingExposure = previousExposure
    }
  }, [densityScale, gl, scene])

  useFrame(() => {
    const ritual = uniforms.uRitualIntensity.value
    gl.toneMappingExposure = ART_SCENE.exposure + ritual * ART_SCENE.ritualExposureLift
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = ART_SCENE.fogDensity * densityScale * (1 - ritual * 0.08)
    }
  }, -70)

  return null
}
