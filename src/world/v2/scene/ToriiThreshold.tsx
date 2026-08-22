import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGardenInteractable, type GardenInteractionDescriptor } from '../interactions'
import {
  circleStrokePoints,
  createBrushLeafGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface, LIVING_SCROLL_PALETTE } from './materials'

const BELL_INTERACTION: GardenInteractionDescriptor = {
  focusRadius: 3.8,
  id: 'garden-bell:threshold',
  kind: 'garden-bell',
  position: [0, 2.8, 11.7],
}

function GardenBell() {
  const group = useRef<THREE.Group>(null)
  const { activateFromPointer, activated, focused, onPointerOut, onPointerOver } = useGardenInteractable(BELL_INTERACTION)
  const bell = useMemo(() => createScholarStoneGeometry(0.3, 27, 18), [])
  const aura = useMemo(() => createTaperedTubeGeometry(circleStrokePoints(0.78, 0.78, -2.2, 3.7, 15), {
    endScale: 0.04,
    irregularity: 0.12,
    radialSegments: 6,
    radius: 0.025,
    seed: 18,
    startScale: 0.7,
    tubularSegments: 50,
  }), [])

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const target = activated ? Math.sin(clock.elapsedTime * 7.2) * 0.18 * Math.exp(-((clock.elapsedTime * 0.7) % 3)) : focused ? 0.08 : 0
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, target, 6.5, delta)
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
      position={[0, 3.05, 0.42]}
      ref={group}
    >
      <mesh castShadow geometry={bell} scale={[0.85, 1.05, 0.85]}>
        <GardenSurface role="gold" />
      </mesh>
      <mesh geometry={aura} position={[0, 0, 0.08]} scale={focused || activated ? 1 : 0.001}>
        <GardenSurface role="gold" />
      </mesh>
      <pointLight color={LIVING_SCROLL_PALETTE.gold} decay={2} distance={focused || activated ? 5 : 1.5} intensity={focused || activated ? 3.2 : 0.3} />
    </group>
  )
}

export function ToriiThreshold() {
  const geometries = useMemo(() => {
    const leftPost = createTaperedTubeGeometry([
      new THREE.Vector3(-2.55, 0.15, 0.02),
      new THREE.Vector3(-2.62, 1.7, 0),
      new THREE.Vector3(-2.51, 3.45, -0.05),
      new THREE.Vector3(-2.59, 5.35, 0.04),
    ], { radius: 0.38, startScale: 1.14, endScale: 0.82, radialSegments: 9, seed: 4 })
    const rightPost = createTaperedTubeGeometry([
      new THREE.Vector3(2.58, 0.15, -0.02),
      new THREE.Vector3(2.5, 1.65, 0.04),
      new THREE.Vector3(2.61, 3.5, 0),
      new THREE.Vector3(2.53, 5.35, -0.03),
    ], { radius: 0.38, startScale: 1.14, endScale: 0.82, radialSegments: 9, seed: 11 })
    const middleBeam = createTaperedTubeGeometry([
      new THREE.Vector3(-3.7, 4.26, 0),
      new THREE.Vector3(-1.8, 4.38, 0.01),
      new THREE.Vector3(0, 4.3, -0.02),
      new THREE.Vector3(1.9, 4.39, 0.01),
      new THREE.Vector3(3.72, 4.25, 0),
    ], { radius: 0.24, startScale: 0.58, endScale: 0.55, radialSegments: 8, seed: 3 })
    const crownBeam = createTaperedTubeGeometry([
      new THREE.Vector3(-4.45, 5.35, 0.02),
      new THREE.Vector3(-3.5, 5.52, -0.02),
      new THREE.Vector3(-1.5, 5.62, 0.02),
      new THREE.Vector3(0, 5.55, 0),
      new THREE.Vector3(1.65, 5.63, -0.03),
      new THREE.Vector3(3.6, 5.51, 0.02),
      new THREE.Vector3(4.52, 5.32, 0),
    ], { radius: 0.34, startScale: 0.42, endScale: 0.38, radialSegments: 9, seed: 21 })
    const innerCrown = createTaperedTubeGeometry([
      new THREE.Vector3(-3.55, 4.86, 0.04),
      new THREE.Vector3(-1.7, 5.0, 0),
      new THREE.Vector3(0, 4.95, -0.04),
      new THREE.Vector3(1.8, 5.02, 0),
      new THREE.Vector3(3.6, 4.87, 0.04),
    ], { radius: 0.2, startScale: 0.66, endScale: 0.62, radialSegments: 8, seed: 31 })
    const rope = createTaperedTubeGeometry([
      new THREE.Vector3(-2.25, 3.85, 0.38),
      new THREE.Vector3(-1.2, 3.55, 0.48),
      new THREE.Vector3(0, 3.45, 0.52),
      new THREE.Vector3(1.25, 3.58, 0.48),
      new THREE.Vector3(2.25, 3.85, 0.38),
    ], { radius: 0.055, startScale: 0.9, endScale: 0.9, radialSegments: 6, seed: 6 })
    return { crownBeam, innerCrown, leftPost, middleBeam, rightPost, rope }
  }, [])
  const paperStrip = useMemo(() => createBrushLeafGeometry(0.72, 0.21, 0.05, 7), [])
  const baseLeft = useMemo(() => createScholarStoneGeometry(0.7, 8, 18), [])
  const baseRight = useMemo(() => createScholarStoneGeometry(0.72, 16, 18), [])

  return (
    <group position={[0, 0, 11.7]}>
      <mesh castShadow geometry={geometries.leftPost}><GardenSurface role="vermilion" /></mesh>
      <mesh castShadow geometry={geometries.rightPost}><GardenSurface role="vermilion" /></mesh>
      <mesh castShadow geometry={geometries.middleBeam}><GardenSurface role="vermilion" /></mesh>
      <mesh castShadow geometry={geometries.crownBeam}><GardenSurface role="soot" /></mesh>
      <mesh castShadow geometry={geometries.innerCrown}><GardenSurface role="vermilion" /></mesh>
      <mesh castShadow geometry={geometries.rope}><GardenSurface role="gold" /></mesh>
      {[-1.25, 0, 1.25].map((x, index) => (
        <mesh
          castShadow
          geometry={paperStrip}
          key={x}
          position={[x, 2.93 + Math.abs(index - 1) * 0.08, 0.47]}
          rotation={[0, 0, index === 1 ? 0.06 : index === 0 ? -0.13 : 0.13]}
          scale={[1, index === 1 ? 1.16 : 0.92, 1]}
        >
          <GardenSurface role="paper" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh castShadow geometry={baseLeft} position={[-2.58, 0.22, 0]} scale={[1.2, 0.62, 1]}>
        <GardenSurface role="stone" />
      </mesh>
      <mesh castShadow geometry={baseRight} position={[2.55, 0.22, 0]} scale={[1.15, 0.6, 1]}>
        <GardenSurface role="stone" />
      </mesh>
      <GardenBell />
    </group>
  )
}
