import { useMemo } from 'react'
import * as THREE from 'three'
import {
  circleStrokePoints,
  createDrapedVeilGeometry,
  createOrganicPlateGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface, LIVING_SCROLL_PALETTE } from './materials'

export function DistantSanctuary() {
  const geometry = useMemo(() => {
    const post = (x: number, z: number, seed: number) => createTaperedTubeGeometry([
      new THREE.Vector3(x, 0.35, z),
      new THREE.Vector3(x + Math.sin(seed) * 0.07, 2.3, z + Math.cos(seed) * 0.035),
      new THREE.Vector3(x - Math.cos(seed) * 0.055, 4.15, z),
    ], { endScale: 0.72, radialSegments: 8, radius: 0.16, seed, startScale: 1.12, tubularSegments: 34 })

    return {
      enso: createTaperedTubeGeometry(circleStrokePoints(0.7, 0.7, -2.6, 3.46, 24), {
        endScale: 0.02,
        irregularity: 0.11,
        radialSegments: 6,
        radius: 0.042,
        seed: 114,
        startScale: 0.82,
        tubularSegments: 72,
      }),
      lanterns: [
        createScholarStoneGeometry(0.38, 160, 16),
        createScholarStoneGeometry(0.38, 177, 16),
      ],
      panels: createDrapedVeilGeometry(1.72, 2.32, 18, 24),
      posts: [
        post(-2.28, 0.92, 19),
        post(2.28, 0.92, 31),
        post(-2.28, -0.92, 47),
        post(2.28, -0.92, 59),
      ],
      roof: createDrapedVeilGeometry(8.3, 4.1, 42, 28),
      roofCrown: createTaperedTubeGeometry([
        new THREE.Vector3(-4.4, 4.22, 0),
        new THREE.Vector3(-2.2, 4.54, -0.05),
        new THREE.Vector3(0, 4.68, 0.04),
        new THREE.Vector3(2.2, 4.55, -0.04),
        new THREE.Vector3(4.42, 4.2, 0),
      ], { endScale: 0.42, radialSegments: 8, radius: 0.18, seed: 83, startScale: 0.5, tubularSegments: 54 }),
      steps: Array.from({ length: 7 }, (_, index) => createOrganicPlateGeometry(
        2.5 - index * 0.12,
        0.72,
        0.18,
        140 + index * 13,
        32,
      )),
      terraces: [
        createOrganicPlateGeometry(7.3, 5.2, 0.42, 91, 74),
        createOrganicPlateGeometry(6.4, 4.45, 0.34, 103, 68),
        createOrganicPlateGeometry(5.55, 3.7, 0.28, 127, 64),
      ],
    }
  }, [])

  return (
    <group name="distant-sanctuary" position={[0.4, 0.1, -35.5]} scale={1.08}>
      {geometry.terraces.map((terrace, index) => (
        <mesh
          castShadow
          geometry={terrace}
          key={index}
          position={[0, index * 0.25, 0]}
          receiveShadow
          rotation={[0, index * 0.025 - 0.018, 0]}
        >
          <GardenSurface role={index === 0 ? 'soot' : index === 1 ? 'stone' : 'paper'} />
        </mesh>
      ))}
      {geometry.steps.map((step, index) => (
        <mesh
          geometry={step}
          key={index}
          position={[Math.sin(index * 1.8) * 0.08, 0.12 + index * 0.085, 3.1 + index * 0.64]}
          rotation={[0, Math.sin(index) * 0.04, 0]}
          scale={[1 - index * 0.045, 1, 1]}
        >
          <GardenSurface role={index % 3 === 0 ? 'paper' : 'stone'} />
        </mesh>
      ))}
      {geometry.posts.map((post, index) => (
        <mesh castShadow geometry={post} key={index}>
          <GardenSurface role="pineBark" />
        </mesh>
      ))}
      <mesh geometry={geometry.roof} position={[0, 4.08, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.62]}>
        <GardenSurface role="soot" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry.roof} position={[0, 4.22, -0.08]} rotation={[Math.PI / 2, 0, Math.PI]} scale={[0.82, 0.82, 0.5]}>
        <GardenSurface role="indigo" side={THREE.DoubleSide} />
      </mesh>
      <mesh castShadow geometry={geometry.roofCrown}><GardenSurface role="gold" /></mesh>
      {[-1.45, 0, 1.45].map((x, index) => (
        <mesh geometry={geometry.panels} key={x} position={[x, 2.25, -0.99]} scale={[index === 1 ? 0.78 : 0.72, 1, 1]}>
          <GardenSurface role={index === 1 ? 'gold' : 'paper'} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={geometry.enso} position={[0, 2.32, -0.83]}>
        <GardenSurface role="vermilion" />
      </mesh>
      {[-2.9, 2.9].map((x, index) => (
        <mesh
          geometry={geometry.lanterns[index]}
          key={x}
          position={[x, 0.78, 1.62]}
          scale={[0.7, 1.7, 0.7]}
        >
          <GardenSurface role="gold" />
        </mesh>
      ))}
      <pointLight
        color={LIVING_SCROLL_PALETTE.gold}
        decay={2}
        distance={16}
        intensity={4.8}
        position={[0, 2.45, 0.35]}
      />
    </group>
  )
}
