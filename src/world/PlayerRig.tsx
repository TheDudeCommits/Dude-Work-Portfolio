import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  createJourneyFrame,
  JOURNEY_EYE_HEIGHT,
  JOURNEY_PATH_LENGTH,
  sampleJourneyFrame,
  sampleJourneyWidth,
} from './path'
import type { PlayerRigProps } from './types'

const CONTROLLED_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'KeyA',
  'KeyD',
  'KeyS',
  'KeyW',
  'ShiftLeft',
  'ShiftRight',
])

const WALK_SPEED = 3.15
const SPRINT_SPEED = 5.15
const STRAFE_SPEED = 2.35
const CAMERA_POSITION_DAMPING = 14
const CAMERA_ROTATION_DAMPING = 9

const isForwardKey = (keys: Set<string>) => Number(keys.has('KeyW') || keys.has('ArrowUp'))
  - Number(keys.has('KeyS') || keys.has('ArrowDown'))

const isStrafeKey = (keys: Set<string>) => Number(keys.has('KeyD') || keys.has('ArrowRight'))
  - Number(keys.has('KeyA') || keys.has('ArrowLeft'))

export function PlayerRig({
  active,
  inputRef,
  onProgress,
  progressRef,
  reducedMotion = false,
}: PlayerRigProps) {
  const { gl } = useThree()
  const camera = useRef<THREE.PerspectiveCamera>(null)
  const keys = useRef(new Set<string>())
  const lastProgress = useRef(-1)
  const pointerTarget = useRef(new THREE.Vector2())
  const lateralOffset = useRef(0)
  const lateralVelocity = useRef(0)
  const bobPhase = useRef(0)
  const bobStrength = useRef(0)
  const frame = useMemo(() => createJourneyFrame(), [])
  const vectors = useMemo(() => ({
    desiredPosition: new THREE.Vector3(),
    desiredTarget: new THREE.Vector3(),
    lookDirection: new THREE.Vector3(),
    worldUp: new THREE.Vector3(0, 1, 0),
  }), [])
  const desiredOrientation = useMemo(() => new THREE.PerspectiveCamera(), [])

  useLayoutEffect(() => {
    if (!camera.current) return
    const progress = THREE.MathUtils.clamp(progressRef.current, 0, 1)
    sampleJourneyFrame(progress, frame)
    camera.current.position
      .copy(frame.position)
      .addScaledVector(frame.up, JOURNEY_EYE_HEIGHT)
    vectors.desiredTarget
      .copy(camera.current.position)
      .addScaledVector(frame.tangent, 8)
    camera.current.up.copy(vectors.worldUp)
    camera.current.lookAt(vectors.desiredTarget)
    camera.current.updateMatrixWorld()
  }, [frame, progressRef, vectors])

  useEffect(() => {
    const canvas = gl.domElement
    const resetInput = () => {
      keys.current.clear()
      pointerTarget.current.set(0, 0)
      lateralVelocity.current = 0
      inputRef.current.forward = 0
      inputRef.current.lookX = 0
      inputRef.current.lookY = 0
      inputRef.current.strafe = 0
      inputRef.current.wheel = 0
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!active || !CONTROLLED_KEYS.has(event.code)) return
      event.preventDefault()
      keys.current.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!CONTROLLED_KEYS.has(event.code)) return
      if (active) event.preventDefault()
      keys.current.delete(event.code)
    }
    const onWheel = (event: WheelEvent) => {
      if (!active) return
      event.preventDefault()
      inputRef.current.wheel = THREE.MathUtils.clamp(
        inputRef.current.wheel + Math.sign(event.deltaY) * 0.82,
        -1.55,
        1.75,
      )
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!active) return
      const bounds = canvas.getBoundingClientRect()
      pointerTarget.current.set(
        THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(-(((event.clientY - bounds.top) / bounds.height) * 2 - 1), -1, 1),
      )
    }
    const onPointerLeave = () => pointerTarget.current.set(0, 0)
    const onVisibilityChange = () => {
      if (document.hidden) resetInput()
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', resetInput)
    document.addEventListener('visibilitychange', onVisibilityChange)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)

    if (!active) resetInput()

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', resetInput)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      resetInput()
    }
  }, [active, gl, inputRef])

  useFrame((_, rawDelta) => {
    if (!active || !camera.current) return

    const delta = Math.min(rawDelta, 0.12)
    const input = inputRef.current
    const forwardKeys = isForwardKey(keys.current)
    const strafeKeys = isStrafeKey(keys.current)
    const sprint = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
    const forward = THREE.MathUtils.clamp(forwardKeys + input.forward + input.wheel, -1.35, 1.65)
    const strafe = THREE.MathUtils.clamp(strafeKeys + input.strafe, -1, 1)
    const movementSpeed = sprint ? SPRINT_SPEED : WALK_SPEED

    input.wheel = THREE.MathUtils.damp(input.wheel, 0, 5.2, delta)
    progressRef.current = THREE.MathUtils.clamp(
      progressRef.current + (forward * movementSpeed * delta) / JOURNEY_PATH_LENGTH,
      0,
      1,
    )

    lateralVelocity.current = THREE.MathUtils.damp(
      lateralVelocity.current,
      strafe * STRAFE_SPEED * (sprint ? 1.28 : 1),
      11,
      delta,
    )
    const availableWidth = sampleJourneyWidth(progressRef.current)
    lateralOffset.current = THREE.MathUtils.clamp(
      lateralOffset.current + lateralVelocity.current * delta,
      -availableWidth,
      availableWidth,
    )

    input.lookX = THREE.MathUtils.damp(
      input.lookX,
      pointerTarget.current.x * 0.78 + strafe * 0.08,
      4.4,
      delta,
    )
    input.lookY = THREE.MathUtils.damp(input.lookY, pointerTarget.current.y * 0.5, 4.4, delta)

    const progress = progressRef.current
    const locomotion = THREE.MathUtils.clamp(Math.abs(forward) + Math.abs(strafe) * 0.55, 0, 1)
    bobStrength.current = THREE.MathUtils.damp(bobStrength.current, locomotion, 8, delta)
    if (locomotion > 0.015) {
      bobPhase.current += delta * (sprint ? 10.2 : 7.7) * Math.max(0.3, locomotion)
    }

    sampleJourneyFrame(progress, frame)
    const motionScale = reducedMotion ? 0 : 1
    const bob = Math.sin(bobPhase.current) * 0.024 * bobStrength.current * motionScale
    const sway = Math.cos(bobPhase.current * 0.5) * 0.012 * bobStrength.current * motionScale
    vectors.desiredPosition
      .copy(frame.position)
      .addScaledVector(frame.right, lateralOffset.current + sway)
      .addScaledVector(frame.up, JOURNEY_EYE_HEIGHT + bob)

    camera.current.position.lerp(
      vectors.desiredPosition,
      1 - Math.exp(-CAMERA_POSITION_DAMPING * delta),
    )

    vectors.lookDirection
      .copy(frame.tangent)
      .multiplyScalar(8)
      .addScaledVector(frame.right, input.lookX * 2.35)
      .addScaledVector(
        vectors.worldUp,
        -0.58 + THREE.MathUtils.smoothstep(progress, 0.91, 1) * 1.42 + input.lookY * 1.65,
      )
    vectors.desiredTarget.copy(camera.current.position).add(vectors.lookDirection)
    desiredOrientation.position.copy(camera.current.position)
    desiredOrientation.up.copy(vectors.worldUp)
    desiredOrientation.lookAt(vectors.desiredTarget)
    camera.current.quaternion.slerp(
      desiredOrientation.quaternion,
      1 - Math.exp(-CAMERA_ROTATION_DAMPING * delta),
    )
    camera.current.updateMatrixWorld()

    const reachedNewEndpoint = (progress === 0 || progress === 1) && progress !== lastProgress.current
    if (
      lastProgress.current < 0
      || Math.abs(progress - lastProgress.current) > 0.0035
      || reachedNewEndpoint
    ) {
      lastProgress.current = progress
      onProgress(progress)
    }
  })

  return (
    <PerspectiveCamera
      far={150}
      fov={52}
      makeDefault
      near={0.06}
      ref={camera}
    />
  )
}
