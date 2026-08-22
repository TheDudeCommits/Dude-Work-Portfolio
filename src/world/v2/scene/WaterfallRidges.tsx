import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SumiSurfaceMaterial } from '../../../art'
import {
  circleStrokePoints,
  createBrushLeafGeometry,
  createDrapedVeilGeometry,
  createOrganicPlateGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface } from './materials'

interface RidgeVariant {
  foliageCount: number
  ledgeSide: -1 | 1
  position: [number, number, number]
  rotation: number
  scale: number
  seed: number
  waterfallHeight: number
  waterfallWidth: number
}

const RIDGES: readonly RidgeVariant[] = [
  {
    foliageCount: 30,
    ledgeSide: 1,
    position: [-14.8, -0.42, -25.2],
    rotation: 0.38,
    scale: 1.16,
    seed: 31,
    waterfallHeight: 6.6,
    waterfallWidth: 2.65,
  },
  {
    foliageCount: 24,
    ledgeSide: -1,
    position: [14.7, -0.48, -23.5],
    rotation: -0.46,
    scale: 1.04,
    seed: 73,
    waterfallHeight: 5.5,
    waterfallWidth: 2.15,
  },
] as const

function addWaterfallWeights(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position as THREE.BufferAttribute
  const uv = geometry.attributes.uv as THREE.BufferAttribute | undefined
  const weights = new Float32Array(position.count)
  for (let index = 0; index < position.count; index += 1) {
    const vertical = uv ? uv.getY(index) : THREE.MathUtils.inverseLerp(-3, 3, position.getY(index))
    weights[index] = 0.22 + THREE.MathUtils.smoothstep(1 - vertical, 0.05, 1) * 0.78
  }
  geometry.setAttribute('aSumiWind', new THREE.BufferAttribute(weights, 1))
  return geometry
}

function WaterfallCurtain({
  height,
  reducedMotion,
  seed,
  width,
}: {
  height: number
  reducedMotion: boolean
  seed: number
  width: number
}) {
  const group = useRef<THREE.Group>(null)
  const ribbons = useMemo(() => [0, 1, 2].map((index) => {
    const geometry = createDrapedVeilGeometry(
      width * (0.84 + index * 0.08),
      height * (0.95 + index * 0.025),
      18,
      34,
    )
    const position = geometry.attributes.position as THREE.BufferAttribute
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const u = uv.getX(vertex)
      const v = uv.getY(vertex)
      const edgeTaper = Math.pow(Math.sin(u * Math.PI), 0.34)
      const x = position.getX(vertex) * (0.72 + edgeTaper * 0.34)
      const flow = Math.sin(v * 32 + u * 8.5 + seed + index * 2.7) * (0.025 + v * 0.035)
      const fray = v < 0.12 ? Math.sin(u * 41 + seed) * (0.12 - v) * 0.45 : 0
      position.setXYZ(vertex, x + flow + fray, position.getY(vertex), position.getZ(vertex) + flow * 0.6)
    }
    geometry.computeVertexNormals()
    return addWaterfallWeights(geometry)
  }), [height, seed, width])

  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return
    group.current.children.forEach((child, index) => {
      const pulse = Math.sin(clock.elapsedTime * (0.62 + index * 0.09) + seed * 0.1 + index * 1.7)
      child.position.y = pulse * (0.035 + index * 0.012)
      child.position.x = Math.sin(clock.elapsedTime * 0.34 + index * 2.2) * 0.018
      child.scale.y = 1 + pulse * 0.012
    })
  })

  return (
    <group ref={group}>
      {ribbons.map((geometry, index) => (
        <mesh
          geometry={geometry}
          key={index}
          position={[index === 0 ? -0.12 : index === 1 ? 0.14 : 0, 0, index * 0.055]}
          renderOrder={5 + index}
        >
          <SumiSurfaceMaterial
            depthWrite={false}
            opacity={0.48 - index * 0.075}
            role="water"
            side={THREE.DoubleSide}
            transparent
            windResponse={reducedMotion ? 0.02 : 0.22 + index * 0.04}
          />
        </mesh>
      ))}
    </group>
  )
}

function SprayWashes({ reducedMotion, seed, width }: { reducedMotion: boolean; seed: number; width: number }) {
  const group = useRef<THREE.Group>(null)
  const wash = useMemo(() => createBrushLeafGeometry(1.45, 0.58, 0.24, 10), [])
  const splashArcs = useMemo(() => [0, 1].map((index) => createTaperedTubeGeometry(
    circleStrokePoints(width * (0.62 + index * 0.2), 0.38 + index * 0.12, -2.72, 2.9, 18),
    {
      endScale: 0.02,
      irregularity: 0.13,
      radialSegments: 5,
      radius: 0.024 - index * 0.005,
      seed: seed + index * 11,
      startScale: 0.68,
      tubularSegments: 54,
    },
  )), [seed, width])

  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return
    group.current.children.forEach((child, index) => {
      const cycle = (clock.elapsedTime * (0.08 + index * 0.006) + index * 0.19 + seed * 0.01) % 1
      const breadth = 0.72 + cycle * 0.62
      child.scale.set(breadth, 0.74 + cycle * 0.38, breadth)
      child.position.y = cycle * 0.24
      child.rotation.z = index * 0.9 + cycle * 0.16
    })
  })

  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((index) => (
        <mesh
          geometry={wash}
          key={`wash-${index}`}
          position={[(index - 1.5) * width * 0.26, index * 0.035, 0.18 + index * 0.03]}
          rotation={[Math.PI / 2, index * 0.83, -Math.PI / 2 + index * 0.18]}
          scale={[1.1 + index * 0.08, 0.64, 1]}
        >
          <GardenSurface role="mist" side={THREE.DoubleSide} transparent />
        </mesh>
      ))}
      {splashArcs.map((geometry, index) => (
        <mesh geometry={geometry} key={`arc-${index}`} position={[0, 0.08 + index * 0.04, 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
          <GardenSurface role="mist" transparent />
        </mesh>
      ))}
    </group>
  )
}

function RidgeFoliage({ count, seed }: { count: number; seed: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const leaf = useMemo(() => createBrushLeafGeometry(1.18, 0.27, 0.22, 9), [])
  const transform = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const tier = index % 5
      const spread = ((index * 47 + seed) % 73) / 73
      transform.position.set(
        side * (2.2 + spread * 3.4),
        0.45 + tier * 1.05 + Math.sin(index * 2.1 + seed) * 0.22,
        -0.45 + Math.cos(index * 1.7 + seed) * 1.05,
      )
      transform.rotation.set(
        Math.sin(index * 0.71) * 0.42,
        side * (0.7 + spread * 1.5),
        side * (0.64 + Math.cos(index) * 0.31),
      )
      const scale = 0.6 + ((index * 29 + seed) % 41) / 41 * 0.72
      transform.scale.set(side * scale, scale, scale)
      transform.updateMatrix()
      mesh.current.setMatrixAt(index, transform.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [count, seed, transform])

  return (
    <instancedMesh args={[undefined, undefined, count]} castShadow count={count} geometry={leaf} ref={mesh}>
      <GardenSurface role="foliage" side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function WaterfallRidge({ reducedMotion, variant }: { reducedMotion: boolean; variant: RidgeVariant }) {
  const rocks = useMemo(() => {
    const layout = [
      [-3.6, 0.95, 0.1, 2.7, 1.5, 2.15],
      [-1.65, 1.85, -0.2, 2.5, 2.55, 1.8],
      [0.4, 2.25, -0.55, 2.35, 3.1, 1.55],
      [2.3, 1.55, -0.2, 2.6, 2.25, 1.9],
      [4.15, 0.75, 0.05, 2.1, 1.35, 1.75],
      [-2.65, 4.25, -0.75, 2.0, 2.25, 1.45],
      [0.25, 5.35, -0.92, 2.25, 2.55, 1.42],
      [2.72, 4.0, -0.72, 1.95, 2.2, 1.36],
      [-0.75, 7.05, -1.2, 1.5, 2.0, 1.12],
    ] as const
    return layout.map((entry, index) => ({
      geometry: createScholarStoneGeometry(1, variant.seed + index * 13, 20 + index % 3 * 2),
      position: [entry[0], entry[1], entry[2]] as [number, number, number],
      rotation: [Math.sin(index * 1.3) * 0.18, index * 0.79 + variant.seed * 0.03, Math.cos(index * 0.8) * 0.14] as [number, number, number],
      scale: [entry[3], entry[4], entry[5]] as [number, number, number],
    }))
  }, [variant.seed])
  const ledges = useMemo(() => Array.from({ length: 6 }, (_, index) => ({
    geometry: createOrganicPlateGeometry(1.3 - index * 0.06, 0.76 - index * 0.03, 0.24, variant.seed + index * 7, 34),
    position: [
      variant.ledgeSide * (4.7 - index * 0.7),
      0.28 + index * 0.76,
      1.45 - index * 0.25,
    ] as [number, number, number],
    rotation: [0.03 * Math.sin(index), -variant.ledgeSide * (0.22 + index * 0.04), variant.ledgeSide * 0.025] as [number, number, number],
  })), [variant.ledgeSide, variant.seed])

  return (
    <group position={variant.position} rotation={[0, variant.rotation, 0]} scale={variant.scale}>
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
          <GardenSurface role={index === 2 || index === 6 || index === 8 ? 'soot' : 'stone'} />
        </mesh>
      ))}
      {ledges.map((ledge, index) => (
        <mesh castShadow geometry={ledge.geometry} key={index} position={ledge.position} receiveShadow rotation={ledge.rotation}>
          <GardenSurface role={index % 3 === 0 ? 'paper' : 'stone'} />
        </mesh>
      ))}
      <group position={[0.2, variant.waterfallHeight * 0.5 + 0.78, 1.12]}>
        <WaterfallCurtain
          height={variant.waterfallHeight}
          reducedMotion={reducedMotion}
          seed={variant.seed}
          width={variant.waterfallWidth}
        />
      </group>
      <group position={[0.15, 0.26, 1.58]}>
        <SprayWashes reducedMotion={reducedMotion} seed={variant.seed} width={variant.waterfallWidth} />
      </group>
      <RidgeFoliage count={variant.foliageCount} seed={variant.seed} />
    </group>
  )
}

export function WaterfallRidges({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group name="living-scroll-waterfall-ridges">
      {RIDGES.map((variant) => (
        <WaterfallRidge key={variant.seed} reducedMotion={reducedMotion} variant={variant} />
      ))}
    </group>
  )
}

export { RIDGES as WATERFALL_RIDGE_PLACEMENTS }
