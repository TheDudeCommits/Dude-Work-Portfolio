import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { JourneyInputRef, ProgressRef } from './types'

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
  const { gl } = useThree()
  const keys = useRef(new Set<string>())
  const lastProgress = useRef(-1)
  const pointerTarget = useRef(new THREE.Vector2())

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
      inputRef.current.wheel = THREE.MathUtils.clamp(
        inputRef.current.wheel + Math.sign(event.deltaY) * 0.82,
        -1.55,
        1.75,
      )
    }
    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      pointerTarget.current.set(
        THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(-(((event.clientY - bounds.top) / bounds.height) * 2 - 1), -1, 1),
      )
    }
    const onPointerLeave = () => pointerTarget.current.set(0, 0)

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [active, gl, inputRef])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.12)
    const input = inputRef.current
    const forwardKeys = Number(keys.current.has('KeyW') || keys.current.has('ArrowUp'))
      - Number(keys.current.has('KeyS') || keys.current.has('ArrowDown'))
    const strafeKeys = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight'))
      - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft'))
    const sprint = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
    const forward = active
      ? THREE.MathUtils.clamp(forwardKeys + input.forward + input.wheel, -1.4, 1.8)
      : 0
    const strafe = active ? THREE.MathUtils.clamp(strafeKeys + input.strafe, -1, 1) : 0
    const speed = sprint ? 0.064 : 0.038

    input.wheel = THREE.MathUtils.damp(input.wheel, 0, 5.2, delta)
    progressRef.current = THREE.MathUtils.clamp(
      progressRef.current + forward * speed * delta,
      0,
      1,
    )
    input.lookX = THREE.MathUtils.damp(
      input.lookX,
      pointerTarget.current.x * 0.9 + strafe * 0.16,
      3.2,
      delta,
    )
    input.lookY = THREE.MathUtils.damp(input.lookY, pointerTarget.current.y * 0.58, 3.2, delta)

    const progress = progressRef.current
    if (Math.abs(progress - lastProgress.current) > 0.0035 || progress === 0 || progress === 1) {
      lastProgress.current = progress
      onProgress(progress)
    }
  })

  return null
}
