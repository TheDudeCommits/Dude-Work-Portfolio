import { useCursor, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { projects, type Project } from '../projects'
import { InkPortalMaterial } from './materials'
import type { ProgressRef } from './types'

function ProjectPortal({
  compact,
  index,
  position,
  progressRef,
  project,
}: {
  compact: boolean
  index: number
  position: [number, number, number]
  progressRef: ProgressRef
  project: Project
}) {
  const texture = useTexture(project.image)
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const revealStart = 0.845 + index * 0.011
    const reveal = THREE.MathUtils.smoothstep(progressRef.current, revealStart, revealStart + 0.075)
    const targetScale = reveal * (hovered ? 1.13 : 1)
    group.current.scale.setScalar(THREE.MathUtils.damp(group.current.scale.x, targetScale, 6.4, delta))
    group.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.52 + index * 1.37) * 0.055
    group.current.position.z = position[2] + (hovered ? 0.65 : 0)
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.28 + index * 0.83) * 0.018
  })

  return (
    <group position={position} ref={group} scale={0.001}>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          window.open(project.href, '_blank', 'noopener,noreferrer')
        }}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        renderOrder={5}
      >
        <planeGeometry args={compact ? [1.12, 0.94, 1, 1] : [1.65, 1.34, 1, 1]} />
        <InkPortalMaterial hovered={hovered} index={index} progressRef={progressRef} texture={texture} />
      </mesh>
    </group>
  )
}

export function Sanctuary({ progressRef }: { progressRef: ProgressRef }) {
  const compact = useThree((state) => state.size.width < 640)
  const positions = useMemo(() => {
    if (compact) {
      return projects.map((_, index) => [
        index === projects.length - 1 ? 0 : (index % 2 === 0 ? -0.72 : 0.72),
        3.05 - index * 0.77,
        2 + index * 0.006,
      ] as [number, number, number])
    }

    return [
      [-5.25, 1.72, 2.0],
      [-3.9, 2.82, 2.02],
      [-2.12, 3.5, 2.04],
      [0.0, 3.7, 2.06],
      [2.18, 3.43, 2.08],
      [4.03, 2.72, 2.1],
      [5.3, 1.5, 2.12],
      [-2.38, 0.28, 2.14],
      [2.5, 0.34, 2.16],
    ] as [number, number, number][]
  }, [compact])

  return (
    <group>
      {projects.map((project, index) => (
        <ProjectPortal
          compact={compact}
          index={index}
          key={project.slug}
          position={positions[index]}
          progressRef={progressRef}
          project={project}
        />
      ))}
    </group>
  )
}
