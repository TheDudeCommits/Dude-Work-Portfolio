import { useFrame } from '@react-three/fiber'
import {
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ART_PALETTE } from '../../art'
import { projects, type Project } from '../../projects'
import {
  createBrushLeafGeometry,
  createDrapedVeilGeometry,
  createKoiBodyGeometry,
  createOrganicPlateGeometry,
  createOrganicSurfaceGeometry,
  createPaperBoatGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from '../v2/scene/geometry'
import { freeRoamStore } from '../v2/runtime/store'
import type {
  V3MaterialRequest,
  V3SumiMaterialAdapter,
  V3SumiMaterialRole,
  V3Vector3Tuple,
} from './types'

type Vector3Tuple = [number, number, number]
type ChapterEventKind =
  | 'boats'
  | 'falling-maple'
  | 'koi'
  | 'moon-motes'
  | 'raked-wind'
  | 'rising-seeds'
  | 'signal'
  | 'waterfall'
  | 'wind-bamboo'

export interface ProjectChapterLayout {
  artPosition: V3Vector3Tuple
  artRotation: V3Vector3Tuple
  artScale: V3Vector3Tuple
  eventKind: ChapterEventKind
  farDistance: number
  focusPosition: V3Vector3Tuple
  nearDistance: number
  project: Project
  seed: number
}

const LAYOUT_BY_SLUG: Readonly<Record<string, Omit<ProjectChapterLayout, 'project'>>> = {
  omni: {
    artPosition: [7.2, 2.42, 17.3],
    artRotation: [0, 0, 0],
    artScale: [1.62, 1.62, 1],
    eventKind: 'falling-maple',
    farDistance: 16,
    focusPosition: [7.2, 0.08, 19],
    nearDistance: 10,
    seed: 11,
  },
  'idea-farm': {
    artPosition: [-10.2, 2.05, 7.8],
    artRotation: [0, 0.5, -0.04],
    artScale: [1.3, 1.55, 1],
    eventKind: 'rising-seeds',
    farDistance: 17,
    focusPosition: [-8.85, 0.08, 9.15],
    nearDistance: 10.5,
    seed: 23,
  },
  vpay: {
    artPosition: [-5.2, -0.045, 0.9],
    artRotation: [-Math.PI / 2, 0, 0.08],
    artScale: [1.9, 1.9, 1],
    eventKind: 'koi',
    farDistance: 20,
    focusPosition: [-7.5, 0.08, 0.9],
    nearDistance: 11,
    seed: 31,
  },
  'pod-racing': {
    artPosition: [-11.5, 0.055, -8.8],
    artRotation: [-Math.PI / 2, 0, -0.22],
    artScale: [1.9, 1.5, 1],
    eventKind: 'raked-wind',
    farDistance: 20,
    focusPosition: [-11.5, 0.08, -6.65],
    nearDistance: 11,
    seed: 43,
  },
  'we-are-on-the-cruise': {
    artPosition: [0, -0.045, -9.35],
    artRotation: [-Math.PI / 2, 0, 0.12],
    artScale: [1.95, 1.62, 1],
    eventKind: 'boats',
    farDistance: 22,
    focusPosition: [0, 0.08, -11.8],
    nearDistance: 12,
    seed: 53,
  },
  cloak: {
    artPosition: [8.8, 2.08, -13.05],
    artRotation: [0, 0, 0],
    artScale: [1.46, 1.78, 1],
    eventKind: 'waterfall',
    farDistance: 23,
    focusPosition: [8.8, 0.08, -10.9],
    nearDistance: 12,
    seed: 61,
  },
  'wish-galaxy': {
    artPosition: [14, 1.02, -8.4],
    artRotation: [-0.82, 0, -0.08],
    artScale: [1.55, 1.55, 1],
    eventKind: 'moon-motes',
    farDistance: 23,
    focusPosition: [12.25, 0.08, -7.15],
    nearDistance: 12,
    seed: 71,
  },
  'between-the-lines': {
    artPosition: [11.2, 2.05, 12],
    artRotation: [0, 0, 0],
    artScale: [1.02, 1.65, 1],
    eventKind: 'wind-bamboo',
    farDistance: 12.5,
    focusPosition: [10, 0.08, 13.5],
    nearDistance: 9.5,
    seed: 83,
  },
  relay: {
    artPosition: [7.8, 0.055, 8.5],
    artRotation: [-Math.PI / 2, 0, 0],
    artScale: [1.75, 1.5, 1],
    eventKind: 'signal',
    farDistance: 17.5,
    focusPosition: [7.8, 0.08, 10.45],
    nearDistance: 9.5,
    seed: 97,
  },
}

export const PROJECT_CHAPTERS: readonly ProjectChapterLayout[] = projects.map((project) => ({
  ...LAYOUT_BY_SLUG[project.slug],
  project,
}))

const MATERIAL_ROLES: readonly V3SumiMaterialRole[] = [
  'earth',
  'stone',
  'wood',
  'pine',
  'vermilion',
  'indigo',
  'metal',
  'washi',
  'water',
  'spirit',
]

type GeometryBank = Partial<Record<V3SumiMaterialRole, THREE.BufferGeometry>>
type GeometryBuckets = Partial<Record<V3SumiMaterialRole, THREE.BufferGeometry[]>>
interface ChapterGeometry {
  far: GeometryBank
  near: GeometryBank
}

function hash01(value: number) {
  const x = Math.sin(value * 91.713 + 17.197) * 43758.5453
  return x - Math.floor(x)
}

function artLocal(layout: ProjectChapterLayout): Vector3Tuple {
  return [
    layout.artPosition[0] - layout.focusPosition[0],
    layout.artPosition[1],
    layout.artPosition[2] - layout.focusPosition[2],
  ]
}

function bakedGeometry(
  source: THREE.BufferGeometry,
  position: V3Vector3Tuple,
  rotation: V3Vector3Tuple = [0, 0, 0],
  scale: V3Vector3Tuple = [1, 1, 1],
) {
  let geometry: THREE.BufferGeometry
  if (source.index) {
    geometry = source.toNonIndexed()
    source.dispose()
  } else {
    geometry = source.clone()
    source.dispose()
  }
  Object.keys(geometry.attributes).forEach((attribute) => {
    if (attribute !== 'position') geometry.deleteAttribute(attribute)
  })
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
  role: V3SumiMaterialRole,
  geometry: THREE.BufferGeometry,
  position: V3Vector3Tuple,
  rotation: V3Vector3Tuple = [0, 0, 0],
  scale: V3Vector3Tuple = [1, 1, 1],
) {
  const parts = buckets[role] ?? []
  parts.push(bakedGeometry(geometry, position, rotation, scale))
  buckets[role] = parts
}

function addBox(
  buckets: GeometryBuckets,
  role: V3SumiMaterialRole,
  size: V3Vector3Tuple,
  position: V3Vector3Tuple,
  rotation: V3Vector3Tuple = [0, 0, 0],
) {
  addGeometry(buckets, role, new THREE.BoxGeometry(...size), position, rotation)
}

function addCylinder(
  buckets: GeometryBuckets,
  role: V3SumiMaterialRole,
  radius: number,
  height: number,
  position: V3Vector3Tuple,
  rotation: V3Vector3Tuple = [0, 0, 0],
  scale: V3Vector3Tuple = [1, 1, 1],
) {
  addGeometry(
    buckets,
    role,
    new THREE.CylinderGeometry(radius * 0.82, radius, height, 7),
    position,
    rotation,
    scale,
  )
}

function addTube(
  buckets: GeometryBuckets,
  role: V3SumiMaterialRole,
  points: readonly THREE.Vector3[],
  radius: number,
  seed: number,
  position: V3Vector3Tuple = [0, 0, 0],
  rotation: V3Vector3Tuple = [0, 0, 0],
) {
  addGeometry(
    buckets,
    role,
    createTaperedTubeGeometry(points, {
      endScale: 0.22,
      irregularity: 0.075,
      radialSegments: 5,
      radius,
      seed,
      startScale: 0.96,
      tubularSegments: Math.max(18, points.length * 7),
    }),
    position,
    rotation,
  )
}

function addOrganicGround(
  buckets: GeometryBuckets,
  radiusX: number,
  radiusZ: number,
  depth: number,
  seed: number,
  position: V3Vector3Tuple = [0, -0.22, 0],
) {
  addGeometry(
    buckets,
    'earth',
    createOrganicPlateGeometry(radiusX, radiusZ, depth, seed, 28),
    position,
  )
}

function addStoneMass(
  buckets: GeometryBuckets,
  position: V3Vector3Tuple,
  scale: V3Vector3Tuple,
  seed: number,
  role: V3SumiMaterialRole = 'stone',
) {
  addGeometry(
    buckets,
    role,
    createScholarStoneGeometry(1, seed, 9),
    position,
    [hash01(seed) * 0.2, hash01(seed + 2) * Math.PI, hash01(seed + 7) * 0.12],
    scale,
  )
}

function addGroundcoverMass(
  buckets: GeometryBuckets,
  options: {
    center: readonly [number, number]
    count: number
    radius: readonly [number, number]
    role?: V3SumiMaterialRole
    seed: number
  },
) {
  const { center, count, radius, role = 'pine', seed } = options
  for (let index = 0; index < count; index += 1) {
    const angle = hash01(seed + index * 3.3) * Math.PI * 2
    const spread = Math.sqrt(hash01(seed + index * 7.7))
    const x = center[0] + Math.cos(angle) * radius[0] * spread
    const z = center[1] + Math.sin(angle) * radius[1] * spread
    const height = 0.34 + hash01(seed + index * 5.9) * 0.5
    addGeometry(
      buckets,
      role,
      createBrushLeafGeometry(height, 0.13 + height * 0.12, 0.1, 5),
      [x, 0.02, z],
      [0, angle, (hash01(seed + index * 9.1) - 0.5) * 0.32],
      [index % 2 ? -1 : 1, 1, 1],
    )
  }
}

function addMapleTree(
  far: GeometryBuckets,
  near: GeometryBuckets,
  position: V3Vector3Tuple,
  scale: number,
  seed: number,
) {
  addTube(
    far,
    'wood',
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.12, 1.25 * scale, 0.08),
      new THREE.Vector3(0.18, 2.5 * scale, -0.04),
      new THREE.Vector3(-0.05, 3.55 * scale, 0.12),
    ],
    0.26 * scale,
    seed,
    position,
  )
  const branches = [
    [-1.2, 2.55, 0.1],
    [1.25, 2.72, -0.18],
    [-0.72, 3.42, -0.48],
    [0.82, 3.65, 0.35],
  ] as const
  branches.forEach(([x, y, z], index) => {
    addTube(
      far,
      'wood',
      [
        new THREE.Vector3(0, 1.85 * scale, 0),
        new THREE.Vector3(x * 0.55 * scale, y * 0.78 * scale, z * 0.4 * scale),
        new THREE.Vector3(x * scale, y * scale, z * scale),
      ],
      0.12 * scale,
      seed + index + 1,
      position,
    )
  })
  for (let index = 0; index < 24; index += 1) {
    const angle = hash01(seed + index * 5.4) * Math.PI * 2
    const radius = 0.6 + hash01(seed + index * 7.1) * 1.55
    const crownPosition: Vector3Tuple = [
      position[0] + Math.cos(angle) * radius * scale,
      position[1] + (2.7 + hash01(seed + index * 4.6) * 1.45) * scale,
      position[2] + Math.sin(angle) * radius * 0.7 * scale,
    ]
    addStoneMass(
      far,
      crownPosition,
      [0.58 * scale, 0.2 * scale, 0.44 * scale],
      seed + index * 2.1,
      index % 7 === 0 ? 'pine' : 'vermilion',
    )
    if (index < 18) {
      addGeometry(
        near,
        'vermilion',
        createBrushLeafGeometry(0.82 * scale, 0.3 * scale, 0.13, 6),
        crownPosition,
        [0, angle, angle * 0.33],
      )
    }
  }
}

function addLantern(
  far: GeometryBuckets,
  position: V3Vector3Tuple,
  height: number,
  seed: number,
  spiritRole: V3SumiMaterialRole = 'spirit',
) {
  addCylinder(far, 'stone', height * 0.085, height * 0.52, [position[0], position[1] + height * 0.3, position[2]])
  addBox(far, spiritRole, [height * 0.24, height * 0.22, height * 0.24], [position[0], position[1] + height * 0.64, position[2]])
  addGeometry(
    far,
    'metal',
    new THREE.ConeGeometry(height * 0.25, height * 0.18, 4),
    [position[0], position[1] + height * 0.83, position[2]],
    [0, Math.PI / 4 + hash01(seed) * 0.12, 0],
  )
}

function addApproachStones(
  near: GeometryBuckets,
  start: readonly [number, number],
  end: readonly [number, number],
  count: number,
  seed: number,
) {
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1)
    const x = THREE.MathUtils.lerp(start[0], end[0], t) + (hash01(seed + index) - 0.5) * 0.3
    const z = THREE.MathUtils.lerp(start[1], end[1], t) + (hash01(seed + index * 2.1) - 0.5) * 0.24
    addStoneMass(
      near,
      [x, -0.02, z],
      [0.55 + hash01(seed + index * 3) * 0.25, 0.1, 0.38 + hash01(seed + index * 4) * 0.18],
      seed + index,
    )
  }
}

function addBambooWall(
  far: GeometryBuckets,
  near: GeometryBuckets,
  side: -1 | 1,
  seed: number,
) {
  for (let index = 0; index < 9; index += 1) {
    const z = -3.9 + index * 0.92
    const x = side * (2.15 + hash01(seed + index) * 0.6)
    const height = 3.6 + hash01(seed + index * 2.7) * 2.25
    addCylinder(
      far,
      index % 5 === 0 ? 'wood' : 'pine',
      0.08 + hash01(seed + index * 4.1) * 0.035,
      height,
      [x, height * 0.5 - 0.05, z],
      [0, 0, side * (hash01(seed + index * 7.2) - 0.5) * 0.08],
    )
    for (let leafIndex = 0; leafIndex < 3; leafIndex += 1) {
      const y = height * (0.42 + leafIndex * 0.2)
      addGeometry(
        near,
        'pine',
        createBrushLeafGeometry(0.8 + leafIndex * 0.15, 0.28, 0.16, 6),
        [x, y, z],
        [0, side * (0.6 + leafIndex), side * (0.9 + leafIndex * 0.34)],
        [side, 1, 1],
      )
    }
  }
}

function ellipsePoints(
  radiusX: number,
  radiusZ: number,
  y: number,
  count = 36,
  start = 0,
  end = Math.PI * 2,
) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1)
    const angle = THREE.MathUtils.lerp(start, end, t)
    return new THREE.Vector3(Math.cos(angle) * radiusX, y, Math.sin(angle) * radiusZ)
  })
}

function buildOmniChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  const art = artLocal(layout)
  addOrganicGround(far, 5.8, 4.7, 0.58, layout.seed, [0, -0.28, -0.35])
  // One asymmetrical specimen frames the eclipse from the garden side. The
  // former paired tree stood directly inside the authored arrival camera and
  // turned the first project reveal into a wall of branches.
  addMapleTree(far, near, [3.85, -0.04, -1.05], 0.78, layout.seed + 19)
  addGeometry(
    far,
    'vermilion',
    new THREE.SphereGeometry(1, 24, 16),
    [art[0], art[1] + 0.18, art[2] - 0.36],
    [0, 0, 0],
    [2.18, 2.18, 0.16],
  )
  addGeometry(
    far,
    'metal',
    new THREE.TorusGeometry(2.52, 0.095, 6, 56),
    [art[0], art[1] + 0.18, art[2] - 0.22],
  )
  ;[-2.35, 2.35].forEach((x, index) => {
    addStoneMass(far, [x, 1.05, -2.05], [0.72, 1.7, 0.82], layout.seed + 30 + index)
  })
  addTube(
    far,
    'wood',
    [
      new THREE.Vector3(-2.45, 1.95, 0),
      new THREE.Vector3(-1.1, 2.55, 0.04),
      new THREE.Vector3(0, 2.75, 0),
      new THREE.Vector3(1.15, 2.54, -0.02),
      new THREE.Vector3(2.45, 1.92, 0),
    ],
    0.14,
    layout.seed + 40,
    [0, 0, -2.05],
  )
  addApproachStones(near, [0, 4.15], [0, 0.35], 8, layout.seed + 48)
  addGroundcoverMass(near, { center: [-3.35, 0], count: 18, radius: [1.9, 2.4], seed: layout.seed + 56 })
  addGroundcoverMass(near, { center: [3.35, -0.55], count: 16, radius: [1.7, 2], seed: layout.seed + 68 })
  addLantern(near, [-1.65, 0, 1.55], 1.8, layout.seed + 80)
  addLantern(near, [1.75, 0, 1.2], 1.45, layout.seed + 81)
}

function buildIdeaFarmChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addOrganicGround(far, 5.3, 4.6, 0.52, layout.seed, [0, -0.3, -0.25])
  ;[
    { position: [0.9, -0.04, 1.9] as Vector3Tuple, radius: [4.1, 1.55] as const },
    { position: [0.25, 0.28, -0.35] as Vector3Tuple, radius: [3.75, 1.5] as const },
    { position: [-0.65, 0.6, -2.45] as Vector3Tuple, radius: [3.1, 1.25] as const },
  ].forEach((terrace, index) => {
    addGeometry(
      far,
      index === 2 ? 'stone' : 'earth',
      createOrganicPlateGeometry(terrace.radius[0], terrace.radius[1], 0.38, layout.seed + index, 24),
      terrace.position,
    )
  })
  const trellisCenter: Vector3Tuple = [-1.05, 0, -1.35]
  ;[-2.35, 0.25].forEach((x) => {
    ;[-2.35, -0.2].forEach((z) => addCylinder(far, 'wood', 0.13, 4.5, [x, 2.25, z]))
  })
  addBox(far, 'wood', [3.15, 0.18, 0.22], [trellisCenter[0], 4.35, -2.35])
  addBox(far, 'wood', [3.15, 0.18, 0.22], [trellisCenter[0], 4.35, -0.2])
  for (let beam = 0; beam < 6; beam += 1) {
    addBox(far, beam % 2 ? 'pine' : 'wood', [0.1, 0.12, 2.65], [-2.3 + beam * 0.5, 4.48, -1.28])
  }
  for (let vine = 0; vine < 7; vine += 1) {
    const x = -2.1 + vine * 0.38
    addTube(
      near,
      'pine',
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.12, 1.2, 0.08),
        new THREE.Vector3(-0.1, 2.35, -0.05),
        new THREE.Vector3(0.08, 3.6, 0.06),
      ],
      0.035,
      layout.seed + vine,
      [x, 0.62, -2.3 + (vine % 2) * 2.05],
    )
  }
  for (let row = 0; row < 4; row += 1) {
    addGroundcoverMass(near, {
      center: [1.25, 2.35 - row * 1.45],
      count: 9,
      radius: [2.1, 0.38],
      role: row === 3 ? 'vermilion' : 'pine',
      seed: layout.seed + 20 + row * 13,
    })
  }
  ;[-0.7, 0.8].forEach((z, index) => addGeometry(
    near,
    'water',
    createOrganicSurfaceGeometry(2.55, 0.12, layout.seed + index, 24),
    [1.2, 0.72 - index * 0.3, z],
  ))
  for (let step = 0; step < 5; step += 1) {
    addBox(near, 'stone', [1.2, 0.13, 0.46], [-3.25, step * 0.18, 3.45 - step * 0.48])
  }
  addLantern(near, [3.5, 0, 2.3], 1.55, layout.seed + 72)
}

function buildVPayChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addOrganicGround(far, 5.7, 4.15, 0.55, layout.seed, [0.65, -0.36, 0])
  addGeometry(
    far,
    'water',
    createOrganicSurfaceGeometry(4.75, 3.15, layout.seed + 1, 40),
    [1.45, 0.015, 0],
  )
  ;[-3.5, 4.85].forEach((x, index) => {
    addStoneMass(far, [x, 0.18, -1.4 + index * 2.25], [1.45, 0.62, 1.05], layout.seed + 9 + index)
    addStoneMass(far, [x + (index ? -0.5 : 0.55), 0.1, 1.45 - index * 2.1], [1.15, 0.42, 0.9], layout.seed + 13 + index)
  })
  for (let plank = 0; plank < 11; plank += 1) {
    const x = -3.55 + plank * 0.42
    const y = 0.16 + Math.sin((plank / 10) * Math.PI) * 0.22
    addBox(far, 'wood', [0.37, 0.13, 2.5], [x, y, 0.2], [0, 0, (hash01(layout.seed + plank) - 0.5) * 0.025])
  }
  ;[-1.02, 1.42].forEach((z) => addTube(
    far,
    'wood',
    [
      new THREE.Vector3(-3.7, 0.82, z),
      new THREE.Vector3(-1.5, 1.1, z),
      new THREE.Vector3(0.65, 0.82, z),
    ],
    0.07,
    layout.seed + z,
  ))
  ;[
    [-0.15, 0.08, -0.55, -0.4, 'vermilion'],
    [1.85, 0.07, 0.8, 2.4, 'metal'],
    [3.45, 0.06, -0.75, 1.2, 'indigo'],
    [2.55, 0.07, 1.35, -2.15, 'washi'],
  ].forEach(([x, y, z, yaw, role], index) => addGeometry(
    near,
    role as V3SumiMaterialRole,
    createKoiBodyGeometry(1.28, 0.25),
    [Number(x), Number(y), Number(z)],
    [0, Number(yaw), index % 2 ? 0.08 : -0.06],
    [0.9, 0.46, 0.8],
  ))
  for (let lily = 0; lily < 12; lily += 1) {
    const angle = hash01(layout.seed + lily * 2.4) * Math.PI * 2
    const radius = 1.2 + hash01(layout.seed + lily * 3.8) * 2.6
    addCylinder(
      near,
      lily % 4 === 0 ? 'vermilion' : 'pine',
      0.2 + hash01(layout.seed + lily) * 0.18,
      0.025,
      [1.5 + Math.cos(angle) * radius, 0.045, Math.sin(angle) * radius * 0.66],
    )
  }
  addGroundcoverMass(near, { center: [-3.9, -2.35], count: 18, radius: [1.3, 1.1], seed: layout.seed + 55 })
  addGroundcoverMass(near, { center: [4.5, 2.1], count: 16, radius: [1.2, 1], seed: layout.seed + 77 })
  addLantern(near, [-3.45, 0, -1.72], 1.7, layout.seed + 91, 'vermilion')
}

function buildPodRacingChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addOrganicGround(far, 6.15, 4.85, 0.5, layout.seed, [0, -0.29, -0.5])
  addMapleTree(far, near, [-3.7, -0.02, 0.2], 0.9, layout.seed + 4)
  addStoneMass(far, [3.7, 1.75, -0.35], [1.0, 2.7, 1.15], layout.seed + 8)
  addStoneMass(far, [2.45, 0.62, -2.5], [1.25, 1, 0.9], layout.seed + 10)
  for (let ring = 0; ring < 8; ring += 1) {
    const radius = 0.75 + ring * 0.47
    addTube(
      near,
      ring === 2 ? 'vermilion' : 'stone',
      ellipsePoints(radius * 1.25, radius * 0.72, 0.045, 42),
      ring === 2 ? 0.035 : 0.022,
      layout.seed + ring,
      [0, 0, -1.65],
    )
  }
  addTube(
    near,
    'metal',
    [
      new THREE.Vector3(-4.6, 0.055, 2.65),
      new THREE.Vector3(-2, 0.052, 1.5),
      new THREE.Vector3(0, 0.05, -1.6),
      new THREE.Vector3(2.25, 0.052, 1.15),
      new THREE.Vector3(4.7, 0.055, 2.5),
    ],
    0.028,
    layout.seed + 20,
  )
  ;[
    [-1.1, 0.12, -2.2, -0.62, 'vermilion'],
    [0.9, 0.11, -1.2, 2.55, 'metal'],
  ].forEach(([x, y, z, yaw, role]) => addGeometry(
    near,
    role as V3SumiMaterialRole,
    createKoiBodyGeometry(1.35, 0.23),
    [Number(x), Number(y), Number(z)],
    [0, Number(yaw), 0],
    [1.05, 0.4, 0.72],
  ))
  addGroundcoverMass(near, { center: [-4.4, -2.5], count: 18, radius: [1.25, 1.1], seed: layout.seed + 32 })
  addGroundcoverMass(near, { center: [4.25, 2.65], count: 15, radius: [1.2, 0.9], seed: layout.seed + 44 })
  addApproachStones(near, [0, 4.1], [0, 2], 5, layout.seed + 61)
}

function buildCruiseChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addGeometry(
    far,
    'water',
    createOrganicSurfaceGeometry(2.15, 5.7, layout.seed, 42),
    [0, 0.015, 0],
  )
  addGeometry(
    far,
    'earth',
    createOrganicPlateGeometry(2.7, 5.6, 0.55, layout.seed + 1, 30),
    [-3.65, -0.34, 0.1],
  )
  addGeometry(
    far,
    'earth',
    createOrganicPlateGeometry(2.8, 5.8, 0.58, layout.seed + 2, 30),
    [3.72, -0.36, -0.15],
  )
  for (let plank = 0; plank < 13; plank += 1) {
    const progress = plank / 12
    const x = -2.85 + progress * 5.7
    const y = 0.22 + Math.sin(progress * Math.PI) * 0.82
    addBox(far, 'wood', [0.42, 0.15, 1.65], [x, y, -0.15], [0, 0, -Math.cos(progress * Math.PI) * 0.12])
  }
  ;[-0.92, 0.64].forEach((z, index) => addTube(
    far,
    index ? 'vermilion' : 'wood',
    [
      new THREE.Vector3(-2.8, 0.85, z),
      new THREE.Vector3(0, 1.72, z),
      new THREE.Vector3(2.8, 0.85, z),
    ],
    0.075,
    layout.seed + index,
  ))
  ;[
    [-0.42, 0.07, 3.15, 0.16, 0.66],
    [0.55, 0.06, 1.85, -0.2, 0.5],
    [-0.6, 0.055, -2.6, 0.28, 0.58],
    [0.35, 0.05, -4.05, -0.12, 0.42],
  ].forEach(([x, y, z, yaw, scale], index) => addGeometry(
    near,
    index === 0 ? 'washi' : index === 2 ? 'vermilion' : 'metal',
    createPaperBoatGeometry(Number(scale)),
    [Number(x), Number(y), Number(z)],
    [0, Number(yaw), index % 2 ? -0.03 : 0.04],
  ))
  ;[-2.25, 2.25].forEach((x, side) => {
    for (let reed = 0; reed < 34; reed += 1) {
      const z = -5 + hash01(layout.seed + side * 91 + reed * 2.3) * 10
      const spread = (hash01(layout.seed + side * 47 + reed * 3.9) - 0.5) * 1.5
      const height = 0.55 + hash01(layout.seed + reed * 7.1) * 1.0
      addGeometry(
        near,
        'pine',
        createBrushLeafGeometry(height, 0.12, 0.08, 5),
        [x + (side ? 1 : -1) * spread, 0, z],
        [0, side ? -0.45 : 0.45, (hash01(reed + layout.seed) - 0.5) * 0.2],
      )
    }
  })
  addStoneMass(far, [-3.35, 0.75, -3.65], [1.5, 1.3, 1.2], layout.seed + 80)
  addStoneMass(far, [3.45, 0.55, 3.5], [1.25, 1.0, 1.1], layout.seed + 82)
  addLantern(near, [3.25, 0, -2.7], 1.65, layout.seed + 95)
}

function buildCloakChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addOrganicGround(far, 5.75, 4.85, 0.72, layout.seed, [0, -0.42, -0.65])
  addGeometry(
    far,
    'water',
    createOrganicSurfaceGeometry(3.35, 2.5, layout.seed + 1, 36),
    [0, 0.02, -0.75],
  )
  const rockMasses = [
    [-3.15, 1.15, -2.75, 1.25, 1.75, 1.15],
    [3.2, 1.05, -2.8, 1.2, 1.65, 1.1],
    [-1.55, 2.35, -3.45, 1.05, 1.65, 1],
    [1.6, 2.4, -3.5, 1.08, 1.7, 1],
    [0, 3.15, -3.7, 1.45, 0.95, 1.08],
  ] as const
  rockMasses.forEach(([x, y, z, sx, sy, sz], index) => {
    addStoneMass(
      far,
      [x, y, z],
      [sx, sy, sz],
      layout.seed + 8 + index,
      index === 0 || index === 4 ? 'stone' : 'indigo',
    )
  })
  addTube(
    far,
    'indigo',
    [
      new THREE.Vector3(-3.05, 0.3, 0),
      new THREE.Vector3(-2.3, 2.5, 0),
      new THREE.Vector3(0, 4.65, 0),
      new THREE.Vector3(2.35, 2.45, 0),
      new THREE.Vector3(3.1, 0.25, 0),
    ],
    0.48,
    layout.seed + 20,
    [0, 0, -2.72],
  )
  addGeometry(
    far,
    'water',
    createDrapedVeilGeometry(4.1, 4.65, 18, 22),
    [0, 2.3, -3.02],
  )
  for (let root = 0; root < 12; root += 1) {
    const x = -2.85 + root * 0.52
    addTube(
      near,
      root % 4 === 0 ? 'pine' : 'wood',
      [
        new THREE.Vector3(0, 4.15, 0),
        new THREE.Vector3((hash01(root + layout.seed) - 0.5) * 0.35, 2.4, 0.1),
        new THREE.Vector3((hash01(root * 3 + layout.seed) - 0.5) * 0.55, 0.2, 0),
      ],
      0.055 + hash01(root + 3) * 0.035,
      layout.seed + root,
      [x, 0, -2.58],
    )
  }
  addGroundcoverMass(near, { center: [-3.55, 0.15], count: 24, radius: [1.65, 2.4], seed: layout.seed + 43 })
  addGroundcoverMass(near, { center: [3.6, 0.1], count: 22, radius: [1.55, 2.35], seed: layout.seed + 62 })
  addApproachStones(near, [0, 3.85], [0, 0.35], 7, layout.seed + 87)
  addLantern(near, [2.75, 0.08, 1.55], 1.35, layout.seed + 97)
}

function buildWishGalaxyChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addOrganicGround(far, 5.45, 4.45, 0.6, layout.seed, [0.25, -0.34, -0.25])
  addGeometry(
    far,
    'water',
    createOrganicSurfaceGeometry(3.6, 2.05, layout.seed + 1, 36),
    [-0.2, 0.018, 1.45],
  )
  const pavilionCenter: Vector3Tuple = [1.25, 0, -1.2]
  ;[-1.25, 1.25].forEach((x) => {
    ;[-1.15, 1.15].forEach((z) => addCylinder(
      far,
      'wood',
      0.15,
      3.55,
      [pavilionCenter[0] + x, 1.75, pavilionCenter[2] + z],
    ))
  })
  addGeometry(
    far,
    'indigo',
    createOrganicPlateGeometry(3.25, 2.55, 0.2, layout.seed + 4, 28),
    [pavilionCenter[0], 3.46, pavilionCenter[2]],
    [0, 0, 0],
    [1, 0.55, 1],
  )
  addGeometry(
    far,
    'metal',
    createOrganicPlateGeometry(2.45, 1.8, 0.16, layout.seed + 5, 24),
    [pavilionCenter[0], 3.75, pavilionCenter[2]],
    [0, 0, 0],
    [1, 0.7, 1],
  )
  addBox(far, 'wood', [5.3, 0.18, 0.16], [pavilionCenter[0], 3.08, pavilionCenter[2] - 1.2])
  addBox(far, 'wood', [5.3, 0.18, 0.16], [pavilionCenter[0], 3.08, pavilionCenter[2] + 1.2])
  addGeometry(
    far,
    'indigo',
    new THREE.SphereGeometry(1, 22, 14),
    [1.75, 4.2, -2.65],
    [0, 0, 0],
    [2.05, 2.05, 0.13],
  )
  addGeometry(
    far,
    'spirit',
    new THREE.OctahedronGeometry(0.28, 0),
    [1.75, 4.2, -2.46],
    [0, 0, Math.PI / 4],
    [0.55, 1.85, 0.55],
  )
  addApproachStones(near, [-3.65, 3.15], [-1.1, 1.65], 7, layout.seed + 20)
  addGroundcoverMass(near, { center: [-3.6, -1.1], count: 24, radius: [1.45, 2.5], role: 'washi', seed: layout.seed + 39 })
  addGroundcoverMass(near, { center: [4.15, 1.5], count: 20, radius: [1.2, 1.85], role: 'pine', seed: layout.seed + 58 })
  addLantern(near, [-2.55, 0, 2.15], 1.65, layout.seed + 81)
  addLantern(near, [3.9, 0, 0.8], 1.5, layout.seed + 82, 'vermilion')
}

function buildBetweenLinesChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addOrganicGround(far, 1.65, 5.4, 0.46, layout.seed, [0, -0.26, -0.15])
  addGeometry(
    far,
    'earth',
    createOrganicPlateGeometry(2.7, 5.25, 1.35, layout.seed + 1, 28),
    [-3.35, -0.55, -0.15],
  )
  addGeometry(
    far,
    'earth',
    createOrganicPlateGeometry(2.75, 5.45, 1.5, layout.seed + 2, 28),
    [3.45, -0.65, -0.25],
  )
  addBambooWall(far, near, -1, layout.seed + 5)
  addBambooWall(far, near, 1, layout.seed + 25)
  for (let index = 0; index < 5; index += 1) {
    const z = -4.35 + index * 1.45
    addStoneMass(
      far,
      [-3.25 - hash01(index + layout.seed) * 0.6, 0.46, z],
      [0.76, 0.72, 0.68],
      layout.seed + 44 + index,
      index % 3 === 0 ? 'stone' : 'earth',
    )
    addStoneMass(
      far,
      [3.3 + hash01(index * 2 + layout.seed) * 0.55, 0.44, z + 0.28],
      [0.72, 0.68, 0.64],
      layout.seed + 56 + index,
      index % 3 === 1 ? 'stone' : 'earth',
    )
  }
  const art = artLocal(layout)
  ;[-0.72, 0.72].forEach((x, index) => addGeometry(
    far,
    index === 0 ? 'wood' : 'vermilion',
    createDrapedVeilGeometry(1.05, 3.55, 11, 18),
    [art[0] + x, art[1] + 0.2, art[2] - 0.12],
    [0, 0, index === 0 ? -0.045 : 0.045],
  ))
  addApproachStones(near, [0, 4.85], [0, -3.8], 13, layout.seed + 72)
  addGroundcoverMass(near, { center: [-2.55, 0], count: 20, radius: [1.05, 4.2], seed: layout.seed + 91 })
  addGroundcoverMass(near, { center: [2.6, -0.2], count: 20, radius: [1.05, 4.25], seed: layout.seed + 111 })
}

function buildRelayChapter(far: GeometryBuckets, near: GeometryBuckets, layout: ProjectChapterLayout) {
  addOrganicGround(far, 5.8, 4.8, 0.54, layout.seed, [0, -0.32, 0])
  const channels = [
    { position: [-2.55, 0.015, 0] as Vector3Tuple, radius: [2.5, 0.48] as const, rotation: 0 },
    { position: [2.55, 0.016, 0] as Vector3Tuple, radius: [2.5, 0.48] as const, rotation: 0 },
    { position: [0, 0.017, -2.1] as Vector3Tuple, radius: [0.48, 2.05] as const, rotation: 0 },
    { position: [0, 0.018, 2.1] as Vector3Tuple, radius: [0.48, 2.05] as const, rotation: 0 },
  ]
  channels.forEach((channel, index) => addGeometry(
    far,
    'water',
    createOrganicSurfaceGeometry(channel.radius[0], channel.radius[1], layout.seed + index, 26),
    channel.position,
    [0, channel.rotation, 0],
  ))
  addLantern(far, [0, 0, 0], 3.35, layout.seed, 'vermilion')
  ;[
    [-4.15, 0, 0, 1.45],
    [4.15, 0, 0, 1.45],
    [0, 0, -3.75, 1.35],
    [0, 0, 3.75, 1.35],
  ].forEach(([x, y, z, height], index) => addLantern(
    far,
    [Number(x), Number(y), Number(z)],
    Number(height),
    layout.seed + 10 + index,
    index === 2 ? 'indigo' : 'spirit',
  ))
  ;[
    [-2.65, 0.22, -2.05, 1.25, 0.55, 1.0],
    [2.8, 0.18, 2.1, 1.15, 0.5, 0.9],
    [-2.8, 0.16, 2.25, 1.0, 0.42, 0.82],
    [2.7, 0.2, -2.15, 1.2, 0.52, 0.92],
  ].forEach(([x, y, z, sx, sy, sz], index) => addStoneMass(
    far,
    [x, y, z],
    [sx, sy, sz],
    layout.seed + 22 + index,
  ))
  for (let axis = 0; axis < 2; axis += 1) {
    for (let plank = -5; plank <= 5; plank += 1) {
      const offset = plank * 0.43
      addBox(
        near,
        'wood',
        axis === 0 ? [0.34, 0.08, 1.05] : [1.05, 0.08, 0.34],
        axis === 0 ? [offset, 0.13, 0] : [0, 0.14, offset],
      )
    }
  }
  addApproachStones(near, [-4.9, 3.8], [-2, 1.25], 6, layout.seed + 39)
  addGroundcoverMass(near, { center: [-3.65, -2.9], count: 20, radius: [1.55, 1.25], seed: layout.seed + 55 })
  addGroundcoverMass(near, { center: [3.65, 2.8], count: 18, radius: [1.4, 1.25], seed: layout.seed + 75 })
}

function buildChapterGeometry(layout: ProjectChapterLayout): ChapterGeometry {
  const far: GeometryBuckets = {}
  const near: GeometryBuckets = {}
  switch (layout.project.slug) {
    case 'omni': buildOmniChapter(far, near, layout); break
    case 'idea-farm': buildIdeaFarmChapter(far, near, layout); break
    case 'vpay': buildVPayChapter(far, near, layout); break
    case 'pod-racing': buildPodRacingChapter(far, near, layout); break
    case 'we-are-on-the-cruise': buildCruiseChapter(far, near, layout); break
    case 'cloak': buildCloakChapter(far, near, layout); break
    case 'wish-galaxy': buildWishGalaxyChapter(far, near, layout); break
    case 'between-the-lines': buildBetweenLinesChapter(far, near, layout); break
    case 'relay': buildRelayChapter(far, near, layout); break
    default: break
  }

  const mergeBank = (buckets: GeometryBuckets): GeometryBank => {
    const bank: GeometryBank = {}
    MATERIAL_ROLES.forEach((role) => {
      const parts = buckets[role]
      if (!parts?.length) return
      const merged = mergeGeometries(parts, false)
      parts.forEach((part) => part.dispose())
      if (!merged) throw new Error(`Unable to merge ${layout.project.slug} ${role} geometry`)
      merged.computeBoundingBox()
      merged.computeBoundingSphere()
      bank[role] = merged
    })
    return bank
  }

  return { far: mergeBank(far), near: mergeBank(near) }
}

function requestForRole(mesh: THREE.Mesh, role: V3SumiMaterialRole): V3MaterialRequest {
  const windResponse = role === 'pine' ? 0.36 : role === 'washi' ? 0.2 : 0
  mesh.userData.livingSumi = {
    brushDirection: role === 'pine' ? [0.2, 1] : [1, 0.12],
    maskDefaults: {
      dryness: role === 'earth' || role === 'stone' ? 0.76 : 0.42,
      pigment: role === 'spirit' ? 0.38 : 0.72,
      wetness: role === 'water' || role === 'indigo' ? 0.48 : 0.14,
      wind: windResponse,
    },
    role,
  }
  return {
    mesh,
    meshName: mesh.name,
    outlineProfile: 'none',
    role,
    sourceMaterial: null,
    sourceMaterialName: `RUNTIME_PROJECT_CHAPTER_${role.toUpperCase()}`,
    windResponse,
  }
}

function ChapterZone({
  chapterIndex,
  layout,
  materialAdapter,
}: {
  chapterIndex: number
  layout: ProjectChapterLayout
  materialAdapter: V3SumiMaterialAdapter
}) {
  const root = useRef<THREE.Group>(null)
  const nearLayer = useRef<THREE.Group>(null)
  const farMeshes = useRef(new Map<V3SumiMaterialRole, THREE.Mesh>())
  const nearMeshes = useRef(new Map<V3SumiMaterialRole, THREE.Mesh>())
  const geometry = useMemo(() => buildChapterGeometry(layout), [layout])
  const placeholder = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), [])

  useLayoutEffect(() => {
    ;[farMeshes.current, nearMeshes.current].forEach((meshBank) => {
      meshBank.forEach((mesh, role) => {
        mesh.material = materialAdapter.resolve(requestForRole(mesh, role))
      })
    })
  }, [materialAdapter])

  useFrame(() => {
    const [playerX, , playerZ] = freeRoamStore.getState().motion.position
    const dx = layout.focusPosition[0] - playerX
    const dz = layout.focusPosition[2] - playerZ
    const distanceSquared = dx * dx + dz * dz
    if (root.current) root.current.visible = distanceSquared < layout.farDistance ** 2
    if (nearLayer.current) nearLayer.current.visible = distanceSquared < layout.nearDistance ** 2
  })

  useEffect(() => () => {
    ;[geometry.far, geometry.near].forEach((bank) => {
      Object.values(bank).forEach((part) => part?.dispose())
    })
    placeholder.dispose()
  }, [geometry, placeholder])

  const registerMesh = (
    bank: React.MutableRefObject<Map<V3SumiMaterialRole, THREE.Mesh>>,
    role: V3SumiMaterialRole,
    mesh: THREE.Mesh | null,
  ) => {
    if (mesh) bank.current.set(role, mesh)
    else bank.current.delete(role)
  }

  return (
    <group
      name={`V3_ProjectChapter_${layout.project.slug}`}
      position={[layout.focusPosition[0], 0, layout.focusPosition[2]]}
      ref={root}
      userData={{ chapterIndex, projectSlug: layout.project.slug }}
    >
      <group name={`V3_ProjectChapter_${layout.project.slug}_landmark`}>
        {MATERIAL_ROLES.map((role) => {
          const part = geometry.far[role]
          if (!part) return null
          return (
            <mesh
              geometry={part}
              key={role}
              material={placeholder}
              name={`V3_ProjectChapter_${layout.project.slug}_far_${role}`}
              ref={(mesh) => registerMesh(farMeshes, role, mesh)}
            />
          )
        })}
      </group>
      <group name={`V3_ProjectChapter_${layout.project.slug}_habitat`} ref={nearLayer}>
        {MATERIAL_ROLES.map((role) => {
          const part = geometry.near[role]
          if (!part) return null
          return (
            <mesh
              geometry={part}
              key={role}
              material={placeholder}
              name={`V3_ProjectChapter_${layout.project.slug}_near_${role}`}
              ref={(mesh) => registerMesh(nearMeshes, role, mesh)}
            />
          )
        })}
      </group>
    </group>
  )
}

export function ProjectChapterZones({
  materialAdapter,
}: {
  materialAdapter: V3SumiMaterialAdapter
}): ReactElement {
  return (
    <group name="v3-nine-project-environmental-chapters">
      {PROJECT_CHAPTERS.map((layout, chapterIndex) => (
        <ChapterZone
          chapterIndex={chapterIndex}
          key={layout.project.slug}
          layout={layout}
          materialAdapter={materialAdapter}
        />
      ))}
    </group>
  )
}

const EVENT_PARTICLES_PER_CHAPTER = 14

function eventColor(kind: ChapterEventKind) {
  switch (kind) {
    case 'falling-maple': return new THREE.Color(ART_PALETTE.mapleCrimson)
    case 'rising-seeds': return new THREE.Color(ART_PALETTE.oldGold)
    case 'koi': return new THREE.Color(ART_PALETTE.vermilion)
    case 'raked-wind': return new THREE.Color(ART_PALETTE.washi)
    case 'boats': return new THREE.Color(ART_PALETTE.paleWater)
    case 'waterfall': return new THREE.Color(ART_PALETTE.coolLight)
    case 'moon-motes': return new THREE.Color(ART_PALETTE.moonGlow)
    case 'wind-bamboo': return new THREE.Color(ART_PALETTE.celadon)
    case 'signal': return new THREE.Color(ART_PALETTE.lanternAmber)
    default: return new THREE.Color(ART_PALETTE.firefly)
  }
}

function writeEventPosition(
  attribute: THREE.BufferAttribute,
  chapter: ProjectChapterLayout,
  index: number,
  particle: number,
  time: number,
  focused: boolean,
) {
  const phase = particle * 1.937 + chapter.seed * 0.71
  const energy = focused ? 1.35 : 1
  const originX = chapter.focusPosition[0]
  const originZ = chapter.focusPosition[2]
  switch (chapter.eventKind) {
    case 'falling-maple': {
      const fall = (time * 0.36 * energy + particle / EVENT_PARTICLES_PER_CHAPTER) % 1
      attribute.setXYZ(
        index,
        originX + Math.sin(phase + time * 0.38) * (2.2 + (particle % 3) * 0.42),
        5.2 - fall * 4.8,
        originZ - 0.4 + Math.cos(phase * 0.7 + time * 0.24) * 2.65,
      )
      break
    }
    case 'rising-seeds': {
      const rise = (time * 0.22 * energy + particle / EVENT_PARTICLES_PER_CHAPTER) % 1
      attribute.setXYZ(
        index,
        originX + 1.2 + Math.sin(phase + time * 0.32) * 2.5,
        0.55 + rise * 4.2,
        originZ + 0.2 + Math.cos(phase * 1.3) * 2.7,
      )
      break
    }
    case 'koi': {
      const radius = 1.1 + (particle % 5) * 0.52
      const angle = phase + time * (0.22 + (particle % 3) * 0.04) * energy
      attribute.setXYZ(
        index,
        originX + 1.5 + Math.cos(angle) * radius,
        0.12 + Math.sin(angle * 2) * 0.025,
        originZ + Math.sin(angle) * radius * 0.65,
      )
      break
    }
    case 'raked-wind': {
      const radius = 0.85 + (particle % 7) * 0.48
      const angle = phase + time * 0.18 * energy
      attribute.setXYZ(
        index,
        originX + Math.cos(angle) * radius * 1.25,
        0.16 + Math.sin(phase + time * 0.7) * 0.07,
        originZ - 1.65 + Math.sin(angle) * radius * 0.72,
      )
      break
    }
    case 'boats': {
      const drift = ((time * 0.18 * energy + particle / EVENT_PARTICLES_PER_CHAPTER) % 1) * 10 - 5
      attribute.setXYZ(
        index,
        originX + Math.sin(phase) * 1.2,
        0.14 + Math.sin(time * 0.7 + phase) * 0.03,
        originZ + drift,
      )
      break
    }
    case 'waterfall': {
      const fall = (time * 0.48 * energy + particle / EVENT_PARTICLES_PER_CHAPTER) % 1
      attribute.setXYZ(
        index,
        originX + Math.sin(phase * 1.7) * 1.75,
        4.45 - fall * 4.15,
        originZ - 2.86 + Math.sin(time * 0.8 + phase) * 0.1,
      )
      break
    }
    case 'moon-motes': {
      const angle = phase + time * 0.17 * energy
      const radius = 0.85 + (particle % 5) * 0.38
      attribute.setXYZ(
        index,
        originX + 1.75 + Math.cos(angle) * radius,
        4.15 + Math.sin(angle * 1.7) * radius * 0.72,
        originZ - 2.55 + Math.sin(angle) * 0.32,
      )
      break
    }
    case 'wind-bamboo': {
      const side = particle % 2 ? 1 : -1
      const sway = Math.sin(time * 0.55 + phase) * 0.42 * energy
      attribute.setXYZ(
        index,
        originX + side * (2.2 + (particle % 4) * 0.18) + sway,
        2.2 + (particle % 6) * 0.58,
        originZ - 3.8 + ((particle * 0.83) % 7.6),
      )
      break
    }
    case 'signal': {
      const arm = particle % 4
      const travel = ((time * 0.3 * energy + particle / EVENT_PARTICLES_PER_CHAPTER) % 1) * 4.5
      const x = arm === 0 ? travel : arm === 1 ? -travel : 0
      const z = arm === 2 ? travel : arm === 3 ? -travel : 0
      attribute.setXYZ(index, originX + x, 0.24 + Math.sin(phase + time) * 0.08, originZ + z)
      break
    }
    default:
      attribute.setXYZ(index, originX, 0.2, originZ)
  }
}

export function ChapterEventField({
  focusedIndex,
  reducedMotion,
}: {
  focusedIndex: number | null
  reducedMotion: boolean
}): ReactElement {
  const particleCount = PROJECT_CHAPTERS.length * EVENT_PARTICLES_PER_CHAPTER
  const lastReducedFocus = useRef<number | null | undefined>(undefined)
  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry()
    const colors = new Float32Array(particleCount * 3)
    PROJECT_CHAPTERS.forEach((chapter, chapterIndex) => {
      const color = eventColor(chapter.eventKind)
      for (let particle = 0; particle < EVENT_PARTICLES_PER_CHAPTER; particle += 1) {
        const offset = (chapterIndex * EVENT_PARTICLES_PER_CHAPTER + particle) * 3
        colors[offset] = color.r
        colors[offset + 1] = color.g
        colors[offset + 2] = color.b
      }
    })
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return buffer
  }, [particleCount])
  const material = useMemo(() => new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.76,
    size: 0.105,
    sizeAttenuation: true,
    transparent: true,
    vertexColors: true,
  }), [])

  useFrame(({ clock }) => {
    if (reducedMotion && lastReducedFocus.current === focusedIndex) return
    lastReducedFocus.current = reducedMotion ? focusedIndex : undefined
    const [playerX, , playerZ] = freeRoamStore.getState().motion.position
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    const time = reducedMotion ? 0 : clock.elapsedTime
    PROJECT_CHAPTERS.forEach((chapter, chapterIndex) => {
      const dx = chapter.focusPosition[0] - playerX
      const dz = chapter.focusPosition[2] - playerZ
      const culled = dx * dx + dz * dz > chapter.farDistance ** 2
      for (let particle = 0; particle < EVENT_PARTICLES_PER_CHAPTER; particle += 1) {
        const index = chapterIndex * EVENT_PARTICLES_PER_CHAPTER + particle
        if (culled) position.setXYZ(index, 0, -1000, 0)
        else writeEventPosition(position, chapter, index, particle, time, focusedIndex === chapterIndex)
      }
    })
    material.size = focusedIndex === null ? 0.105 : 0.13
    position.needsUpdate = true
  })

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return (
    <points
      frustumCulled={false}
      geometry={geometry}
      material={material}
      name="V3_ProjectChapter_LocalEvents"
    />
  )
}
