import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { V3MaterialRequest, V3SumiMaterialAdapter } from './types'

function sculptedGroundHeight(x: number, z: number) {
  const broad = Math.sin(x * 0.23 + z * 0.11) * 0.055
    + Math.cos(z * 0.19 - x * 0.08) * 0.035
  const outerBank = THREE.MathUtils.smoothstep(Math.abs(x), 9, 18) * 0.34
  const thresholdLift = THREE.MathUtils.smoothstep(z, 6, 24) * 0.055
  return broad + outerBank + thresholdLift
}

const COURT_PATH_POINTS = [
  [0, 27],
  [0, 11.7],
  [-3.3, 4.2],
  [-7.05, -3.4],
  [7.05, -3.4],
  [9.65, -6.1],
  [12.4, -10.3],
] as const

function distanceToPathSegment(
  x: number,
  z: number,
  start: readonly [number, number],
  end: readonly [number, number],
) {
  const segmentX = end[0] - start[0]
  const segmentZ = end[1] - start[1]
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ
  const amount = lengthSquared > 0
    ? THREE.MathUtils.clamp(
      ((x - start[0]) * segmentX + (z - start[1]) * segmentZ) / lengthSquared,
      0,
      1,
    )
    : 0
  const nearestX = start[0] + segmentX * amount
  const nearestZ = start[1] + segmentZ * amount
  return Math.hypot(x - nearestX, z - nearestZ)
}

function distanceToCourtPath(x: number, z: number) {
  let distance = Number.POSITIVE_INFINITY
  for (let index = 0; index < COURT_PATH_POINTS.length - 1; index += 1) {
    distance = Math.min(
      distance,
      distanceToPathSegment(x, z, COURT_PATH_POINTS[index], COURT_PATH_POINTS[index + 1]),
    )
  }
  return distance
}

function inPond(x: number, z: number) {
  return x > -6.35 && x < 6.35 && z > -10.5 && z < 5.25
}

function createGroundCarrierGeometry() {
  const columns = 33
  const rows = 49
  const width = 72
  const depth = 68
  const minZ = -28
  const positions = new Float32Array(columns * rows * 3)
  const colors = new Float32Array(columns * rows * 4)
  const uvs = new Float32Array(columns * rows * 2)
  const indices: number[] = []

  for (let row = 0; row < rows; row += 1) {
    const v = row / (rows - 1)
    const z = minZ + v * depth
    for (let column = 0; column < columns; column += 1) {
      const u = column / (columns - 1)
      const x = (u - 0.5) * width
      const vertex = row * columns + column
      const height = sculptedGroundHeight(x, z)
      positions[vertex * 3] = x
      positions[vertex * 3 + 1] = height
      positions[vertex * 3 + 2] = z
      uvs[vertex * 2] = u
      uvs[vertex * 2 + 1] = v

      const distanceToPath = distanceToCourtPath(x, z)
      const pathAmount = 1 - THREE.MathUtils.smoothstep(distanceToPath, 1.7, 5.2)
      const pondEdge = 1 - THREE.MathUtils.smoothstep(
        Math.min(Math.abs(Math.abs(x) - 7), Math.abs(z + 10.5), Math.abs(z - 5.25)),
        0,
        2.2,
      )
      colors[vertex * 4] = THREE.MathUtils.lerp(0.68, 0.52, pathAmount)
      colors[vertex * 4 + 1] = THREE.MathUtils.clamp(0.12 + pondEdge * 0.42, 0, 1)
      colors[vertex * 4 + 2] = THREE.MathUtils.lerp(0.38, 0.24, pathAmount)
      colors[vertex * 4 + 3] = 0
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const centerU = (column + 0.5) / (columns - 1)
      const centerV = (row + 0.5) / (rows - 1)
      const centerX = (centerU - 0.5) * width
      const centerZ = minZ + centerV * depth
      if (inPond(centerX, centerZ)) continue
      const a = row * columns + column
      const b = a + 1
      const d = (row + 1) * columns + column
      const c = d + 1
      indices.push(a, d, b, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createWaterCarrierGeometry() {
  // The land mesh owns the irregular pond opening. Keeping one generous water
  // sheet underneath prevents a rectangular corner ever entering the camera.
  const geometry = new THREE.PlaneGeometry(52, 54, 52, 54)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, -0.12, -2.5)
  const position = geometry.getAttribute('position')
  const color = new Float32Array(position.count * 4)
  for (let index = 0; index < position.count; index += 1) {
    color[index * 4] = 0.42
    color[index * 4 + 1] = 0.86
    color[index * 4 + 2] = 0.16
    color[index * 4 + 3] = 0
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 4))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function supportRequest(
  mesh: THREE.Mesh,
  role: 'earth' | 'water',
): V3MaterialRequest {
  return {
    mesh,
    meshName: mesh.name,
    outlineProfile: 'none',
    role,
    sourceMaterial: null,
    sourceMaterialName: `RUNTIME_SUPPORT_${role.toUpperCase()}`,
    windResponse: 0,
  }
}

export interface V3BaseEnvironmentProps {
  materialAdapter: V3SumiMaterialAdapter
}

/**
 * Two support carriers only: a sculpted low-poly land/path mesh with a pond
 * cutout, and one subdivided water surface. They establish ground contact for
 * the authored GLB without inventing any primitive hero silhouette.
 */
export function V3BaseEnvironment({ materialAdapter }: V3BaseEnvironmentProps) {
  const ground = useRef<THREE.Mesh>(null)
  const water = useRef<THREE.Mesh>(null)
  const groundGeometry = useMemo(createGroundCarrierGeometry, [])
  const waterGeometry = useMemo(createWaterCarrierGeometry, [])

  useLayoutEffect(() => {
    if (ground.current) {
      ground.current.material = materialAdapter.resolve(supportRequest(ground.current, 'earth'))
      ground.current.visible = true
    }
    if (water.current) {
      water.current.material = materialAdapter.resolve(supportRequest(water.current, 'water'))
      water.current.visible = true
    }
  }, [materialAdapter])

  useEffect(() => () => {
    groundGeometry.dispose()
    waterGeometry.dispose()
  }, [groundGeometry, waterGeometry])

  return (
    <group name="v3-base-environment-support">
      <mesh
        castShadow={false}
        geometry={groundGeometry}
        name="V3_GroundPath_Carrier"
        receiveShadow
        ref={ground}
        visible={false}
      />
      <mesh
        castShadow={false}
        geometry={waterGeometry}
        name="V3_Water_Carrier"
        receiveShadow={false}
        ref={water}
        renderOrder={1}
        visible={false}
      />
    </group>
  )
}
