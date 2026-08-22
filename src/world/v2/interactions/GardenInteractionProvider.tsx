import { useFrame } from '@react-three/fiber'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import { useArtDirector, useLivingInkField } from '../../../art'
import type {
  GardenInteractionDescriptor,
  GardenInteractionEvent,
  WorldPositionRef,
} from './types'

interface RegisteredInteraction {
  descriptor: GardenInteractionDescriptor
}

interface GardenInteractionContextValue {
  activate: (id: string, source: GardenInteractionEvent['source']) => void
  activatedIds: ReadonlySet<string>
  focusedId: string | null
  register: (interaction: RegisteredInteraction) => () => void
  setPointerFocus: (id: string | null) => void
}

const GardenInteractionContext = createContext<GardenInteractionContextValue | null>(null)

export interface GardenInteractionProviderProps {
  activationSignal?: number
  children: ReactNode
  onActivate?: (event: GardenInteractionEvent) => void
  onFocusChange?: (descriptor: GardenInteractionDescriptor | null) => void
  playerPositionRef?: WorldPositionRef
}

export function GardenInteractionProvider({
  activationSignal = 0,
  children,
  onActivate,
  onFocusChange,
  playerPositionRef,
}: GardenInteractionProviderProps) {
  const registry = useRef(new Map<string, RegisteredInteraction>())
  const { pulseRitual } = useArtDirector()
  const { emitInk } = useLivingInkField()
  const pointerFocus = useRef<string | null>(null)
  const focusedIdRef = useRef<string | null>(null)
  const lastActivationSignal = useRef(activationSignal)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [activatedIds, setActivatedIds] = useState<ReadonlySet<string>>(() => new Set())
  const scratch = useMemo(() => new THREE.Vector3(), [])

  const commitFocus = useCallback((nextId: string | null) => {
    if (nextId === focusedIdRef.current) return
    focusedIdRef.current = nextId
    setFocusedId(nextId)
    onFocusChange?.(nextId ? registry.current.get(nextId)?.descriptor ?? null : null)
  }, [onFocusChange])

  const register = useCallback((interaction: RegisteredInteraction) => {
    registry.current.set(interaction.descriptor.id, interaction)
    return () => {
      registry.current.delete(interaction.descriptor.id)
      if (focusedIdRef.current === interaction.descriptor.id) commitFocus(null)
    }
  }, [commitFocus])

  const activate = useCallback((id: string, source: GardenInteractionEvent['source']) => {
    const interaction = registry.current.get(id)
    if (!interaction) return
    setActivatedIds((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
    const isProject = interaction.descriptor.kind === 'project-shrine'
    emitInk({
      ageReset: 1,
      disturbance: isProject ? 0.95 : 0.7,
      pigment: isProject ? 0.92 : 0.72,
      position: interaction.descriptor.position,
      radius: isProject ? 4.2 : 2.4,
      strength: 1,
      wetness: isProject ? 0.95 : 0.78,
    })
    pulseRitual(isProject ? 0.9 : 0.52, isProject ? 1.8 : 1.1)
    onActivate?.({ descriptor: interaction.descriptor, source })
  }, [emitInk, onActivate, pulseRitual])

  const setPointerFocus = useCallback((id: string | null) => {
    pointerFocus.current = id
    commitFocus(id)
  }, [commitFocus])

  useEffect(() => {
    if (activationSignal === lastActivationSignal.current) return
    lastActivationSignal.current = activationSignal
    if (focusedIdRef.current) activate(focusedIdRef.current, 'proximity-input')
  }, [activate, activationSignal])

  useFrame(() => {
    if (pointerFocus.current || !playerPositionRef?.current) return

    let candidate: string | null = null
    let candidateScore = Number.POSITIVE_INFINITY
    for (const [id, interaction] of registry.current) {
      scratch.fromArray(interaction.descriptor.position)
      const distance = scratch.distanceTo(playerPositionRef.current)
      if (distance > interaction.descriptor.focusRadius) continue
      const score = distance / interaction.descriptor.focusRadius
      if (score < candidateScore) {
        candidate = id
        candidateScore = score
      }
    }
    commitFocus(candidate)
  })

  const value = useMemo<GardenInteractionContextValue>(() => ({
    activate,
    activatedIds,
    focusedId,
    register,
    setPointerFocus,
  }), [activate, activatedIds, focusedId, register, setPointerFocus])

  return (
    <GardenInteractionContext.Provider value={value}>
      {children}
    </GardenInteractionContext.Provider>
  )
}

export function useGardenInteractable(descriptor: GardenInteractionDescriptor) {
  const context = useContext(GardenInteractionContext)
  if (!context) throw new Error('useGardenInteractable must be used inside GardenInteractionProvider')

  const { activate, activatedIds, focusedId, register, setPointerFocus } = context
  const descriptorKey = `${descriptor.id}:${descriptor.position.join(',')}:${descriptor.focusRadius}`

  useEffect(() => register({ descriptor }), [descriptor, descriptorKey, register])

  return {
    activateFromPointer: () => activate(descriptor.id, 'pointer'),
    activated: activatedIds.has(descriptor.id),
    focused: focusedId === descriptor.id,
    onPointerOut: () => setPointerFocus(null),
    onPointerOver: () => setPointerFocus(descriptor.id),
  }
}
