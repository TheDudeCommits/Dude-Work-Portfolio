import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ensureLivingSumiAttributes,
  LIVING_SUMI_ATTRIBUTES,
  LivingSumiMaterial,
  type LivingSumiRole,
} from '../../art/v3'

type Vector3Tuple = readonly [x: number, y: number, z: number]
type StaticRole = Extract<
  LivingSumiRole,
  'indigo' | 'stone' | 'wood' | 'vermilion' | 'washi'
>
type GeometryBuckets = Record<StaticRole, THREE.BufferGeometry[]>
type StaticGeometryBank = Record<StaticRole, THREE.BufferGeometry>
type VegetationKind = 'grass' | 'bamboo' | 'maple' | 'pine'

interface Placement {
  pitch: number
  roll: number
  scaleX: number
  scaleY: number
  scaleZ: number
  x: number
  y: number
  yaw: number
  z: number
}

interface RectZone {
  maxX: number
  maxZ: number
  minX: number
  minZ: number
  weight: number
}

const STATIC_ROLES: readonly StaticRole[] = [
  'indigo',
  'stone',
  'wood',
  'vermilion',
  'washi',
]

const PATH_POINTS: readonly Vector3Tuple[] = [
  [-6.8, 0, 28.2],
  [-4.7, 0, 23.2],
  [-2.4, 0, 17.7],
  [0, 0, 11.7],
  [4.1, 0, 6.4],
  [8.1, 0, 2.5],
  [9.4, 0, -3.4],
  [10.4, 0, -7.7],
  [13.2, 0, -13.8],
]

const LEFT_LOOP: readonly Vector3Tuple[] = [
  [0, 0, 11.7],
  [-3.3, 0, 5.8],
  [-7.8, 0, 3.4],
  [-9.4, 0, -3.4],
  [-6.7, 0, -11.4],
  [0, 0, -12.3],
]

const RIGHT_LOOP: readonly Vector3Tuple[] = [
  [0, 0, 11.7],
  [4.2, 0, 6.5],
  [8.2, 0, 2.8],
  [9.4, 0, -3.4],
  [7.1, 0, -10.7],
  [0, 0, -12.3],
]

const BRIDGE_PATH: readonly Vector3Tuple[] = [
  [-9.4, 0, -3.4],
  [9.4, 0, -3.4],
]

// The scripted camera is itself a walkable corridor. Vegetation may frame it,
// but trunks and broad crowns must never occupy it; otherwise a scroll beat can
// land inside a tree even when the visible stepping path remains clear.
const CAMERA_RAIL_PATH: readonly Vector3Tuple[] = [
  [-6.8, 0, 27.8],
  [3.9, 0, 22.2],
  [-1.4, 0, 17.3],
  [-2.1, 0, 10.8],
  [-4.9, 0, 6.4],
  [-10.5, 0, 0.8],
  [-7.05, 0, -3.4],
  [0, 0, -3.4],
  [13.8, 0, -5.2],
  [15, 0, 1.4],
]

const PROJECT_CLEARINGS = [
  [7.2, 17.3, 2.35],
  [-10.2, 7.8, 2.2],
  [-5.2, 0.9, 2.05],
  [-11.5, -8.8, 2.1],
  [0, -9.35, 2.3],
  [8.8, -13.05, 2.1],
  [14, -8.4, 2.35],
  [11.2, 12, 2.2],
  [7.8, 8.5, 2.15],
] as const

const GRASS_ZONES: readonly RectZone[] = [
  // A close, asymmetric verge gives the arrival shot a real foreground plane
  // instead of reading as an empty procedural floor. The rail exclusion still
  // keeps a clean walking lane through its centre.
  { minX: -11.2, maxX: 2.2, minZ: 20, maxZ: 27.4, weight: 2.6 },
  { minX: -17.2, maxX: -8.5, minZ: 9, maxZ: 29.6, weight: 1.45 },
  { minX: 2.8, maxX: 17.2, minZ: 8, maxZ: 29.6, weight: 1.65 },
  { minX: -17.2, maxX: -6.4, minZ: -11.4, maxZ: 7.4, weight: 1.1 },
  { minX: 6.4, maxX: 17.2, minZ: -11.4, maxZ: 7.4, weight: 1.2 },
  { minX: -17.2, maxX: 17.2, minZ: -15.2, maxZ: -10.7, weight: 0.8 },
]

const BAMBOO_ZONES: readonly RectZone[] = [
  { minX: -16.4, maxX: -11.2, minZ: 11, maxZ: 25.5, weight: 1.2 },
  { minX: 12.2, maxX: 16.8, minZ: -6.5, maxZ: 4.8, weight: 1.25 },
  { minX: -16.2, maxX: -11.5, minZ: -11.5, maxZ: 4, weight: 0.7 },
]

const MAPLE_ZONES: readonly RectZone[] = [
  { minX: 12.3, maxX: 17.1, minZ: 8.6, maxZ: 23.8, weight: 2.4 },
  { minX: 10.2, maxX: 17.1, minZ: -15.1, maxZ: -10.7, weight: 1.05 },
  { minX: -16.1, maxX: -12, minZ: -12.8, maxZ: -3.5, weight: 0.42 },
]

const PINE_ZONES: readonly RectZone[] = [
  { minX: -17, maxX: -11.3, minZ: 13, maxZ: 29.2, weight: 1.8 },
  { minX: -16.8, maxX: -11.2, minZ: -12.5, maxZ: 9, weight: 1.05 },
  { minX: 11.4, maxX: 17.1, minZ: -15.2, maxZ: -10.5, weight: 1.2 },
  { minX: 13.5, maxX: 17.1, minZ: 1, maxZ: 8.5, weight: 0.55 },
]

function hash01(index: number, salt: number) {
  const value = Math.sin(index * 91.3458 + salt * 37.719) * 47453.5453
  return value - Math.floor(value)
}

function stripAndBake(
  source: THREE.BufferGeometry,
  position: Vector3Tuple = [0, 0, 0],
  rotation: Vector3Tuple = [0, 0, 0],
  scale: Vector3Tuple = [1, 1, 1],
) {
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  source.dispose()
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position') geometry.deleteAttribute(name)
  }
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  ))
  geometry.computeVertexNormals()
  return geometry
}

function addGeometry(
  buckets: GeometryBuckets,
  role: StaticRole,
  geometry: THREE.BufferGeometry,
  position: Vector3Tuple = [0, 0, 0],
  rotation: Vector3Tuple = [0, 0, 0],
  scale: Vector3Tuple = [1, 1, 1],
) {
  buckets[role].push(stripAndBake(geometry, position, rotation, scale))
}

function mergeLocal(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  if (!geometry) throw new Error('Unable to merge procedural garden geometry')
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createMoundGeometry(seed: number, radialSegments = 12, rings = 5) {
  const positions: number[] = []
  const indices: number[] = []

  for (let ring = 0; ring <= rings; ring += 1) {
    const amount = ring / rings
    const ringScale = Math.max(0.035, Math.cos(amount * Math.PI * 0.5))
    const y = Math.sin(amount * Math.PI * 0.5)
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = segment / radialSegments * Math.PI * 2
      const irregularity = 1
        + Math.sin(angle * 3 + seed) * 0.075
        + Math.sin(angle * 5 - seed * 0.6) * 0.035
      positions.push(
        Math.cos(angle) * ringScale * irregularity,
        y,
        Math.sin(angle) * ringScale * irregularity,
      )
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments
      const a = ring * radialSegments + segment
      const b = ring * radialSegments + next
      const c = (ring + 1) * radialSegments + segment
      const d = (ring + 1) * radialSegments + next
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRidgeGeometry(width: number, depth: number, height: number, seed: number) {
  const segments = 14
  const positions: number[] = []
  const indices: number[] = []

  for (let segment = 0; segment <= segments; segment += 1) {
    const amount = segment / segments
    const x = (amount - 0.5) * width
    const taper = Math.sin(amount * Math.PI) * 0.34 + 0.66
    const top = height * taper
      + Math.sin(segment * 1.71 + seed) * height * 0.12
      + Math.sin(segment * 0.63 - seed) * height * 0.08
    positions.push(
      x, -0.4, depth * 0.5,
      x, top, depth * 0.5,
      x, -0.4, -depth * 0.5,
      x, top * 0.94, -depth * 0.5,
    )
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const base = segment * 4
    const next = base + 4
    indices.push(
      base, next, base + 1,
      base + 1, next, next + 1,
      base + 2, base + 3, next + 2,
      base + 3, next + 3, next + 2,
      base + 1, next + 1, base + 3,
      base + 3, next + 1, next + 3,
      base, base + 2, next,
      base + 2, next + 2, next,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRoofGeometry(
  width: number,
  depth: number,
  height: number,
  thickness: number,
) {
  const xSegments = 8
  const zSegments = 2
  const positions: number[] = []
  const indices: number[] = []

  const surfaceVertex = (underside: boolean, zIndex: number, xIndex: number) => {
    const xAmount = xIndex / xSegments
    const zAmount = zIndex / zSegments
    const x = (xAmount - 0.5) * width
    const z = (zAmount - 0.5) * depth
    const across = Math.abs(xAmount - 0.5) * 2
    const fromRidge = Math.abs(zAmount - 0.5) * 2
    const cornerLift = Math.pow(across, 3.2) * (0.28 + fromRidge * 0.28)
    const ridgeLift = (1 - fromRidge) * height
    const softSag = -Math.sin(xAmount * Math.PI) * fromRidge * 0.11
    positions.push(x, ridgeLift + cornerLift + softSag - (underside ? thickness : 0), z)
  }

  for (let side = 0; side < 2; side += 1) {
    for (let zIndex = 0; zIndex <= zSegments; zIndex += 1) {
      for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
        surfaceVertex(side === 1, zIndex, xIndex)
      }
    }
  }

  const stride = xSegments + 1
  const surfaceCount = stride * (zSegments + 1)
  for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
      const a = zIndex * stride + xIndex
      const b = a + 1
      const c = a + stride
      const d = c + 1
      indices.push(a, c, b, b, c, d)

      const underside = surfaceCount
      indices.push(
        underside + a,
        underside + b,
        underside + c,
        underside + b,
        underside + d,
        underside + c,
      )
    }
  }

  const connectEdge = (topA: number, topB: number) => {
    const bottomA = topA + surfaceCount
    const bottomB = topB + surfaceCount
    indices.push(topA, bottomA, topB, topB, bottomA, bottomB)
  }

  for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
    connectEdge(xIndex, xIndex + 1)
    const back = zSegments * stride + xIndex
    connectEdge(back + 1, back)
  }
  for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
    connectEdge(zIndex * stride, (zIndex + 1) * stride)
    connectEdge((zIndex + 2) * stride - 1, (zIndex + 1) * stride - 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRockGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 1)
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const noise = 0.86
      + hash01(index, seed) * 0.22
      + Math.sin(x * 4.1 + z * 3.7 + seed) * 0.045
    position.setXYZ(index, x * noise, y * noise, z * noise)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function addSteppingPath(
  buckets: GeometryBuckets,
  points: readonly Vector3Tuple[],
  spacing: number,
  width: number,
  salt: number,
) {
  let stoneIndex = 0
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const start = points[segment]
    const end = points[segment + 1]
    const distance = Math.hypot(end[0] - start[0], end[2] - start[2])
    const count = Math.max(1, Math.floor(distance / spacing))
    for (let index = 0; index < count; index += 1) {
      const amount = (index + 0.5) / count
      const jitter = (hash01(stoneIndex, salt) - 0.5) * 0.22
      const x = THREE.MathUtils.lerp(start[0], end[0], amount)
        + (end[2] - start[2]) / distance * jitter
      const z = THREE.MathUtils.lerp(start[2], end[2], amount)
        - (end[0] - start[0]) / distance * jitter
      const scale = 0.82 + hash01(stoneIndex, salt + 1.7) * 0.26
      addGeometry(
        buckets,
        'stone',
        new THREE.CylinderGeometry(1, 1.06, 0.105, 7, 1),
        [x, roomGroundHeight(x, z) + 0.062, z],
        [0, hash01(stoneIndex, salt + 3.2) * Math.PI, 0],
        [width * scale, 1, width * (0.56 + hash01(stoneIndex, salt + 5.3) * 0.16)],
      )
      stoneIndex += 1
    }
  }
}

function addLantern(buckets: GeometryBuckets, position: Vector3Tuple, scale = 1) {
  const [x, y, z] = position
  addGeometry(
    buckets,
    'stone',
    new THREE.CylinderGeometry(0.38, 0.52, 0.23, 7),
    [x, y + 0.115 * scale, z],
    [0, 0, 0],
    [scale, scale, scale],
  )
  addGeometry(
    buckets,
    'wood',
    new THREE.CylinderGeometry(0.07, 0.105, 1.42, 6),
    [x, y + 0.86 * scale, z],
    [0, 0, 0],
    [scale, scale, scale],
  )
  addGeometry(
    buckets,
    'washi',
    new THREE.BoxGeometry(0.52, 0.54, 0.52),
    [x, y + 1.68 * scale, z],
    [0, Math.PI * 0.25, 0],
    [scale, scale, scale],
  )
  for (const vertical of [-1, 1]) {
    for (const horizontal of [-1, 1]) {
      addGeometry(
        buckets,
        'wood',
        new THREE.BoxGeometry(0.045, 0.65, 0.045),
        [
          x + vertical * 0.27 * scale,
          y + 1.68 * scale,
          z + horizontal * 0.27 * scale,
        ],
        [0, Math.PI * 0.25, 0],
        [scale, scale, scale],
      )
    }
  }
  for (const lift of [1.37, 1.99]) {
    addGeometry(
      buckets,
      'wood',
      new THREE.BoxGeometry(0.68, 0.075, 0.68),
      [x, y + lift * scale, z],
      [0, Math.PI * 0.25, 0],
      [scale, scale, scale],
    )
  }
  addGeometry(
    buckets,
    'indigo',
    new THREE.CylinderGeometry(0.38, 0.64, 0.22, 4),
    [x, y + 2.14 * scale, z],
    [0, Math.PI * 0.25, 0],
    [scale, scale, scale],
  )
}

function addTemple(buckets: GeometryBuckets) {
  const centerX = 13.2
  const centerZ = -16.75
  const ground = roomGroundHeight(centerX, centerZ)

  addGeometry(
    buckets,
    'stone',
    new THREE.BoxGeometry(8.4, 0.34, 4.35),
    [centerX, ground + 0.14, centerZ],
  )
  for (let step = 0; step < 4; step += 1) {
    addGeometry(
      buckets,
      'stone',
      new THREE.BoxGeometry(3.9 - step * 0.32, 0.105, 0.68),
      [
        centerX,
        roomGroundHeight(centerX, -14.32 - step * 0.48) + 0.075 + step * 0.018,
        -14.32 - step * 0.48,
      ],
    )
  }

  const frontZ = -14.95
  const backZ = -18.25
  for (const x of [9.9, 12.1, 14.3, 16.5]) {
    addGeometry(
      buckets,
      x === 9.9 || x === 16.5 ? 'vermilion' : 'wood',
      new THREE.CylinderGeometry(0.15, 0.2, 3.7, 7),
      [x, ground + 2.04, frontZ],
    )
    addGeometry(
      buckets,
      'wood',
      new THREE.CylinderGeometry(0.14, 0.19, 3.4, 7),
      [x, ground + 1.9, backZ],
    )
  }
  addGeometry(
    buckets,
    'vermilion',
    new THREE.BoxGeometry(8.3, 0.28, 0.32),
    [centerX, ground + 3.58, frontZ],
  )
  addGeometry(
    buckets,
    'wood',
    new THREE.BoxGeometry(7.7, 0.22, 0.24),
    [centerX, ground + 2.86, frontZ + 0.04],
  )

  for (let panel = 0; panel < 4; panel += 1) {
    addGeometry(
      buckets,
      'washi',
      new THREE.BoxGeometry(1.42, 1.46, 0.085),
      [9.92 + panel * 2.18, ground + 1.82, frontZ - 0.12],
    )
  }

  addGeometry(
    buckets,
    'indigo',
    createRoofGeometry(9.6, 5.05, 1.08, 0.24),
    [centerX, ground + 3.96, centerZ],
  )
  addGeometry(
    buckets,
    'vermilion',
    new THREE.BoxGeometry(5.5, 0.23, 2.65),
    [centerX, ground + 5.2, centerZ],
  )
  for (const x of [11.1, 15.3]) {
    for (const z of [-16.1, -17.35]) {
      addGeometry(
        buckets,
        'wood',
        new THREE.CylinderGeometry(0.12, 0.15, 1.55, 6),
        [x, ground + 5.75, z],
      )
    }
  }
  addGeometry(
    buckets,
    'indigo',
    createRoofGeometry(6.45, 3.45, 0.84, 0.2),
    [centerX, ground + 6.32, centerZ],
  )
  addGeometry(
    buckets,
    'wood',
    new THREE.BoxGeometry(0.18, 1.15, 0.18),
    [centerX, ground + 7.25, centerZ],
  )
  addGeometry(
    buckets,
    'indigo',
    new THREE.CylinderGeometry(0.04, 0.34, 0.56, 5),
    [centerX, ground + 7.72, centerZ],
  )
}

function addTeaCourt(buckets: GeometryBuckets) {
  const centerX = 12
  const centerZ = -1.2
  const ground = roomGroundHeight(centerX, centerZ)
  addGeometry(
    buckets,
    'stone',
    new THREE.CylinderGeometry(2.15, 2.35, 0.18, 9),
    [centerX, ground + 0.06, centerZ],
    [0, 0.18, 0],
    [1, 1, 0.72],
  )
  for (const x of [10.45, 13.55]) {
    for (const z of [-2.05, -0.35]) {
      addGeometry(
        buckets,
        'wood',
        new THREE.CylinderGeometry(0.11, 0.15, 2.65, 6),
        [x, ground + 1.46, z],
      )
    }
  }
  addGeometry(
    buckets,
    'indigo',
    createRoofGeometry(4.25, 3.2, 0.62, 0.16),
    [centerX, ground + 2.7, centerZ - 0.06],
  )
  addGeometry(
    buckets,
    'washi',
    new THREE.BoxGeometry(2.65, 1.4, 0.075),
    [centerX, ground + 1.5, centerZ - 1.12],
  )
  addGeometry(
    buckets,
    'wood',
    new THREE.BoxGeometry(2.35, 0.17, 0.64),
    [centerX - 0.2, ground + 0.58, centerZ + 0.35],
  )
}

function createStaticRoomGeometries(): StaticGeometryBank {
  const buckets: GeometryBuckets = {
    indigo: [],
    stone: [],
    wood: [],
    vermilion: [],
    washi: [],
  }

  // Overlapping raised banks turn each threshold into a dark foreground mass;
  // the shared earth carrier remains the continuous walkable floor below.
  const mounds = [
    [-14.7, 0, 25, 5.2, 1.25, 6.6, 1.2],
    [5.8, 0, 25.2, 8.6, 0.94, 5.5, 2.7],
    [-14.3, 0, 17.2, 5.4, 1.45, 6.4, 4.2],
    [15.1, 0, 17.7, 3.6, 1.7, 6.9, 6.5],
    [-14.4, 0, 7.1, 5.2, 1.75, 7.1, 8.9],
    [19, 0, 4.9, 3.1, 1.82, 6.1, 9.7],
    [-14.7, 0, -4.7, 5.4, 1.55, 6.2, 12.4],
    [19.2, 0, -4.7, 2.8, 1.82, 5.9, 15.8],
    [-15.3, 0, -14.5, 4.4, 2.25, 4.5, 18.1],
    [3.2, 0, -18.1, 8.2, 2.05, 3.25, 20.6],
    [19, 0, -18, 3.5, 2.7, 3.4, 23.8],
  ] as const
  mounds.forEach(([x, y, z, scaleX, scaleY, scaleZ, seed]) => {
    addGeometry(
      buckets,
      'indigo',
      createMoundGeometry(seed),
      [x, y + roomGroundHeight(x, z) - 0.035, z],
      [0, hash01(Math.round(seed * 10), 2.9) * Math.PI, 0],
      [scaleX, scaleY, scaleZ],
    )
  })

  addGeometry(
    buckets,
    'indigo',
    createRidgeGeometry(24, 3.4, 5.8, 4.8),
    [-7.5, roomGroundHeight(-7.5, -19.4) - 0.15, -19.4],
  )
  addGeometry(
    buckets,
    'indigo',
    createRidgeGeometry(17, 3.1, 7.1, 9.2),
    [12.7, roomGroundHeight(12.7, -20.1) - 0.2, -20.1],
  )
  addGeometry(
    buckets,
    'indigo',
    createRidgeGeometry(14, 3.8, 4.8, 12.7),
    [-20.1, roomGroundHeight(-20.1, 5.5) - 0.2, 5.5],
    [0, Math.PI * 0.5, 0],
  )

  addSteppingPath(buckets, PATH_POINTS, 1.28, 0.72, 7.1)
  addSteppingPath(buckets, LEFT_LOOP, 1.32, 0.68, 11.4)
  addSteppingPath(buckets, RIGHT_LOOP, 1.34, 0.67, 15.2)

  const courtRocks = [
    [10.4, 0.62, -6.55, 0.72, 1.35, 0.64, 3.1],
    [16.2, 0.78, -5.1, 0.94, 1.62, 0.76, 5.4],
    [8.2, 0.55, -8.7, 0.66, 1.08, 0.7, 7.7],
    [16.1, 0.63, -11.7, 0.78, 1.28, 0.72, 9.6],
    [4.9, 0.48, 6.3, 0.62, 0.92, 0.58, 13.2],
    [-12.9, 0.57, 1.8, 0.72, 1.18, 0.64, 16.8],
  ] as const
  courtRocks.forEach(([x, y, z, scaleX, scaleY, scaleZ, seed]) => {
    addGeometry(
      buckets,
      'stone',
      createRockGeometry(seed),
      [x, y + roomGroundHeight(x, z), z],
      [0.12, seed * 0.37, -0.08],
      [scaleX, scaleY, scaleZ],
    )
  })

  const lanterns = [
    [-8.2, 0, 21.7, 1.02],
    [0.25, 0, 20.6, 1.02],
    [-4.25, 0, 9.5, 1.06],
    [4.3, 0, 9.25, 1.06],
    [-9.2, 0, 0.05, 0.96],
    [9.15, 0, 0.05, 0.96],
    [-9.05, 0, -6.7, 0.94],
    [9.35, 0, -7.2, 0.94],
    [10.05, 0, -13.65, 1.04],
    [16.35, 0, -13.55, 1.04],
  ] as const
  lanterns.forEach(([x, y, z, scale]) => {
    addLantern(buckets, [x, y + roomGroundHeight(x, z) - 0.025, z], scale)
  })

  addTeaCourt(buckets)
  addTemple(buckets)

  return STATIC_ROLES.reduce<StaticGeometryBank>((bank, role) => {
    const merged = mergeGeometries(buckets[role], false)
    buckets[role].forEach((part) => part.dispose())
    if (!merged) throw new Error(`Unable to build ${role} garden room geometry`)
    ensureLivingSumiAttributes(merged, {
      dryness: role === 'stone' ? 0.84 : role === 'washi' ? 0.28 : 0.58,
      pigment: role === 'indigo' || role === 'wood' ? 0.92 : 0.8,
      stroke: role === 'washi' ? [0.62, 0.78] : [0.94, 0.34],
      wetness: role === 'indigo' ? 0.36 : role === 'vermilion' ? 0.3 : 0.14,
      wind: 0,
    })
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    bank[role] = merged
    return bank
  }, {} as StaticGeometryBank)
}

function addRibbonBlade(
  positions: number[],
  indices: number[],
  offsetX: number,
  offsetZ: number,
  angle: number,
  height: number,
  width: number,
  lean: number,
) {
  const start = positions.length / 3
  const levels = 5
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  for (let level = 0; level < levels; level += 1) {
    const amount = level / (levels - 1)
    const halfWidth = width * (1 - Math.pow(amount, 1.42)) + 0.006
    const center = Math.sin(amount * Math.PI * 0.5) * lean
    const x = offsetX + sin * center
    const z = offsetZ + cos * center
    positions.push(
      x - cos * halfWidth, amount * height, z + sin * halfWidth,
      x + cos * halfWidth, amount * height, z - sin * halfWidth,
    )
    if (level < levels - 1) {
      const vertex = start + level * 2
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3)
    }
  }
}

function addFernFrond(
  positions: number[],
  indices: number[],
  angle: number,
  height: number,
) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const baseX = cos * 0.05
  const baseZ = sin * 0.05
  const sections = 5
  for (let section = 1; section <= sections; section += 1) {
    const amount = section / (sections + 0.8)
    const centerX = baseX + cos * amount * height * 0.34
    const centerY = amount * height
    const centerZ = baseZ + sin * amount * height * 0.34
    const leafLength = (1 - amount * 0.72) * 0.24
    for (const side of [-1, 1]) {
      const tangentX = -sin * side
      const tangentZ = cos * side
      const start = positions.length / 3
      positions.push(
        centerX - tangentX * 0.025,
        centerY - 0.035,
        centerZ - tangentZ * 0.025,
        centerX + tangentX * leafLength,
        centerY + 0.025,
        centerZ + tangentZ * leafLength,
        centerX + tangentX * 0.025,
        centerY + 0.09,
        centerZ + tangentZ * 0.025,
      )
      indices.push(start, start + 1, start + 2)
    }
  }
}

function paintVegetationMasks(
  geometry: THREE.BufferGeometry,
  kind: VegetationKind,
) {
  ensureLivingSumiAttributes(geometry, {
    dryness: kind === 'maple' ? 0.72 : 0.48,
    pigment: kind === 'maple' ? 0.94 : 0.86,
    stroke: kind === 'grass' ? [0.34, 0.94] : [0.76, 0.65],
    wetness: kind === 'grass' ? 0.28 : 0.22,
    wind: 0,
  })
  geometry.computeBoundingBox()
  const position = geometry.getAttribute('position')
  const bounds = geometry.boundingBox
  const minimumY = bounds?.min.y ?? 0
  const maximumY = bounds?.max.y ?? 1
  const height = Math.max(0.001, maximumY - minimumY)
  const wind = new Float32Array(position.count)
  const dryness = new Float32Array(position.count)
  const wetness = new Float32Array(position.count)

  for (let index = 0; index < position.count; index += 1) {
    const amount = THREE.MathUtils.clamp((position.getY(index) - minimumY) / height, 0, 1)
    const anchored = THREE.MathUtils.smoothstep(amount, kind === 'grass' ? 0.08 : 0.22, 1)
    wind[index] = anchored * anchored
    dryness[index] = THREE.MathUtils.clamp(
      (kind === 'maple' ? 0.54 : 0.36) + amount * (kind === 'maple' ? 0.38 : 0.34),
      0,
      1,
    )
    wetness[index] = THREE.MathUtils.clamp(0.32 - amount * 0.18, 0, 1)
  }

  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.wind,
    new THREE.Float32BufferAttribute(wind, 1).setUsage(THREE.StaticDrawUsage),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.dryness,
    new THREE.Float32BufferAttribute(dryness, 1).setUsage(THREE.StaticDrawUsage),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.wetness,
    new THREE.Float32BufferAttribute(wetness, 1).setUsage(THREE.StaticDrawUsage),
  )
  geometry.computeBoundingSphere()
  return geometry
}

function createGrassFernClumpGeometry() {
  const positions: number[] = []
  const indices: number[] = []
  for (let blade = 0; blade < 9; blade += 1) {
    const angle = blade / 9 * Math.PI * 2 + (blade % 2) * 0.23
    const radius = blade % 3 === 0 ? 0.2 : 0.1
    addRibbonBlade(
      positions,
      indices,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      angle,
      0.72 + (blade % 4) * 0.14,
      0.045 + (blade % 3) * 0.012,
      0.12 + (blade % 2) * 0.1,
    )
  }
  for (let frond = 0; frond < 3; frond += 1) {
    addFernFrond(positions, indices, frond / 3 * Math.PI * 2 + 0.48, 0.82 + frond * 0.08)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return paintVegetationMasks(geometry, 'grass')
}

function createLeafGeometry(length: number, width: number) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    -width, length * 0.43, 0,
    0, length, 0.025,
    width, length * 0.43, 0,
  ], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeVertexNormals()
  return geometry
}

function createBambooClumpGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const stalks = [
    [-0.22, 0.03, 2.85, -0.06],
    [0.08, -0.12, 3.35, 0.035],
    [0.28, 0.11, 2.55, 0.08],
  ] as const
  stalks.forEach(([x, z, height, lean], stalkIndex) => {
    parts.push(stripAndBake(
      new THREE.CylinderGeometry(0.045, 0.068, height, 5, 4),
      [x + lean * 0.45, height * 0.5, z],
      [0, 0, lean],
    ))
    for (let leaf = 0; leaf < 4; leaf += 1) {
      const angle = stalkIndex * 1.8 + leaf * 1.45
      const y = height * (0.48 + leaf * 0.115)
      parts.push(stripAndBake(
        createLeafGeometry(0.62 - leaf * 0.04, 0.115),
        [x, y, z],
        [0.3 + leaf * 0.08, angle, (leaf % 2 === 0 ? 1 : -1) * 0.72],
      ))
    }
  })
  return paintVegetationMasks(mergeLocal(parts), 'bamboo')
}

function createMapleTreeGeometry() {
  const parts: THREE.BufferGeometry[] = []
  parts.push(stripAndBake(
    new THREE.CylinderGeometry(0.095, 0.2, 2.85, 6),
    [0, 1.4, 0],
    [0, 0, -0.07],
  ))
  const branches = [
    [-0.42, 2.45, 0.04, -0.72],
    [0.5, 2.35, -0.08, 0.78],
    [0.12, 2.82, 0.12, 0.28],
  ] as const
  branches.forEach(([x, y, z, rotation]) => {
    parts.push(stripAndBake(
      new THREE.CylinderGeometry(0.055, 0.095, 1.28, 5),
      [x, y, z],
      [0, 0, rotation],
    ))
  })
  const crowns = [
    [-0.78, 3.05, 0.02, 0.9, 0.52, 0.7],
    [-0.24, 3.52, -0.12, 1.08, 0.64, 0.78],
    [0.5, 3.35, 0.02, 1.1, 0.58, 0.76],
    [0.95, 3.02, -0.08, 0.8, 0.46, 0.65],
    [-0.58, 3.78, 0.2, 0.74, 0.44, 0.7],
    [0.2, 4.08, 0.12, 0.86, 0.46, 0.72],
    [0.72, 3.82, -0.25, 0.72, 0.42, 0.64],
    [0, 3.2, 0.48, 0.76, 0.45, 0.66],
  ] as const
  crowns.forEach(([x, y, z, scaleX, scaleY, scaleZ], crownIndex) => {
    // Airy overlapping leaf strokes read as painted maple boughs from both
    // near and far, avoiding the faceted red-sphere silhouette of a stock
    // low-poly tree crown.
    for (let leaf = 0; leaf < 5; leaf += 1) {
      const angle = crownIndex * 0.91 + leaf * 1.257
      const spread = 0.22 + (leaf % 3) * 0.1
      parts.push(stripAndBake(
        createLeafGeometry(0.68 + scaleX * 0.22, 0.2 + scaleZ * 0.09),
        [
          x + Math.cos(angle) * spread * scaleX,
          y + (leaf % 2 === 0 ? -0.2 : 0.06) * scaleY,
          z + Math.sin(angle) * spread * scaleZ,
        ],
        [0.32 + (leaf % 3) * 0.17, angle, (leaf % 2 === 0 ? -1 : 1) * (0.58 + crownIndex * 0.035)],
      ))
    }
  })
  return paintVegetationMasks(mergeLocal(parts), 'maple')
}

function createPineTreeGeometry() {
  const parts: THREE.BufferGeometry[] = []
  parts.push(stripAndBake(
    new THREE.CylinderGeometry(0.12, 0.27, 5.2, 7),
    [0, 2.52, 0],
    [0, 0, 0.055],
  ))
  const pads = [
    [-0.55, 2.35, 0.1, 1.45, 0.32, 0.82],
    [0.58, 3.05, -0.12, 1.65, 0.36, 0.92],
    [-0.34, 3.78, 0.08, 1.34, 0.31, 0.78],
    [0.32, 4.42, -0.04, 1.12, 0.3, 0.7],
    [-0.08, 4.93, 0.05, 0.78, 0.27, 0.56],
  ] as const
  pads.forEach(([x, y, z, scaleX, scaleY, scaleZ], index) => {
    parts.push(stripAndBake(
      new THREE.IcosahedronGeometry(1, 1),
      [x, y, z],
      [index * 0.13, index * 0.47, index * 0.08],
      [scaleX, scaleY, scaleZ],
    ))
  })
  return paintVegetationMasks(mergeLocal(parts), 'pine')
}

function distanceToSegment(
  x: number,
  z: number,
  start: Vector3Tuple,
  end: Vector3Tuple,
) {
  const segmentX = end[0] - start[0]
  const segmentZ = end[2] - start[2]
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ
  const amount = lengthSquared > 0
    ? THREE.MathUtils.clamp(
      ((x - start[0]) * segmentX + (z - start[2]) * segmentZ) / lengthSquared,
      0,
      1,
    )
    : 0
  return Math.hypot(
    x - THREE.MathUtils.lerp(start[0], end[0], amount),
    z - THREE.MathUtils.lerp(start[2], end[2], amount),
  )
}

function pathDistance(x: number, z: number, path: readonly Vector3Tuple[]) {
  let distance = Number.POSITIVE_INFINITY
  for (let index = 0; index < path.length - 1; index += 1) {
    distance = Math.min(distance, distanceToSegment(x, z, path[index], path[index + 1]))
  }
  return distance
}

function excludedFromVegetation(x: number, z: number, kind: VegetationKind) {
  const clearance = kind === 'grass' ? 1.15 : kind === 'maple' ? 2.35 : 2
  const cameraClearance = kind === 'grass' ? 2.25 : kind === 'bamboo' ? 4.4 : 5.4
  if (pathDistance(x, z, CAMERA_RAIL_PATH) < cameraClearance) return true
  if (pathDistance(x, z, PATH_POINTS) < clearance) return true
  if (pathDistance(x, z, LEFT_LOOP) < clearance) return true
  if (pathDistance(x, z, RIGHT_LOOP) < clearance) return true
  if (pathDistance(x, z, BRIDGE_PATH) < clearance + 0.35) return true
  if (Math.hypot(x + 6.8, z - 28.2) < 3.2) return true
  if (Math.hypot(x, z - 11.7) < (kind === 'grass' ? 3.3 : 4.2)) return true
  if (Math.abs(x) < 6.25 && z > -10.5 && z < 5.45) return true
  if (kind !== 'grass' && x > 9 && z < -14.15) return true
  if (kind !== 'grass' && x > 9.3 && x < 14.7 && z > -2.85 && z < 0.65) return true
  for (const [projectX, projectZ, radius] of PROJECT_CLEARINGS) {
    if (Math.hypot(x - projectX, z - projectZ) < radius + (kind === 'grass' ? 0 : 0.75)) {
      return true
    }
  }
  return false
}

function chooseZone(index: number, zones: readonly RectZone[], salt: number) {
  const total = zones.reduce((sum, zone) => sum + zone.weight, 0)
  let cursor = hash01(index, salt) * total
  for (const zone of zones) {
    cursor -= zone.weight
    if (cursor <= 0) return zone
  }
  return zones[zones.length - 1]
}

function roomGroundHeight(x: number, z: number) {
  const broad = Math.sin(x * 0.19 + z * 0.12) * 0.075
    + Math.cos(z * 0.17 - x * 0.09) * 0.052
  const sideBank = THREE.MathUtils.smoothstep(Math.abs(x), 7.5, 18) * 0.28
  const arrivalBank = THREE.MathUtils.smoothstep(z, 8, 29) * 0.12
  const farBank = (1 - THREE.MathUtils.smoothstep(z, -25, -12)) * 0.18
  const pathHollow = Math.exp(-((x / 3.4) ** 2))
    * THREE.MathUtils.smoothstep(z, 7, 26)
    * 0.06
  const westCourt = Math.exp(-(((x + 10.4) / 5.6) ** 2 + ((z + 7.4) / 7.5) ** 2)) * 0.08
  const eastGrove = Math.exp(-(((x - 12.2) / 6.8) ** 2 + ((z + 8.8) / 7.8) ** 2)) * 0.1
  return broad + sideBank + arrivalBank + farBank + westCourt + eastGrove - pathHollow
}

function createPlacements(
  count: number,
  kind: VegetationKind,
  zones: readonly RectZone[],
) {
  const placements: Placement[] = []
  const salt = kind === 'grass' ? 11.7 : kind === 'bamboo' ? 23.9 : kind === 'maple' ? 37.3 : 49.1

  for (let candidate = 0; placements.length < count && candidate < count * 120; candidate += 1) {
    const zone = chooseZone(candidate, zones, salt)
    const x = THREE.MathUtils.lerp(zone.minX, zone.maxX, hash01(candidate, salt + 1.4))
    const z = THREE.MathUtils.lerp(zone.minZ, zone.maxZ, hash01(candidate, salt + 2.8))
    if (excludedFromVegetation(x, z, kind)) continue

    const scaleSeed = hash01(candidate, salt + 4.2)
    const scale = kind === 'grass'
      ? 0.72 + scaleSeed * 0.82
      : kind === 'bamboo'
        ? 0.78 + scaleSeed * 0.54
        : kind === 'maple'
          ? 0.86 + scaleSeed * 0.7
          : 0.92 + scaleSeed * 0.68
    const widthVariation = 0.84 + hash01(candidate, salt + 5.9) * 0.34
    placements.push({
      pitch: (hash01(candidate, salt + 7.2) - 0.5) * (kind === 'grass' ? 0.28 : 0.08),
      roll: (hash01(candidate, salt + 8.6) - 0.5) * (kind === 'grass' ? 0.32 : 0.1),
      scaleX: scale * widthVariation,
      scaleY: scale * (0.9 + hash01(candidate, salt + 10.1) * 0.22),
      scaleZ: scale * (1.12 - (widthVariation - 0.84) * 0.35),
      x,
      y: roomGroundHeight(x, z) - 0.025,
      yaw: hash01(candidate, salt + 11.9) * Math.PI * 2,
      z,
    })
  }

  return placements
}

function geometryForKind(kind: VegetationKind) {
  if (kind === 'grass') return createGrassFernClumpGeometry()
  if (kind === 'bamboo') return createBambooClumpGeometry()
  if (kind === 'maple') return createMapleTreeGeometry()
  return createPineTreeGeometry()
}

function zonesForKind(kind: VegetationKind) {
  if (kind === 'grass') return GRASS_ZONES
  if (kind === 'bamboo') return BAMBOO_ZONES
  if (kind === 'maple') return MAPLE_ZONES
  return PINE_ZONES
}

interface VegetationBatchProps {
  compact: boolean
  kind: VegetationKind
  reducedMotion: boolean
}

function VegetationBatch({ compact, kind, reducedMotion }: VegetationBatchProps) {
  const count = kind === 'grass'
    ? compact ? 110 : 260
    : kind === 'bamboo'
      ? compact ? 11 : 24
      : kind === 'maple'
        ? compact ? 15 : 30
        : compact ? 9 : 17
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => geometryForKind(kind), [kind])
  const placements = useMemo(
    () => createPlacements(count, kind, zonesForKind(kind)),
    [count, kind],
  )
  const transform = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const instance = mesh.current
    if (!instance) return
    instance.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    placements.forEach((placement, index) => {
      transform.position.set(placement.x, placement.y, placement.z)
      transform.rotation.set(placement.pitch, placement.yaw, placement.roll)
      transform.scale.set(placement.scaleX, placement.scaleY, placement.scaleZ)
      transform.updateMatrix()
      instance.setMatrixAt(index, transform.matrix)
    })
    instance.instanceMatrix.needsUpdate = true
    instance.computeBoundingBox()
    instance.computeBoundingSphere()
  }, [placements, transform])

  useEffect(() => () => geometry.dispose(), [geometry])

  const role = kind === 'maple' ? 'vermilion' : 'pine'
  const windResponse = reducedMotion
    ? 0
    : kind === 'grass'
      ? 0.5
      : kind === 'bamboo'
        ? 0.28
        : kind === 'maple'
          ? 0.2
          : 0.12

  return (
    <instancedMesh
      args={[geometry, undefined, count]}
      castShadow={false}
      count={count}
      frustumCulled
      name={`V3_GardenRooms_${kind}`}
      receiveShadow={false}
      ref={mesh}
    >
      <LivingSumiMaterial
        alphaFeather={0}
        brushScale={kind === 'grass' ? 0.51 : kind === 'maple' ? 0.67 : 0.72}
        drynessGain={kind === 'maple' ? 1.28 : 1.08}
        fogStrength={0.9}
        pigmentGain={kind === 'maple' ? 1.16 : kind === 'grass' ? 0.84 : kind === 'bamboo' ? 0.96 : 1.05}
        role={role}
        side={THREE.DoubleSide}
        silhouetteStrength={kind === 'grass' ? 0.88 : 1.04}
        strokeInfluence={kind === 'grass' ? 0.88 : 0.78}
        windAmplitude={kind === 'grass' ? 0.09 : kind === 'bamboo' ? 0.075 : 0.055}
        windResponse={windResponse}
      />
    </instancedMesh>
  )
}

function StaticGardenRooms() {
  const geometries = useMemo(createStaticRoomGeometries, [])

  useEffect(() => () => {
    STATIC_ROLES.forEach((role) => geometries[role].dispose())
  }, [geometries])

  return (
    <group name="V3_GardenRooms_Static">
      <mesh geometry={geometries.indigo} name="V3_GardenRooms_TerrainRoofsRidges">
        <LivingSumiMaterial
          alphaFeather={0}
          brushScale={0.48}
          drynessGain={0.94}
          fogStrength={0.94}
          pigmentGain={1.25}
          role="indigo"
          silhouetteStrength={0.96}
          strokeInfluence={0.78}
          wetnessGain={1.18}
        />
      </mesh>
      <mesh geometry={geometries.stone} name="V3_GardenRooms_PathStepsRocks">
        <LivingSumiMaterial
          alphaFeather={0}
          brushScale={0.68}
          drynessGain={1.24}
          fogStrength={0.9}
          pigmentGain={1.08}
          role="stone"
          silhouetteStrength={0.94}
          strokeInfluence={0.86}
        />
      </mesh>
      <mesh geometry={geometries.wood} name="V3_GardenRooms_Timber">
        <LivingSumiMaterial
          alphaFeather={0}
          brushScale={0.55}
          drynessGain={1.14}
          fogStrength={0.9}
          pigmentGain={1.2}
          role="wood"
          silhouetteStrength={1.02}
          strokeInfluence={0.84}
        />
      </mesh>
      <mesh geometry={geometries.vermilion} name="V3_GardenRooms_CeremonialPigment">
        <LivingSumiMaterial
          alphaFeather={0}
          brushScale={0.6}
          drynessGain={1.3}
          fogStrength={0.88}
          pigmentGain={1.13}
          role="vermilion"
          silhouetteStrength={1.02}
          strokeInfluence={0.86}
          wetnessGain={1.08}
        />
      </mesh>
      <mesh geometry={geometries.washi} name="V3_GardenRooms_LanternWashi">
        <LivingSumiMaterial
          alphaFeather={0}
          brushScale={0.31}
          drynessGain={0.82}
          fogStrength={0.78}
          opacity={1}
          pigmentGain={0.92}
          role="washi"
          silhouetteStrength={0.48}
          strokeInfluence={0.68}
          wetnessGain={0.72}
        />
      </mesh>
    </group>
  )
}

export interface GardenRoomsProps {
  active?: boolean
  reducedMotion?: boolean
}

/**
 * Nine-draw environmental density layer for the connected v3 garden journey.
 *
 * Static architecture is merged into five semantic pigment banks. Four more
 * draws instance complete multi-blade / multi-leaf 3D clumps, never isolated
 * billboard cards. Mount this component beneath `LivingSumiProvider`; the
 * existing world controller remains the source of truth for navigation.
 */
export function GardenRooms({
  active = true,
  reducedMotion = false,
}: GardenRoomsProps) {
  const compact = useThree((state) => state.size.width < 720)

  return (
    <group name="v3-connected-garden-rooms" visible={active}>
      <StaticGardenRooms />
      <VegetationBatch compact={compact} kind="grass" reducedMotion={reducedMotion} />
      <VegetationBatch compact={compact} kind="bamboo" reducedMotion={reducedMotion} />
      <VegetationBatch compact={compact} kind="maple" reducedMotion={reducedMotion} />
      <VegetationBatch compact={compact} kind="pine" reducedMotion={reducedMotion} />
    </group>
  )
}
