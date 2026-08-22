export type Vector3Tuple = readonly [x: number, y: number, z: number]

export type FreeRoamInputMode = 'desktop' | 'touch' | 'unknown'

export interface FreeRoamMotionState {
  grounded: boolean
  moving: boolean
  position: Vector3Tuple
  speed: number
  sprinting: boolean
  verticalSpeed: number
}

export interface FreeRoamDiagnosticsState {
  cameraDistance: number
  collisionCount: number
  drawCalls: number
  fps: number
  frameMs: number
  physicsStepMs: number
  recoveries: number
  triangles: number
}

export interface FreeRoamZoneState {
  id: string
  priority: number
}

export interface FreeRoamInteractionState {
  available: boolean
  lastActivatedId: string | null
  nearbyId: string | null
}

export interface FreeRoamRuntimeSnapshot {
  activeZone: FreeRoamZoneState | null
  cameraPitch: number
  cameraYaw: number
  checkpoint: Vector3Tuple
  diagnostics: FreeRoamDiagnosticsState
  inputMode: FreeRoamInputMode
  interaction: FreeRoamInteractionState
  motion: FreeRoamMotionState
  pointerLocked: boolean
  teleportTarget: Vector3Tuple
  teleportVersion: number
}

export interface FreeRoamMovementInput {
  moveX: number
  moveY: number
  sprint: boolean
}

export interface FreeRoamLookDelta {
  x: number
  y: number
}

export interface FreeRoamTouchBridge {
  /** Adds a camera drag delta in CSS pixels. */
  addLookDelta: (deltaX: number, deltaY: number) => void
  /** Queues a wordless interaction with the closest active target. */
  interact: () => void
  /** Queues a jump on the next physics step. */
  jump: () => void
  /** Releases all touch-owned controls, for pointer-cancel and unmount. */
  release: () => void
  /** Sets the normalized movement stick. Positive Y moves forward. */
  setMove: (x: number, y: number) => void
  /** Holds or releases sprint independently of the movement stick. */
  setSprint: (sprinting: boolean) => void
}

export interface FreeRoamCommands {
  resetToCheckpoint: () => void
  setCheckpoint: (checkpoint: Vector3Tuple) => void
  teleport: (target: Vector3Tuple) => void
}

