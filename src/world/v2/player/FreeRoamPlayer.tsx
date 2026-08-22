import { useFrame } from '@react-three/fiber'
import { ActiveCollisionTypes } from '@dimforge/rapier3d-compat'
import {
  CapsuleCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../../../art'
import { freeRoamInput } from '../runtime/input'
import { FREE_ROAM_PLAYER_TAG } from '../runtime/interactions'
import { freeRoamStore } from '../runtime/store'
import type { Vector3Tuple } from '../runtime/types'
import { FreeRoamCamera } from './FreeRoamCamera'

export interface FreeRoamPlayerApi {
  getRigidBody: () => RapierRigidBody | null
  resetToCheckpoint: () => void
  teleport: (target: Vector3Tuple) => void
}

export interface FreeRoamPlayerProps {
  acceleration?: number
  active?: boolean
  autostepHeight?: number
  autostepMinWidth?: number
  braking?: number
  cameraDistance?: number
  cameraTargetHeight?: number
  capsuleHalfHeight?: number
  capsuleRadius?: number
  children?: ReactNode
  debugVisual?: boolean
  gravity?: number
  initialCameraPitch?: number
  initialCameraYaw?: number
  jumpSpeed?: number
  killY?: number
  maxSlopeAngle?: number
  minSlideAngle?: number
  onReady?: (api: FreeRoamPlayerApi) => void
  onRecover?: () => void
  snapToGround?: number
  spawn?: Vector3Tuple
  sprintSpeed?: number
  visualTurnSpeed?: number
  walkSpeed?: number
}

const dampAngle = (current: number, target: number, damping: number, delta: number) => {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + difference * (1 - Math.exp(-damping * delta))
}

export const FreeRoamPlayer = forwardRef<FreeRoamPlayerApi, FreeRoamPlayerProps>(function FreeRoamPlayer({
  acceleration = 18,
  active = true,
  autostepHeight = 0.38,
  autostepMinWidth = 0.2,
  braking = 24,
  cameraDistance = 5.8,
  cameraTargetHeight = 1.35,
  capsuleHalfHeight = 0.52,
  capsuleRadius = 0.42,
  children,
  debugVisual = false,
  gravity = 22,
  initialCameraPitch = 0.28,
  initialCameraYaw = 0,
  jumpSpeed = 7.2,
  killY = -18,
  maxSlopeAngle = THREE.MathUtils.degToRad(48),
  minSlideAngle = THREE.MathUtils.degToRad(52),
  onReady,
  onRecover,
  snapToGround = 0.28,
  spawn = [0, 1.05, 18.6],
  sprintSpeed = 6.2,
  visualTurnSpeed = 14,
  walkSpeed = 3.65,
}: FreeRoamPlayerProps, forwardedRef) {
  const { rapier, world } = useRapier()
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const cameraAnchor = useRef<THREE.Group>(null)
  const visual = useRef<THREE.Group>(null)
  const controller = useRef<ReturnType<typeof world.createCharacterController> | null>(null)
  const horizontalVelocity = useRef(new THREE.Vector2())
  const verticalVelocity = useRef(0)
  const grounded = useRef(false)
  const facing = useRef(initialCameraYaw + Math.PI)
  const teleportVersion = useRef(freeRoamStore.getState().teleportVersion)
  const publishClock = useRef(0)
  const recoveryCount = useRef(0)
  const onReadyRef = useRef(onReady)
  const api = useMemo<FreeRoamPlayerApi>(() => ({
    getRigidBody: () => body.current,
    resetToCheckpoint: () => freeRoamStore.getState().resetToCheckpoint(),
    teleport: (target) => freeRoamStore.getState().requestTeleport(target),
  }), [])
  const vectors = useMemo(() => ({
    desired: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    movement: new THREE.Vector3(),
    right: new THREE.Vector3(),
  }), [])
  const capsuleCenterHeight = capsuleHalfHeight + capsuleRadius
  const spawnX = spawn[0]
  const spawnY = spawn[1]
  const spawnZ = spawn[2]

  useImperativeHandle(forwardedRef, () => api, [api])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const characterController = world.createCharacterController(0.035)
    characterController.enableAutostep(autostepHeight, autostepMinWidth, false)
    characterController.enableSnapToGround(snapToGround)
    characterController.setApplyImpulsesToDynamicBodies(true)
    characterController.setCharacterMass(68)
    characterController.setMaxSlopeClimbAngle(maxSlopeAngle)
    characterController.setMinSlopeSlideAngle(minSlideAngle)
    characterController.setSlideEnabled(true)
    controller.current = characterController
    onReadyRef.current?.(api)
    return () => {
      controller.current = null
      world.removeCharacterController(characterController)
    }
  }, [api, autostepHeight, autostepMinWidth, maxSlopeAngle, minSlideAngle, snapToGround, world])

  useEffect(() => {
    const initialSpawn: Vector3Tuple = [spawnX, spawnY, spawnZ]
    freeRoamStore.getState().setCheckpoint(initialSpawn)
    freeRoamStore.getState().requestTeleport(initialSpawn)
    freeRoamStore.getState().setCameraAngles(initialCameraYaw, initialCameraPitch)
  }, [initialCameraPitch, initialCameraYaw, spawnX, spawnY, spawnZ])

  useBeforePhysicsStep((physicsWorld) => {
    const rigidBody = body.current
    const playerCollider = collider.current
    const characterController = controller.current
    if (!rigidBody || !playerCollider || !characterController) return
    const startedAt = performance.now()
    const dt = THREE.MathUtils.clamp(physicsWorld.timestep || 1 / 60, 1 / 240, 1 / 20)
    const runtime = freeRoamStore.getState()

    if (teleportVersion.current !== runtime.teleportVersion) {
      teleportVersion.current = runtime.teleportVersion
      const target = runtime.teleportTarget
      rigidBody.setTranslation({ x: target[0], y: target[1], z: target[2] }, true)
      rigidBody.setNextKinematicTranslation({ x: target[0], y: target[1], z: target[2] })
      horizontalVelocity.current.set(0, 0)
      verticalVelocity.current = 0
      grounded.current = false
      return
    }

    const current = rigidBody.translation()
    if (current.y < killY) {
      const checkpoint = runtime.checkpoint
      rigidBody.setTranslation({ x: checkpoint[0], y: checkpoint[1], z: checkpoint[2] }, true)
      rigidBody.setNextKinematicTranslation({ x: checkpoint[0], y: checkpoint[1], z: checkpoint[2] })
      horizontalVelocity.current.set(0, 0)
      verticalVelocity.current = 0
      grounded.current = false
      recoveryCount.current += 1
      runtime.setDiagnostics({ recoveries: recoveryCount.current })
      onRecover?.()
      return
    }

    const input = active ? freeRoamInput.movement() : { moveX: 0, moveY: 0, sprint: false }
    const inputMagnitude = Math.hypot(input.moveX, input.moveY)
    const yaw = runtime.cameraYaw
    vectors.forward.set(Math.sin(yaw), 0, -Math.cos(yaw))
    vectors.right.set(Math.cos(yaw), 0, Math.sin(yaw))
    vectors.desired
      .copy(vectors.forward)
      .multiplyScalar(input.moveY)
      .addScaledVector(vectors.right, input.moveX)
    if (vectors.desired.lengthSq() > 1) vectors.desired.normalize()
    const sprinting = input.sprint && inputMagnitude > 0.1
    const targetSpeed = sprinting ? sprintSpeed : walkSpeed
    vectors.desired.multiplyScalar(targetSpeed)
    const damping = inputMagnitude > 0.01 ? acceleration : braking
    horizontalVelocity.current.x = THREE.MathUtils.damp(
      horizontalVelocity.current.x,
      vectors.desired.x,
      damping,
      dt,
    )
    horizontalVelocity.current.y = THREE.MathUtils.damp(
      horizontalVelocity.current.y,
      vectors.desired.z,
      damping,
      dt,
    )

    const jumpQueued = freeRoamInput.consumeJump()
    const jumpRequested = active && jumpQueued
    if (jumpRequested && grounded.current) {
      verticalVelocity.current = jumpSpeed
      grounded.current = false
    } else if (!grounded.current) {
      verticalVelocity.current -= gravity * dt
    } else if (verticalVelocity.current <= 0) {
      verticalVelocity.current = -1.4
    }

    vectors.movement.set(
      horizontalVelocity.current.x * dt,
      verticalVelocity.current * dt,
      horizontalVelocity.current.y * dt,
    )
    characterController.computeColliderMovement(
      playerCollider,
      vectors.movement,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      (candidate) => candidate.handle !== playerCollider.handle
        && candidate.parent()?.handle !== rigidBody.handle,
    )
    const computed = characterController.computedMovement()
    const next = { x: current.x + computed.x, y: current.y + computed.y, z: current.z + computed.z }
    rigidBody.setNextKinematicTranslation(next)
    grounded.current = characterController.computedGrounded()
    if (grounded.current && verticalVelocity.current < 0) verticalVelocity.current = 0
    for (let index = 0; index < characterController.numComputedCollisions(); index += 1) {
      const collision = characterController.computedCollision(index)
      if (collision && collision.normal1.y < -0.55 && verticalVelocity.current > 0) {
        verticalVelocity.current = 0
      }
    }

    const speed = horizontalVelocity.current.length()
    if (speed > 0.12) facing.current = Math.atan2(horizontalVelocity.current.x, horizontalVelocity.current.y)
    publishClock.current += dt
    if (publishClock.current >= 1 / 15) {
      publishClock.current = 0
      runtime.setMotion({
        grounded: grounded.current,
        moving: speed > 0.1,
        position: [next.x, next.y, next.z],
        speed,
        sprinting,
        verticalSpeed: verticalVelocity.current,
      })
      runtime.setDiagnostics({
        collisionCount: characterController.numComputedCollisions(),
        physicsStepMs: performance.now() - startedAt,
      })
    }
  })

  useFrame((_, rawDelta) => {
    if (!visual.current) return
    visual.current.rotation.y = dampAngle(
      visual.current.rotation.y,
      facing.current,
      visualTurnSpeed,
      Math.min(rawDelta, 0.1),
    )
  })

  return (
    <>
      <RigidBody
        activeCollisionTypes={ActiveCollisionTypes.ALL}
        canSleep={false}
        ccd
        colliders={false}
        lockRotations
        name="free-roam-player"
        position={spawn}
        ref={body}
        type="kinematicPosition"
        userData={{ freeRoamRole: FREE_ROAM_PLAYER_TAG }}
      >
        <CapsuleCollider
          activeCollisionTypes={ActiveCollisionTypes.ALL}
          args={[capsuleHalfHeight, capsuleRadius]}
          friction={0}
          ref={collider}
        />
        <group position={[0, cameraTargetHeight - capsuleCenterHeight, 0]} ref={cameraAnchor} />
        <group position={[0, -capsuleCenterHeight, 0]} ref={visual}>
          {children}
        </group>
        {debugVisual && (
          <mesh visible>
            <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2, 8, 16]} />
            <meshBasicMaterial color={ART_PALETTE.vermilion} wireframe />
          </mesh>
        )}
      </RigidBody>
      <FreeRoamCamera
        active={active}
        anchorRef={cameraAnchor}
        bodyRef={body}
        colliderRef={collider}
        distance={cameraDistance}
        initialPitch={initialCameraPitch}
        initialYaw={initialCameraYaw}
      />
    </>
  )
})
