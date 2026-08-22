import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type {
  FreeRoamDiagnosticsState,
  FreeRoamCommands,
  FreeRoamExplorationState,
  FreeRoamInputMode,
  FreeRoamInteractionState,
  FreeRoamMotionState,
  FreeRoamRuntimeSnapshot,
  FreeRoamZoneState,
  Vector3Tuple,
} from './types'

const DEFAULT_SPAWN: Vector3Tuple = [-6.8, 2.32, 27.8]

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

const DEFAULT_EXPLORATION: FreeRoamExplorationState = {
  mode: 'rail',
  railProgress: 0,
  railTargetProgress: 0,
}

export interface FreeRoamRuntimeActions {
  requestTeleport: (target: Vector3Tuple) => void
  reset: (spawn?: Vector3Tuple) => void
  resetToCheckpoint: () => void
  setActiveZone: (zone: FreeRoamZoneState | null) => void
  setCameraAngles: (yaw: number, pitch: number) => void
  setCheckpoint: (checkpoint: Vector3Tuple) => void
  setDiagnostics: (diagnostics: Partial<FreeRoamDiagnosticsState>) => void
  setExploration: (exploration: Partial<FreeRoamExplorationState>) => void
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
  exploration: { ...DEFAULT_EXPLORATION },
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
    exploration: { ...DEFAULT_EXPLORATION },
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
  setExploration: (exploration) => set((state) => {
    const next = { ...state.exploration, ...exploration }
    if (
      next.mode === state.exploration.mode
      && next.railProgress === state.exploration.railProgress
      && next.railTargetProgress === state.exploration.railTargetProgress
    ) return state
    return { exploration: next }
  }),
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

export const freeRoamCommands: FreeRoamCommands = {
  enterFreeRoam: () => freeRoamStore.getState().setExploration({ mode: 'free' }),
  resetToCheckpoint: () => {
    const state = freeRoamStore.getState()
    state.setExploration({ mode: 'free' })
    state.resetToCheckpoint()
  },
  resumeCinematicRail: (progress?: number) => {
    const state = freeRoamStore.getState()
    const target = Math.min(1, Math.max(0, progress ?? state.exploration.railTargetProgress))
    state.setExploration({
      mode: 'reattaching',
      railProgress: progress === undefined ? state.exploration.railProgress : target,
      railTargetProgress: target,
    })
  },
  setCheckpoint: (checkpoint: Vector3Tuple) => freeRoamStore.getState().setCheckpoint(checkpoint),
  teleport: (target: Vector3Tuple) => {
    const state = freeRoamStore.getState()
    state.setExploration({ mode: 'free' })
    state.requestTeleport(target)
  },
}
