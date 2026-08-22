import { useCursor, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../../art'
import { projects } from '../../projects'
import { freeRoamInput } from '../v2/runtime/input'
import { freeRoamStore } from '../v2/runtime/store'
import { V3_GATE_BRIDGE_ANCHORS } from './composition'
import type {
  V3MaterialRequest,
  V3OutlineProfile,
  V3SumiMaterialAdapter,
  V3SumiMaterialRole,
  V3Vector3Tuple,
} from './types'

const PANEL_WIDTH = 1.18
const PANEL_HEIGHT = 2.08
const ART_WIDTH = 1.02
const ART_HEIGHT = 1.02
const PANEL_CENTER_Y = 1.36
const COURT_RADIUS = 4.6
const ARC_START_DEGREES = 208
const ARC_END_DEGREES = 332
const PROJECT_ART_URLS = projects.map((project) => project.image)
const SCROLL_VARIATIONS = [
  { length: 1.18, lift: 0.03, radius: 0.68, scale: 0.78, yaw: -0.07 },
  { length: 0.84, lift: 0.23, radius: 0.25, scale: 0.91, yaw: 0.04 },
  { length: 1.08, lift: 0.06, radius: 0.48, scale: 0.84, yaw: -0.034 },
  { length: 0.9, lift: 0.28, radius: 0.08, scale: 1.01, yaw: 0.027 },
  { length: 1.24, lift: 0.4, radius: -0.62, scale: 1.32, yaw: 0 },
  { length: 0.94, lift: 0.23, radius: 0.12, scale: 0.98, yaw: -0.024 },
  { length: 1.12, lift: 0.04, radius: 0.52, scale: 0.83, yaw: 0.036 },
  { length: 0.86, lift: 0.22, radius: 0.28, scale: 0.9, yaw: -0.043 },
  { length: 1.16, lift: 0.02, radius: 0.7, scale: 0.77, yaw: 0.072 },
] as const
const COURT_STEPPING_STONES = [
  { scale: [0.54, 0.075, 0.37], x: 12.18, yaw: -0.08, z: -6.86 },
  { scale: [0.48, 0.07, 0.34], x: 12.58, yaw: 0.15, z: -7.52 },
  { scale: [0.57, 0.08, 0.35], x: 12.22, yaw: -0.19, z: -8.22 },
  { scale: [0.5, 0.075, 0.38], x: 12.62, yaw: 0.08, z: -8.93 },
  { scale: [0.61, 0.08, 0.39], x: 12.31, yaw: -0.12, z: -9.68 },
] as const

function courtGroundHeight(x: number, z: number) {
  const broad = Math.sin(x * 0.23 + z * 0.11) * 0.055
    + Math.cos(z * 0.19 - x * 0.08) * 0.035
  const outerBank = THREE.MathUtils.smoothstep(Math.abs(x), 9, 18) * 0.34
  const thresholdLift = THREE.MathUtils.smoothstep(z, 6, 24) * 0.055
  return broad + outerBank + thresholdLift
}

function createCourtClearingGeometry() {
  const center = V3_GATE_BRIDGE_ANCHORS.projectCourt
  const segments = 48
  const rings = 7
  const positions: number[] = [center[0], courtGroundHeight(center[0], center[2]) + 0.032, center[2]]
  const colors: number[] = [0.62, 0.08, 0.28, 0]
  const indices: number[] = []

  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = ring / rings
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2
      const irregularity = 1
        + Math.sin(angle * 3 + 0.7) * 0.028 * radius
        + Math.sin(angle * 7 - 1.4) * 0.014 * radius
      const x = center[0] + Math.cos(angle) * 5.05 * radius * irregularity
      const z = center[2] + Math.sin(angle) * 4.75 * radius * irregularity
      const y = courtGroundHeight(x, z)
        + 0.028
        + Math.sin(angle * 5 + ring * 1.7) * 0.006 * radius
      positions.push(x, y, z)
      colors.push(
        THREE.MathUtils.lerp(0.62, 0.74, radius),
        THREE.MathUtils.lerp(0.08, 0.035, radius),
        THREE.MathUtils.lerp(0.28, 0.4, radius),
        0,
      )
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments
    indices.push(0, 1 + segment, 1 + next)
  }
  for (let ring = 1; ring < rings; ring += 1) {
    const innerStart = 1 + (ring - 1) * segments
    const outerStart = 1 + ring * segments
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments
      const a = innerStart + segment
      const b = innerStart + next
      const c = outerStart + segment
      const d = outerStart + next
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createScrollBackingGeometry() {
  const shape = new THREE.Shape()
  const edgeSteps = 14
  const edgeX = (side: -1 | 1, progress: number) => (
    side * 0.5
    + Math.sin(progress * Math.PI * 5 + side * 0.8) * 0.013
    + Math.sin(progress * Math.PI * 11 - side * 0.3) * 0.006
  )
  shape.moveTo(edgeX(-1, 0), -0.5)
  for (let index = 1; index <= edgeSteps; index += 1) {
    const progress = index / edgeSteps
    shape.lineTo(edgeX(-1, progress), -0.5 + progress)
  }
  for (let index = edgeSteps; index >= 0; index -= 1) {
    const progress = index / edgeSteps
    shape.lineTo(edgeX(1, progress), -0.5 + progress)
  }
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape, 1)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

const projectArtVertexShader = /* glsl */ `
  uniform float uHover;
  uniform float uSeed;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float paperHold = sin(uv.y * 3.14159265);
    float paperBreath = sin(uv.y * 8.0 + uTime * 0.42 + uSeed * 7.0)
      * sin(uv.x * 5.0 - uTime * 0.28 + uSeed * 3.0);
    transformed.z += paperHold * paperBreath * (0.004 + uHover * 0.004);
    vec4 world = modelMatrix * vec4(transformed, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const projectArtFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uGold;
  uniform vec3 uPaper;
  uniform vec3 uSoot;
  uniform float uHover;
  uniform float uSeed;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;

  float paperHash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float paperNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(paperHash(cell), paperHash(cell + vec2(1.0, 0.0)), local.x),
      mix(paperHash(cell + vec2(0.0, 1.0)), paperHash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  void main() {
    float warpX = paperNoise(vUv * 6.2 + vec2(uTime * 0.021, uSeed * 7.0));
    float warpY = paperNoise(vUv * 8.4 + vec2(uSeed * 11.0, -uTime * 0.016));
    vec2 sampleUv = clamp(
      vUv + (vec2(warpX, warpY) - 0.5) * (0.008 + uHover * 0.004),
      0.006,
      0.994
    );
    vec3 source = texture2D(uMap, sampleUv).rgb;
    float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));
    float fibre = paperNoise(vWorld.xy * vec2(61.0, 89.0) + uSeed * 31.0);
    float wash = paperNoise(vWorld.xy * 3.6 + vec2(uTime * 0.015, uSeed * 9.0));
    float edge = smoothstep(0.0, 0.055, vUv.x)
      * smoothstep(0.0, 0.055, 1.0 - vUv.x)
      * smoothstep(0.0, 0.045, vUv.y)
      * smoothstep(0.0, 0.045, 1.0 - vUv.y);
    float edgeDistance = min(
      min(vUv.x, 1.0 - vUv.x),
      min(vUv.y, 1.0 - vUv.y)
    );
    float edgeNoise = paperNoise(vUv * 23.0 + vec2(uSeed * 17.0, uSeed * 31.0));
    float imageHold = smoothstep(0.02, 0.145, edgeDistance + (edgeNoise - 0.5) * 0.075);

    vec3 restrained = mix(vec3(luminance), source, 0.88);
    vec3 color = mix(uPaper, restrained, 0.96);
    color = mix(uPaper, color, imageHold);
    color *= mix(0.955, 1.025, fibre);
    color = mix(color, color * uSoot, (1.0 - edge) * 0.12 + wash * 0.018);
    color = mix(color, color + uGold * 0.075, uHover);
    color += uPaper * uHover * edge * 0.018;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

interface CourtPanelPlacement {
  length: number
  position: V3Vector3Tuple
  rotationY: number
  scale: number
}

const COURT_PANEL_PLACEMENTS: readonly CourtPanelPlacement[] = projects.map((_, index) => {
  const progress = projects.length <= 1 ? 0.5 : index / (projects.length - 1)
  const angle = THREE.MathUtils.degToRad(
    THREE.MathUtils.lerp(ARC_START_DEGREES, ARC_END_DEGREES, progress),
  )
  const variation = SCROLL_VARIATIONS[index]
  const center = V3_GATE_BRIDGE_ANCHORS.projectCourt
  const radius = COURT_RADIUS + variation.radius
  const x = center[0] + Math.cos(angle) * radius
  const z = center[2] + Math.sin(angle) * radius
  return {
    length: variation.length,
    position: [x, courtGroundHeight(x, z) + 0.018 + variation.lift, z],
    rotationY: Math.atan2(center[0] - x, center[2] - z) + variation.yaw,
    scale: variation.scale,
  }
})

function courtSupportRequest(
  mesh: THREE.Mesh,
  role: V3SumiMaterialRole,
  outlineProfile: V3OutlineProfile,
): V3MaterialRequest {
  return {
    mesh,
    meshName: mesh.name,
    outlineProfile,
    role,
    sourceMaterial: null,
    sourceMaterialName: `RUNTIME_PROJECT_COURT_${role.toUpperCase()}`,
    windResponse: 0,
  }
}

function writeInstanceMatrices(
  backings: THREE.InstancedMesh,
  frames: THREE.InstancedMesh,
  plinths: THREE.InstancedMesh,
) {
  const panelRoot = new THREE.Object3D()
  const part = new THREE.Object3D()
  const worldMatrix = new THREE.Matrix4()
  let frameIndex = 0

  COURT_PANEL_PLACEMENTS.forEach((placement, index) => {
    const scrollHeight = PANEL_HEIGHT * placement.length
    const scrollCenterY = PANEL_CENTER_Y + (PANEL_HEIGHT - scrollHeight) * 0.5
    const scrollTopY = scrollCenterY + scrollHeight * 0.5
    const scrollBottomY = scrollCenterY - scrollHeight * 0.5
    panelRoot.position.set(...placement.position)
    panelRoot.rotation.set(0, placement.rotationY, 0)
    panelRoot.scale.setScalar(placement.scale)
    panelRoot.updateMatrix()

    part.position.set(0, scrollCenterY, -0.006)
    part.rotation.set(0, 0, 0)
    part.scale.set(PANEL_WIDTH, scrollHeight, 1)
    part.updateMatrix()
    worldMatrix.multiplyMatrices(panelRoot.matrix, part.matrix)
    backings.setMatrixAt(index, worldMatrix)

    const rails = [
      { position: [0, scrollTopY + 0.025, 0.052], scale: [PANEL_WIDTH + 0.28, 0.055, 0.055] },
      { position: [0, scrollBottomY - 0.02, 0.052], scale: [PANEL_WIDTH + 0.18, 0.045, 0.05] },
      { position: [0, scrollTopY + 0.28, 0.028], scale: [0.018, 0.5, 0.018] },
    ] as const
    rails.forEach((rail) => {
      part.position.set(rail.position[0], rail.position[1], rail.position[2])
      part.rotation.set(0, 0, 0)
      part.scale.set(rail.scale[0], rail.scale[1], rail.scale[2])
      part.updateMatrix()
      worldMatrix.multiplyMatrices(panelRoot.matrix, part.matrix)
      frames.setMatrixAt(frameIndex, worldMatrix)
      frameIndex += 1
    })

  })

  COURT_STEPPING_STONES.forEach((stone, index) => {
    part.position.set(stone.x, courtGroundHeight(stone.x, stone.z) + 0.092, stone.z)
    part.rotation.set(0, stone.yaw, 0)
    part.scale.set(stone.scale[0], stone.scale[1], stone.scale[2])
    part.updateMatrix()
    plinths.setMatrixAt(index, part.matrix)
  })

  ;[backings, frames, plinths].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
  })
}

export interface ProjectCourtProps {
  materialAdapter: V3SumiMaterialAdapter
  reducedMotion?: boolean
}

/**
 * A ritual hanging-scroll sanctuary: nine source artworks become staggered
 * torn-edge kakemono, with one dominant central scroll. Repeated paper, rods,
 * cords and stepping stones stay instanced, while the arc faces the bridge
 * exit and preserves a free-roam clearing at its centre.
 */
export function ProjectCourt({ materialAdapter, reducedMotion = false }: ProjectCourtProps) {
  const artGroups = useRef<Array<THREE.Group | null>>([])
  const artworkMeshes = useRef<Array<THREE.Mesh | null>>([])
  const backings = useRef<THREE.InstancedMesh>(null)
  const centerAimIndex = useRef<number | null>(null)
  const clearing = useRef<THREE.Mesh>(null)
  const frames = useRef<THREE.InstancedMesh>(null)
  const plinths = useRef<THREE.InstancedMesh>(null)
  const raycastHits = useRef<THREE.Intersection[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const projectTextures = useTexture(PROJECT_ART_URLS)
  useCursor(hoveredIndex !== null)

  const backingGeometry = useMemo(createScrollBackingGeometry, [])
  const frameGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const plinthGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 10, 1), [])
  const clearingGeometry = useMemo(createCourtClearingGeometry, [])
  const artworkGeometry = useMemo(() => new THREE.PlaneGeometry(ART_WIDTH, ART_HEIGHT, 12, 16), [])
  const hiddenPlaceholderMaterial = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), [])
  const centerRaycaster = useMemo(() => {
    const raycaster = new THREE.Raycaster()
    raycaster.near = 0.2
    raycaster.far = 12.5
    return raycaster
  }, [])
  const viewportCenter = useMemo(() => new THREE.Vector2(0, 0), [])
  const artworkMaterials = useMemo(() => projectTextures.map((texture, index) => {
    const material = new THREE.ShaderMaterial({
      depthTest: true,
      depthWrite: true,
      fragmentShader: projectArtFragmentShader,
      side: THREE.FrontSide,
      uniforms: {
        uGold: new THREE.Uniform(new THREE.Color(ART_PALETTE.oldGold)),
        uHover: new THREE.Uniform(0),
        uMap: new THREE.Uniform(texture),
        uPaper: new THREE.Uniform(new THREE.Color(ART_PALETTE.washi)),
        uSeed: new THREE.Uniform((index + 1) / projects.length),
        uSoot: new THREE.Uniform(new THREE.Color(ART_PALETTE.soot)),
        uTime: new THREE.Uniform(0),
      },
      vertexShader: projectArtVertexShader,
    })
    material.name = `V3_ProjectArtwork_${projects[index].slug}`
    return material
  }), [projectTextures])

  useLayoutEffect(() => {
    projectTextures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 8
      texture.magFilter = THREE.LinearFilter
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.generateMipmaps = true
      texture.needsUpdate = true
    })
  }, [projectTextures])

  useLayoutEffect(() => {
    if (!backings.current || !clearing.current || !frames.current || !plinths.current) return
    writeInstanceMatrices(backings.current, frames.current, plinths.current)
    backings.current.material = materialAdapter.resolve(
      courtSupportRequest(backings.current, 'washi', 'none'),
    )
    clearing.current.material = materialAdapter.resolve(
      courtSupportRequest(clearing.current, 'earth', 'none'),
    )
    frames.current.material = materialAdapter.resolve(
      courtSupportRequest(frames.current, 'wood', 'none'),
    )
    plinths.current.material = materialAdapter.resolve(
      courtSupportRequest(plinths.current, 'stone', 'none'),
    )
    backings.current.visible = true
    clearing.current.visible = true
    frames.current.visible = true
    plinths.current.visible = true
  }, [materialAdapter])

  useFrame(({ camera, clock }, delta) => {
    artworkMaterials.forEach((material, index) => {
      const isHovered = hoveredIndex === index
      material.uniforms.uHover.value = THREE.MathUtils.damp(
        material.uniforms.uHover.value,
        isHovered ? 1 : 0,
        7,
        delta,
      )
      material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime

      const group = artGroups.current[index]
      if (!group) return
      const placement = COURT_PANEL_PLACEMENTS[index]
      const idleFloat = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.42 + index * 1.73) * 0.008
      group.position.y = THREE.MathUtils.damp(
        group.position.y,
        placement.position[1] + idleFloat + (isHovered ? 0.055 : 0),
        7,
        delta,
      )
      const scale = THREE.MathUtils.damp(
        group.scale.x,
        placement.scale * (isHovered ? 1.045 : 1),
        7,
        delta,
      )
      group.scale.setScalar(scale)
    })

    centerRaycaster.setFromCamera(viewportCenter, camera)
    raycastHits.current.length = 0
    artworkMeshes.current.forEach((mesh) => {
      if (mesh) centerRaycaster.intersectObject(mesh, false, raycastHits.current)
    })
    const projectIndex = raycastHits.current[0]?.object.userData.projectIndex
    const aimedIndex = Number.isInteger(projectIndex) ? Number(projectIndex) : null
    const pointerLocked = freeRoamStore.getState().pointerLocked
    if (pointerLocked && aimedIndex !== centerAimIndex.current) {
      centerAimIndex.current = aimedIndex
      setHoveredIndex(aimedIndex)
    } else if (!pointerLocked && centerAimIndex.current !== null) {
      centerAimIndex.current = null
      setHoveredIndex(null)
    }
    const interactionQueued = freeRoamInput.consumeInteract()
    if (aimedIndex !== null && interactionQueued) {
      window.open(projects[aimedIndex].href, '_blank', 'noopener,noreferrer')
    }
  })

  useEffect(() => () => {
    backingGeometry.dispose()
    frameGeometry.dispose()
    plinthGeometry.dispose()
    clearingGeometry.dispose()
    artworkGeometry.dispose()
    hiddenPlaceholderMaterial.dispose()
    artworkMaterials.forEach((material) => material.dispose())
  }, [artworkGeometry, artworkMaterials, backingGeometry, clearingGeometry, frameGeometry, hiddenPlaceholderMaterial, plinthGeometry])

  return (
    <group dispose={null} name="v3-nine-project-hanging-scroll-sanctuary">
      <mesh
        geometry={clearingGeometry}
        material={hiddenPlaceholderMaterial}
        name="V3_ProjectCourt_OrganicStoneClearing"
        receiveShadow
        ref={clearing}
        visible={false}
      />
      <instancedMesh
        args={[backingGeometry, hiddenPlaceholderMaterial, projects.length]}
        castShadow
        name="V3_ProjectCourt_WashiScrolls"
        receiveShadow
        ref={backings}
        visible={false}
      />
      <instancedMesh
        args={[frameGeometry, hiddenPlaceholderMaterial, projects.length * 3]}
        castShadow
        name="V3_ProjectCourt_ScrollRods"
        receiveShadow
        ref={frames}
        visible={false}
      />
      <instancedMesh
        args={[
          plinthGeometry,
          hiddenPlaceholderMaterial,
          COURT_STEPPING_STONES.length,
        ]}
        castShadow
        name="V3_ProjectCourt_PathStones"
        receiveShadow
        ref={plinths}
        visible={false}
      />

      {projects.map((project, index) => {
        const placement = COURT_PANEL_PLACEMENTS[index]
        return (
          <group
            key={project.slug}
            name={`V3_ProjectPortal_${project.slug}`}
            position={placement.position}
            ref={(node) => {
              artGroups.current[index] = node
            }}
            rotation={[0, placement.rotationY, 0]}
            scale={placement.scale}
            userData={{ projectHref: project.href, projectSlug: project.slug }}
          >
            <mesh
              geometry={artworkGeometry}
              material={artworkMaterials[index]}
              name={`V3_ProjectPainting_${project.slug}`}
              onClick={(event) => {
                event.stopPropagation()
                window.open(project.href, '_blank', 'noopener,noreferrer')
              }}
              onPointerOut={() => {
                setHoveredIndex((current) => current === index ? null : current)
              }}
              onPointerOver={(event) => {
                event.stopPropagation()
                setHoveredIndex(index)
              }}
              position={[
                0,
                PANEL_CENTER_Y + (PANEL_HEIGHT - PANEL_HEIGHT * placement.length) * 0.5 + 0.06,
                0.072,
              ]}
              ref={(node) => {
                artworkMeshes.current[index] = node
                if (node) node.userData.projectIndex = index
              }}
              renderOrder={2}
            />
          </group>
        )
      })}
    </group>
  )
}
