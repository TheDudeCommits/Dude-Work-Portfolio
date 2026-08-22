import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FreeRoamCamera } from '../v2/player/FreeRoamCamera'
import { freeRoamInput } from '../v2/runtime/input'
import { freeRoamStore } from '../v2/runtime/store'
import type { Vector3Tuple } from '../v2/runtime/types'
import {
  CINEMATIC_GARDEN_RAIL_LENGTH,
  createCinematicRailPose,
  findNearestCinematicRailProgress,
  sampleCinematicGardenRail,
} from './cinematicRail'
import { V3_GATE_BRIDGE_ANCHORS } from './composition'

interface CircularObstacle {
  radius: number
  x: number
  z: number
}

const BODY_RADIUS = 0.42
const CAMERA_ANCHOR_OFFSET = 0.58
const WORLD_LIMITS = { maxX: 17.5, maxZ: 30, minX: -17.5, minZ: -15.5 } as const

const OBSTACLES: readonly CircularObstacle[] = [
  { radius: 0.78, x: -2.57, z: 11.7 },
  { radius: 0.78, x: 2.56, z: 11.7 },
  { radius: 1.18, x: -8.65, z: -6.3 },
  { radius: 1.62, x: 6.65, z: -0.8 },
] as const

function bridgeHeight(x: number) {
  const normalized = THREE.MathUtils.clamp(Math.abs(x) / 7.1, 0, 1)
  return 0.18 + (1 - normalized ** 1.8) * 1.72
}

function bodyHeightAt(x: number, z: number) {
  const onBridge = Math.abs(z + 3.4) < 1.34 && Math.abs(x) < 7.18
  return onBridge ? bridgeHeight(x) + 1.08 : 1.05
}

function resolveGardenBounds(position: THREE.Vector3) {
  position.x = THREE.MathUtils.clamp(position.x, WORLD_LIMITS.minX, WORLD_LIMITS.maxX)
  position.z = THREE.MathUtils.clamp(position.z, WORLD_LIMITS.minZ, WORLD_LIMITS.maxZ)

  for (const obstacle of OBSTACLES) {
    const dx = position.x - obstacle.x
    const dz = position.z - obstacle.z
    const minimumDistance = obstacle.radius + BODY_RADIUS
    const distanceSquared = dx * dx + dz * dz
    if (distanceSquared >= minimumDistance * minimumDistance) continue
    const distance = Math.sqrt(Math.max(distanceSquared, 0.0001))
    position.x = obstacle.x + (dx / distance) * minimumDistance
    position.z = obstacle.z + (dz / distance) * minimumDistance
  }
}

export interface LeanFreeRoamPlayerProps {
  acceleration?: number
  active?: boolean
  braking?: number
  initialCameraPitch?: number
  initialCameraYaw?: number
  railProgressDamping?: number
  railReattachDistance?: number
  railReattachSpeed?: number
  railScrollSensitivity?: number
  railTravelSpeed?: number
  spawn?: Vector3Tuple
  sprintSpeed?: number
  walkSpeed?: number
}

/**
 * A disembodied, allocation-free garden controller. The opening slice does not
 * need a WASM physics world: authored rail motion and bounded first-person
 * walking are enough, while the visual asset keeps collision metadata for the
 * future full garden.
 */
export function LeanFreeRoamPlayer({
  acceleration = 16,
  active = true,
  braking = 22,
  initialCameraPitch = 0.08,
  initialCameraYaw = 0,
  railProgressDamping = 5.2,
  railReattachDistance = 0.28,
  railReattachSpeed = 7.2,
  railScrollSensitivity = 0.00046,
  railTravelSpeed = 5.2,
  spawn = V3_GATE_BRIDGE_ANCHORS.spawn as Vector3Tuple,
  sprintSpeed = 5.6,
  walkSpeed = 3.25,
}: LeanFreeRoamPlayerProps) {
  const body = useRef<THREE.Group>(null)
  const cameraAnchor = useRef<THREE.Group>(null)
  const position = useRef(new THREE.Vector3(...spawn))
  const velocity = useRef(new THREE.Vector2())
  const teleportVersion = useRef(freeRoamStore.getState().teleportVersion)
  const publishClock = useRef(0)
  const railPose = useMemo(createCinematicRailPose, [])
  const vectors = useMemo(() => ({
    desired: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    movement: new THREE.Vector3(),
    right: new THREE.Vector3(),
  }), [])

  useEffect(() => {
    const initialSpawn: Vector3Tuple = [spawn[0], spawn[1], spawn[2]]
    position.current.set(...initialSpawn)
    freeRoamStore.getState().setCheckpoint(initialSpawn)
    freeRoamStore.getState().requestTeleport(initialSpawn)
    freeRoamStore.getState().setCameraAngles(initialCameraYaw, initialCameraPitch)
    freeRoamStore.getState().setExploration({
      mode: 'rail',
      railProgress: 0,
      railTargetProgress: 0,
    })
  }, [initialCameraPitch, initialCameraYaw, spawn])

  useFrame((_, rawDelta) => {
    const group = body.current
    if (!group) return
    const startedAt = performance.now()
    const delta = THREE.MathUtils.clamp(rawDelta, 1 / 240, 1 / 20)
    const runtime = freeRoamStore.getState()
    const current = position.current

    if (teleportVersion.current !== runtime.teleportVersion) {
      teleportVersion.current = runtime.teleportVersion
      current.set(...runtime.teleportTarget)
      velocity.current.set(0, 0)
    }

    const input = active ? freeRoamInput.movement() : { moveX: 0, moveY: 0, sprint: false }
    const inputMagnitude = Math.hypot(input.moveX, input.moveY)
    const scrollDelta = active ? freeRoamInput.consumeScroll() : 0
    let explorationMode = runtime.exploration.mode
    let railProgress = runtime.exploration.railProgress
    let railTargetProgress = runtime.exploration.railTargetProgress

    if (inputMagnitude > 0.01 && explorationMode !== 'free') {
      railProgress = findNearestCinematicRailProgress(current, 96)
      railTargetProgress = railProgress
      explorationMode = 'free'
    } else if (Math.abs(scrollDelta) > 0.001) {
      if (explorationMode === 'free') {
        railProgress = findNearestCinematicRailProgress(current, 128)
        railTargetProgress = railProgress
        explorationMode = 'reattaching'
      }
      railTargetProgress = THREE.MathUtils.clamp(
        railTargetProgress + scrollDelta * railScrollSensitivity,
        0,
        1,
      )
    }

    let sprinting = false
    if (explorationMode !== 'free') {
      const dampedProgress = THREE.MathUtils.damp(
        railProgress,
        railTargetProgress,
        railProgressDamping,
        delta,
      )
      const maximumStep = railTravelSpeed * delta / CINEMATIC_GARDEN_RAIL_LENGTH
      railProgress += THREE.MathUtils.clamp(
        dampedProgress - railProgress,
        -maximumStep,
        maximumStep,
      )
      sampleCinematicGardenRail(railProgress, railPose)
      vectors.movement.copy(railPose.position).sub(current)
      const railDistance = vectors.movement.length()
      if (explorationMode === 'reattaching' && railDistance > 0.0001) {
        vectors.movement.clampLength(0, railReattachSpeed * delta)
      }
      current.add(vectors.movement)
      velocity.current.set(
        vectors.movement.x / Math.max(delta, 0.001),
        vectors.movement.z / Math.max(delta, 0.001),
      )
      if (explorationMode === 'reattaching' && railDistance <= railReattachDistance) {
        explorationMode = 'rail'
      }
      freeRoamInput.consumeJump()
    } else {
      const yaw = runtime.cameraYaw
      vectors.forward.set(Math.sin(yaw), 0, -Math.cos(yaw))
      vectors.right.set(Math.cos(yaw), 0, Math.sin(yaw))
      vectors.desired
        .copy(vectors.forward)
        .multiplyScalar(input.moveY)
        .addScaledVector(vectors.right, input.moveX)
      if (vectors.desired.lengthSq() > 1) vectors.desired.normalize()
      sprinting = input.sprint && inputMagnitude > 0.1
      vectors.desired.multiplyScalar(sprinting ? sprintSpeed : walkSpeed)
      const damping = inputMagnitude > 0.01 ? acceleration : braking
      velocity.current.x = THREE.MathUtils.damp(
        velocity.current.x,
        vectors.desired.x,
        damping,
        delta,
      )
      velocity.current.y = THREE.MathUtils.damp(
        velocity.current.y,
        vectors.desired.z,
        damping,
        delta,
      )
      current.x += velocity.current.x * delta
      current.z += velocity.current.y * delta
      resolveGardenBounds(current)
      current.y = THREE.MathUtils.damp(current.y, bodyHeightAt(current.x, current.z), 14, delta)
      freeRoamInput.consumeJump()
    }

    runtime.setExploration({
      mode: explorationMode,
      railProgress,
      railTargetProgress,
    })
    group.position.copy(current)
    const speed = velocity.current.length()
    publishClock.current += delta
    if (publishClock.current >= 1 / 15) {
      publishClock.current = 0
      runtime.setMotion({
        grounded: true,
        moving: speed > 0.08,
        position: [current.x, current.y, current.z],
        speed,
        sprinting,
        verticalSpeed: 0,
      })
      runtime.setDiagnostics({ collisionCount: 0, physicsStepMs: performance.now() - startedAt })
    }
  }, -32)

  return (
    <group name="v3-disembodied-player" position={spawn} ref={body}>
      <group position={[0, CAMERA_ANCHOR_OFFSET, 0]} ref={cameraAnchor} />
      <FreeRoamCamera
        active={active}
        anchorRef={cameraAnchor}
        far={125}
        initialPitch={initialCameraPitch}
        initialYaw={initialCameraYaw}
        near={0.055}
      />
    </group>
  )
}
