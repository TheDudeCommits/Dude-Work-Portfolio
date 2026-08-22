import { PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import type { RefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { freeRoamInput } from '../runtime/input'
import { freeRoamStore } from '../runtime/store'

export interface FreeRoamCameraProps {
  active?: boolean
  anchorRef: RefObject<THREE.Group | null>
  bodyRef: RefObject<RapierRigidBody | null>
  colliderRef: RefObject<RapierCollider | null>
  collisionPadding?: number
  distance?: number
  far?: number
  fov?: number
  initialPitch?: number
  initialYaw?: number
  lookSensitivity?: number
  maxPitch?: number
  minDistance?: number
  minPitch?: number
  near?: number
  shoulderOffset?: number
}

export function FreeRoamCamera({
  active = true,
  anchorRef,
  bodyRef,
  colliderRef,
  collisionPadding = 0.2,
  distance = 5.8,
  far = 180,
  fov = 48,
  initialPitch = 0.28,
  initialYaw = 0,
  lookSensitivity = 0.00235,
  maxPitch = 1.04,
  minDistance = 1.05,
  minPitch = -0.48,
  near = 0.055,
  shoulderOffset = 0.34,
}: FreeRoamCameraProps) {
  const camera = useRef<THREE.PerspectiveCamera>(null)
  const { rapier, world } = useRapier()
  const yaw = useRef(initialYaw)
  const pitch = useRef(initialPitch)
  const initialized = useRef(false)
  const diagnosticsClock = useRef(0)
  const vectors = useMemo(() => ({
    direction: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    position: new THREE.Vector3(),
    right: new THREE.Vector3(),
    target: new THREE.Vector3(),
  }), [])
  // Cameras look down local -Z, while a plain Object3D.lookAt aligns local +Z.
  // Use a camera as the quaternion scratch object so the final view faces the
  // target instead of being exactly reversed.
  const desiredOrientation = useMemo(() => new THREE.PerspectiveCamera(), [])

  useEffect(() => {
    yaw.current = initialYaw
    pitch.current = initialPitch
    freeRoamStore.getState().setCameraAngles(initialYaw, initialPitch)
  }, [initialPitch, initialYaw])

  useFrame((_, rawDelta) => {
    if (!camera.current || !anchorRef.current) return
    const delta = Math.min(rawDelta, 0.1)
    const look = freeRoamInput.consumeLook()
    if (active) {
      yaw.current = THREE.MathUtils.euclideanModulo(
        yaw.current + look.x * lookSensitivity + Math.PI,
        Math.PI * 2,
      ) - Math.PI
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - look.y * lookSensitivity,
        minPitch,
        maxPitch,
      )
    }
    freeRoamStore.getState().setCameraAngles(yaw.current, pitch.current)

    anchorRef.current.getWorldPosition(vectors.target)
    vectors.forward.set(Math.sin(yaw.current), 0, -Math.cos(yaw.current))
    vectors.right.set(Math.cos(yaw.current), 0, Math.sin(yaw.current))
    const horizontalDistance = Math.cos(pitch.current) * distance
    vectors.position
      .copy(vectors.target)
      .addScaledVector(vectors.forward, -horizontalDistance)
      .addScaledVector(vectors.right, shoulderOffset)
    vectors.position.y += Math.sin(pitch.current) * distance

    vectors.direction.copy(vectors.position).sub(vectors.target)
    const desiredDistance = vectors.direction.length()
    if (desiredDistance > 0.001) {
      vectors.direction.multiplyScalar(1 / desiredDistance)
      const ray = new rapier.Ray(vectors.target, vectors.direction)
      const hit = world.castRay(
        ray,
        desiredDistance,
        true,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        colliderRef.current ?? undefined,
        bodyRef.current ?? undefined,
      )
      if (hit) {
        const safeDistance = THREE.MathUtils.clamp(
          hit.timeOfImpact - collisionPadding,
          minDistance,
          desiredDistance,
        )
        vectors.position.copy(vectors.target).addScaledVector(vectors.direction, safeDistance)
      }
    }

    if (!initialized.current) {
      camera.current.position.copy(vectors.position)
      initialized.current = true
    } else {
      camera.current.position.lerp(vectors.position, 1 - Math.exp(-13 * delta))
    }
    vectors.lookTarget.copy(vectors.target).addScaledVector(vectors.forward, 0.32)
    desiredOrientation.position.copy(camera.current.position)
    desiredOrientation.up.set(0, 1, 0)
    desiredOrientation.lookAt(vectors.lookTarget)
    camera.current.quaternion.slerp(
      desiredOrientation.quaternion,
      1 - Math.exp(-16 * delta),
    )
    camera.current.updateMatrixWorld()

    diagnosticsClock.current += delta
    if (diagnosticsClock.current >= 0.25) {
      diagnosticsClock.current = 0
      freeRoamStore.getState().setDiagnostics({
        cameraDistance: camera.current.position.distanceTo(vectors.target),
      })
    }
  })

  return <PerspectiveCamera far={far} fov={fov} makeDefault near={near} ref={camera} />
}
