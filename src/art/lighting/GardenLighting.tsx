import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { ART_SCENE } from '../artTokens'

export interface GardenLightingProps {
  keyPosition?: readonly [x: number, y: number, z: number]
  ritualOrigin?: readonly [x: number, y: number, z: number]
  shadowMapSize?: 1024 | 2048
}

export function GardenLighting({
  keyPosition = [-18, 26, 22],
  ritualOrigin = [0, 4, -26],
  shadowMapSize = 2048,
}: GardenLightingProps) {
  const key = useRef<THREE.DirectionalLight>(null)
  const ritual = useRef<THREE.PointLight>(null)
  const { uniforms } = useArtDirector()

  useFrame(() => {
    const ritualIntensity = uniforms.uRitualIntensity.value
    if (key.current) key.current.intensity = 2.08 + ritualIntensity * 0.14
    if (ritual.current) ritual.current.intensity = ritualIntensity * 5.2
  }, -80)

  return (
    <>
      <hemisphereLight
        color={ART_SCENE.hemisphereSky}
        groundColor={ART_SCENE.hemisphereGround}
        intensity={0.48}
      />
      <directionalLight
        castShadow
        color={ART_SCENE.keyLight}
        intensity={2.08}
        position={keyPosition}
        ref={key}
        shadow-bias={-0.00012}
        shadow-normalBias={0.025}
        shadow-camera-bottom={-25}
        shadow-camera-far={125}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={28}
        shadow-mapSize-height={shadowMapSize}
        shadow-mapSize-width={shadowMapSize}
      />
      <directionalLight color={ART_SCENE.fillLight} intensity={0.18} position={[17, 12, -32]} />
      <pointLight
        color={ART_SCENE.ritualLight}
        decay={1.7}
        distance={24}
        intensity={0}
        position={ritualOrigin}
        ref={ritual}
      />
    </>
  )
}
