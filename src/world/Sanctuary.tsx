import { useCursor, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { projects, type Project } from '../projects'
import type { ProgressRef } from './types'

function ShojiPanel({ side }: { side: -1 | 1 }) {
  const lines = useMemo(() => {
    const vertical = Array.from({ length: 7 }, (_, index) => ({
      key: `v-${index}`,
      position: [-1.85 + index * 0.61, 0, 0.06] as [number, number, number],
      scale: [0.045, 4.75, 0.045] as [number, number, number],
    }))
    const horizontal = Array.from({ length: 6 }, (_, index) => ({
      key: `h-${index}`,
      position: [0, -2 + index * 0.8, 0.06] as [number, number, number],
      scale: [3.8, 0.045, 0.045] as [number, number, number],
    }))
    return [...vertical, ...horizontal]
  }, [])

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4.1, 5.2, 0.24]} />
        <meshStandardMaterial color="#e9e0ca" roughness={0.86} transparent opacity={0.94} />
      </mesh>
      {lines.map((line) => (
        <mesh castShadow key={line.key} position={line.position} scale={line.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#4a3c31" roughness={0.92} />
        </mesh>
      ))}
      <mesh castShadow position={[side * 1.68, 0, 0.2]}>
        <boxGeometry args={[0.13, 0.65, 0.11]} />
        <meshStandardMaterial color="#7c5a36" metalness={0.28} roughness={0.5} />
      </mesh>
    </group>
  )
}

function SlidingDoors({ progressRef }: { progressRef: ProgressRef }) {
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const open = THREE.MathUtils.smoothstep(progressRef.current, 0.79, 0.93)
    const damp = 1 - Math.exp(-delta * 2.7)
    if (left.current) left.current.position.x = THREE.MathUtils.lerp(left.current.position.x, -2.12 - open * 4.1, damp)
    if (right.current) right.current.position.x = THREE.MathUtils.lerp(right.current.position.x, 2.12 + open * 4.1, damp)
  })

  return (
    <group position={[0, 2.72, -28.4]}>
      <group ref={left} position={[-2.12, 0, 0]}>
        <ShojiPanel side={1} />
      </group>
      <group ref={right} position={[2.12, 0, 0]}>
        <ShojiPanel side={-1} />
      </group>
    </group>
  )
}

function TempleRoof({ position, scale = 1 }: {
  position: [number, number, number]
  scale?: number
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow rotation={[0, Math.PI / 4, 0]} scale={[1.72, 0.55, 0.9]}>
        <cylinderGeometry args={[5.4, 7.2, 1.7, 4]} />
        <meshStandardMaterial color="#405452" metalness={0.03} roughness={0.94} />
      </mesh>
      <mesh castShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[0.42, 0.42, 10.8]} />
        <meshStandardMaterial color="#2d3d3b" roughness={0.9} />
      </mesh>
    </group>
  )
}

function ProjectPortal({ project, position, portalScale = 1 }: {
  portalScale?: number
  project: Project
  position: [number, number, number]
}) {
  const texture = useTexture(project.image)
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.repeat.set(1, 0.572)
  texture.offset.set(0, 0.214)
  texture.needsUpdate = true

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const target = portalScale * (hovered ? 1.065 : 1)
    const damp = 1 - Math.exp(-delta * 6)
    group.current.scale.lerp(new THREE.Vector3(target, target, target), damp)
    group.current.position.z = position[2] + (hovered ? 0.24 : 0)
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.45 + position[0]) * 0.0025
  })

  return (
    <group ref={group} position={position} scale={portalScale}>
      <mesh castShadow position={[0, 0, -0.12]}>
        <boxGeometry args={[3.48, 2.12, 0.16]} />
        <meshStandardMaterial color="#493e34" roughness={0.92} />
      </mesh>
      <mesh
        position={[0, 0, 0.02]}
        onClick={(event) => {
          event.stopPropagation()
          window.open(project.href, '_blank', 'noopener,noreferrer')
        }}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
      >
        <planeGeometry args={[3.18, 1.82]} />
        <meshBasicMaterial
          color={hovered ? '#ffffff' : '#ece7d9'}
          map={texture}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function ProjectWall() {
  const compact = useThree((state) => state.size.width < 640)
  const positions = useMemo(() => projects.map((_, index) => {
    if (compact) {
      const column = index % 2
      const row = Math.floor(index / 2)
      const lastPortal = index === projects.length - 1
      return [lastPortal ? 0 : -1.05 + column * 2.1, 5.65 - row * 1.25, -42.25] as [number, number, number]
    }
    const column = index % 3
    const row = Math.floor(index / 3)
    return [-4.15 + column * 4.15, 5.05 - row * 2.22, -42.25] as [number, number, number]
  }), [compact])

  return (
    <group>
      {projects.map((project, index) => (
        <ProjectPortal
          key={project.slug}
          portalScale={compact ? 0.58 : 1}
          position={positions[index]}
          project={project}
        />
      ))}
    </group>
  )
}

function InkPool() {
  const material = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.opacity = 0.46 + Math.sin(clock.elapsedTime * 0.35) * 0.035
    }
  })

  return (
    <mesh position={[0, 0.015, -35.3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[13.2, 13.2]} />
      <meshStandardMaterial
        ref={material}
        color="#263b39"
        metalness={0.08}
        opacity={0.48}
        roughness={0.22}
        transparent
      />
    </mesh>
  )
}

export function Sanctuary({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <group>
      <group position={[0, 0, -34.5]}>
        <mesh castShadow position={[-7.1, 3.4, 0]}>
          <boxGeometry args={[0.5, 6.8, 16]} />
          <meshStandardMaterial color="#342f2a" roughness={0.96} />
        </mesh>
        <mesh castShadow position={[7.1, 3.4, 0]}>
          <boxGeometry args={[0.5, 6.8, 16]} />
          <meshStandardMaterial color="#342f2a" roughness={0.96} />
        </mesh>
        <mesh castShadow position={[0, 6.85, -3.8]}>
          <boxGeometry args={[14.7, 0.5, 8.2]} />
          <meshStandardMaterial color="#3c413b" roughness={0.94} />
        </mesh>
        <mesh receiveShadow position={[0, 3.5, -8.15]}>
          <boxGeometry args={[14.5, 7, 0.4]} />
          <meshStandardMaterial color="#232d2b" roughness={0.95} />
        </mesh>
        <TempleRoof position={[0, 7.55, -1.2]} />
        <TempleRoof position={[0, 9.1, -1.5]} scale={0.72} />
      </group>
      <mesh receiveShadow position={[0, -0.1, -34.5]}>
        <boxGeometry args={[14.5, 0.2, 16.4]} />
        <meshStandardMaterial color="#a6a393" roughness={0.96} />
      </mesh>
      <InkPool />
      <SlidingDoors progressRef={progressRef} />
      <ProjectWall />
      <pointLight color="#e4b777" distance={18} intensity={3.8} position={[0, 5.5, -34]} />
      <pointLight color="#c7d9c4" distance={10} intensity={2} position={[-5.4, 3, -38]} />
      <pointLight color="#c7d9c4" distance={10} intensity={2} position={[5.4, 3, -38]} />
    </group>
  )
}
