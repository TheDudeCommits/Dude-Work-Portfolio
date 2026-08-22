import { useCallback } from 'react'
import { projects, type Project } from '../../../projects'
import {
  GardenInteractionProvider,
  type GardenInteractionDescriptor,
  type GardenInteractionEvent,
  type WorldPositionRef,
} from '../interactions'
import { AuthoredRockGarden } from './AuthoredRockGarden'
import { CinematicGardenSetPieces } from './CinematicGardenSetPieces'
import { DistantSanctuary } from './DistantSanctuary'
import { GardenEnvironment } from './GardenEnvironment'
import { MonumentalPine } from './MonumentalPine'
import { MoonBridge } from './MoonBridge'
import { PondGarden } from './PondGarden'
import { ProjectShrines } from './ProjectShrines'
import { ToriiThreshold } from './ToriiThreshold'

export interface LivingScrollGardenProps {
  activationSignal?: number
  onFocusChange?: (descriptor: GardenInteractionDescriptor | null) => void
  onInteractionActivate?: (event: GardenInteractionEvent) => void
  onProjectActivate?: (project: Project, event: GardenInteractionEvent) => void
  playerPositionRef?: WorldPositionRef
  reducedMotion?: boolean
}

export function LivingScrollGarden({
  activationSignal = 0,
  onFocusChange,
  onInteractionActivate,
  onProjectActivate,
  playerPositionRef,
  reducedMotion = false,
}: LivingScrollGardenProps) {
  const handleActivate = useCallback((event: GardenInteractionEvent) => {
    onInteractionActivate?.(event)
    const projectSlug = event.descriptor.metadata?.projectSlug
    if (!projectSlug) return
    const project = projects.find((candidate) => candidate.slug === projectSlug)
    if (project) onProjectActivate?.(project, event)
  }, [onInteractionActivate, onProjectActivate])

  return (
    <GardenInteractionProvider
      activationSignal={activationSignal}
      onActivate={handleActivate}
      onFocusChange={onFocusChange}
      playerPositionRef={playerPositionRef}
    >
      <group name="living-scroll-garden-v2">
        <GardenEnvironment />
        <CinematicGardenSetPieces reducedMotion={reducedMotion} />
        <AuthoredRockGarden />
        <DistantSanctuary />
        <PondGarden playerPositionRef={playerPositionRef} reducedMotion={reducedMotion} />
        <MoonBridge />
        <ToriiThreshold />
        <MonumentalPine
          playerPositionRef={playerPositionRef}
          position={[-10.2, 0, -7.15]}
          reducedMotion={reducedMotion}
        />
        <ProjectShrines reducedMotion={reducedMotion} />
        <group position={[12.4, 0, -12.6]} scale={1.18}>
          <MonumentalPine playerPositionRef={playerPositionRef} reducedMotion={reducedMotion} />
        </group>
      </group>
    </GardenInteractionProvider>
  )
}
