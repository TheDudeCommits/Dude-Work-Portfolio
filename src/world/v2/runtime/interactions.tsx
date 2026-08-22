import { useFrame } from '@react-three/fiber'
import { ActiveCollisionTypes } from '@dimforge/rapier3d-compat'
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  type IntersectionEnterPayload,
  type IntersectionExitPayload,
} from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { freeRoamInput } from './input'
import { freeRoamStore } from './store'
import type { Vector3Tuple } from './types'

export const FREE_ROAM_PLAYER_TAG = 'living-scroll-player'

interface OccupiedZone {
  enteredAt: number
  id: string
  priority: number
}

interface InteractionRecord {
  activated: boolean
  enabled: boolean
  id: string
  once: boolean
  onInteract: () => void | Promise<void>
  position: Vector3Tuple
  priority: number
}

const occupiedZones = new Map<string, OccupiedZone>()
const interactionRecords = new Map<string, InteractionRecord>()
const nearbyInteractions = new Set<string>()
let enterSequence = 0

const isPlayerPayload = (payload: IntersectionEnterPayload | IntersectionExitPayload) => {
  const userData = payload.other.rigidBody?.userData
  return typeof userData === 'object'
    && userData !== null
    && 'freeRoamRole' in userData
    && userData.freeRoamRole === FREE_ROAM_PLAYER_TAG
}

const refreshActiveZone = () => {
  const active = [...occupiedZones.values()].sort((left, right) => (
    right.priority - left.priority || right.enteredAt - left.enteredAt
  ))[0]
  freeRoamStore.getState().setActiveZone(active ? { id: active.id, priority: active.priority } : null)
}

const refreshNearbyInteraction = () => {
  const position = freeRoamStore.getState().motion.position
  const nearest = [...nearbyInteractions]
    .map((id) => interactionRecords.get(id))
    .filter((record): record is InteractionRecord => Boolean(
      record && record.enabled && (!record.once || !record.activated),
    ))
    .sort((left, right) => {
      const priority = right.priority - left.priority
      if (priority !== 0) return priority
      const leftDistance = (
        (left.position[0] - position[0]) ** 2
          + (left.position[1] - position[1]) ** 2
          + (left.position[2] - position[2]) ** 2
      )
      const rightDistance = (
        (right.position[0] - position[0]) ** 2
          + (right.position[1] - position[1]) ** 2
          + (right.position[2] - position[2]) ** 2
      )
      return leftDistance - rightDistance
    })[0]

  freeRoamStore.getState().setInteraction({
    available: Boolean(nearest),
    nearbyId: nearest?.id ?? null,
  })
}

const invokeNearbyInteraction = () => {
  refreshNearbyInteraction()
  const id = freeRoamStore.getState().interaction.nearbyId
  if (!id) return
  const record = interactionRecords.get(id)
  if (!record || !record.enabled || (record.once && record.activated)) return
  record.activated = true
  freeRoamStore.getState().setInteraction({ lastActivatedId: id })
  if (record.once) {
    nearbyInteractions.delete(id)
    refreshNearbyInteraction()
  }
  try {
    const result = record.onInteract()
    if (result instanceof Promise) result.catch((error) => console.error(`Interaction "${id}" failed`, error))
  } catch (error) {
    console.error(`Interaction "${id}" failed`, error)
  }
}

export interface SpatialZoneProps {
  children?: ReactNode
  checkpoint?: Vector3Tuple
  enabled?: boolean
  id: string
  onEnter?: () => void
  onExit?: () => void
  position: Vector3Tuple
  priority?: number
  size: Vector3Tuple
}

export function SpatialZone({
  children,
  checkpoint,
  enabled = true,
  id,
  onEnter,
  onExit,
  position,
  priority = 0,
  size,
}: SpatialZoneProps) {
  const inside = useRef(false)
  const halfExtents = useMemo(() => (
    [size[0] / 2, size[1] / 2, size[2] / 2] as [number, number, number]
  ), [size])

  useEffect(() => () => {
    occupiedZones.delete(id)
    refreshActiveZone()
  }, [id])

  useEffect(() => {
    if (enabled || !inside.current) return
    inside.current = false
    occupiedZones.delete(id)
    refreshActiveZone()
    onExit?.()
  }, [enabled, id, onExit])

  if (!enabled) return <group position={position}>{children}</group>

  return (
    <RigidBody colliders={false} position={position} type="fixed">
      <CuboidCollider
        activeCollisionTypes={ActiveCollisionTypes.KINEMATIC_FIXED}
        args={halfExtents}
        onIntersectionEnter={(payload) => {
          if (!isPlayerPayload(payload) || inside.current) return
          inside.current = true
          occupiedZones.set(id, { enteredAt: enterSequence += 1, id, priority })
          refreshActiveZone()
          if (checkpoint) freeRoamStore.getState().setCheckpoint(checkpoint)
          onEnter?.()
        }}
        onIntersectionExit={(payload) => {
          if (!isPlayerPayload(payload) || !inside.current) return
          inside.current = false
          occupiedZones.delete(id)
          refreshActiveZone()
          onExit?.()
        }}
        sensor
      />
      {children}
    </RigidBody>
  )
}

export interface InteractionTargetProps {
  children?: ReactNode
  enabled?: boolean
  id: string
  onInteract: () => void | Promise<void>
  once?: boolean
  position: Vector3Tuple
  priority?: number
  radius?: number
  size?: Vector3Tuple
}

export function InteractionTarget({
  children,
  enabled = true,
  id,
  onInteract,
  once = false,
  position,
  priority = 0,
  radius,
  size = [3, 2.4, 3],
}: InteractionTargetProps) {
  const inside = useRef(false)
  const halfExtents = useMemo(() => (
    [size[0] / 2, size[1] / 2, size[2] / 2] as [number, number, number]
  ), [size])

  useEffect(() => {
    const existing = interactionRecords.get(id)
    interactionRecords.set(id, {
      activated: existing?.activated ?? false,
      enabled,
      id,
      once,
      onInteract,
      position,
      priority,
    })
    refreshNearbyInteraction()
    return () => {
      interactionRecords.delete(id)
      nearbyInteractions.delete(id)
      refreshNearbyInteraction()
    }
  }, [enabled, id, onInteract, once, position, priority])

  useEffect(() => {
    if (enabled || !inside.current) return
    inside.current = false
    nearbyInteractions.delete(id)
    refreshNearbyInteraction()
  }, [enabled, id])

  if (!enabled) return <group position={position}>{children}</group>

  const enter = (payload: IntersectionEnterPayload) => {
    if (!isPlayerPayload(payload) || inside.current) return
    inside.current = true
    nearbyInteractions.add(id)
    refreshNearbyInteraction()
  }

  const exit = (payload: IntersectionExitPayload) => {
    if (!isPlayerPayload(payload) || !inside.current) return
    inside.current = false
    nearbyInteractions.delete(id)
    refreshNearbyInteraction()
  }

  return (
    <RigidBody colliders={false} position={position} type="fixed">
      {radius === undefined ? (
        <CuboidCollider
          activeCollisionTypes={ActiveCollisionTypes.KINEMATIC_FIXED}
          args={halfExtents}
          onIntersectionEnter={enter}
          onIntersectionExit={exit}
          sensor
        />
      ) : (
        <BallCollider
          activeCollisionTypes={ActiveCollisionTypes.KINEMATIC_FIXED}
          args={[radius]}
          onIntersectionEnter={enter}
          onIntersectionExit={exit}
          sensor
        />
      )}
      {children}
    </RigidBody>
  )
}

export interface FreeRoamInteractionSystemProps {
  active?: boolean
}

export function FreeRoamInteractionSystem({ active = true }: FreeRoamInteractionSystemProps) {
  useFrame(() => {
    if (!freeRoamInput.consumeInteract()) return
    if (active) invokeNearbyInteraction()
  })
  return null
}
