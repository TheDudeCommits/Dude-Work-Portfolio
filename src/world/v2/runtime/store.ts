import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type {
  FreeRoamDiagnosticsState,
  FreeRoamInputMode,
  FreeRoamInteractionState,
  FreeRoamMotionState,
  FreeRoamRuntimeSnapshot,
  FreeRoamZoneState,
  Vector3Tuple,
} from './types'

const DEFAULT_SPAWN: Vector3Tuple = [0, 1.05, 18.6]

const DEFAULT_MOTION: FreeRoamMotionState = {
  grounded: false,
  moving: false,
  position: DEFAULT_SPAWN,
  speed: 0,
  sprinting: false,
  verticalSpeed: 0,
}

const DEFAULT_DIAGNOSTICS: FreeRoamDiagnosticsState = {
  cameraDistance: 0,
  collisionCount: 0,
  drawCalls: 0,
  fps: 0,
  frameMs: 0,
  physicsStepMs: 0,
  recoveries: 0,
  triangles: 0,
}

const DEFAULT_INTERACTION: FreeRoamInteractionState = {
  available: false,
  lastActivatedId: null,
  nearbyId: null,
}

export interface FreeRoamRuntimeActions {
  requestTeleport: (target: Vector3Tuple) => void
  reset: (spawn?: Vector3Tuple) => void
  resetToCheckpoint: () => void
  setActiveZone: (zone: FreeRoamZoneState | null) => void
  setCameraAngles: (yaw: number, pitch: number) => void
  setCheckpoint: (checkpoint: Vector3Tuple) => void
  setDiagnostics: (diagnostics: Partial<FreeRoamDiagnosticsState>) => void
  setInputMode: (mode: FreeRoamInputMode) => void
  setInteraction: (interaction: Partial<FreeRoamInteractionState>) => void
  setMotion: (motion: Partial<FreeRoamMotionState>) => void
  setPointerLocked: (locked: boolean) => void
}

export type FreeRoamRuntimeStore = FreeRoamRuntimeSnapshot & FreeRoamRuntimeActions

const cloneTuple = (value: Vector3Tuple): Vector3Tuple => [value[0], value[1], value[2]]

export const freeRoamStore = createStore<FreeRoamRuntimeStore>()((set, get) => ({
  activeZone: null,
  cameraPitch: 0.28,
  cameraYaw: 0,
  checkpoint: cloneTuple(DEFAULT_SPAWN),
  diagnostics: { ...DEFAULT_DIAGNOSTICS },
  inputMode: 'unknown',
  interaction: { ...DEFAULT_INTERACTION },
  motion: { ...DEFAULT_MOTION, position: cloneTuple(DEFAULT_SPAWN) },
  pointerLocked: false,
  teleportTarget: cloneTuple(DEFAULT_SPAWN),
  teleportVersion: 0,
  requestTeleport: (target) => set((state) => ({
    teleportTarget: cloneTuple(target),
    teleportVersion: state.teleportVersion + 1,
  })),
  reset: (spawn = DEFAULT_SPAWN) => set((state) => ({
    activeZone: null,
    cameraPitch: 0.28,
    cameraYaw: 0,
    checkpoint: cloneTuple(spawn),
    diagnostics: { ...DEFAULT_DIAGNOSTICS },
    inputMode: 'unknown',
    interaction: { ...DEFAULT_INTERACTION },
    motion: { ...DEFAULT_MOTION, position: cloneTuple(spawn) },
    pointerLocked: false,
    teleportTarget: cloneTuple(spawn),
    teleportVersion: state.teleportVersion + 1,
  })),
  resetToCheckpoint: () => get().requestTeleport(get().checkpoint),
  setActiveZone: (activeZone) => set({ activeZone }),
  setCameraAngles: (cameraYaw, cameraPitch) => set({ cameraPitch, cameraYaw }),
  setCheckpoint: (checkpoint) => set({ checkpoint: cloneTuple(checkpoint) }),
  setDiagnostics: (diagnostics) => set((state) => ({
    diagnostics: { ...state.diagnostics, ...diagnostics },
  })),
  setInputMode: (inputMode) => {
    if (get().inputMode !== inputMode) set({ inputMode })
  },
  setInteraction: (interaction) => set((state) => ({
    interaction: { ...state.interaction, ...interaction },
  })),
  setMotion: (motion) => set((state) => ({
    motion: { ...state.motion, ...motion },
  })),
  setPointerLocked: (pointerLocked) => {
    if (get().pointerLocked !== pointerLocked) set({ pointerLocked })
  },
}))

export function useFreeRoamStore<T>(selector: (state: FreeRoamRuntimeStore) => T): T {
  return useStore(freeRoamStore, selector)
}

export const useFreeRoamDiagnostics = () => useFreeRoamStore((state) => state.diagnostics)

export const getFreeRoamSnapshot = (): FreeRoamRuntimeSnapshot => freeRoamStore.getState()

export const subscribeFreeRoam = freeRoamStore.subscribe

export const freeRoamCommands = {
  resetToCheckpoint: () => freeRoamStore.getState().resetToCheckpoint(),
  setCheckpoint: (checkpoint: Vector3Tuple) => freeRoamStore.getState().setCheckpoint(checkpoint),
  teleport: (target: Vector3Tuple) => freeRoamStore.getState().requestTeleport(target),
}
