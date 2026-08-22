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
import {
  CINEMATIC_GARDEN_RAIL_LENGTH,
  createCinematicRailPose,
  findNearestCinematicRailProgress,
  sampleCinematicGardenRail,
} from '../runtime/cinematicRail'
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
  /** @deprecated The camera is now first-person and has no orbit distance. */
  cameraDistance?: number
  cameraTargetHeight?: number
  capsuleHalfHeight?: number
  capsuleRadius?: number
  /** @deprecated Rendered avatars are intentionally suppressed. */
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
  railProgressDamping?: number
  railReattachDistance?: number
  railReattachSpeed?: number
  railScrollSensitivity?: number
  railTravelSpeed?: number
  snapToGround?: number
  spawn?: Vector3Tuple
  sprintSpeed?: number
  /** @deprecated There is no visible player mesh to turn. */
  visualTurnSpeed?: number
  walkSpeed?: number
}

export const FreeRoamPlayer = forwardRef<FreeRoamPlayerApi, FreeRoamPlayerProps>(function FreeRoamPlayer({
  acceleration = 18,
  active = true,
  autostepHeight = 0.38,
  autostepMinWidth = 0.2,
  braking = 24,
  cameraTargetHeight = 1.35,
  capsuleHalfHeight = 0.52,
  capsuleRadius = 0.42,
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
  railProgressDamping = 5.8,
  railReattachDistance = 0.32,
  railReattachSpeed = 7.4,
  railScrollSensitivity = 0.00042,
  railTravelSpeed = 6.2,
  snapToGround = 0.28,
  spawn = [0, 1.05, 18.6],
  sprintSpeed = 6.2,
  walkSpeed = 3.65,
}: FreeRoamPlayerProps, forwardedRef) {
  const { rapier, world } = useRapier()
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const cameraAnchor = useRef<THREE.Group>(null)
  const controller = useRef<ReturnType<typeof world.createCharacterController> | null>(null)
  const horizontalVelocity = useRef(new THREE.Vector2())
  const verticalVelocity = useRef(0)
  const grounded = useRef(false)
  const teleportVersion = useRef(freeRoamStore.getState().teleportVersion)
  const publishClock = useRef(0)
  const recoveryCount = useRef(0)
  const onReadyRef = useRef(onReady)
  const api = useMemo<FreeRoamPlayerApi>(() => ({
    getRigidBody: () => body.current,
    resetToCheckpoint: () => {
      const state = freeRoamStore.getState()
      state.setExploration({ mode: 'free' })
      state.resetToCheckpoint()
    },
    teleport: (target) => {
      const state = freeRoamStore.getState()
      state.setExploration({ mode: 'free' })
      state.requestTeleport(target)
    },
  }), [])
  const railPose = useMemo(createCinematicRailPose, [])
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
    freeRoamStore.getState().setExploration({
      mode: 'rail',
      railProgress: 0,
      railTargetProgress: 0,
    })
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
      runtime.setExploration({ mode: 'free' })
      onRecover?.()
      return
    }

    const input = active ? freeRoamInput.movement() : { moveX: 0, moveY: 0, sprint: false }
    const inputMagnitude = Math.hypot(input.moveX, input.moveY)
    const scrollDelta = active ? freeRoamInput.consumeScroll() : 0
    let explorationMode = runtime.exploration.mode
    let railProgress = runtime.exploration.railProgress
    let railTargetProgress = runtime.exploration.railTargetProgress

    if (inputMagnitude > 0.01) {
      if (explorationMode !== 'free') {
        railProgress = findNearestCinematicRailProgress(current, 96)
        railTargetProgress = railProgress
        explorationMode = 'free'
        runtime.setExploration({
          mode: explorationMode,
          railProgress,
          railTargetProgress,
        })
      }
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
      runtime.setExploration({
        mode: explorationMode,
        railProgress,
        railTargetProgress,
      })
    }

    if (explorationMode !== 'free') {
      const dampedRailProgress = THREE.MathUtils.damp(
        railProgress,
        railTargetProgress,
        railProgressDamping,
        dt,
      )
      const maximumProgressStep = railTravelSpeed * dt / CINEMATIC_GARDEN_RAIL_LENGTH
      railProgress += THREE.MathUtils.clamp(
        dampedRailProgress - railProgress,
        -maximumProgressStep,
        maximumProgressStep,
      )
      sampleCinematicGardenRail(railProgress, railPose)
      vectors.movement.set(
        railPose.position.x - current.x,
        railPose.position.y - current.y,
        railPose.position.z - current.z,
      )
      const railDistance = vectors.movement.length()
      if (explorationMode === 'reattaching' && railDistance > 0.0001) {
        vectors.movement.clampLength(0, railReattachSpeed * dt)
      }
      if (
        explorationMode === 'reattaching'
        && railDistance <= railReattachDistance
      ) {
        explorationMode = 'rail'
      }
      runtime.setExploration({
        mode: explorationMode,
        railProgress,
        railTargetProgress,
      })
      freeRoamInput.consumeJump()
      const next = {
        x: current.x + vectors.movement.x,
        y: current.y + vectors.movement.y,
        z: current.z + vectors.movement.z,
      }
      rigidBody.setNextKinematicTranslation(next)
      horizontalVelocity.current.set(
        vectors.movement.x / Math.max(dt, 0.001),
        vectors.movement.z / Math.max(dt, 0.001),
      )
      verticalVelocity.current = vectors.movement.y / Math.max(dt, 0.001)
      grounded.current = true

      const speed = horizontalVelocity.current.length()
      publishClock.current += dt
      if (publishClock.current >= 1 / 15) {
        publishClock.current = 0
        runtime.setMotion({
          grounded: true,
          moving: speed > 0.1,
          position: [next.x, next.y, next.z],
          speed,
          sprinting: false,
          verticalSpeed: verticalVelocity.current,
        })
        runtime.setDiagnostics({
          collisionCount: 0,
          physicsStepMs: performance.now() - startedAt,
        })
      }
      return
    }

    const yaw = runtime.cameraYaw
    vectors.forward.set(Math.sin(yaw), 0, -Math.cos(yaw))
    vectors.right.set(Math.cos(yaw), 0, Math.sin(yaw))
    vectors.desired
      .copy(vectors.forward)
      .multiplyScalar(input.moveY)
      .addScaledVector(vectors.right, input.moveX)
    if (vectors.desired.lengthSq() > 1) vectors.desired.normalize()
    const sprinting = input.sprint && inputMagnitude > 0.1
    vectors.desired.multiplyScalar(sprinting ? sprintSpeed : walkSpeed)

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
    const jumpRequested = active && explorationMode === 'free' && jumpQueued
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
        initialPitch={initialCameraPitch}
        initialYaw={initialCameraYaw}
      />
    </>
  )
})
