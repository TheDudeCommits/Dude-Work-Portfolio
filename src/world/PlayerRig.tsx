import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { JourneyInputRef, ProgressRef } from './types'

const START_Z = 36.5
const END_Z = -32.6

const pathHeight = (z: number) => {
  const climb = THREE.MathUtils.smoothstep(START_Z - z, 17, 64)
  return 1.72 + climb * 0.42
}

export function PlayerRig({
  active,
  inputRef,
  onProgress,
  progressRef,
}: {
  active: boolean
  inputRef: JourneyInputRef
  onProgress: (progress: number) => void
  progressRef: ProgressRef
}) {
  const { camera, gl } = useThree()
  const position = useRef(new THREE.Vector3(0, pathHeight(START_Z), START_Z))
  const yaw = useRef(0)
  const pitch = useRef(-0.015)
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const keys = useRef(new Set<string>())
  const lastProgress = useRef(-1)
  const elapsed = useRef(0)

  useEffect(() => {
    camera.position.copy(position.current)
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
  }, [camera])

  useEffect(() => {
    const canvas = gl.domElement
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
      keys.current.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code)
    const onWheel = (event: WheelEvent) => {
      if (!active) return
      event.preventDefault()
      inputRef.current.wheel = THREE.MathUtils.clamp(inputRef.current.wheel + Math.sign(event.deltaY) * 0.74, -1.4, 1.6)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!active || event.pointerType === 'touch') return
      dragging.current = true
      lastPointer.current = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add('is-looking')
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current || event.pointerType === 'touch') return
      const dx = event.clientX - lastPointer.current.x
      const dy = event.clientY - lastPointer.current.y
      lastPointer.current = { x: event.clientX, y: event.clientY }
      yaw.current = THREE.MathUtils.clamp(yaw.current - dx * 0.0022, -0.44, 0.44)
      pitch.current = THREE.MathUtils.clamp(pitch.current - dy * 0.0018, -0.32, 0.25)
    }
    const onPointerUp = (event: PointerEvent) => {
      dragging.current = false
      canvas.classList.remove('is-looking')
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [active, gl, inputRef])

  useFrame((_, rawDelta) => {
    // Keep travel speed tied to wall-clock time on slower GPUs while still
    // capping background-tab jumps to a safe distance.
    const delta = Math.min(rawDelta, 0.12)
    elapsed.current += delta
    const input = inputRef.current
    const forwardKeys = Number(keys.current.has('KeyW') || keys.current.has('ArrowUp'))
      - Number(keys.current.has('KeyS') || keys.current.has('ArrowDown'))
    const strafeKeys = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight'))
      - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft'))
    const sprint = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
    const forward = active ? THREE.MathUtils.clamp(forwardKeys + input.forward + input.wheel, -1.35, 1.7) : 0
    const strafe = active ? THREE.MathUtils.clamp(strafeKeys + input.strafe, -1, 1) : 0
    const speed = sprint ? 10.6 : 6.2

    input.wheel = THREE.MathUtils.damp(input.wheel, 0, 4.8, delta)
    position.current.z = THREE.MathUtils.clamp(position.current.z - forward * speed * delta, END_Z, START_Z)
    const pathWidth = position.current.z < -29 ? 4.9 : 2.05
    position.current.x = THREE.MathUtils.clamp(position.current.x + strafe * speed * 0.67 * delta, -pathWidth, pathWidth)

    const moving = Math.min(1, Math.abs(forward) + Math.abs(strafe))
    const bob = Math.sin(elapsed.current * 8.4) * 0.026 * moving
    const sway = Math.cos(elapsed.current * 4.2) * 0.013 * moving
    const target = new THREE.Vector3(position.current.x + sway, pathHeight(position.current.z) + bob, position.current.z)
    camera.position.lerp(target, 1 - Math.exp(-delta * 13))
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    const progress = THREE.MathUtils.clamp((START_Z - position.current.z) / (START_Z - END_Z), 0, 1)
    progressRef.current = progress
    if (Math.abs(progress - lastProgress.current) > 0.004 || progress === 0 || progress === 1) {
      lastProgress.current = progress
      onProgress(progress)
    }
  })

  return null
}
