import { useCursor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { type ReactElement, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { projects, type Project } from '../../../projects'
import { useGardenInteractable, type GardenInteractionDescriptor, type Vec3Tuple } from '../interactions'
import {
  circleStrokePoints,
  createBrushLeafGeometry,
  createDrapedVeilGeometry,
  createKoiBodyGeometry,
  createOrganicPlateGeometry,
  createPaperBoatGeometry,
  createPortalMembraneGeometry,
  createRibbonGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface, LIVING_SCROLL_PALETTE, ProjectInkMembrane } from './materials'

interface ShrinePlacement {
  position: Vec3Tuple
  rotation: number
  scale?: number
}

const shrinePlacements: readonly ShrinePlacement[] = [
  { position: [0, 0.18, -19.4], rotation: 0 },
  { position: [8.2, 0.12, -17.2], rotation: -0.48, scale: 0.94 },
  { position: [14.4, 0.1, -9.1], rotation: -1.1, scale: 0.92 },
  { position: [15.4, 0.16, 0.2], rotation: -1.58, scale: 0.9 },
  { position: [11.5, 0.12, 8.5], rotation: -2.23, scale: 0.9 },
  { position: [-10.7, 0.14, 8.7], rotation: 2.22, scale: 0.9 },
  { position: [-15.2, 0.12, 1], rotation: 1.58, scale: 0.9 },
  { position: [-14.6, 0.1, -8.7], rotation: 1.08, scale: 0.92 },
  { position: [-8.2, 0.12, -17.3], rotation: 0.48, scale: 0.94 },
] as const

function BrushArc({
  geometry,
  role = 'gold',
}: {
  geometry: THREE.BufferGeometry
  role?: 'gold' | 'indigo' | 'soot' | 'vermilion'
}) {
  return <mesh geometry={geometry}><GardenSurface role={role} /></mesh>
}

function OmniSculpture() {
  const arcs = useMemo(() => [
    createTaperedTubeGeometry(circleStrokePoints(1.02, 1.02, -2.8, 2.85, 18), { radius: 0.045, endScale: 0.05, startScale: 0.8, radialSegments: 6, seed: 3 }),
    createTaperedTubeGeometry(circleStrokePoints(1.2, 0.55, -2.8, 2.9, 18), { radius: 0.035, endScale: 0.04, startScale: 0.78, radialSegments: 6, seed: 8 }),
    createTaperedTubeGeometry(circleStrokePoints(1.15, 0.48, -2.65, 3.0, 18), { radius: 0.03, endScale: 0.03, startScale: 0.7, radialSegments: 6, seed: 13 }),
  ], [])
  const core = useMemo(() => createScholarStoneGeometry(0.28, 82, 18), [])
  return (
    <group>
      <BrushArc geometry={arcs[0]} />
      <group rotation={[0.92, 0.1, 0.28]}><BrushArc geometry={arcs[1]} role="indigo" /></group>
      <group rotation={[-0.74, 0.4, -0.25]}><BrushArc geometry={arcs[2]} role="vermilion" /></group>
      <mesh castShadow geometry={core}><GardenSurface role="gold" /></mesh>
    </group>
  )
}

function VPaySculpture() {
  const body = useMemo(() => createKoiBodyGeometry(1.5, 0.28), [])
  const tail = useMemo(() => createBrushLeafGeometry(0.82, 0.55, 0.13, 10), [])
  const current = useMemo(() => createTaperedTubeGeometry([
    new THREE.Vector3(-1.25, -0.7, 0),
    new THREE.Vector3(-0.72, -0.25, 0.05),
    new THREE.Vector3(0.15, -0.1, -0.04),
    new THREE.Vector3(0.94, 0.28, 0.05),
    new THREE.Vector3(1.2, 0.72, 0),
  ], { radius: 0.04, endScale: 0.03, startScale: 0.8, radialSegments: 6, seed: 12 }), [])
  return (
    <group rotation={[0, 0, 0.22]}>
      <BrushArc geometry={current} role="indigo" />
      <mesh castShadow geometry={body} rotation={[0, 0, 0.42]} scale={[0.82, 0.68, 0.82]}><GardenSurface role="gold" /></mesh>
      <mesh geometry={tail} position={[-0.68, -0.26, 0]} rotation={[0, 0, -1.1]}><GardenSurface role="vermilion" side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

function CloakSculpture() {
  const veil = useMemo(() => createDrapedVeilGeometry(1.82, 2.35, 24, 30), [])
  const clasp = useMemo(() => createTaperedTubeGeometry(circleStrokePoints(0.22, 0.22, -2.7, 3.1, 13), {
    radius: 0.026, endScale: 0.04, startScale: 0.8, radialSegments: 6, seed: 27,
  }), [])
  return (
    <group position={[0, 0.1, 0]}>
      <mesh geometry={veil} scale={[1, 1, 1]}><GardenSurface role="soot" side={THREE.DoubleSide} /></mesh>
      <mesh geometry={clasp} position={[0, 0.7, 0.16]}><GardenSurface role="gold" /></mesh>
    </group>
  )
}

function RelaySculpture() {
  const signal = useMemo(() => createTaperedTubeGeometry([
    new THREE.Vector3(-1.22, -0.65, 0),
    new THREE.Vector3(-0.62, 0.42, 0.08),
    new THREE.Vector3(0, -0.05, -0.04),
    new THREE.Vector3(0.62, 0.58, 0.06),
    new THREE.Vector3(1.2, -0.55, 0),
  ], { radius: 0.042, endScale: 0.05, startScale: 0.8, radialSegments: 6, seed: 34 }), [])
  const node = useMemo(() => createScholarStoneGeometry(0.22, 33, 14), [])
  return (
    <group>
      <BrushArc geometry={signal} role="vermilion" />
      {[[-1.22, -0.65], [-0.62, 0.42], [0, -0.05], [0.62, 0.58], [1.2, -0.55]].map(([x, y], index) => (
        <mesh geometry={node} key={index} position={[x, y, 0]} scale={index === 2 ? 1.25 : 0.8}>
          <GardenSurface role={index % 2 ? 'gold' : 'paper'} />
        </mesh>
      ))}
    </group>
  )
}

function WishGalaxySculpture() {
  const spiral = useMemo(() => {
    const points = Array.from({ length: 24 }, (_, index) => {
      const t = index / 23
      const angle = t * Math.PI * 4.5
      const radius = 0.12 + t * 1.16
      return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(t * 9) * 0.08)
    })
    return createTaperedTubeGeometry(points, { radius: 0.035, endScale: 0.02, startScale: 0.75, radialSegments: 6, seed: 19, tubularSegments: 80 })
  }, [])
  const star = useMemo(() => createBrushLeafGeometry(0.32, 0.15, 0, 6), [])
  return (
    <group>
      <BrushArc geometry={spiral} role="indigo" />
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = index * 2.2
        const radius = 0.35 + index * 0.16
        return (
          <mesh geometry={star} key={index} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0.08]} rotation={[0, 0, -angle]} scale={0.7 + index * 0.08}>
            <GardenSurface role={index % 3 === 0 ? 'vermilion' : 'gold'} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}

function IdeaFarmSculpture() {
  const vine = useMemo(() => createTaperedTubeGeometry([
    new THREE.Vector3(0, -1.1, 0),
    new THREE.Vector3(-0.25, -0.45, 0.04),
    new THREE.Vector3(0.18, 0.08, -0.03),
    new THREE.Vector3(-0.15, 0.72, 0.04),
    new THREE.Vector3(0.08, 1.25, 0),
  ], { radius: 0.07, endScale: 0.1, startScale: 1, radialSegments: 7, seed: 29 }), [])
  const leaf = useMemo(() => createBrushLeafGeometry(0.72, 0.3, 0.16, 9), [])
  const seed = useMemo(() => createScholarStoneGeometry(0.34, 101, 16), [])
  return (
    <group>
      <BrushArc geometry={vine} role="indigo" />
      <mesh geometry={seed} position={[0, -1.05, 0]} scale={[0.7, 1, 0.65]}><GardenSurface role="gold" /></mesh>
      {[[-0.18, -0.42, -1], [0.15, 0.1, 1], [-0.12, 0.68, -1], [0.05, 1.06, 1]].map(([x, y, side], index) => (
        <mesh geometry={leaf} key={index} position={[x, y, 0]} rotation={[0, 0, side * 1.02]} scale={[side, 0.8 + index * 0.06, 1]}>
          <GardenSurface role="foliage" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function BetweenLinesSculpture() {
  const ribbons = useMemo(() => [
    createRibbonGeometry([
      new THREE.Vector3(-0.7, -1.25, 0), new THREE.Vector3(-0.38, -0.35, 0.14), new THREE.Vector3(-0.64, 0.45, -0.06), new THREE.Vector3(-0.3, 1.25, 0.08),
    ], { width: 0.18, thickness: 0.028, tubularSegments: 38 }),
    createRibbonGeometry([
      new THREE.Vector3(0.7, -1.25, 0), new THREE.Vector3(0.38, -0.35, -0.1), new THREE.Vector3(0.63, 0.45, 0.08), new THREE.Vector3(0.28, 1.25, -0.06),
    ], { width: 0.18, thickness: 0.028, tubularSegments: 38 }),
  ], [])
  return (
    <group>
      <mesh geometry={ribbons[0]}><GardenSurface role="soot" /></mesh>
      <mesh geometry={ribbons[1]}><GardenSurface role="vermilion" /></mesh>
    </group>
  )
}

function PodRacingSculpture() {
  const pod = useMemo(() => createKoiBodyGeometry(1.15, 0.22), [])
  const track = useMemo(() => createTaperedTubeGeometry(circleStrokePoints(1.25, 0.78, -2.85, 2.9, 18), {
    radius: 0.032, endScale: 0.03, startScale: 0.8, radialSegments: 6, seed: 39,
  }), [])
  return (
    <group rotation={[0, 0, -0.12]}>
      <BrushArc geometry={track} role="indigo" />
      <mesh castShadow geometry={pod} position={[-0.62, 0.4, 0]} rotation={[0, 0, 0.38]} scale={[0.72, 0.48, 0.56]}><GardenSurface role="vermilion" /></mesh>
      <mesh castShadow geometry={pod} position={[0.68, -0.25, 0.03]} rotation={[0, 0, -0.2]} scale={[0.65, 0.42, 0.52]}><GardenSurface role="gold" /></mesh>
    </group>
  )
}

function CruiseSculpture() {
  const boat = useMemo(() => createPaperBoatGeometry(0.72), [])
  const waves = useMemo(() => [-0.56, -0.78].map((y, index) => createTaperedTubeGeometry([
    new THREE.Vector3(-1.3, y, 0),
    new THREE.Vector3(-0.62, y + 0.18, 0.02),
    new THREE.Vector3(0, y - 0.08, -0.02),
    new THREE.Vector3(0.72, y + 0.15, 0.01),
    new THREE.Vector3(1.3, y, 0),
  ], { radius: 0.035 - index * 0.007, endScale: 0.03, startScale: 0.72, radialSegments: 6, seed: 51 + index })), [])
  return (
    <group>
      <mesh castShadow geometry={boat} position={[0, 0.1, 0]} rotation={[0.08, 0, -0.04]}><GardenSurface role="paper" side={THREE.DoubleSide} /></mesh>
      {waves.map((geometry, index) => <BrushArc geometry={geometry} key={index} role={index ? 'indigo' : 'gold'} />)}
    </group>
  )
}

const sculptureBySlug: Readonly<Record<string, () => ReactElement>> = {
  'between-the-lines': BetweenLinesSculpture,
  'cloak': CloakSculpture,
  'idea-farm': IdeaFarmSculpture,
  'omni': OmniSculpture,
  'pod-racing': PodRacingSculpture,
  'relay': RelaySculpture,
  'vpay': VPaySculpture,
  'we-are-on-the-cruise': CruiseSculpture,
  'wish-galaxy': WishGalaxySculpture,
}

function ProjectShrine({
  placement,
  project,
  reducedMotion,
}: {
  placement: ShrinePlacement
  project: Project
  reducedMotion: boolean
}) {
  const descriptor = useMemo<GardenInteractionDescriptor>(() => ({
    focusRadius: 4.2,
    id: `project-shrine:${project.slug}`,
    kind: 'project-shrine',
    metadata: { href: project.href, projectSlug: project.slug },
    position: placement.position,
  }), [placement.position, project.href, project.slug])
  const { activateFromPointer, activated, focused, onPointerOut, onPointerOver } = useGardenInteractable(descriptor)
  const root = useRef<THREE.Group>(null)
  const sculpture = useRef<THREE.Group>(null)
  const aura = useRef<THREE.Mesh>(null)
  const energy = useRef(0)
  useCursor(focused)

  const base = useMemo(() => createOrganicPlateGeometry(1.88, 1.55, 0.38, project.slug.length * 11, 52), [project.slug])
  const terrace = useMemo(() => createOrganicPlateGeometry(2.72, 2.28, 0.34, project.slug.length * 17, 64), [project.slug])
  const upperTerrace = useMemo(() => createOrganicPlateGeometry(2.24, 1.88, 0.26, project.slug.length * 23, 58), [project.slug])
  const membrane = useMemo(() => createPortalMembraneGeometry(2.45, 2.95, 24, 30), [])
  const halo = useMemo(() => createTaperedTubeGeometry(circleStrokePoints(1.72, 1.72, -2.65, 3.4, 22), {
    endScale: 0.025,
    irregularity: 0.1,
    radialSegments: 6,
    radius: 0.035,
    seed: project.slug.length * 7,
    startScale: 0.72,
    tubularSegments: 70,
  }), [project.slug])
  const frame = useMemo(() => {
    const seed = project.slug.length * 13
    return {
      canopy: createBrushLeafGeometry(2.4, 0.48, 0.12, seed),
      left: createTaperedTubeGeometry([
        new THREE.Vector3(-1.58, 0.2, -0.24),
        new THREE.Vector3(-1.64, 1.7, -0.2),
        new THREE.Vector3(-1.52, 3.48, -0.28),
      ], { radius: 0.12, startScale: 1.1, endScale: 0.66, radialSegments: 7, seed, tubularSegments: 28 }),
      lintel: createTaperedTubeGeometry([
        new THREE.Vector3(-2.08, 3.48, -0.26),
        new THREE.Vector3(-0.95, 3.65, -0.28),
        new THREE.Vector3(0.1, 3.58, -0.3),
        new THREE.Vector3(1.12, 3.66, -0.27),
        new THREE.Vector3(2.1, 3.46, -0.25),
      ], { radius: 0.14, startScale: 0.62, endScale: 0.55, radialSegments: 7, seed: seed + 9, tubularSegments: 38 }),
      right: createTaperedTubeGeometry([
        new THREE.Vector3(1.58, 0.2, -0.24),
        new THREE.Vector3(1.52, 1.78, -0.28),
        new THREE.Vector3(1.62, 3.48, -0.24),
      ], { radius: 0.12, startScale: 1.06, endScale: 0.64, radialSegments: 7, seed: seed + 4, tubularSegments: 28 }),
    }
  }, [project.slug])
  const paperCharm = useMemo(() => createBrushLeafGeometry(0.58, 0.16, 0.06, project.slug.length * 29), [project.slug])
  const Sculpture = sculptureBySlug[project.slug] ?? OmniSculpture

  useFrame(({ clock }, delta) => {
    const target = activated ? 1 : focused ? 0.62 : 0
    energy.current = THREE.MathUtils.damp(energy.current, target, 4.8, delta)
    if (root.current) {
      root.current.position.y = placement.position[1] + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.52 + project.slug.length) * 0.025)
    }
    if (sculpture.current) {
      sculpture.current.rotation.y += reducedMotion ? 0 : delta * (0.04 + energy.current * 0.16)
      const scale = 1.32 + energy.current * 0.22
      sculpture.current.scale.setScalar(scale)
    }
    if (aura.current) {
      aura.current.rotation.z += reducedMotion ? 0 : delta * (0.05 + energy.current * 0.18)
      aura.current.scale.setScalar(0.82 + energy.current * 0.2)
      aura.current.visible = energy.current > 0.015
    }
  })

  return (
    <group
      onClick={(event) => {
        event.stopPropagation()
        activateFromPointer()
      }}
      onPointerOut={onPointerOut}
      onPointerOver={(event) => {
        event.stopPropagation()
        onPointerOver()
      }}
      position={placement.position}
      ref={root}
      rotation={[0, placement.rotation, 0]}
      scale={placement.scale ?? 1}
    >
      <mesh castShadow geometry={terrace} position={[0, -0.24, 0]} receiveShadow>
        <GardenSurface role="soot" />
      </mesh>
      <mesh castShadow geometry={upperTerrace} position={[0, -0.02, 0]} receiveShadow>
        <GardenSurface role="stone" />
      </mesh>
      <mesh castShadow geometry={base} position={[0, 0.18, 0]} receiveShadow>
        <GardenSurface role="stone" />
      </mesh>
      <mesh castShadow geometry={frame.left}><GardenSurface role="pineBark" /></mesh>
      <mesh castShadow geometry={frame.right}><GardenSurface role="pineBark" /></mesh>
      <mesh castShadow geometry={frame.lintel}><GardenSurface role="gold" /></mesh>
      <mesh geometry={frame.canopy} position={[-1.15, 3.73, -0.27]} rotation={[0, 0, -1.5]} scale={[1.15, 1, 1]}>
        <GardenSurface role="soot" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={frame.canopy} position={[1.12, 3.76, -0.27]} rotation={[0, 0, 1.48]} scale={[-1.1, 0.94, 1]}>
        <GardenSurface role="soot" side={THREE.DoubleSide} />
      </mesh>
      {[-0.76, 0, 0.76].map((x, index) => (
        <mesh
          geometry={paperCharm}
          key={x}
          position={[x, 3.18 - Math.abs(index - 1) * 0.06, -0.18]}
          rotation={[0, 0, index === 1 ? 0.04 : index === 0 ? -0.18 : 0.18]}
          scale={[1, index === 1 ? 1.1 : 0.88, 1]}
        >
          <GardenSurface role="paper" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={halo} position={[0, 2.22, -0.18]} ref={aura}>
        <GardenSurface role="gold" />
      </mesh>
      <mesh geometry={membrane} position={[0, 2.18, -0.38]}>
        <ProjectInkMembrane active={activated} focused={focused} image={project.image} reducedMotion={reducedMotion} />
      </mesh>
      <group position={[0, 2.0, 0.28]} ref={sculpture} scale={1.32}>
        <Sculpture />
      </group>
      <pointLight
        color={activated ? LIVING_SCROLL_PALETTE.gold : LIVING_SCROLL_PALETTE.celadon}
        decay={2}
        distance={activated ? 7 : focused ? 4.5 : 1.5}
        intensity={activated ? 5.2 : focused ? 2.2 : 0.12}
        position={[0, 2.18, 0.6]}
      />
    </group>
  )
}

export function ProjectShrines({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group>
      {projects.map((project, index) => (
        <ProjectShrine
          key={project.slug}
          placement={shrinePlacements[index]}
          project={project}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}

export { shrinePlacements }
