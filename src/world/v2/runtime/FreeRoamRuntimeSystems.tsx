import { useEffect } from 'react'
import { FreeRoamDesktopInput } from './FreeRoamDesktopInput'
import { FreeRoamDiagnosticsProbe } from './diagnostics'
import { freeRoamInput } from './input'
import { FreeRoamInteractionSystem } from './interactions'

export interface FreeRoamRuntimeSystemsProps {
  active?: boolean
  diagnostics?: boolean
  interactions?: boolean
  pointerLock?: boolean
  scrollNavigation?: boolean
}

/** Mount once inside Canvas. It wires desktop input, interactions, and runtime telemetry. */
export function FreeRoamRuntimeSystems({
  active = true,
  diagnostics = true,
  interactions = true,
  pointerLock = true,
  scrollNavigation = true,
}: FreeRoamRuntimeSystemsProps) {
  useEffect(() => () => freeRoamInput.resetAll(), [])
  useEffect(() => {
    if (!active) freeRoamInput.resetAll()
  }, [active])

  return (
    <>
      <FreeRoamDesktopInput
        active={active}
        pointerLock={pointerLock}
        scrollNavigation={scrollNavigation}
      />
      {interactions && <FreeRoamInteractionSystem active={active} />}
      <FreeRoamDiagnosticsProbe enabled={diagnostics} />
    </>
  )
}
