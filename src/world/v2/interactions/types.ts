import type { MutableRefObject } from 'react'
import type * as THREE from 'three'

export type Vec3Tuple = readonly [number, number, number]

export type GardenInteractionKind =
  | 'project-shrine'
  | 'garden-bell'
  | 'water'
  | 'lantern'
  | 'discovery'

export interface GardenInteractionDescriptor {
  focusRadius: number
  id: string
  kind: GardenInteractionKind
  metadata?: Readonly<Record<string, string>>
  position: Vec3Tuple
}

export interface GardenInteractionEvent {
  descriptor: GardenInteractionDescriptor
  source: 'pointer' | 'proximity-input'
}

export type WorldPositionRef = MutableRefObject<THREE.Vector3>

