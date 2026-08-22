import type { MutableRefObject } from 'react'

export interface JourneyInput {
  forward: number
  lookX: number
  lookY: number
  strafe: number
  wheel: number
}

export type JourneyInputRef = MutableRefObject<JourneyInput>
export type ProgressRef = MutableRefObject<number>

export interface PlayerRigProps {
  active: boolean
  inputRef: JourneyInputRef
  onProgress: (progress: number) => void
  progressRef: ProgressRef
  reducedMotion?: boolean
}
