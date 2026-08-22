import { useMemo } from 'react'
import * as THREE from 'three'
import { createRibbonGeometry, createTaperedTubeGeometry } from './geometry'
import { GardenSurface } from './materials'

function archPoints(yOffset = 0, z = 0) {
  return [
    new THREE.Vector3(-7.1, 0.18 + yOffset, z),
    new THREE.Vector3(-5.2, 0.62 + yOffset, z),
    new THREE.Vector3(-2.8, 1.48 + yOffset, z),
    new THREE.Vector3(0, 1.9 + yOffset, z),
    new THREE.Vector3(2.9, 1.42 + yOffset, z),
    new THREE.Vector3(5.25, 0.58 + yOffset, z),
    new THREE.Vector3(7.05, 0.16 + yOffset, z),
  ]
}

export function MoonBridge() {
  const geometry = useMemo(() => {
    const deck = createRibbonGeometry(archPoints(), { width: 2.45, thickness: 0.22, tubularSegments: 52, widthVariation: 0.024 })
    const leftRail = createTaperedTubeGeometry(archPoints(1.12, -1.18), {
      radius: 0.11,
      radialSegments: 7,
      seed: 9,
      startScale: 0.72,
      endScale: 0.68,
    })
    const rightRail = createTaperedTubeGeometry(archPoints(1.12, 1.18), {
      radius: 0.11,
      radialSegments: 7,
      seed: 14,
      startScale: 0.7,
      endScale: 0.74,
    })
    const rails = [leftRail, rightRail]
    const uprights = [-5.6, -3.75, -1.85, 0, 1.9, 3.82, 5.7].flatMap((x, index) => {
      const y = 0.18 + (1 - Math.pow(Math.abs(x) / 7.1, 1.8)) * 1.72
      return [-1.18, 1.18].map((z, sideIndex) => createTaperedTubeGeometry([
        new THREE.Vector3(x, y + 0.03, z),
        new THREE.Vector3(x + Math.sin(index * 1.7 + sideIndex) * 0.035, y + 1.1, z),
      ], {
        endScale: 0.7,
        radialSegments: 6,
        radius: 0.085,
        seed: index * 3 + sideIndex,
        startScale: 1,
        tubularSegments: 12,
      }))
    })
    return { deck, rails, uprights }
  }, [])

  return (
    <group position={[0, -0.02, -3.4]}>
      <mesh castShadow geometry={geometry.deck} receiveShadow>
        <GardenSurface role="vermilion" />
      </mesh>
      {geometry.rails.map((rail, index) => (
        <mesh castShadow geometry={rail} key={index}>
          <GardenSurface role="soot" />
        </mesh>
      ))}
      {geometry.uprights.map((upright, index) => (
        <mesh castShadow geometry={upright} key={index}>
          <GardenSurface role="soot" />
        </mesh>
      ))}
    </group>
  )
}

