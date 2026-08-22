import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldPositionRef } from '../interactions'
import {
  createBrushLeafGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface } from './materials'

interface FoliageStroke {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
}

interface CrownPad {
  center: readonly [number, number, number]
  count: number
  flow: number
  radius: readonly [number, number]
  seed: number
  skew: number
}

const GOLDEN_ANGLE = 2.399963229728653

/**
 * Authored cloud pads establish the pine's calligraphic silhouette. The gaps
 * between them are deliberate: negative space is as important as foliage in
 * a sumi-e pine.
 */
const CROWN_PADS: readonly CrownPad[] = [
  { center: [-5.7, 1.08, 0.08], count: 42, flow: -1.18, radius: [2.25, 0.54], seed: 11, skew: -0.28 },
  { center: [-4.1, 2.75, -0.08], count: 54, flow: -1.03, radius: [2.72, 0.68], seed: 23, skew: -0.18 },
  { center: [-1.65, 4.02, 0.12], count: 48, flow: -0.78, radius: [2.35, 0.7], seed: 37, skew: 0.12 },
  { center: [0.45, 2.82, -0.18], count: 46, flow: -0.35, radius: [2.26, 0.6], seed: 47, skew: 0.2 },
  { center: [3.15, 3.34, 0.04], count: 58, flow: -0.14, radius: [2.9, 0.68], seed: 59, skew: 0.22 },
  { center: [5.8, 2.34, -0.1], count: 66, flow: 0.18, radius: [3.25, 0.62], seed: 71, skew: 0.3 },
  { center: [8.05, 2.48, 0.1], count: 38, flow: 0.38, radius: [1.92, 0.48], seed: 83, skew: 0.16 },
  { center: [2.48, 1.12, 0.16], count: 34, flow: 0.08, radius: [1.75, 0.46], seed: 97, skew: 0.12 },
] as const

function seededNoise(value: number) {
  const result = Math.sin(value * 91.713 + 17.197) * 43758.5453
  return result - Math.floor(result)
}

function createCrownStrokes() {
  const foliage: FoliageStroke[] = []
  const ink: FoliageStroke[] = []

  CROWN_PADS.forEach((pad, padIndex) => {
    for (let index = 0; index < pad.count; index += 1) {
      const progress = (index + 0.42) / pad.count
      const radius = Math.sqrt(progress)
      const angle = index * GOLDEN_ANGLE + pad.seed * 0.19
      const unitX = Math.cos(angle)
      const unitY = Math.sin(angle)
      const edgeBreakup = 0.88 + seededNoise(index + pad.seed * 3.1) * 0.24
      const horizontal = unitX * radius * pad.radius[0] * edgeBreakup
      const vertical = unitY * radius * pad.radius[1]
      const edgeDroop = Math.pow(Math.abs(horizontal) / pad.radius[0], 1.7) * 0.2
      const position = new THREE.Vector3(
        pad.center[0] + horizontal + vertical * pad.skew,
        pad.center[1] + vertical - edgeDroop,
        pad.center[2]
          + Math.sin(angle * 1.7 + pad.seed) * (0.2 + radius * 0.22)
          + (seededNoise(index * 2.7 + pad.seed) - 0.5) * 0.16,
      )
      const jitter = (seededNoise(index * 7.3 + pad.seed) - 0.5) * 0.4
      const rotation = new THREE.Euler(
        (seededNoise(index * 3.9 + pad.seed) - 0.5) * 0.42,
        (seededNoise(index * 5.2 + pad.seed) - 0.5) * 0.7,
        pad.flow + unitX * 0.25 + jitter,
      )
      const size = 0.7 + seededNoise(index * 4.3 + pad.seed) * 0.62
      const stroke = {
        position,
        rotation,
        scale: new THREE.Vector3(size * (0.86 + radius * 0.16), size, size * 0.82),
      }
      const isInkEdge = radius > 0.72 && (index + padIndex * 2) % 3 === 0
      const isInteriorInk = radius > 0.42 && (index + pad.seed) % 13 === 0
      ;(isInkEdge || isInteriorInk ? ink : foliage).push(stroke)
    }
  })

  return { foliage, ink }
}

function createFringeStrokes() {
  const authored: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-7.3, 0.94, 0.12, 2.62, 0.9],
    [-6.55, 0.73, -0.08, 2.76, 1.12],
    [-5.2, 0.66, 0.16, 2.92, 0.82],
    [-4.72, 2.4, -0.12, 2.71, 1.06],
    [-3.36, 2.24, 0.14, 2.92, 0.78],
    [-2.55, 3.82, -0.04, 2.82, 0.94],
    [-0.4, 2.54, 0.16, 3.02, 0.86],
    [1.82, 0.88, -0.14, -2.98, 0.88],
    [3.38, 0.76, 0.12, -2.82, 1.04],
    [4.62, 2.96, -0.1, -2.72, 0.9],
    [5.74, 1.98, 0.15, -2.88, 1.1],
    [7.14, 1.94, -0.12, -2.7, 0.94],
    [8.64, 2.1, 0.1, -2.58, 1.06],
    [9.18, 2.26, -0.08, -2.48, 0.82],
  ]
  return authored.map(([x, y, z, rotation, size], index) => ({
    position: new THREE.Vector3(x, y, z),
    rotation: new THREE.Euler(index % 2 ? 0.18 : -0.12, index % 3 * 0.16 - 0.12, rotation),
    scale: new THREE.Vector3(size * 0.72, size, size * 0.68),
  }))
}

function populateInstances(
  mesh: THREE.InstancedMesh | null,
  strokes: readonly FoliageStroke[],
  transform: THREE.Object3D,
) {
  if (!mesh) return
  strokes.forEach((stroke, index) => {
    transform.position.copy(stroke.position)
    transform.rotation.copy(stroke.rotation)
    transform.scale.copy(stroke.scale)
    transform.updateMatrix()
    mesh.setMatrixAt(index, transform.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

export function MonumentalPine({
  playerPositionRef,
  position = [-5.55, 0, -5.6],
  reducedMotion = false,
}: {
  playerPositionRef?: WorldPositionRef
  position?: readonly [number, number, number]
  reducedMotion?: boolean
}) {
  const [positionX, positionY, positionZ] = position
  const crown = useRef<THREE.Group>(null)
  const foliage = useRef<THREE.InstancedMesh>(null)
  const inkFoliage = useRef<THREE.InstancedMesh>(null)
  const fringe = useRef<THREE.InstancedMesh>(null)
  const transform = useMemo(() => new THREE.Object3D(), [])
  const worldPosition = useMemo(
    () => new THREE.Vector3(positionX, positionY, positionZ),
    [positionX, positionY, positionZ],
  )
  const leaf = useMemo(() => createBrushLeafGeometry(1.32, 0.31, 0.18, 9), [])
  const fringeLeaf = useMemo(() => createBrushLeafGeometry(1.78, 0.2, 0.26, 10), [])
  const strokes = useMemo(createCrownStrokes, [])
  const fringeStrokes = useMemo(createFringeStrokes, [])
  const trunkAndBranches = useMemo(() => [
    createTaperedTubeGeometry([
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(-0.52, 1.45, 0.2),
      new THREE.Vector3(0.18, 2.95, -0.18),
      new THREE.Vector3(-0.62, 4.48, 0.22),
      new THREE.Vector3(0.12, 5.98, -0.16),
      new THREE.Vector3(-0.14, 7.52, 0.06),
    ], { radius: 0.82, startScale: 1.42, endScale: 0.32, radialSegments: 11, seed: 7, tubularSegments: 76 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(-0.42, 3.72, 0.02),
      new THREE.Vector3(-1.62, 4.48, -0.12),
      new THREE.Vector3(-3.45, 4.82, 0.18),
      new THREE.Vector3(-5.12, 5.42, -0.08),
      new THREE.Vector3(-6.55, 6.08, 0.1),
    ], { radius: 0.38, startScale: 1, endScale: 0.08, radialSegments: 9, seed: 13, tubularSegments: 58 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(-0.08, 5.34, 0.02),
      new THREE.Vector3(-1.38, 6.2, 0.14),
      new THREE.Vector3(-2.92, 7.18, -0.12),
      new THREE.Vector3(-4.86, 7.62, 0.08),
      new THREE.Vector3(-5.78, 7.86, -0.02),
    ], { radius: 0.3, startScale: 1, endScale: 0.06, radialSegments: 8, seed: 29, tubularSegments: 58 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(-0.16, 4.52, -0.04),
      new THREE.Vector3(1.16, 5.14, 0.16),
      new THREE.Vector3(3.04, 5.38, -0.16),
      new THREE.Vector3(5.08, 6.02, 0.1),
      new THREE.Vector3(6.88, 6.42, -0.04),
      new THREE.Vector3(8.72, 7.02, 0.06),
    ], { radius: 0.44, startScale: 1, endScale: 0.055, radialSegments: 9, seed: 19, tubularSegments: 76 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(0.04, 6.36, 0),
      new THREE.Vector3(1.18, 7.08, -0.1),
      new THREE.Vector3(2.86, 7.62, 0.14),
      new THREE.Vector3(4.4, 8.22, -0.08),
      new THREE.Vector3(5.58, 8.42, 0.05),
    ], { radius: 0.3, startScale: 1, endScale: 0.065, radialSegments: 8, seed: 41, tubularSegments: 58 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(-0.08, 7.12, 0.02),
      new THREE.Vector3(-0.38, 8.04, 0.12),
      new THREE.Vector3(-1.24, 8.92, -0.1),
      new THREE.Vector3(-2.3, 9.48, 0.04),
    ], { radius: 0.28, startScale: 1, endScale: 0.07, radialSegments: 8, seed: 53, tubularSegments: 48 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(-0.2, 2.66, 0.04),
      new THREE.Vector3(0.82, 3.36, -0.12),
      new THREE.Vector3(2.08, 4.16, 0.14),
      new THREE.Vector3(3.62, 5.22, -0.04),
    ], { radius: 0.31, startScale: 1, endScale: 0.08, radialSegments: 8, seed: 61, tubularSegments: 48 }),
  ], [])
  const roots = useMemo(() => [
    createTaperedTubeGeometry([
      new THREE.Vector3(-0.1, 0.2, 0),
      new THREE.Vector3(-1.1, 0.12, 0.28),
      new THREE.Vector3(-2.18, 0.05, 0.52),
      new THREE.Vector3(-3.02, 0.01, 0.34),
    ], { radius: 0.34, startScale: 1, endScale: 0.04, radialSegments: 8, seed: 67, tubularSegments: 40 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(0.16, 0.18, 0),
      new THREE.Vector3(0.88, 0.1, -0.52),
      new THREE.Vector3(1.72, 0.05, -0.86),
      new THREE.Vector3(2.52, 0.01, -0.68),
    ], { radius: 0.3, startScale: 1, endScale: 0.04, radialSegments: 8, seed: 73, tubularSegments: 38 }),
    createTaperedTubeGeometry([
      new THREE.Vector3(0.04, 0.16, 0.08),
      new THREE.Vector3(0.52, 0.09, 0.78),
      new THREE.Vector3(1.24, 0.04, 1.34),
      new THREE.Vector3(2.08, 0.01, 1.52),
    ], { radius: 0.28, startScale: 1, endScale: 0.04, radialSegments: 8, seed: 79, tubularSegments: 38 }),
  ], [])
  const rootStones = useMemo(() => [0, 1, 2, 3, 4].map((index) => createScholarStoneGeometry(0.62 + index * 0.075, 70 + index * 12, 18)), [])

  useLayoutEffect(() => {
    populateInstances(foliage.current, strokes.foliage, transform)
    populateInstances(inkFoliage.current, strokes.ink, transform)
    populateInstances(fringe.current, fringeStrokes, transform)
  }, [fringeStrokes, strokes, transform])

  useFrame(({ clock }, delta) => {
    if (!crown.current) return
    const distance = playerPositionRef?.current ? playerPositionRef.current.distanceTo(worldPosition) : 20
    const attention = 1 - THREE.MathUtils.smoothstep(distance, 5, 15)
    const wind = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.3) * 0.012 + Math.sin(clock.elapsedTime * 0.67) * 0.006
    crown.current.rotation.z = THREE.MathUtils.damp(crown.current.rotation.z, wind * (1 + attention * 1.45), 1.8, delta)
    crown.current.rotation.y = THREE.MathUtils.damp(crown.current.rotation.y, Math.sin(clock.elapsedTime * 0.18) * 0.005, 1.35, delta)
  })

  return (
    <group position={worldPosition} rotation={[0, -0.12, 0]}>
      {roots.map((geometry, index) => (
        <mesh castShadow geometry={geometry} key={`root-${index}`} receiveShadow>
          <GardenSurface role="pineBark" />
        </mesh>
      ))}
      {trunkAndBranches.map((geometry, index) => (
        <mesh castShadow geometry={geometry} key={`branch-${index}`} receiveShadow>
          <GardenSurface role="pineBark" />
        </mesh>
      ))}
      <group position={[0.08, 5.08, 0]} ref={crown}>
        <instancedMesh
          args={[undefined, undefined, strokes.foliage.length]}
          castShadow
          count={strokes.foliage.length}
          geometry={leaf}
          ref={foliage}
        >
          <GardenSurface role="foliage" side={THREE.DoubleSide} />
        </instancedMesh>
        <instancedMesh
          args={[undefined, undefined, strokes.ink.length]}
          castShadow
          count={strokes.ink.length}
          geometry={leaf}
          ref={inkFoliage}
        >
          <GardenSurface role="soot" side={THREE.DoubleSide} />
        </instancedMesh>
        <instancedMesh
          args={[undefined, undefined, fringeStrokes.length]}
          castShadow
          count={fringeStrokes.length}
          geometry={fringeLeaf}
          ref={fringe}
        >
          <GardenSurface role="soot" side={THREE.DoubleSide} />
        </instancedMesh>
      </group>
      {rootStones.map((geometry, index) => (
        <mesh
          castShadow
          geometry={geometry}
          key={`stone-${index}`}
          position={[
            Math.cos(index * 1.7) * (0.72 + index * 0.18),
            0.14,
            Math.sin(index * 1.7) * (0.64 + index * 0.13),
          ]}
          receiveShadow
          rotation={[0.08 * index, index * 0.9, -0.05 * index]}
          scale={[1.42, 0.42 + index * 0.045, 1.08]}
        >
          <GardenSurface role={index === 2 ? 'soot' : 'stone'} />
        </mesh>
      ))}
    </group>
  )
}
