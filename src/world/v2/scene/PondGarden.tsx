import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useLivingInkField } from '../../../art'
import type { WorldPositionRef } from '../interactions'
import {
  circleStrokePoints,
  createBrushLeafGeometry,
  createKoiBodyGeometry,
  createOrganicPlateGeometry,
  createOrganicSurfaceGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface, GardenWater } from './materials'

function InkKoi({
  index,
  playerPositionRef,
  reducedMotion,
}: {
  index: number
  playerPositionRef?: WorldPositionRef
  reducedMotion: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Mesh>(null)
  const phase = useRef(index * 2.17)
  const speed = useRef(0.22 + index * 0.025)
  const lastInkTime = useRef(-index)
  const { emitInk } = useLivingInkField()
  const body = useMemo(() => createKoiBodyGeometry(1.08 + index * 0.08, 0.23), [index])
  const tailGeometry = useMemo(() => createBrushLeafGeometry(0.68, 0.48, index % 2 ? 0.08 : -0.08, 9), [index])
  const worldPosition = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, delta) => {
    if (!group.current || !tail.current) return
    group.current.getWorldPosition(worldPosition)
    const playerDistance = playerPositionRef?.current
      ? worldPosition.distanceTo(playerPositionRef.current)
      : Number.POSITIVE_INFINITY
    const startled = THREE.MathUtils.smoothstep(4.2 - Math.min(playerDistance, 4.2), 0.3, 3.7)
    speed.current = THREE.MathUtils.damp(speed.current, 0.2 + index * 0.025 + startled * 0.38, 2.6, delta)
    if (!reducedMotion) phase.current += delta * speed.current
    const radiusX = 7.8 + index * 0.92
    const radiusZ = 6.5 + (index % 2) * 1.15
    const angle = phase.current + Math.sin(phase.current * 0.67 + index) * 0.18
    const x = Math.cos(angle) * radiusX
    const z = Math.sin(angle) * radiusZ
    const dx = -Math.sin(angle) * radiusX
    const dz = Math.cos(angle) * radiusZ
    group.current.position.set(x, -0.06 + Math.sin(clock.elapsedTime * 1.8 + index) * 0.025, z)
    group.current.rotation.y = Math.atan2(-dz, dx)
    group.current.rotation.z = Math.sin(clock.elapsedTime * 1.2 + index) * 0.035
    const tailWave = reducedMotion ? 0.04 : Math.sin(clock.elapsedTime * (4.4 + startled * 4.2) + index) * (0.28 + startled * 0.12)
    tail.current.rotation.y = tailWave
    if (!reducedMotion && clock.elapsedTime - lastInkTime.current > 0.42 + index * 0.06) {
      lastInkTime.current = clock.elapsedTime
      emitInk({
        disturbance: 0.26,
        pigment: index === 1 ? 0.3 : 0.2,
        position: worldPosition,
        radius: 0.72,
        strength: 0.28,
        wetness: 0.82,
      })
    }
  })

  return (
    <group ref={group}>
      <mesh castShadow geometry={body} rotation={[0, 0, index % 2 ? 0.03 : -0.025]} scale={[1, 0.75, 1]}>
        <GardenSurface role={index === 1 ? 'vermilion' : index === 2 ? 'gold' : 'paper'} />
      </mesh>
      <mesh
        geometry={tailGeometry}
        position={[-0.49 - index * 0.03, 0, 0]}
        ref={tail}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <GardenSurface role={index === 1 ? 'vermilion' : index === 2 ? 'gold' : 'paper'} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={tailGeometry} position={[0.08, 0.09, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 2]} scale={[0.35, 0.38, 0.35]}>
        <GardenSurface role="indigo" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function ReedBeds() {
  const count = 214
  const mesh = useRef<THREE.InstancedMesh>(null)
  const reed = useMemo(() => createBrushLeafGeometry(1.25, 0.13, 0.16, 8), [])
  const transform = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    for (let index = 0; index < count; index += 1) {
      const seed = ((index * 89) % 109) / 109
      const rawAngle = seed * Math.PI * 2
      const entranceGap = Math.sin(rawAngle) > 0.63 && Math.abs(Math.cos(rawAngle)) < 0.34
      const angle = entranceGap
        ? rawAngle + (index % 2 === 0 ? -0.38 : 0.38)
        : rawAngle
      const radiusX = 13.82 + Math.sin(index * 4.13) * 0.82
      const radiusZ = 13.62 + Math.cos(index * 3.11) * 0.72
      const bridgeGap = Math.abs(Math.sin(angle)) < 0.13 ? 2.45 : 0
      transform.position.set(
        Math.cos(angle) * (radiusX + bridgeGap),
        -0.05 + Math.sin(index * 1.7) * 0.08,
        Math.sin(angle) * (radiusZ + bridgeGap * 0.4),
      )
      transform.rotation.set(0, angle + Math.sin(index) * 0.4, (Math.sin(index * 2.3) * 0.1))
      const scale = 0.58 + ((index * 37) % 53) / 53 * 0.75
      transform.scale.set(scale * (index % 3 === 0 ? -1 : 1), scale, scale)
      transform.updateMatrix()
      mesh.current.setMatrixAt(index, transform.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [transform])

  return (
    <instancedMesh args={[undefined, undefined, count]} castShadow count={count} frustumCulled geometry={reed} ref={mesh}>
      <GardenSurface role="bamboo" side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function BankShrubs() {
  const count = 162
  const mesh = useRef<THREE.InstancedMesh>(null)
  const leaf = useMemo(() => createBrushLeafGeometry(0.92, 0.28, 0.2, 13), [])
  const transform = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    for (let index = 0; index < count; index += 1) {
      const cluster = index % 9
      const local = Math.floor(index / 9)
      const rawAngle = cluster / 9 * Math.PI * 2 + Math.sin(cluster * 4.2) * 0.16
      const entranceGap = Math.sin(rawAngle) > 0.68 && Math.abs(Math.cos(rawAngle)) < 0.38
      const angle = entranceGap
        ? rawAngle + (local % 2 === 0 ? -0.42 : 0.42)
        : rawAngle
      const spread = ((local * 47 + cluster * 13) % 67) / 67
      const radiusX = 14.6 + spread * 1.5
      const radiusZ = 14.5 + (1 - spread) * 1.35
      const x = Math.cos(angle) * radiusX + Math.sin(local * 2.3) * 0.65
      const z = Math.sin(angle) * radiusZ + Math.cos(local * 1.7) * 0.55
      transform.position.set(x, -0.04 + (local % 4) * 0.06, z)
      transform.rotation.set(
        Math.sin(index * 0.53) * 0.42,
        angle + Math.PI / 2 + Math.cos(index) * 0.42,
        Math.cos(index * 0.77) * 0.82,
      )
      const size = 0.62 + ((index * 31) % 43) / 43 * 0.82
      transform.scale.set(index % 3 === 0 ? -size : size, size, size)
      transform.updateMatrix()
      mesh.current.setMatrixAt(index, transform.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [transform])

  return (
    <instancedMesh args={[undefined, undefined, count]} castShadow count={count} geometry={leaf} ref={mesh}>
      <GardenSurface role="foliage" side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function LotusField() {
  const count = 68
  const mesh = useRef<THREE.InstancedMesh>(null)
  const leaf = useMemo(() => createBrushLeafGeometry(0.82, 0.48, 0.08, 17), [])
  const transform = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    for (let index = 0; index < count; index += 1) {
      const seed = ((index * 71) % 59) / 59
      const angle = index * 2.399963
      const radius = 2.3 + seed * 9.7
      transform.position.set(
        Math.cos(angle) * radius,
        -0.105 + Math.sin(index * 1.4) * 0.012,
        Math.sin(angle) * radius * 0.9,
      )
      transform.rotation.set(-Math.PI / 2 + Math.sin(index) * 0.08, angle, index * 0.37)
      const size = 0.52 + ((index * 23) % 31) / 31 * 0.62
      transform.scale.set(index % 4 === 0 ? -size : size, size, size)
      transform.updateMatrix()
      mesh.current.setMatrixAt(index, transform.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [transform])

  return (
    <instancedMesh args={[undefined, undefined, count]} count={count} geometry={leaf} ref={mesh}>
      <GardenSurface role="foliage" side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function WaterRipples({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const ripples = useMemo(() => [0, 1, 2].map((index) => createTaperedTubeGeometry(
    circleStrokePoints(0.58, 0.32, -2.8, 2.95, 18),
    {
      endScale: 0.02,
      irregularity: 0.08,
      radialSegments: 5,
      radius: 0.018,
      seed: 12 + index,
      startScale: 0.75,
      tubularSegments: 48,
    },
  )), [])

  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return
    group.current.children.forEach((child, index) => {
      const cycle = (clock.elapsedTime * 0.18 + index / 3) % 1
      child.scale.setScalar(0.25 + cycle * 2.1)
      child.rotation.z = cycle * 0.25 + index
    })
  })

  return (
    <group position={[4.8, -0.1, 2.3]} ref={group} rotation={[-Math.PI / 2, 0, 0]}>
      {ripples.map((geometry, index) => (
        <mesh geometry={geometry} key={index}>
          <GardenSurface role="gold" />
        </mesh>
      ))}
    </group>
  )
}

function ShorelineContours() {
  const contours = useMemo(() => [
    {
      geometry: createTaperedTubeGeometry(circleStrokePoints(14.3, 14.16, -2.72, 2.98, 38), {
        endScale: 0.025,
        irregularity: 0.1,
        radialSegments: 6,
        radius: 0.052,
        seed: 91,
        startScale: 0.82,
        tubularSegments: 116,
      }),
      position: [0.15, -0.075, -0.08] as [number, number, number],
      role: 'soot' as const,
    },
    {
      geometry: createTaperedTubeGeometry(circleStrokePoints(14.72, 14.58, -0.18, 4.98, 35), {
        endScale: 0.02,
        irregularity: 0.14,
        radialSegments: 5,
        radius: 0.034,
        seed: 113,
        startScale: 0.7,
        tubularSegments: 104,
      }),
      position: [-0.12, -0.09, 0.12] as [number, number, number],
      role: 'indigo' as const,
    },
    {
      geometry: createTaperedTubeGeometry(circleStrokePoints(13.92, 13.74, 0.7, 4.25, 28), {
        endScale: 0.03,
        irregularity: 0.11,
        radialSegments: 5,
        radius: 0.024,
        seed: 137,
        startScale: 0.64,
        tubularSegments: 82,
      }),
      position: [0.08, -0.055, 0.04] as [number, number, number],
      role: 'stone' as const,
    },
  ], [])

  return (
    <group>
      {contours.map((contour, index) => (
        <mesh
          geometry={contour.geometry}
          key={index}
          position={contour.position}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <GardenSurface role={contour.role} />
        </mesh>
      ))}
    </group>
  )
}

function SculptedBankShelves() {
  const shelves = useMemo(() => [
    { geometry: createOrganicPlateGeometry(3.8, 1.9, 0.38, 151, 54), position: [-9.8, -0.13, 9.8] as [number, number, number], rotation: -0.34, role: 'stone' as const },
    { geometry: createOrganicPlateGeometry(2.7, 1.42, 0.3, 163, 48), position: [-12.4, -0.07, 5.6] as [number, number, number], rotation: -0.86, role: 'foliage' as const },
    { geometry: createOrganicPlateGeometry(3.4, 1.7, 0.34, 179, 52), position: [9.7, -0.12, 9.2] as [number, number, number], rotation: 0.42, role: 'stone' as const },
    { geometry: createOrganicPlateGeometry(2.5, 1.28, 0.28, 191, 46), position: [12.65, -0.08, 4.4] as [number, number, number], rotation: 0.92, role: 'foliage' as const },
    { geometry: createOrganicPlateGeometry(3.15, 1.52, 0.32, 211, 50), position: [-10.8, -0.1, -9.25] as [number, number, number], rotation: 0.66, role: 'indigo' as const },
    { geometry: createOrganicPlateGeometry(3.45, 1.66, 0.34, 227, 52), position: [9.1, -0.11, -10.5] as [number, number, number], rotation: -0.52, role: 'stone' as const },
    { geometry: createOrganicPlateGeometry(2.1, 1.2, 0.26, 239, 42), position: [-13.5, -0.07, -2.15] as [number, number, number], rotation: 1.2, role: 'foliage' as const },
    { geometry: createOrganicPlateGeometry(2.25, 1.18, 0.27, 251, 42), position: [13.35, -0.08, -3.1] as [number, number, number], rotation: -1.08, role: 'indigo' as const },
  ], [])

  return (
    <group>
      {shelves.map((shelf, index) => (
        <mesh
          castShadow
          geometry={shelf.geometry}
          key={index}
          position={shelf.position}
          receiveShadow
          rotation={[0, shelf.rotation, 0]}
        >
          <GardenSurface role={shelf.role} />
        </mesh>
      ))}
    </group>
  )
}

function SubmergedPigmentBeds() {
  const washes = useMemo(() => [
    { geometry: createOrganicSurfaceGeometry(4.5, 2.5, 281, 52), position: [-6.1, -0.19, 3.8] as [number, number, number], rotation: 0.32 },
    { geometry: createOrganicSurfaceGeometry(3.8, 2.25, 307, 48), position: [6.7, -0.185, -2.8] as [number, number, number], rotation: -0.45 },
    { geometry: createOrganicSurfaceGeometry(3.15, 1.85, 331, 44), position: [1.8, -0.188, 8.2] as [number, number, number], rotation: 0.12 },
    { geometry: createOrganicSurfaceGeometry(2.75, 1.65, 353, 42), position: [-3.2, -0.184, -8.8] as [number, number, number], rotation: -0.28 },
  ], [])
  return (
    <group>
      {washes.map((wash, index) => (
        <mesh geometry={wash.geometry} key={index} position={wash.position} rotation={[0, wash.rotation, 0]}>
          <GardenSurface role={index === 2 ? 'soot' : 'indigo'} />
        </mesh>
      ))}
    </group>
  )
}

export function PondGarden({
  playerPositionRef,
  reducedMotion = false,
}: {
  playerPositionRef?: WorldPositionRef
  reducedMotion?: boolean
}) {
  const geometry = useMemo(() => {
    const water = createOrganicSurfaceGeometry(14.0, 13.9, 32, 128)
    const position = water.getAttribute('position')
    const wind = new Float32Array(position.count)
    wind.fill(1)
    water.setAttribute('aSumiWind', new THREE.BufferAttribute(wind, 1))
    return {
      basin: createOrganicPlateGeometry(14.38, 14.22, 0.84, 9, 116),
      mossShelf: createOrganicPlateGeometry(15.05, 14.86, 0.48, 67, 120),
      outerInk: createOrganicPlateGeometry(16.28, 15.82, 0.74, 19, 128),
      stoneShelf: createOrganicPlateGeometry(15.68, 15.35, 0.6, 43, 124),
      water,
    }
  }, [])
  const stones = useMemo(() => Array.from({ length: 38 }, (_, index) => {
    const rawAngle = index / 38 * Math.PI * 2 + 0.1
    const entranceGap = Math.sin(rawAngle) > 0.78 && Math.abs(Math.cos(rawAngle)) < 0.22
    const angle = entranceGap
      ? rawAngle + (index % 2 === 0 ? -0.3 : 0.3)
      : rawAngle
    return {
      geometry: createScholarStoneGeometry(0.5 + (index % 5) * 0.1, 41 + index * 9, 17),
      position: new THREE.Vector3(
        Math.cos(angle) * (14.52 + Math.sin(index * 1.9) * 0.62),
        0.04 + (index % 3) * 0.025,
        Math.sin(angle) * (14.38 + Math.cos(index * 2.1) * 0.56),
      ),
      rotation: [Math.sin(index) * 0.12, index * 1.37, Math.cos(index) * 0.1] as [number, number, number],
      scale: [1 + (index % 2) * 0.34, 0.42 + (index % 4) * 0.11, 0.8 + (index % 3) * 0.18] as [number, number, number],
    }
  }), [])
  const steppingStones = useMemo(() => [
    ...Array.from({ length: 13 }, (_, index) => {
      const t = index / 12
      return {
        geometry: createScholarStoneGeometry(0.7 + (index % 4) * 0.075, 120 + index * 17, 18),
        position: new THREE.Vector3(
          -8.1 + Math.sin(t * Math.PI * 1.6) * 2.25 + t * 2.5,
          -0.025 + (index % 3) * 0.02,
          11.45 - t * 12.9,
        ),
        rotation: [Math.sin(index) * 0.08, index * 0.83, Math.cos(index) * 0.06] as [number, number, number],
        scale: [1.22 + (index % 3) * 0.14, 0.32 + (index % 2) * 0.09, 0.92 + (index % 4) * 0.1] as [number, number, number],
      }
    }),
    ...Array.from({ length: 10 }, (_, index) => {
      const t = index / 9
      return {
        geometry: createScholarStoneGeometry(0.64 + (index % 3) * 0.085, 401 + index * 19, 18),
        position: new THREE.Vector3(
          8.75 + Math.sin(t * Math.PI * 1.4) * 1.55 - t * 1.1,
          -0.035 + (index % 2) * 0.025,
          9.3 - t * 12.1,
        ),
        rotation: [Math.cos(index) * 0.07, index * 0.91 + 0.3, Math.sin(index) * 0.06] as [number, number, number],
        scale: [1.08 + (index % 4) * 0.12, 0.3 + (index % 3) * 0.075, 0.86 + (index % 3) * 0.11] as [number, number, number],
      }
    }),
  ], [])

  return (
    <group position={[0, 0, -3.4]}>
      <mesh geometry={geometry.outerInk} position={[0, -0.5, 0]} receiveShadow>
        <GardenSurface role="soot" />
      </mesh>
      <mesh geometry={geometry.stoneShelf} position={[0.08, -0.405, 0.04]} receiveShadow>
        <GardenSurface role="stone" />
      </mesh>
      <mesh geometry={geometry.mossShelf} position={[-0.1, -0.335, -0.04]} receiveShadow>
        <GardenSurface role="foliage" />
      </mesh>
      <mesh geometry={geometry.basin} position={[0, -0.57, 0]} receiveShadow>
        <GardenSurface role="indigo" />
      </mesh>
      <SubmergedPigmentBeds />
      <mesh geometry={geometry.water} position={[0, -0.12, 0]} receiveShadow>
        <GardenWater reducedMotion={reducedMotion} />
      </mesh>
      <ShorelineContours />
      <SculptedBankShelves />
      {stones.map((stone, index) => (
        <mesh
          castShadow
          geometry={stone.geometry}
          key={index}
          position={stone.position}
          receiveShadow
          rotation={stone.rotation}
          scale={stone.scale}
        >
          <GardenSurface role={index % 7 === 0 ? 'soot' : index % 5 === 0 ? 'indigo' : 'stone'} />
        </mesh>
      ))}
      {steppingStones.map((stone, index) => (
        <mesh
          castShadow
          geometry={stone.geometry}
          key={`step-${index}`}
          position={stone.position}
          receiveShadow
          rotation={stone.rotation}
          scale={stone.scale}
        >
          <GardenSurface role={index % 6 === 0 ? 'soot' : index % 4 === 0 ? 'indigo' : 'stone'} />
        </mesh>
      ))}
      <ReedBeds />
      <BankShrubs />
      <LotusField />
      {[0, 1, 2].map((index) => (
        <InkKoi index={index} key={index} playerPositionRef={playerPositionRef} reducedMotion={reducedMotion} />
      ))}
      <WaterRipples reducedMotion={reducedMotion} />
    </group>
  )
}
