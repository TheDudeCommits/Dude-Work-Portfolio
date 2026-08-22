import { PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  createCinematicRailPose,
  sampleCinematicGardenRail,
} from '../../v3/cinematicRail'
import { freeRoamInput } from '../runtime/input'
import { freeRoamStore } from '../runtime/store'

export interface FreeRoamCameraProps {
  active?: boolean
  anchorRef: RefObject<THREE.Group | null>
  far?: number
  fov?: number
  initialPitch?: number
  initialYaw?: number
  lookSensitivity?: number
  maxPitch?: number
  minPitch?: number
  near?: number
  orientationDamping?: number
  positionDamping?: number
}

const wrapAngle = (angle: number) => THREE.MathUtils.euclideanModulo(
  angle + Math.PI,
  Math.PI * 2,
) - Math.PI

/**
 * A disembodied first-person camera. In rail mode the invisible physics
 * capsule follows the authored route while this rig composes each shot. Direct
 * movement transfers to the same camera without changing perspective.
 */
export function FreeRoamCamera({
  active = true,
  anchorRef,
  far = 180,
  fov = 46,
  initialPitch = 0.08,
  initialYaw = 0,
  lookSensitivity = 0.00215,
  maxPitch = 1.18,
  minPitch = -1.08,
  near = 0.045,
  orientationDamping = 12,
  positionDamping = 18,
}: FreeRoamCameraProps) {
  const camera = useRef<THREE.PerspectiveCamera>(null)
  const yaw = useRef(initialYaw)
  const pitch = useRef(initialPitch)
  const railYawOffset = useRef(0)
  const railPitchOffset = useRef(0)
  const railLookHold = useRef(0)
  const initialized = useRef(false)
  const diagnosticsClock = useRef(0)
  const railPose = useMemo(createCinematicRailPose, [])
  const vectors = useMemo(() => ({
    anchor: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    localPosition: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    position: new THREE.Vector3(),
    worldPosition: new THREE.Vector3(),
  }), [])
  const desiredOrientation = useMemo(() => new THREE.PerspectiveCamera(), [])

  useEffect(() => {
    yaw.current = initialYaw
    pitch.current = initialPitch
    railYawOffset.current = 0
    railPitchOffset.current = 0
    freeRoamStore.getState().setCameraAngles(initialYaw, initialPitch)
  }, [initialPitch, initialYaw])

  useFrame((_, rawDelta) => {
    const activeCamera = camera.current
    const anchor = anchorRef.current
    if (!activeCamera || !anchor) return

    const delta = Math.min(rawDelta, 0.1)
    const runtime = freeRoamStore.getState()
    const scripted = runtime.exploration.mode !== 'free'
    const look = freeRoamInput.consumeLook()
    const hasLookInput = active && (Math.abs(look.x) > 0.001 || Math.abs(look.y) > 0.001)

    anchor.getWorldPosition(vectors.anchor)
    if (scripted) sampleCinematicGardenRail(runtime.exploration.railProgress, railPose)

    vectors.position.copy(vectors.anchor)
    const portraitAmount = THREE.MathUtils.clamp((0.8 - activeCamera.aspect) / 0.28, 0, 1)
    const entranceAmount = scripted
      ? 1 - THREE.MathUtils.smoothstep(runtime.exploration.railProgress, 0.025, 0.18)
      : 0
    const portraitEntranceAmount = portraitAmount * entranceAmount
    const portraitDestinationAmount = scripted
      ? portraitAmount * THREE.MathUtils.smoothstep(runtime.exploration.railProgress, 0.88, 1)
      : 0
    if (portraitEntranceAmount > 0.001) {
      vectors.direction.copy(railPose.lookAt).sub(vectors.anchor)
      vectors.direction.y = 0
      if (vectors.direction.lengthSq() > 0.0001) {
        vectors.direction.normalize()
        vectors.position.addScaledVector(vectors.direction, -4.8 * portraitEntranceAmount)
      }
      vectors.position.y += 0.24 * portraitEntranceAmount
    }
    if (portraitDestinationAmount > 0.001) {
      vectors.direction.copy(railPose.lookAt).sub(vectors.anchor)
      vectors.direction.y = 0
      if (vectors.direction.lengthSq() > 0.0001) {
        vectors.direction.normalize()
        vectors.position.addScaledVector(vectors.direction, -6 * portraitDestinationAmount)
      }
      vectors.position.y += 0.28 * portraitDestinationAmount
    }

    // The camera is a sibling of the anchor inside the translated player
    // body. Convert the authored world-space target into that parent's local
    // space; assigning world coordinates directly here doubles every player
    // translation and eventually sends the camera beyond the destination.
    vectors.localPosition.copy(vectors.position)
    activeCamera.parent?.worldToLocal(vectors.localPosition)

    if (!initialized.current || activeCamera.position.distanceToSquared(vectors.localPosition) > 16) {
      activeCamera.position.copy(vectors.localPosition)
      initialized.current = true
    } else {
      activeCamera.position.lerp(
        vectors.localPosition,
        1 - Math.exp(-positionDamping * delta),
      )
    }
    activeCamera.updateMatrixWorld(true)
    activeCamera.getWorldPosition(vectors.worldPosition)

    let targetFov = fov
    let targetRoll = 0

    if (scripted) {
      vectors.direction.copy(railPose.lookAt).sub(vectors.worldPosition)
      const horizontalLength = Math.hypot(vectors.direction.x, vectors.direction.z)
      const authoredYaw = Math.atan2(vectors.direction.x, -vectors.direction.z)
      const authoredPitch = Math.atan2(vectors.direction.y, Math.max(horizontalLength, 0.0001))

      if (hasLookInput) {
        railYawOffset.current = THREE.MathUtils.clamp(
          railYawOffset.current + look.x * lookSensitivity * 0.72,
          -0.42,
          0.42,
        )
        railPitchOffset.current = THREE.MathUtils.clamp(
          railPitchOffset.current - look.y * lookSensitivity * 0.72,
          -0.26,
          0.26,
        )
        railLookHold.current = 0.72
      } else if (railLookHold.current > 0) {
        railLookHold.current = Math.max(0, railLookHold.current - delta)
      } else {
        railYawOffset.current = THREE.MathUtils.damp(railYawOffset.current, 0, 2.2, delta)
        railPitchOffset.current = THREE.MathUtils.damp(railPitchOffset.current, 0, 2.2, delta)
      }

      yaw.current = wrapAngle(authoredYaw + railYawOffset.current)
      pitch.current = THREE.MathUtils.clamp(
        authoredPitch + railPitchOffset.current,
        minPitch,
        maxPitch,
      )
      targetFov = railPose.fov
        + 12 * portraitEntranceAmount
        + 18 * portraitDestinationAmount
      targetRoll = railPose.roll
    } else {
      railYawOffset.current = 0
      railPitchOffset.current = 0
      railLookHold.current = 0
      if (active) {
        yaw.current = wrapAngle(yaw.current + look.x * lookSensitivity)
        pitch.current = THREE.MathUtils.clamp(
          pitch.current - look.y * lookSensitivity,
          minPitch,
          maxPitch,
        )
      }
    }

    const cosPitch = Math.cos(pitch.current)
    vectors.direction.set(
      Math.sin(yaw.current) * cosPitch,
      Math.sin(pitch.current),
      -Math.cos(yaw.current) * cosPitch,
    )
    vectors.lookTarget.copy(vectors.worldPosition).addScaledVector(vectors.direction, 20)

    desiredOrientation.position.copy(vectors.worldPosition)
    desiredOrientation.up.set(0, 1, 0)
    desiredOrientation.lookAt(vectors.lookTarget)
    if (targetRoll !== 0) desiredOrientation.rotateZ(targetRoll)
    activeCamera.quaternion.slerp(
      desiredOrientation.quaternion,
      1 - Math.exp(-orientationDamping * delta),
    )
    const nextFov = THREE.MathUtils.damp(activeCamera.fov, targetFov, 8, delta)
    if (Math.abs(nextFov - activeCamera.fov) > 0.001) {
      activeCamera.fov = nextFov
      activeCamera.updateProjectionMatrix()
    }
    activeCamera.updateMatrixWorld()
    runtime.setCameraAngles(yaw.current, pitch.current)

    diagnosticsClock.current += delta
    if (diagnosticsClock.current >= 0.25) {
      diagnosticsClock.current = 0
      activeCamera.getWorldPosition(vectors.worldPosition)
      runtime.setDiagnostics({
        cameraDistance: vectors.worldPosition.distanceTo(vectors.anchor),
      })
    }
  })

  return <PerspectiveCamera far={far} fov={fov} makeDefault near={near} ref={camera} />
}
