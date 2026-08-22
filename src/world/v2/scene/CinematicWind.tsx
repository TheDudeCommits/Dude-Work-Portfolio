import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createBrushLeafGeometry, createTaperedTubeGeometry } from './geometry'
import { GardenSurface } from './materials'

interface BambooCluster {
  count: number
  position: readonly [number, number, number]
  radius: readonly [number, number]
  seed: number
}

interface DriftParticle {
  baseX: number
  baseY: number
  depth: number
  phase: number
  roll: number
  scale: number
  speed: number
}

const BAMBOO_CLUSTERS: readonly BambooCluster[] = [
  { count: 18, position: [-8.4, -0.22, 23.1], radius: [2.8, 3.4], seed: 701 },
  { count: 24, position: [8.9, -0.23, 19.5], radius: [3.2, 4.5], seed: 719 },
  { count: 18, position: [-16.8, -0.25, 4.2], radius: [2.9, 6.4], seed: 743 },
  { count: 20, position: [18.4, -0.24, -5.8], radius: [3.2, 6.2], seed: 773 },
  { count: 18, position: [-19.2, -0.26, -18.6], radius: [3.4, 5.1], seed: 797 },
] as const

const FOREGROUND_WIPES = [
  { position: [-4.8, 0.35, 26.8] as const, rotation: -0.62, scale: 4.8 },
  { position: [5.4, 0.2, 22.7] as const, rotation: 0.72, scale: 4.1 },
  { position: [-5.5, 0.2, 6.6] as const, rotation: -0.78, scale: 4.4 },
  { position: [5.9, 0.25, -10.8] as const, rotation: 0.82, scale: 4.7 },
  { position: [-6.1, 0.2, -20.8] as const, rotation: -0.74, scale: 5.2 },
] as const

const GOLDEN_ANGLE = 2.399963229728653

function seededNoise(seed: number) {
  const value = Math.sin(seed * 91.713 + 17.197) * 43758.5453
  return value - Math.floor(value)
}

function WindSweptBamboo() {
  const stalks = useRef<THREE.InstancedMesh>(null)
  const leaves = useRef<THREE.InstancedMesh>(null)
  const inkLeaves = useRef<THREE.InstancedMesh>(null)
  const transform = useMemo(() => new THREE.Object3D(), [])
  const totalStalks = useMemo(
    () => BAMBOO_CLUSTERS.reduce((sum, cluster) => sum + cluster.count, 0),
    [],
  )
  const totalLeaves = totalStalks * 5
  const inkLeafCount = Math.ceil(totalLeaves / 5)
  const foliageLeafCount = totalLeaves - inkLeafCount
  const stalkGeometry = useMemo(() => createTaperedTubeGeometry([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 2.2, 0.02),
    new THREE.Vector3(0.14, 4.8, -0.03),
    new THREE.Vector3(0.33, 7.2, 0.04),
    new THREE.Vector3(0.62, 9.1, 0),
  ], {
    endScale: 0.44,
    irregularity: 0.025,
    radialSegments: 7,
    radius: 0.09,
    seed: 683,
    startScale: 1.12,
    tubularSegments: 48,
  }), [])
  const leafGeometry = useMemo(() => createBrushLeafGeometry(1.16, 0.17, 0.34, 9), [])

  useLayoutEffect(() => {
    if (!stalks.current || !leaves.current || !inkLeaves.current) return
    let stalkIndex = 0
    let leafIndex = 0
    let foliageIndex = 0
    let inkIndex = 0

    BAMBOO_CLUSTERS.forEach((cluster) => {
      for (let localIndex = 0; localIndex < cluster.count; localIndex += 1) {
        const angle = localIndex * GOLDEN_ANGLE + cluster.seed
        const radius = Math.sqrt((localIndex + 0.45) / cluster.count)
        const x = cluster.position[0]
          + Math.cos(angle) * cluster.radius[0] * radius
          + (seededNoise(cluster.seed + localIndex * 7) - 0.5) * 0.42
        const z = cluster.position[2]
          + Math.sin(angle) * cluster.radius[1] * radius
          + (seededNoise(cluster.seed + localIndex * 11) - 0.5) * 0.52
        const height = 0.78 + seededNoise(cluster.seed + localIndex * 19) * 0.54
        const windLean = 0.045 + seededNoise(cluster.seed + localIndex * 29) * 0.075

        transform.position.set(x, cluster.position[1], z)
        transform.rotation.set(
          -0.02 + seededNoise(cluster.seed + localIndex * 31) * 0.035,
          seededNoise(cluster.seed + localIndex * 37) * Math.PI * 2,
          -windLean,
        )
        transform.scale.set(0.72 + height * 0.2, height, 0.72 + height * 0.2)
        transform.updateMatrix()
        stalks.current?.setMatrixAt(stalkIndex, transform.matrix)
        stalkIndex += 1

        for (let branchIndex = 0; branchIndex < 5; branchIndex += 1) {
          const direction = angle + branchIndex * 1.91 + localIndex * 0.37
          const heightOnStalk = 3.2 + branchIndex * 1.05 + seededNoise(cluster.seed + leafIndex) * 0.32
          const leafScale = 0.62 + seededNoise(cluster.seed + leafIndex * 13) * 0.7
          transform.position.set(
            x + Math.cos(direction) * 0.14,
            cluster.position[1] + heightOnStalk * height,
            z + Math.sin(direction) * 0.14,
          )
          transform.rotation.set(
            Math.sin(direction) * 0.44,
            direction,
            -1.16 + Math.cos(direction) * 0.42,
          )
          transform.scale.set(branchIndex % 2 === 0 ? -leafScale : leafScale, leafScale, leafScale)
          transform.updateMatrix()
          const isInkLeaf = leafIndex % 5 === 0
          const destination = isInkLeaf ? inkLeaves.current : leaves.current
          destination?.setMatrixAt(isInkLeaf ? inkIndex : foliageIndex, transform.matrix)
          if (isInkLeaf) inkIndex += 1
          else foliageIndex += 1
          leafIndex += 1
        }
      }
    })

    stalks.current.instanceMatrix.needsUpdate = true
    leaves.current.instanceMatrix.needsUpdate = true
    inkLeaves.current.instanceMatrix.needsUpdate = true
    stalks.current.computeBoundingSphere()
    leaves.current.computeBoundingSphere()
    inkLeaves.current.computeBoundingSphere()
  }, [transform])

  return (
    <group name="cinematic-wind-swept-bamboo">
      <instancedMesh
        args={[undefined, undefined, totalStalks]}
        castShadow
        count={totalStalks}
        geometry={stalkGeometry}
        ref={stalks}
      >
        <GardenSurface role="bamboo" />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, foliageLeafCount]}
        castShadow
        count={foliageLeafCount}
        geometry={leafGeometry}
        ref={leaves}
      >
        <GardenSurface role="foliage" side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, inkLeafCount]}
        castShadow
        count={inkLeafCount}
        geometry={leafGeometry}
        ref={inkLeaves}
      >
        <GardenSurface role="soot" side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}

function createDriftParticles(count: number, seed: number): DriftParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    baseX: (seededNoise(seed + index * 17) - 0.5) * 14,
    baseY: 1.2 + seededNoise(seed + index * 23) * 6.8,
    depth: seededNoise(seed + index * 31),
    phase: seededNoise(seed + index * 43) * Math.PI * 2,
    roll: (seededNoise(seed + index * 47) - 0.5) * 1.4,
    scale: 0.32 + seededNoise(seed + index * 53) * 0.72,
    speed: 0.018 + seededNoise(seed + index * 61) * 0.026,
  }))
}

function WindborneOfferings({ reducedMotion }: { reducedMotion: boolean }) {
  const paper = useRef<THREE.InstancedMesh>(null)
  const vermilion = useRef<THREE.InstancedMesh>(null)
  const transform = useMemo(() => new THREE.Object3D(), [])
  const paperParticles = useMemo(() => createDriftParticles(42, 821), [])
  const vermilionParticles = useMemo(() => createDriftParticles(18, 887), [])
  const geometry = useMemo(() => createBrushLeafGeometry(0.68, 0.22, 0.12, 8), [])

  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime
    const update = (mesh: THREE.InstancedMesh | null, particles: readonly DriftParticle[], offset: number) => {
      if (!mesh) return
      particles.forEach((particle, index) => {
        const progress = (particle.depth + time * particle.speed) % 1
        const gust = Math.sin(time * 0.54 + particle.phase + progress * Math.PI * 4)
        transform.position.set(
          particle.baseX + gust * (0.8 + particle.scale * 0.65),
          particle.baseY + Math.sin(time * 0.38 + particle.phase) * 0.55 + progress * 0.9,
          27.8 - progress * 56,
        )
        transform.rotation.set(
          particle.roll + time * (0.14 + particle.speed * 2),
          particle.phase + time * 0.11,
          gust * 0.82 + offset,
        )
        transform.scale.set(
          particle.scale * (index % 2 === 0 ? -1 : 1),
          particle.scale,
          particle.scale,
        )
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }

    update(paper.current, paperParticles, 0)
    update(vermilion.current, vermilionParticles, 0.36)
  })

  return (
    <group name="cinematic-windborne-offerings">
      <instancedMesh
        args={[undefined, undefined, paperParticles.length]}
        count={paperParticles.length}
        frustumCulled={false}
        geometry={geometry}
        ref={paper}
      >
        <GardenSurface role="paper" side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, vermilionParticles.length]}
        count={vermilionParticles.length}
        frustumCulled={false}
        geometry={geometry}
        ref={vermilion}
      >
        <GardenSurface role="vermilion" side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}

function ForegroundBrushWipes({ reducedMotion }: { reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null)
  const leaf = useMemo(() => createBrushLeafGeometry(2.25, 0.62, 0.52, 12), [])

  useFrame(({ clock }) => {
    if (!root.current) return
    const time = reducedMotion ? 0 : clock.elapsedTime
    root.current.children.forEach((child, index) => {
      const wipe = FOREGROUND_WIPES[index]
      child.rotation.z = wipe.rotation + Math.sin(time * (0.16 + index * 0.018) + index * 1.7) * 0.07
      child.rotation.y = Math.sin(time * 0.11 + index) * 0.13
    })
  })

  return (
    <group name="cinematic-foreground-brush-wipes" ref={root}>
      {FOREGROUND_WIPES.map((wipe, index) => (
        <mesh
          castShadow
          geometry={leaf}
          key={wipe.position[2]}
          position={[...wipe.position]}
          rotation={[0, index % 2 === 0 ? 0.22 : -0.2, wipe.rotation]}
          scale={[
            wipe.scale * (index % 2 === 0 ? -1 : 1),
            wipe.scale,
            wipe.scale,
          ]}
        >
          <GardenSurface role="soot" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export function CinematicWind({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group name="cinematic-wind">
      <WindSweptBamboo />
      <WindborneOfferings reducedMotion={reducedMotion} />
      <ForegroundBrushWipes reducedMotion={reducedMotion} />
    </group>
  )
}
