import * as THREE from 'three'
import { freeRoamStore } from './store'
import type {
  FreeRoamLookDelta,
  FreeRoamMovementInput,
  FreeRoamTouchBridge,
} from './types'

const FORWARD_KEYS = new Set(['ArrowUp', 'KeyW'])
const BACKWARD_KEYS = new Set(['ArrowDown', 'KeyS'])
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA'])
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD'])
const SPRINT_KEYS = new Set(['ShiftLeft', 'ShiftRight'])

export const FREE_ROAM_CONTROLLED_KEYS = new Set([
  ...FORWARD_KEYS,
  ...BACKWARD_KEYS,
  ...LEFT_KEYS,
  ...RIGHT_KEYS,
  ...SPRINT_KEYS,
  'Enter',
  'KeyE',
  'KeyF',
  'Space',
])

class FreeRoamInputBuffer {
  private readonly desktopKeys = new Set<string>()
  private interactQueued = false
  private jumpQueued = false
  private lookX = 0
  private lookY = 0
  private scrollDelta = 0
  private touchMoveX = 0
  private touchMoveY = 0
  private touchSprint = false

  setDesktopKey(code: string, pressed: boolean) {
    if (pressed) this.desktopKeys.add(code)
    else this.desktopKeys.delete(code)
    freeRoamStore.getState().setInputMode('desktop')
  }

  addDesktopLook(deltaX: number, deltaY: number) {
    this.lookX += THREE.MathUtils.clamp(deltaX, -240, 240)
    this.lookY += THREE.MathUtils.clamp(deltaY, -240, 240)
    freeRoamStore.getState().setInputMode('desktop')
  }

  addTouchLook(deltaX: number, deltaY: number) {
    this.lookX += THREE.MathUtils.clamp(deltaX, -160, 160)
    this.lookY += THREE.MathUtils.clamp(deltaY, -160, 160)
    freeRoamStore.getState().setInputMode('touch')
  }

  addScroll(deltaY: number) {
    this.scrollDelta += THREE.MathUtils.clamp(deltaY, -360, 360)
    this.scrollDelta = THREE.MathUtils.clamp(this.scrollDelta, -960, 960)
    freeRoamStore.getState().setInputMode('scroll')
  }

  setTouchMove(x: number, y: number) {
    const magnitude = Math.hypot(x, y)
    const scale = magnitude > 1 ? 1 / magnitude : 1
    this.touchMoveX = THREE.MathUtils.clamp(x * scale, -1, 1)
    this.touchMoveY = THREE.MathUtils.clamp(y * scale, -1, 1)
    freeRoamStore.getState().setInputMode('touch')
  }

  setTouchSprint(sprinting: boolean) {
    this.touchSprint = sprinting
    freeRoamStore.getState().setInputMode('touch')
  }

  queueInteract(mode: 'desktop' | 'touch' = 'desktop') {
    this.interactQueued = true
    freeRoamStore.getState().setInputMode(mode)
  }

  queueJump(mode: 'desktop' | 'touch' = 'desktop') {
    this.jumpQueued = true
    freeRoamStore.getState().setInputMode(mode)
  }

  movement(): FreeRoamMovementInput {
    const keyboardX = Number([...RIGHT_KEYS].some((code) => this.desktopKeys.has(code)))
      - Number([...LEFT_KEYS].some((code) => this.desktopKeys.has(code)))
    const keyboardY = Number([...FORWARD_KEYS].some((code) => this.desktopKeys.has(code)))
      - Number([...BACKWARD_KEYS].some((code) => this.desktopKeys.has(code)))
    const x = THREE.MathUtils.clamp(keyboardX + this.touchMoveX, -1, 1)
    const y = THREE.MathUtils.clamp(keyboardY + this.touchMoveY, -1, 1)
    const magnitude = Math.hypot(x, y)
    const scale = magnitude > 1 ? 1 / magnitude : 1
    return {
      moveX: x * scale,
      moveY: y * scale,
      sprint: this.touchSprint || [...SPRINT_KEYS].some((code) => this.desktopKeys.has(code)),
    }
  }

  consumeLook(): FreeRoamLookDelta {
    const look = { x: this.lookX, y: this.lookY }
    this.lookX = 0
    this.lookY = 0
    return look
  }

  consumeScroll(): number {
    const delta = this.scrollDelta
    this.scrollDelta = 0
    return delta
  }

  consumeInteract(): boolean {
    const queued = this.interactQueued
    this.interactQueued = false
    return queued
  }

  consumeJump(): boolean {
    const queued = this.jumpQueued
    this.jumpQueued = false
    return queued
  }

  resetDesktop() {
    this.desktopKeys.clear()
    this.lookX = 0
    this.lookY = 0
    this.scrollDelta = 0
  }

  resetTouch() {
    this.touchMoveX = 0
    this.touchMoveY = 0
    this.touchSprint = false
  }

  resetAll() {
    this.resetDesktop()
    this.resetTouch()
    this.interactQueued = false
    this.jumpQueued = false
  }
}

export const freeRoamInput = new FreeRoamInputBuffer()

export const freeRoamTouch: FreeRoamTouchBridge = {
  addLookDelta: (deltaX, deltaY) => freeRoamInput.addTouchLook(deltaX, deltaY),
  interact: () => freeRoamInput.queueInteract('touch'),
  jump: () => freeRoamInput.queueJump('touch'),
  release: () => freeRoamInput.resetTouch(),
  setMove: (x, y) => freeRoamInput.setTouchMove(x, y),
  setSprint: (sprinting) => freeRoamInput.setTouchSprint(sprinting),
}
