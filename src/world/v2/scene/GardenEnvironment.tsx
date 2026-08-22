import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  circleStrokePoints,
  createBrushLeafGeometry,
  createOrganicPlateGeometry,
  createRibbonGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface, LIVING_SCROLL_PALETTE } from './materials'

function BambooGrove() {
  const group = useRef<THREE.Group>(null)
  const stalks = useRef<THREE.InstancedMesh>(null)
  const leaves = useRef<THREE.InstancedMesh>(null)
  const transform = useMemo(() => new THREE.Object3D(), [])
  const stalkGeometry = useMemo(() => createTaperedTubeGeometry([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.03, 1.8, 0),
    new THREE.Vector3(-0.02, 3.8, 0.03),
    new THREE.Vector3(0.04, 5.6, -0.02),
  ], { radius: 0.085, startScale: 1.12, endScale: 0.6, radialSegments: 7, seed: 6, tubularSegments: 34 }), [])
  const leafGeometry = useMemo(() => createBrushLeafGeometry(0.72, 0.15, 0.2, 7), [])
  const stalkCount = 44
  const leafCount = stalkCount * 4

  useLayoutEffect(() => {
    if (!stalks.current || !leaves.current) return
    for (let index = 0; index < stalkCount; index += 1) {
      const band = index % 2
      const t = index / stalkCount
      const angle = THREE.MathUtils.lerp(-0.62, 0.78, t)
      const x = 11.8 + Math.cos(angle) * (3.1 + band * 0.8) + Math.sin(index * 2.7) * 0.42
      const z = -2.0 + Math.sin(angle) * 11.5 + Math.cos(index * 1.9) * 0.35
      const height = 0.72 + ((index * 37) % 31) / 31 * 0.52
      transform.position.set(x, -0.2, z)
      transform.rotation.set(Math.sin(index) * 0.025, Math.sin(index * 1.3) * 0.5, Math.cos(index * 1.7) * 0.045)
      transform.scale.set(0.78 + band * 0.18, height, 0.78 + band * 0.18)
      transform.updateMatrix()
      stalks.current.setMatrixAt(index, transform.matrix)

      for (let leafIndex = 0; leafIndex < 4; leafIndex += 1) {
        const instanceIndex = index * 4 + leafIndex
        const leafHeight = 2.1 + leafIndex * 0.75 + Math.sin(index * 2.2) * 0.2
        const direction = index * 1.9 + leafIndex * 1.71
        transform.position.set(x, -0.2 + leafHeight * height, z)
        transform.rotation.set(Math.sin(direction) * 0.5, direction, Math.cos(direction) * 0.9)
        const leafScale = 0.7 + ((index + leafIndex * 5) % 9) / 9 * 0.5
        transform.scale.set(leafScale * (leafIndex % 2 ? -1 : 1), leafScale, leafScale)
        transform.updateMatrix()
        leaves.current.setMatrixAt(instanceIndex, transform.matrix)
      }
    }
    stalks.current.instanceMatrix.needsUpdate = true
    leaves.current.instanceMatrix.needsUpdate = true
  }, [transform])

  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.24) * 0.004
  })

  return (
    <group ref={group}>
      <instancedMesh args={[undefined, undefined, stalkCount]} castShadow count={stalkCount} geometry={stalkGeometry} ref={stalks}>
        <GardenSurface role="bamboo" />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, leafCount]} castShadow count={leafCount} geometry={leafGeometry} ref={leaves}>
        <GardenSurface role="foliage" side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}

function BrushLantern({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const post = useMemo(() => createTaperedTubeGeometry([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.03, 0.8, -0.02),
    new THREE.Vector3(-0.02, 1.55, 0),
  ], { radius: 0.12, startScale: 1.15, endScale: 0.68, radialSegments: 7, seed: Math.abs(position[0] * 11), tubularSegments: 22 }), [position])
  const roof = useMemo(() => createBrushLeafGeometry(1.05, 0.62, 0.1, 9), [])
  const glow = useMemo(() => createScholarStoneGeometry(0.24, Math.abs(position[2] * 13), 14), [position])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow geometry={post}><GardenSurface role="stone" /></mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh geometry={roof} key={index} position={[0, 1.58, 0]} rotation={[Math.PI / 2, index * Math.PI / 2, -Math.PI / 2]} scale={[0.72, 0.75, 0.72]}>
          <GardenSurface role="soot" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={glow} position={[0, 1.42, 0]} scale={[0.72, 0.9, 0.72]}><GardenSurface role="gold" /></mesh>
      <pointLight color={LIVING_SCROLL_PALETTE.gold} decay={2} distance={4.5} intensity={2.1} position={[0, 1.42, 0]} />
    </group>
  )
}

export function GardenEnvironment() {
  const geometry = useMemo(() => {
    const ground = createOrganicPlateGeometry(29.5, 30.5, 0.85, 77, 112)
    const entrancePath = createRibbonGeometry([
      new THREE.Vector3(0.4, 0.08, 29),
      new THREE.Vector3(-0.2, 0.09, 21.4),
      new THREE.Vector3(-0.35, 0.09, 16.2),
      new THREE.Vector3(0.2, 0.11, 10.2),
      new THREE.Vector3(2.7, 0.1, 6.4),
      new THREE.Vector3(7.9, 0.08, 4.2),
    ], { width: 3.1, thickness: 0.08, tubularSegments: 58, widthVariation: 0.065 })
    const westPath = createRibbonGeometry([
      new THREE.Vector3(-1.4, 0.07, 8.4),
      new THREE.Vector3(-7.1, 0.08, 6.8),
      new THREE.Vector3(-12.2, 0.09, 2.1),
      new THREE.Vector3(-13.1, 0.08, -5.3),
      new THREE.Vector3(-10.2, 0.09, -12.5),
      new THREE.Vector3(-4.8, 0.1, -17.0),
    ], { width: 2.45, thickness: 0.07, tubularSegments: 70, widthVariation: 0.08 })
    const eastPath = createRibbonGeometry([
      new THREE.Vector3(7.8, 0.07, 4.2),
      new THREE.Vector3(12.1, 0.08, 1.4),
      new THREE.Vector3(13.2, 0.08, -5.4),
      new THREE.Vector3(10.8, 0.09, -12.0),
      new THREE.Vector3(4.6, 0.1, -17.1),
    ], { width: 2.45, thickness: 0.07, tubularSegments: 64, widthVariation: 0.08 })
    const northPath = createRibbonGeometry([
      new THREE.Vector3(-5.2, 0.09, -17.0),
      new THREE.Vector3(0, 0.1, -20.2),
      new THREE.Vector3(5.1, 0.09, -17.0),
    ], { width: 2.55, thickness: 0.07, tubularSegments: 36, widthVariation: 0.06 })
    const rakedLines = [11.1, 12.25, 13.4].map((radius, index) => createTaperedTubeGeometry(
      circleStrokePoints(radius, radius * 0.72, -2.45, 2.55, 34, 0),
      { radius: 0.018 + index * 0.003, startScale: 0.72, endScale: 0.03, radialSegments: 5, seed: 20 + index, tubularSegments: 100 },
    ))
    return { eastPath, entrancePath, ground, northPath, rakedLines, westPath }
  }, [])
  const scholarStones = useMemo(() => [
    { geometry: createScholarStoneGeometry(1.28, 19, 24), position: [-18.2, 1.0, -2.8] as [number, number, number], scale: [1.15, 1.8, 0.82] as [number, number, number] },
    { geometry: createScholarStoneGeometry(0.92, 43, 22), position: [-17.1, 0.68, -5.0] as [number, number, number], scale: [1, 1.3, 0.75] as [number, number, number] },
    { geometry: createScholarStoneGeometry(1.12, 71, 22), position: [17.9, 0.82, -13.4] as [number, number, number], scale: [0.9, 1.55, 0.76] as [number, number, number] },
    { geometry: createScholarStoneGeometry(0.78, 91, 20), position: [19.0, 0.5, -11.3] as [number, number, number], scale: [1.1, 1.1, 0.82] as [number, number, number] },
  ], [])

  return (
    <group>
      <mesh geometry={geometry.ground} position={[0, -0.68, 0]} receiveShadow>
        <GardenSurface role="paper" />
      </mesh>
      {[geometry.entrancePath, geometry.westPath, geometry.eastPath, geometry.northPath].map((path, index) => (
        <mesh geometry={path} key={index} receiveShadow>
          <GardenSurface role={index === 0 ? 'stone' : 'paper'} />
        </mesh>
      ))}
      {geometry.rakedLines.map((line, index) => (
        <mesh geometry={line} key={index} position={[0, -0.1 - index * 0.003, -3.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <GardenSurface role="stone" />
        </mesh>
      ))}
      <BambooGrove />
      {scholarStones.map((stone, index) => (
        <mesh castShadow geometry={stone.geometry} key={index} position={stone.position} receiveShadow rotation={[0, index * 0.73, index % 2 ? -0.1 : 0.08]} scale={stone.scale}>
          <GardenSurface role={index % 2 ? 'stone' : 'soot'} />
        </mesh>
      ))}
      <BrushLantern position={[-6.7, 0, 8.2]} rotation={0.22} />
      <BrushLantern position={[7.3, 0, 6.8]} rotation={-0.18} />
      <BrushLantern position={[-11.7, 0, -13.8]} rotation={0.42} />
      <BrushLantern position={[11.4, 0, -13.4]} rotation={-0.38} />
    </group>
  )
}
