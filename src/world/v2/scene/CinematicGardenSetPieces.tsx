import { CinematicAtmosphere } from './CinematicAtmosphere'
import { CinematicWind } from './CinematicWind'
import { MonumentalInkVista } from './MonumentalInkVista'

export interface CinematicGardenSetPiecesProps {
  reducedMotion?: boolean
}

/**
 * Visual beats shared by the scroll-driven rail and free-roam camera modes.
 * These coordinates deliberately describe empty-space composition rather than
 * gameplay state so neither navigation mode needs to own the art direction.
 */
export const CINEMATIC_GARDEN_ACTS = [
  {
    endZ: 9,
    focalPoint: [0, 3.1, 11.7] as const,
    id: 'threshold',
    startZ: 30,
  },
  {
    endZ: -13,
    focalPoint: [-2.8, 1.2, -4.8] as const,
    id: 'water-passage',
    startZ: 9,
  },
  {
    endZ: -38,
    focalPoint: [4.6, 5.4, -35.5] as const,
    id: 'sanctuary-reveal',
    startZ: -13,
  },
] as const

export function CinematicGardenSetPieces({
  reducedMotion = false,
}: CinematicGardenSetPiecesProps) {
  return (
    <group name="cinematic-garden-set-pieces">
      <CinematicAtmosphere reducedMotion={reducedMotion} />
      <CinematicWind reducedMotion={reducedMotion} />
      <MonumentalInkVista reducedMotion={reducedMotion} />
    </group>
  )
}
