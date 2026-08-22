import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { FREE_ROAM_CONTROLLED_KEYS, freeRoamInput } from './input'
import { freeRoamStore } from './store'

export interface FreeRoamDesktopInputProps {
  active?: boolean
  dragButton?: number
  pointerLock?: boolean
  scrollNavigation?: boolean
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable
    || target.tagName === 'INPUT'
    || target.tagName === 'SELECT'
    || target.tagName === 'TEXTAREA'
}

export function FreeRoamDesktopInput({
  active = true,
  dragButton = 0,
  pointerLock = true,
  scrollNavigation = true,
}: FreeRoamDesktopInputProps) {
  const canvas = useThree((state) => state.gl.domElement)

  useEffect(() => {
    let dragPointer: number | null = null

    const releaseDrag = () => {
      if (dragPointer !== null && canvas.hasPointerCapture(dragPointer)) {
        canvas.releasePointerCapture(dragPointer)
      }
      dragPointer = null
    }

    const resetDesktop = () => {
      releaseDrag()
      freeRoamInput.resetDesktop()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!active || !FREE_ROAM_CONTROLLED_KEYS.has(event.code) || isEditableTarget(event.target)) return
      event.preventDefault()
      if (!event.repeat) {
        if (event.code === 'Space') freeRoamInput.queueJump('desktop')
        else if (event.code === 'KeyE' || event.code === 'KeyF' || event.code === 'Enter') {
          freeRoamInput.queueInteract('desktop')
        }
      }
      freeRoamInput.setDesktopKey(event.code, true)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (!FREE_ROAM_CONTROLLED_KEYS.has(event.code)) return
      if (active && !isEditableTarget(event.target)) event.preventDefault()
      freeRoamInput.setDesktopKey(event.code, false)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!active || event.pointerType === 'touch' || event.button !== dragButton) return
      canvas.focus({ preventScroll: true })
      dragPointer = event.pointerId
      canvas.setPointerCapture(event.pointerId)
      if (pointerLock && document.pointerLockElement !== canvas) {
        try {
          const lockPromise = canvas.requestPointerLock()
          if (lockPromise instanceof Promise) lockPromise.catch(() => undefined)
        } catch {
          // Drag look remains available when the browser rejects pointer lock.
        }
      }
    }

    const onCanvasPointerMove = (event: PointerEvent) => {
      if (!active || dragPointer !== event.pointerId || document.pointerLockElement === canvas) return
      freeRoamInput.addDesktopLook(event.movementX, event.movementY)
    }

    const onDocumentPointerMove = (event: PointerEvent) => {
      if (!active || document.pointerLockElement !== canvas) return
      freeRoamInput.addDesktopLook(event.movementX, event.movementY)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId === dragPointer) releaseDrag()
    }

    const onPointerLockChange = () => {
      freeRoamStore.getState().setPointerLocked(document.pointerLockElement === canvas)
    }

    const onVisibilityChange = () => {
      if (document.hidden) resetDesktop()
    }

    const onContextMenu = (event: MouseEvent) => {
      if (active) event.preventDefault()
    }

    const onWheel = (event: WheelEvent) => {
      if (
        !active
        || !scrollNavigation
        || event.ctrlKey
        || event.metaKey
        || isEditableTarget(event.target)
      ) return
      event.preventDefault()
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? Math.max(window.innerHeight, 1)
          : 1
      freeRoamInput.addScroll(event.deltaY * unit)
    }

    canvas.tabIndex = 0
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp, { passive: false })
    window.addEventListener('blur', resetDesktop)
    window.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('pointermove', onDocumentPointerMove)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onCanvasPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    if (!active) resetDesktop()

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', resetDesktop)
      window.removeEventListener('wheel', onWheel)
      document.removeEventListener('pointermove', onDocumentPointerMove)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onCanvasPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      freeRoamStore.getState().setPointerLocked(false)
      resetDesktop()
    }
  }, [active, canvas, dragButton, pointerLock, scrollNavigation])

  return null
}
