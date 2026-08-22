import { useCursor } from '@react-three/drei'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import {
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ART_PALETTE } from '../../art'
import { projects, type Project } from '../../projects'
import {
  circleStrokePoints,
  createBrushLeafGeometry,
  createDrapedVeilGeometry,
  createKoiBodyGeometry,
  createPaperBoatGeometry,
  createPortalMembraneGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from '../v2/scene/geometry'
import { ProjectInkMembrane } from '../v2/scene/materials'
import { freeRoamInput } from '../v2/runtime/input'
import { freeRoamStore } from '../v2/runtime/store'
import type {
  V3MaterialRequest,
  V3SumiMaterialAdapter,
  V3SumiMaterialRole,
  V3Vector3Tuple,
} from './types'

type MutableVector3Tuple = [number, number, number]

interface ProjectGardenLayout {
  artPosition: V3Vector3Tuple
  artRotation: V3Vector3Tuple
  artScale: V3Vector3Tuple
  focusPosition: V3Vector3Tuple
  project: Project
  seed: number
}

const LAYOUT_BY_SLUG: Readonly<Record<string, Omit<ProjectGardenLayout, 'project'>>> = {
  omni: {
    artPosition: [7.2, 1.62, 17.3],
    artRotation: [0, 0, 0],
    artScale: [1.04, 1.04, 1],
    focusPosition: [7.2, 0.08, 19],
    seed: 11,
  },
  'idea-farm': {
    artPosition: [-10.2, 1.56, 7.8],
    artRotation: [0, 0.5, -0.04],
    artScale: [0.88, 1.1, 1],
    focusPosition: [-8.85, 0.08, 9.15],
    seed: 23,
  },
  vpay: {
    artPosition: [-5.2, -0.045, 0.9],
    artRotation: [-Math.PI / 2, 0, 0.08],
    artScale: [1.28, 1.28, 1],
    focusPosition: [-7.5, 0.08, 0.9],
    seed: 31,
  },
  'pod-racing': {
    artPosition: [-11.5, 0.055, -8.8],
    artRotation: [-Math.PI / 2, 0, -0.22],
    artScale: [1.2, 0.92, 1],
    focusPosition: [-11.5, 0.08, -6.65],
    seed: 43,
  },
  'we-are-on-the-cruise': {
    artPosition: [0, -0.045, -9.35],
    artRotation: [-Math.PI / 2, 0, 0.12],
    artScale: [1.32, 1.05, 1],
    focusPosition: [0, 0.08, -11.8],
    seed: 53,
  },
  cloak: {
    artPosition: [8.8, 1.5, -13.05],
    artRotation: [0, 0, 0],
    artScale: [1.02, 1.22, 1],
    focusPosition: [8.8, 0.08, -10.9],
    seed: 61,
  },
  'wish-galaxy': {
    artPosition: [14, 0.74, -8.4],
    artRotation: [-0.82, 0, -0.08],
    artScale: [1.12, 1.12, 1],
    focusPosition: [12.25, 0.08, -7.15],
    seed: 71,
  },
  'between-the-lines': {
    artPosition: [11.2, 1.5, 12],
    artRotation: [0, 0, 0],
    artScale: [0.62, 1.18, 1],
    focusPosition: [10, 0.08, 13.5],
    seed: 83,
  },
  relay: {
    artPosition: [7.8, 0.055, 8.5],
    artRotation: [-Math.PI / 2, 0, 0],
    artScale: [1.18, 1.04, 1],
    focusPosition: [7.8, 0.08, 10.45],
    seed: 97,
  },
}

/**
 * A public, data-driven map of the nine encounters. The order still follows
 * the canonical project catalog, while every placement belongs to a different
 * garden loop rather than a terminal gallery wall.
 */
const PROJECT_GARDEN_ENCOUNTERS: readonly ProjectGardenLayout[] = projects.map((project) => ({
  ...LAYOUT_BY_SLUG[project.slug],
  project,
}))

const GAZE_DISTANCE = 13
const PROXIMITY_RADIUS = 5.35
const INTERACTION_PREFIX = 'project-garden:'
const SUMI_ROLES: readonly V3SumiMaterialRole[] = [
  'earth',
  'stone',
  'wood',
  'pine',
  'vermilion',
  'indigo',
  'metal',
  'washi',
  'spirit',
]

type GeometryBank = Partial<Record<V3SumiMaterialRole, THREE.BufferGeometry>>
type GeometryBuckets = Partial<Record<V3SumiMaterialRole, THREE.BufferGeometry[]>>

const point = (layout: ProjectGardenLayout, x = 0, y = 0, z = 0): MutableVector3Tuple => [
  layout.focusPosition[0] + x,
  layout.focusPosition[1] + y,
  layout.focusPosition[2] + z,
]

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
  for (const attribute of Object.keys(geometry.attributes)) {
    if (attribute !== 'position') geometry.deleteAttribute(attribute)
  }
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  ))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
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

function addTube(
  buckets: GeometryBuckets,
  role: V3SumiMaterialRole,
  layout: ProjectGardenLayout,
  points: readonly THREE.Vector3[],
  radius: number,
  seed: number,
  position: V3Vector3Tuple = layout.focusPosition,
  rotation: V3Vector3Tuple = [0, 0, 0],
) {
  addGeometry(
    buckets,
    role,
    createTaperedTubeGeometry(points, {
      endScale: 0.12,
      irregularity: 0.075,
      radialSegments: 5,
      radius,
      seed,
      startScale: 0.92,
      tubularSegments: Math.max(28, points.length * 9),
    }),
    position,
    rotation,
  )
}

function addCommonClearing(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  const rockOffsets = [
    [-1.65, 0.04, -0.52, 0.54],
    [1.48, 0.03, 0.62, 0.42],
    [0.95, 0.02, -1.13, 0.3],
  ] as const
  rockOffsets.forEach(([x, y, z, scale], index) => {
    addGeometry(
      buckets,
      'stone',
      createScholarStoneGeometry(0.52, layout.seed + index * 5, 10),
      point(layout, x, y, z),
      [0.1 * index, layout.seed * 0.07 + index, -0.05 * index],
      [scale * 1.45, scale, scale],
    )
  })
}

function addOmniEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  const art = layout.artPosition
  addGeometry(
    buckets,
    'vermilion',
    new THREE.SphereGeometry(0.84, 20, 12),
    art,
    [0, 0, 0],
    [1, 1, 0.14],
  )
  addGeometry(
    buckets,
    'metal',
    new THREE.TorusGeometry(1.08, 0.045, 5, 48),
    art,
  )
  addTube(
    buckets,
    'wood',
    layout,
    [
      new THREE.Vector3(-1.45, -0.52, 0.13),
      new THREE.Vector3(-0.78, -0.18, 0.08),
      new THREE.Vector3(-0.12, 0.05, 0.11),
      new THREE.Vector3(0.62, 0.4, 0.08),
      new THREE.Vector3(1.42, 0.54, 0.1),
    ],
    0.052,
    layout.seed,
    art,
  )
}

function addIdeaFarmEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  addGeometry(
    buckets,
    'stone',
    createScholarStoneGeometry(0.5, layout.seed, 13),
    point(layout, 0, 0.32, 0),
    [0.08, 0.3, -0.12],
    [0.78, 1.18, 0.76],
  )
  addTube(
    buckets,
    'pine',
    layout,
    [
      new THREE.Vector3(0, 0.18, 0),
      new THREE.Vector3(-0.24, 0.72, 0.05),
      new THREE.Vector3(0.16, 1.28, -0.04),
      new THREE.Vector3(-0.12, 1.86, 0.04),
      new THREE.Vector3(0.08, 2.38, 0),
    ],
    0.065,
    layout.seed,
  )
  const leaf = createBrushLeafGeometry(0.75, 0.34, 0.15, 9)
  ;[
    [-0.2, 0.72, 0.04, -1.02, 1],
    [0.14, 1.21, -0.02, 1.06, -1],
    [-0.08, 1.7, 0.03, -1, 1],
    [0.06, 2.04, 0, 0.92, -1],
  ].forEach(([x, y, z, roll, flip], index) => {
    addGeometry(
      buckets,
      'pine',
      leaf.clone(),
      point(layout, x, y, z),
      [0, index * 0.42, roll],
      [flip, 1, 1],
    )
  })
  leaf.dispose()
}

function addVPayEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  const waterCenter: MutableVector3Tuple = [...layout.artPosition]
  addGeometry(
    buckets,
    'indigo',
    new THREE.TorusGeometry(1.42, 0.035, 4, 48),
    waterCenter,
    [Math.PI / 2, 0, 0],
    [1.05, 0.78, 1],
  )
  const fish = [
    { color: 'vermilion' as const, offset: [-0.82, 0.02, 0.12], rotation: -0.35, scale: 0.86 },
    { color: 'metal' as const, offset: [0.62, 0.018, -0.38], rotation: 2.35, scale: 0.72 },
    { color: 'indigo' as const, offset: [0.22, 0.015, 0.78], rotation: 1.1, scale: 0.62 },
  ]
  fish.forEach((item, index) => addGeometry(
    buckets,
    item.color,
    createKoiBodyGeometry(1.2, 0.25),
    [waterCenter[0] + item.offset[0], waterCenter[1] + item.offset[1], waterCenter[2] + item.offset[2]],
    [0, item.rotation, index % 2 ? 0.08 : -0.06],
    [item.scale, item.scale * 0.42, item.scale],
  ))
}

function addPodRacingEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  addGeometry(
    buckets,
    'indigo',
    new THREE.TorusGeometry(1.36, 0.052, 5, 52),
    point(layout, 0, 0.045, -2.15),
    [Math.PI / 2, 0, 0],
    [1.18, 0.78, 1],
  )
  addGeometry(
    buckets,
    'vermilion',
    new THREE.BoxGeometry(2.5, 0.035, 0.09),
    point(layout, 0, 0.075, -2.15),
    [0, -0.28, 0],
  )
  ;[
    [-0.72, 0.13, -2.48, -0.45, 'vermilion'],
    [0.66, 0.12, -1.72, 2.7, 'metal'],
  ].forEach(([x, y, z, yaw, role]) => addGeometry(
    buckets,
    role as V3SumiMaterialRole,
    createKoiBodyGeometry(1.05, 0.21),
    point(layout, Number(x), Number(y), Number(z)),
    [0, Number(yaw), 0],
    [0.72, 0.38, 0.62],
  ))
}

function addCruiseEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  const boatPosition: MutableVector3Tuple = [0, 0.02, -9.35]
  addGeometry(
    buckets,
    'washi',
    createPaperBoatGeometry(0.82),
    boatPosition,
    [0.04, 0.22, -0.03],
  )
  ;[-0.48, 0.48].forEach((offset, index) => addTube(
    buckets,
    index === 0 ? 'indigo' : 'metal',
    layout,
    [
      new THREE.Vector3(-1.55, 0, offset),
      new THREE.Vector3(-0.78, 0.03, offset + 0.16),
      new THREE.Vector3(0, -0.02, offset - 0.08),
      new THREE.Vector3(0.78, 0.025, offset + 0.13),
      new THREE.Vector3(1.55, 0, offset),
    ],
    index === 0 ? 0.045 : 0.032,
    layout.seed + index,
    boatPosition,
  ))
}

function addCloakEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  addGeometry(
    buckets,
    'indigo',
    createDrapedVeilGeometry(2.25, 3.05, 14, 18),
    layout.artPosition,
    [0, 0, 0],
  )
  addTube(
    buckets,
    'stone',
    layout,
    circleStrokePoints(1.55, 1.72, -2.9, 0.1, 19, -0.22),
    0.18,
    layout.seed,
    layout.artPosition,
  )
  addGeometry(
    buckets,
    'metal',
    new THREE.TorusGeometry(0.24, 0.035, 5, 24),
    [layout.artPosition[0], layout.artPosition[1] + 0.72, layout.artPosition[2] + 0.18],
  )
}

function addWishGalaxyEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  const spiral = Array.from({ length: 29 }, (_, index) => {
    const progress = index / 28
    const angle = progress * Math.PI * 4.7
    const radius = 0.12 + progress * 1.12
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      Math.sin(progress * 8) * 0.055,
    )
  })
  addTube(
    buckets,
    'indigo',
    layout,
    spiral,
    0.038,
    layout.seed,
    [layout.artPosition[0], layout.artPosition[1] + 0.74, layout.artPosition[2]],
  )
  addGeometry(
    buckets,
    'spirit',
    new THREE.OctahedronGeometry(0.18, 0),
    [layout.artPosition[0], layout.artPosition[1] + 0.74, layout.artPosition[2] + 0.08],
    [0, 0, Math.PI / 4],
    [0.45, 1.55, 0.45],
  )
  ;[-0.88, 0.88].forEach((x) => addGeometry(
    buckets,
    'wood',
    new THREE.CylinderGeometry(0.08, 0.12, 2.35, 6),
    point(layout, x, 1.14, -1.1),
  ))
}

function addBetweenLinesEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  ;[-0.56, 0.56].forEach((x, index) => addGeometry(
    buckets,
    index === 0 ? 'wood' : 'vermilion',
    createDrapedVeilGeometry(0.82, 2.75, 10, 18),
    [layout.artPosition[0] + x, layout.artPosition[1], layout.artPosition[2]],
    [0, 0, index === 0 ? -0.035 : 0.035],
  ))
  ;[-1.12, 1.12].forEach((x, index) => addGeometry(
    buckets,
    'pine',
    new THREE.CylinderGeometry(0.065, 0.1, 3.25, 6),
    [layout.artPosition[0] + x, 1.58, layout.artPosition[2] - 0.16],
    [0, 0, index === 0 ? -0.04 : 0.05],
  ))
}

function addRelayEncounter(buckets: GeometryBuckets, layout: ProjectGardenLayout) {
  const paths = [
    [new THREE.Vector3(0, 0.03, 0), new THREE.Vector3(-0.75, 0.03, -0.62), new THREE.Vector3(-1.48, 0.03, -0.4)],
    [new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0.72, 0.04, -0.55), new THREE.Vector3(1.48, 0.04, -0.18)],
    [new THREE.Vector3(0, 0.035, 0), new THREE.Vector3(0.14, 0.035, 0.76), new THREE.Vector3(-0.28, 0.035, 1.42)],
  ]
  paths.forEach((path, index) => addTube(
    buckets,
    'metal',
    layout,
    path,
    0.032,
    layout.seed + index,
    layout.artPosition,
  ))
  const nodes = [[0, 0], [-1.48, -0.4], [1.48, -0.18], [-0.28, 1.42]] as const
  nodes.forEach(([x, z], index) => addGeometry(
    buckets,
    index === 0 ? 'vermilion' : 'stone',
    createScholarStoneGeometry(index === 0 ? 0.34 : 0.24, layout.seed + index, 10),
    [layout.artPosition[0] + x, layout.artPosition[1] + 0.12, layout.artPosition[2] + z],
    [0, index * 0.6, 0],
    [1, 0.42, 1],
  ))
}

function createProjectGardenGeometry(): GeometryBank {
  const buckets: GeometryBuckets = {}
  PROJECT_GARDEN_ENCOUNTERS.forEach((layout) => {
    addCommonClearing(buckets, layout)
    switch (layout.project.slug) {
      case 'omni': addOmniEncounter(buckets, layout); break
      case 'idea-farm': addIdeaFarmEncounter(buckets, layout); break
      case 'vpay': addVPayEncounter(buckets, layout); break
      case 'pod-racing': addPodRacingEncounter(buckets, layout); break
      case 'we-are-on-the-cruise': addCruiseEncounter(buckets, layout); break
      case 'cloak': addCloakEncounter(buckets, layout); break
      case 'wish-galaxy': addWishGalaxyEncounter(buckets, layout); break
      case 'between-the-lines': addBetweenLinesEncounter(buckets, layout); break
      case 'relay': addRelayEncounter(buckets, layout); break
      default: break
    }
  })

  const bank: GeometryBank = {}
  SUMI_ROLES.forEach((role) => {
    const parts = buckets[role]
    if (!parts?.length) return
    const merged = mergeGeometries(parts, false)
    parts.forEach((geometry) => geometry.dispose())
    if (!merged) throw new Error(`Unable to merge project-garden geometry for role "${role}"`)
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    bank[role] = merged
  })
  return bank
}

function requestForRole(mesh: THREE.Mesh, role: V3SumiMaterialRole): V3MaterialRequest {
  const windResponse = role === 'pine' ? 0.36 : role === 'washi' ? 0.18 : 0
  mesh.userData.livingSumi = {
    brushDirection: role === 'pine' ? [0.2, 1] : [1, 0.12],
    maskDefaults: {
      dryness: role === 'earth' || role === 'stone' ? 0.76 : 0.42,
      pigment: role === 'spirit' ? 0.38 : 0.72,
      wetness: role === 'water' || role === 'indigo' ? 0.48 : 0.14,
      wind: windResponse,
    },
  }
  return {
    mesh,
    meshName: mesh.name,
    outlineProfile: 'none',
    role,
    sourceMaterial: null,
    sourceMaterialName: `RUNTIME_PROJECT_GARDEN_${role.toUpperCase()}`,
    windResponse,
  }
}

function ProjectGardenGeometry({
  materialAdapter,
}: {
  materialAdapter: V3SumiMaterialAdapter
}) {
  const geometries = useMemo(createProjectGardenGeometry, [])
  const meshes = useRef(new Map<V3SumiMaterialRole, THREE.Mesh>())
  const placeholder = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), [])

  useLayoutEffect(() => {
    meshes.current.forEach((mesh, role) => {
      mesh.material = materialAdapter.resolve(requestForRole(mesh, role))
      mesh.visible = true
    })
  }, [materialAdapter])

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry?.dispose())
    placeholder.dispose()
  }, [geometries, placeholder])

  return (
    <group name="v3-project-garden-procedural-ecology">
      {SUMI_ROLES.map((role) => {
        const geometry = geometries[role]
        if (!geometry) return null
        return (
          <mesh
            geometry={geometry}
            key={role}
            material={placeholder}
            name={`V3_ProjectGarden_${role}`}
            ref={(mesh) => {
              if (mesh) meshes.current.set(role, mesh)
              else meshes.current.delete(role)
            }}
            visible={false}
          />
        )
      })}
    </group>
  )
}

function FireflyGuides({
  focusedIndex,
  reducedMotion,
}: {
  focusedIndex: number | null
  reducedMotion: boolean
}) {
  const points = useRef<THREE.Points>(null)
  const lastReducedFocus = useRef<number | null | undefined>(undefined)
  const particlesPerEncounter = 5
  const particleCount = PROJECT_GARDEN_ENCOUNTERS.length * particlesPerEncounter
  const phases = useMemo(() => Float32Array.from(
    { length: particleCount },
    (_, index) => index * 1.933 + (index % particlesPerEncounter) * 0.71,
  ), [particleCount])
  const geometry = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [particleCount])
  const material = useMemo(() => new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color: new THREE.Color(ART_PALETTE.oldGold),
    depthWrite: false,
    opacity: 0.82,
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
  }), [])

  useFrame(({ clock }) => {
    if (reducedMotion && lastReducedFocus.current === focusedIndex) return
    lastReducedFocus.current = reducedMotion ? focusedIndex : undefined
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    const time = reducedMotion ? 0 : clock.elapsedTime
    for (let index = 0; index < particleCount; index += 1) {
      const encounterIndex = Math.floor(index / particlesPerEncounter)
      const localIndex = index % particlesPerEncounter
      const layout = PROJECT_GARDEN_ENCOUNTERS[encounterIndex]
      const phase = phases[index]
      const gathered = focusedIndex === encounterIndex
      const radius = gathered ? 0.72 + localIndex * 0.08 : 1.15 + localIndex * 0.16
      const speed = gathered ? 0.72 : 0.28
      position.setXYZ(
        index,
        layout.artPosition[0] + Math.cos(phase + time * speed) * radius,
        layout.artPosition[1] + 0.25 + Math.sin(phase * 1.7 + time * 0.65) * 0.38,
        layout.artPosition[2] + Math.sin(phase + time * speed) * radius * 0.62,
      )
    }
    position.needsUpdate = true
  })

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return <points frustumCulled={false} geometry={geometry} material={material} ref={points} />
}

export interface ProjectGardenProps {
  active?: boolean
  materialAdapter: V3SumiMaterialAdapter
  reducedMotion?: boolean
}

/**
 * Nine projects dissolved into a looped garden ecology. Each artwork remains
 * dormant inside its natural encounter until proximity, gaze or pointer focus
 * gathers the local fireflies and lets the ink membrane bloom.
 */
export function ProjectGarden({
  active = true,
  materialAdapter,
  reducedMotion = false,
}: ProjectGardenProps): ReactElement {
  const artMeshes = useRef<Array<THREE.Mesh | null>>([])
  const centerRaycaster = useMemo(() => {
    const raycaster = new THREE.Raycaster()
    raycaster.near = 0.2
    raycaster.far = GAZE_DISTANCE
    return raycaster
  }, [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])
  const hits = useRef<THREE.Intersection[]>([])
  const pointerIndex = useRef<number | null>(null)
  const spaceQueued = useRef(false)
  const focusedIndexRef = useRef<number | null>(null)
  const publishedInteraction = useRef<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [activated, setActivated] = useState<ReadonlySet<number>>(() => new Set())
  useCursor(focusedIndex !== null)

  const activateProject = useCallback((index: number) => {
    if (!active) return
    const layout = PROJECT_GARDEN_ENCOUNTERS[index]
    if (!layout) return
    const interactionId = `${INTERACTION_PREFIX}${layout.project.slug}`
    setActivated((current) => {
      if (current.has(index)) return current
      const next = new Set(current)
      next.add(index)
      return next
    })
    freeRoamStore.getState().setInteraction({ lastActivatedId: interactionId })
    window.open(layout.project.href, '_blank', 'noopener,noreferrer')
  }, [active])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !active
        || event.repeat
        || event.code !== 'Space'
        || !freeRoamStore.getState().interaction.nearbyId?.startsWith(INTERACTION_PREFIX)
      ) return
      spaceQueued.current = true
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active])

  useEffect(() => () => {
    const runtime = freeRoamStore.getState()
    if (runtime.interaction.nearbyId?.startsWith(INTERACTION_PREFIX)) {
      runtime.setInteraction({ available: false, nearbyId: null })
    }
  }, [])

  useFrame(({ camera }) => {
    if (!active) {
      if (publishedInteraction.current !== null) {
        publishedInteraction.current = null
        freeRoamStore.getState().setInteraction({ available: false, nearbyId: null })
      }
      return
    }

    const runtime = freeRoamStore.getState()
    const [playerX, , playerZ] = runtime.motion.position
    let nearestIndex: number | null = null
    let nearestDistanceSquared = PROXIMITY_RADIUS * PROXIMITY_RADIUS
    PROJECT_GARDEN_ENCOUNTERS.forEach((layout, index) => {
      const dx = layout.focusPosition[0] - playerX
      const dz = layout.focusPosition[2] - playerZ
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared
        nearestIndex = index
      }
    })

    centerRaycaster.setFromCamera(center, camera)
    hits.current.length = 0
    const raycastTargets = artMeshes.current.filter((mesh): mesh is THREE.Mesh => Boolean(mesh))
    centerRaycaster.intersectObjects(raycastTargets, false, hits.current)
    const gazeValue = hits.current[0]?.object.userData.projectGardenIndex
    const gazeIndex = Number.isInteger(gazeValue) ? Number(gazeValue) : null
    const gazeAllowed = gazeIndex !== null && (() => {
      const focus = PROJECT_GARDEN_ENCOUNTERS[gazeIndex].focusPosition
      return (focus[0] - playerX) ** 2 + (focus[2] - playerZ) ** 2 <= GAZE_DISTANCE ** 2
    })()
    const pointerValue = pointerIndex.current
    const pointerAllowed = pointerValue !== null && (() => {
      const focus = PROJECT_GARDEN_ENCOUNTERS[pointerValue].focusPosition
      return (focus[0] - playerX) ** 2 + (focus[2] - playerZ) ** 2 <= GAZE_DISTANCE ** 2
    })()
    const candidate = pointerAllowed
      ? pointerValue
      : gazeAllowed
        ? gazeIndex
        : nearestIndex

    if (candidate !== focusedIndexRef.current) {
      focusedIndexRef.current = candidate
      setFocusedIndex(candidate)
    }

    const interactionId = candidate === null
      ? null
      : `${INTERACTION_PREFIX}${PROJECT_GARDEN_ENCOUNTERS[candidate].project.slug}`
    if (interactionId !== publishedInteraction.current) {
      publishedInteraction.current = interactionId
      runtime.setInteraction({ available: interactionId !== null, nearbyId: interactionId })
    }

    const interactionQueued = freeRoamInput.consumeInteract() || spaceQueued.current
    spaceQueued.current = false
    if (interactionQueued && candidate !== null) activateProject(candidate)
  })

  const handlePointerOver = (index: number, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    pointerIndex.current = index
  }

  const handlePointerOut = (index: number) => {
    if (pointerIndex.current === index) pointerIndex.current = null
  }

  const membraneGeometry = useMemo(
    () => createPortalMembraneGeometry(2.12, 2.12, 14, 16),
    [],
  )
  useEffect(() => () => membraneGeometry.dispose(), [membraneGeometry])

  return (
    <group name="v3-nine-living-project-garden">
      <ProjectGardenGeometry materialAdapter={materialAdapter} />
      <FireflyGuides focusedIndex={focusedIndex} reducedMotion={reducedMotion} />
      {PROJECT_GARDEN_ENCOUNTERS.map((layout, index) => (
        <mesh
          geometry={membraneGeometry}
          key={layout.project.slug}
          name={`V3_ProjectEncounter_${layout.project.slug}`}
          onClick={(event) => {
            event.stopPropagation()
            activateProject(index)
          }}
          onPointerOut={() => handlePointerOut(index)}
          onPointerOver={(event) => handlePointerOver(index, event)}
          position={layout.artPosition}
          ref={(mesh) => {
            artMeshes.current[index] = mesh
            if (mesh) mesh.userData.projectGardenIndex = index
          }}
          rotation={layout.artRotation}
          scale={layout.artScale}
          userData={{ projectHref: layout.project.href, projectSlug: layout.project.slug }}
        >
          <ProjectInkMembrane
            active={activated.has(index)}
            focused={focusedIndex === index}
            image={layout.project.image}
            reducedMotion={reducedMotion}
          />
        </mesh>
      ))}
    </group>
  )
}
