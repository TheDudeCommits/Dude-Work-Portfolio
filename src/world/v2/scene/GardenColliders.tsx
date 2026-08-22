import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
} from '@react-three/rapier'
import type { Vec3Tuple } from '../interactions'
import { shrinePlacements } from './ProjectShrines'

interface CuboidDescriptor {
  halfExtents: Vec3Tuple
  id: string
  position: Vec3Tuple
  rotation?: Vec3Tuple
  sensor?: boolean
  type: 'cuboid'
}

interface CylinderDescriptor {
  halfHeight: number
  id: string
  position: Vec3Tuple
  radius: number
  sensor?: boolean
  type: 'cylinder'
}

export type GardenColliderDescriptor = CuboidDescriptor | CylinderDescriptor

const bridgeColliders: GardenColliderDescriptor[] = Array.from({ length: 9 }, (_, index) => {
  const x = -6.3 + index * 1.575
  const normalized = Math.abs(x) / 7.1
  const y = 0.18 + (1 - Math.pow(normalized, 1.8)) * 1.72
  const slope = -Math.sign(x) * Math.max(0.08, normalized * 0.39)
  return {
    halfExtents: [0.84, 0.16, 1.18],
    id: `bridge-deck:${index}`,
    position: [x, y - 0.03, -3.4],
    rotation: [0, 0, slope],
    type: 'cuboid',
  }
})

export const LIVING_SCROLL_COLLIDERS: readonly GardenColliderDescriptor[] = [
  { halfExtents: [30, 0.5, 30], id: 'garden-ground', position: [0, -0.75, 0], type: 'cuboid' },
  { halfHeight: 2.7, id: 'torii-left-post', position: [-2.57, 2.7, 11.7], radius: 0.46, type: 'cylinder' },
  { halfHeight: 2.7, id: 'torii-right-post', position: [2.56, 2.7, 11.7], radius: 0.46, type: 'cylinder' },
  { halfHeight: 3.35, id: 'pine-trunk', position: [-9.1, 3.25, -9.75], radius: 0.62, type: 'cylinder' },
  ...bridgeColliders,
  ...shrinePlacements.map((placement, index): GardenColliderDescriptor => ({
    halfHeight: 0.22,
    id: `project-shrine-base:${index}`,
    position: [placement.position[0], placement.position[1], placement.position[2]],
    radius: 2.08 * (placement.scale ?? 1),
    type: 'cylinder',
  })),
  { halfExtents: [10.45, 0.32, 10.62], id: 'pond-shallow-water', position: [0, -0.18, -3.4], sensor: true, type: 'cuboid' },
] as const

export function LivingScrollColliders({ includeSensors = true }: { includeSensors?: boolean }) {
  return (
    <RigidBody colliders={false} type="fixed">
      {LIVING_SCROLL_COLLIDERS.map((collider) => {
        if (collider.sensor && !includeSensors) return null
        if (collider.type === 'cuboid') {
          return (
            <CuboidCollider
              args={[...collider.halfExtents]}
              key={collider.id}
              name={collider.id}
              position={[...collider.position]}
              rotation={collider.rotation ? [...collider.rotation] : undefined}
              sensor={collider.sensor}
            />
          )
        }
        return (
          <CylinderCollider
            args={[collider.halfHeight, collider.radius]}
            key={collider.id}
            name={collider.id}
            position={[...collider.position]}
            sensor={collider.sensor}
          />
        )
      })}
    </RigidBody>
  )
}
