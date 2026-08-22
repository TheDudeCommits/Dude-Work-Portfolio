import { Physics } from '@react-three/rapier'
import type { ReactNode } from 'react'

export interface FreeRoamPhysicsProps {
  children: ReactNode
  debug?: boolean
  gravity?: readonly [x: number, y: number, z: number]
  paused?: boolean
  timeStep?: number
}

export function FreeRoamPhysics({
  children,
  debug = false,
  gravity = [0, -22, 0],
  paused = false,
  timeStep = 1 / 60,
}: FreeRoamPhysicsProps) {
  return (
    <Physics
      colliders={false}
      debug={debug}
      gravity={[gravity[0], gravity[1], gravity[2]]}
      interpolate
      maxCcdSubsteps={2}
      paused={paused}
      predictionDistance={0.012}
      timeStep={timeStep}
    >
      {children}
    </Physics>
  )
}

