import {
  CuboidCollider,
  RigidBody,
  TrimeshCollider,
} from '@react-three/rapier'
import type { ReactNode } from 'react'
import type { Vector3Tuple } from '../runtime/types'

export interface StaticBoxColliderProps {
  children?: ReactNode
  friction?: number
  name?: string
  position?: Vector3Tuple
  rotation?: Vector3Tuple
  size: Vector3Tuple
}

export function StaticBoxCollider({
  children,
  friction = 0.82,
  name,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size,
}: StaticBoxColliderProps) {
  return (
    <RigidBody
      colliders={false}
      name={name}
      position={position}
      rotation={rotation}
      type="fixed"
    >
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        friction={friction}
        name={name ? `${name}-collider` : undefined}
      />
      {children}
    </RigidBody>
  )
}

export interface StaticGroundColliderProps {
  friction?: number
  name?: string
  position?: Vector3Tuple
  size?: readonly [width: number, depth: number]
  thickness?: number
}

export function StaticGroundCollider({
  friction = 0.9,
  name = 'free-roam-ground',
  position = [0, 0, 0],
  size = [120, 120],
  thickness = 0.4,
}: StaticGroundColliderProps) {
  return (
    <StaticBoxCollider
      friction={friction}
      name={name}
      position={[position[0], position[1] - thickness / 2, position[2]]}
      size={[size[0], thickness, size[1]]}
    />
  )
}

export interface StaticTrimeshColliderProps {
  children?: ReactNode
  friction?: number
  indices: ArrayLike<number>
  name?: string
  position?: Vector3Tuple
  rotation?: Vector3Tuple
  vertices: ArrayLike<number>
}

export function StaticTrimeshCollider({
  children,
  friction = 0.82,
  indices,
  name,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  vertices,
}: StaticTrimeshColliderProps) {
  return (
    <RigidBody
      colliders={false}
      name={name}
      position={position}
      rotation={rotation}
      type="fixed"
    >
      <TrimeshCollider args={[vertices, indices]} friction={friction} name={name} />
      {children}
    </RigidBody>
  )
}

