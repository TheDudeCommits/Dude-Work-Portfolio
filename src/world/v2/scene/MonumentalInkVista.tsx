import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  createBrushLeafGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface } from './materials'

interface CrownStroke {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
}

const GOLDEN_ANGLE = 2.399963229728653

function seededNoise(seed: number) {
  const value = Math.sin(seed * 73.17 + 19.93) * 43758.5453
  return value - Math.floor(value)
}

function createSentinelCrown(): CrownStroke[] {
  return Array.from({ length: 118 }, (_, index) => {
    const cluster = index % 4
    const localIndex = Math.floor(index / 4)
    const centers = [
      new THREE.Vector3(3.6, 10.1, 0),
      new THREE.Vector3(7.4, 9.4, -0.15),
      new THREE.Vector3(11.2, 8.8, 0.12),
      new THREE.Vector3(-1.2, 11.6, -0.08),
    ]
    const radii = [2.9, 3.4, 3.1, 2.65]
    const angle = localIndex * GOLDEN_ANGLE + cluster * 1.3
    const radius = Math.sqrt((localIndex + 0.5) / 30) * radii[cluster]
    const center = centers[cluster]
    const x = center.x + Math.cos(angle) * radius
    const y = center.y + Math.sin(angle) * radius * 0.24 - Math.abs(Math.cos(angle)) * 0.18
    const z = center.z + Math.sin(angle * 1.7) * 0.46
    const scale = 0.82 + seededNoise(index * 13 + cluster * 41) * 0.92

    return {
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(
        (seededNoise(index * 17) - 0.5) * 0.42,
        (seededNoise(index * 23) - 0.5) * 0.8,
        -1.1 + Math.cos(angle) * 0.36,
      ),
      scale: new THREE.Vector3(
        scale * (index % 3 === 0 ? -1 : 1),
        scale,
        scale * 0.76,
      ),
    }
  })
}

function MonumentalSentinelPine({ reducedMotion }: { reducedMotion: boolean }) {
  const crown = useRef<THREE.Group>(null)
  const foliage = useRef<THREE.InstancedMesh>(null)
  const transform = useMemo(() => new THREE.Object3D(), [])
  const strokes = useMemo(createSentinelCrown, [])
  const leaf = useMemo(() => createBrushLeafGeometry(1.72, 0.34, 0.32, 10), [])
  const branches = useMemo(() => [
    createTaperedTubeGeometry([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.34, 2.9, 0.22),
      new THREE.Vector3(-0.28, 5.8, -0.18),
      new THREE.Vector3(0.52, 8.6, 0.16),
      new THREE.Vector3(-0.24, 11.6, -0.06),
    ], {
      endScale: 0.28,
      irregularity: 0.08,
      radialSegments: 9,
      radius: 0.68,
      seed: 941,
      startScale: 1.22,
      tubularSegments: 72,
    }),
    createTaperedTubeGeometry([
      new THREE.Vector3(0.15, 7.6, 0),
      new THREE.Vector3(2.8, 9.2, 0.18),
      new THREE.Vector3(6.4, 9.58, -0.12),
      new THREE.Vector3(10.2, 9.1, 0.08),
      new THREE.Vector3(13.8, 8.45, -0.04),
    ], {
      endScale: 0.05,
      irregularity: 0.095,
      radialSegments: 8,
      radius: 0.44,
      seed: 967,
      startScale: 0.9,
      tubularSegments: 92,
    }),
    createTaperedTubeGeometry([
      new THREE.Vector3(-0.08, 9.2, 0.04),
      new THREE.Vector3(-2.4, 10.7, -0.12),
      new THREE.Vector3(-4.6, 12.2, 0.1),
      new THREE.Vector3(-6.3, 13.7, -0.05),
    ], {
      endScale: 0.04,
      irregularity: 0.08,
      radialSegments: 8,
      radius: 0.38,
      seed: 983,
      startScale: 0.82,
      tubularSegments: 66,
    }),
    createTaperedTubeGeometry([
      new THREE.Vector3(0.05, 5.35, -0.03),
      new THREE.Vector3(-2.2, 6.1, 0.18),
      new THREE.Vector3(-4.3, 6.0, -0.1),
      new THREE.Vector3(-6.1, 5.25, 0.03),
    ], {
      endScale: 0.04,
      irregularity: 0.1,
      radialSegments: 8,
      radius: 0.33,
      seed: 997,
      startScale: 0.78,
      tubularSegments: 62,
    }),
  ], [])

  useLayoutEffect(() => {
    if (!foliage.current) return
    strokes.forEach((stroke, index) => {
      transform.position.copy(stroke.position)
      transform.rotation.copy(stroke.rotation)
      transform.scale.copy(stroke.scale)
      transform.updateMatrix()
      foliage.current?.setMatrixAt(index, transform.matrix)
    })
    foliage.current.instanceMatrix.needsUpdate = true
    foliage.current.computeBoundingSphere()
  }, [strokes, transform])

  useFrame(({ clock }) => {
    if (!crown.current) return
    const time = reducedMotion ? 0 : clock.elapsedTime
    crown.current.rotation.z = Math.sin(time * 0.145) * 0.018
    crown.current.rotation.y = Math.cos(time * 0.11) * 0.01
  })

  return (
    <group
      name="monumental-sentinel-pine"
      position={[-19.4, -0.2, -27.6]}
      rotation={[0, -0.08, 0]}
      scale={1.12}
    >
      {branches.map((branch, index) => (
        <mesh castShadow geometry={branch} key={index} receiveShadow>
          <GardenSurface role="soot" />
        </mesh>
      ))}
      <group ref={crown}>
        <instancedMesh
          args={[undefined, undefined, strokes.length]}
          castShadow
          count={strokes.length}
          geometry={leaf}
          ref={foliage}
        >
          <GardenSurface role="soot" side={THREE.DoubleSide} />
        </instancedMesh>
      </group>
    </group>
  )
}

function CounterweightCliffs() {
  const rocks = useMemo(() => Array.from({ length: 9 }, (_, index) => ({
    geometry: createScholarStoneGeometry(1.1, 1031 + index * 19, 22),
    position: [
      18.2 + Math.sin(index * 1.7) * 2.2,
      0.4 + index * 1.42,
      -32.5 + Math.cos(index * 1.23) * 2.1,
    ] as [number, number, number],
    rotation: [
      Math.sin(index) * 0.16,
      index * 0.74,
      -0.08 + Math.cos(index * 0.8) * 0.13,
    ] as [number, number, number],
    scale: [
      3.6 - index * 0.11,
      2.4 + index * 0.16,
      2.45 - index * 0.08,
    ] as [number, number, number],
  })), [])

  return (
    <group name="monumental-counterweight-cliffs">
      {rocks.map((rock, index) => (
        <mesh
          castShadow={index < 6}
          geometry={rock.geometry}
          key={index}
          position={rock.position}
          receiveShadow
          rotation={rock.rotation}
          scale={rock.scale}
        >
          <GardenSurface role={index % 4 === 0 ? 'soot' : index % 3 === 0 ? 'indigo' : 'stone'} />
        </mesh>
      ))}
    </group>
  )
}

export function MonumentalInkVista({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group name="monumental-ink-vista">
      <MonumentalSentinelPine reducedMotion={reducedMotion} />
      <CounterweightCliffs />
    </group>
  )
}
