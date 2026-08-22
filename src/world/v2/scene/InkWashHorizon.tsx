import { useMemo } from 'react'
import * as THREE from 'three'
import { SumiSurfaceMaterial } from '../../../art'

function seededNoise(seed: number, index: number) {
  const value = Math.sin(seed * 31.77 + index * 17.31) * 43758.5453
  return value - Math.floor(value)
}

function createMountainRing(radius: number, baseHeight: number, peakHeight: number, seed: number) {
  const segments = 96
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const angle = t * Math.PI * 2
    const broad = Math.sin(angle * 3 + seed) * 0.28 + Math.sin(angle * 7 - seed * 0.7) * 0.15
    const peaks = Math.pow(Math.max(0, Math.sin(angle * (4 + seed % 3) + seed * 0.9)), 2.2)
    const variation = (seededNoise(seed, index) - 0.5) * 0.12
    const height = baseHeight + peakHeight * Math.max(0.08, 0.35 + broad + peaks * 0.55 + variation)
    const radialVariation = 1 + Math.sin(angle * 5 + seed) * 0.025
    const x = Math.cos(angle) * radius * radialVariation
    const z = Math.sin(angle) * radius * radialVariation
    positions.push(x, -8, z, x, height, z)
    if (index < segments) {
      const vertex = index * 2
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function InkWashHorizon() {
  const rings = useMemo(() => [
    { geometry: createMountainRing(37, 4.2, 9.4, 4), opacity: 0.19, role: 'indigo' as const },
    { geometry: createMountainRing(47, 6.0, 12.5, 11), opacity: 0.13, role: 'foliage' as const },
    { geometry: createMountainRing(58, 8.4, 15.2, 19), opacity: 0.1, role: 'stone' as const },
  ], [])

  return (
    <group name="ink-wash-horizon">
      {rings.map((ring, index) => (
        <mesh geometry={ring.geometry} key={index} renderOrder={-20}>
          <SumiSurfaceMaterial
            depthWrite={false}
            opacity={ring.opacity}
            role={ring.role}
            side={THREE.BackSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  )
}
