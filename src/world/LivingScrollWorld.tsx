import { Environment, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  ArtDirectorProvider,
  ART_PALETTE,
  GardenAtmosphere,
  GardenLighting,
  LivingInkFieldProvider,
  LivingScrollSky,
  useArtDirector,
  useLivingInkField,
  WindFieldProvider,
} from '../art'
import type { Project } from '../projects'
import type {
  GardenInteractionDescriptor,
  GardenInteractionEvent,
} from './v2/interactions'
import {
  FreeRoamPhysics,
  StaticBoxCollider,
} from './v2/physics'
import { FreeRoamPlayer } from './v2/player'
import {
  freeRoamInput,
  freeRoamStore,
  FreeRoamRuntimeSystems,
  getFreeRoamSnapshot,
  SpatialZone,
} from './v2/runtime'
import {
  InkWanderer,
  InkWashHorizon,
  LivingScrollColliders,
  LivingScrollGarden,
  WaterfallRidges,
} from './v2/scene'

const SPAWN = [0, 1.05, 18.6] as const
const INK_BOUNDS = [-30, -30, 30, 28] as const

function WebGLContextBridge({ onContextLost }: { onContextLost: (lost: boolean) => void }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      onContextLost(true)
    }
    const handleRestored = () => onContextLost(false)
    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
    }
  }, [gl, onContextLost])

  return null
}

function AdaptiveQuality() {
  const setDpr = useThree((state) => state.setDpr)
  return (
    <PerformanceMonitor
      bounds={(refreshRate) => [Math.min(38, refreshRate * 0.63), Math.min(55, refreshRate * 0.92)]}
      flipflops={3}
      onDecline={() => setDpr(0.82)}
      onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.5))}
    />
  )
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady])
  return null
}

function PlayerPositionBridge({ target }: { target: React.MutableRefObject<THREE.Vector3> }) {
  useFrame(() => {
    const position = getFreeRoamSnapshot().motion.position
    target.current.set(position[0], position[1], position[2])
  }, -24)
  return null
}

function FootstepInkEmitter({
  active,
  playerPosition,
}: {
  active: boolean
  playerPosition: React.MutableRefObject<THREE.Vector3>
}) {
  const { emitInk } = useLivingInkField()
  const lastStep = useRef(new THREE.Vector3(...SPAWN))
  const cadence = useRef(0)

  useFrame((_, delta) => {
    if (!active) return
    const motion = getFreeRoamSnapshot().motion
    if (!motion.grounded || !motion.moving) {
      cadence.current = 0
      lastStep.current.copy(playerPosition.current)
      return
    }

    cadence.current += delta
    const distance = lastStep.current.distanceTo(playerPosition.current)
    const stepDistance = motion.sprinting ? 0.72 : 0.52
    if (distance < stepDistance && cadence.current < 0.34) return

    const x = playerPosition.current.x / 14
    const z = (playerPosition.current.z + 3.4) / 13.9
    const inWater = x * x + z * z < 0.94
    emitInk({
      ageReset: 1,
      disturbance: inWater ? 0.78 : 0.36,
      pigment: inWater ? 0.46 : 0.68,
      position: playerPosition.current,
      radius: inWater ? 1.15 : 0.62,
      strength: inWater ? 0.72 : 0.52,
      wetness: inWater ? 1 : 0.64,
    })
    lastStep.current.copy(playerPosition.current)
    cadence.current = 0
  })

  return null
}

function GardenZones() {
  return (
    <>
      <SpatialZone
        checkpoint={[0, 1.05, 15.2]}
        id="torii-threshold"
        position={[0, 2, 11.4]}
        priority={2}
        size={[9, 4, 6]}
      />
      <SpatialZone
        checkpoint={[0, 1.05, 5.8]}
        id="pond-garden"
        position={[0, 1.5, -2.8]}
        priority={3}
        size={[21, 4, 15]}
      />
      <SpatialZone
        checkpoint={[0, 1.05, -10.8]}
        id="project-court"
        position={[0, 2, -11.5]}
        priority={4}
        size={[38, 5, 19]}
      />
    </>
  )
}

function GardenBoundary() {
  return (
    <>
      <StaticBoxCollider name="garden-boundary-north" position={[0, 2, -29]} size={[62, 5, 1]} />
      <StaticBoxCollider name="garden-boundary-south" position={[0, 2, 28]} size={[62, 5, 1]} />
      <StaticBoxCollider name="garden-boundary-east" position={[30, 2, 0]} size={[1, 5, 58]} />
      <StaticBoxCollider name="garden-boundary-west" position={[-30, 2, 0]} size={[1, 5, 58]} />
    </>
  )
}

function LivingScrollScene({
  active,
  onContextLost,
  onReady,
  reducedMotion,
}: {
  active: boolean
  onContextLost: (lost: boolean) => void
  onReady: () => void
  reducedMotion: boolean
}) {
  const playerPosition = useRef(new THREE.Vector3(...SPAWN))
  const awakenedProjects = useRef(new Set<string>())
  const [activationSignal, setActivationSignal] = useState(0)
  const { pulseRitual } = useArtDirector()
  const { emitInk } = useLivingInkField()

  const handleFocusChange = useCallback((descriptor: GardenInteractionDescriptor | null) => {
    freeRoamStore.getState().setInteraction({
      available: Boolean(descriptor),
      nearbyId: descriptor?.id ?? null,
    })
  }, [])

  const handleInteraction = useCallback((event: GardenInteractionEvent) => {
    freeRoamStore.getState().setInteraction({ lastActivatedId: event.descriptor.id })
  }, [])

  const handleProject = useCallback((project: Project, event: GardenInteractionEvent) => {
    if (!awakenedProjects.current.has(project.slug)) {
      awakenedProjects.current.add(project.slug)
      pulseRitual(1, 2.8)
      emitInk({
        ageReset: 1,
        disturbance: 1,
        pigment: 0.62,
        position: new THREE.Vector3(...event.descriptor.position),
        radius: 4.8,
        strength: 0.95,
        wetness: 1,
      })
      return
    }

    if (event.source === 'pointer') {
      const opened = window.open(project.href, '_blank', 'noopener,noreferrer')
      if (!opened) window.location.assign(project.href)
      return
    }
    window.location.assign(project.href)
  }, [emitInk, pulseRitual])

  useFrame(() => {
    if (active && freeRoamInput.consumeInteract()) {
      setActivationSignal((signal) => signal + 1)
    }
  }, -12)

  return (
    <>
      <WebGLContextBridge onContextLost={onContextLost} />
      <GardenAtmosphere densityScale={0.78} />
      <LivingScrollSky />
      <InkWashHorizon />
      <WaterfallRidges reducedMotion={reducedMotion} />
      <Environment
        background={false}
        environmentIntensity={0.42}
        files="/assets/environment/ninomaru-teien-1k.hdr"
      />
      <GardenLighting shadowMapSize={window.innerWidth < 780 ? 1024 : 2048} />
      <FreeRoamPhysics>
        <LivingScrollColliders />
        <GardenBoundary />
        <GardenZones />
        <FreeRoamPlayer
          active={active}
          cameraDistance={7.15}
          cameraTargetHeight={1.44}
          initialCameraPitch={0.12}
          initialCameraYaw={0}
          spawn={SPAWN}
        >
          <group scale={0.78}>
            <InkWanderer reducedMotion={reducedMotion} />
          </group>
        </FreeRoamPlayer>
      </FreeRoamPhysics>
      <PlayerPositionBridge target={playerPosition} />
      <FootstepInkEmitter active={active} playerPosition={playerPosition} />
      <LivingScrollGarden
        activationSignal={activationSignal}
        onFocusChange={handleFocusChange}
        onInteractionActivate={handleInteraction}
        onProjectActivate={handleProject}
        playerPositionRef={playerPosition}
        reducedMotion={reducedMotion}
      />
      <FreeRoamRuntimeSystems active={active} interactions={false} />
      <AdaptiveQuality />
      <ReadySignal onReady={onReady} />
    </>
  )
}

export interface LivingScrollWorldProps {
  active: boolean
  onContextLost: (lost: boolean) => void
  onReady: () => void
  reducedMotion: boolean
}

export function LivingScrollWorld({
  active,
  onContextLost,
  onReady,
  reducedMotion,
}: LivingScrollWorldProps) {
  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.NeutralToneMapping
    gl.toneMappingExposure = 0.9
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.VSMShadowMap
  }, [])
  const inkBounds = useMemo(() => INK_BOUNDS, [])

  return (
    <Canvas
      dpr={[0.82, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={handleCreated}
      shadows
    >
      <color args={[ART_PALETTE.mist]} attach="background" />
      <Suspense fallback={null}>
        <ArtDirectorProvider reducedMotion={reducedMotion}>
          <WindFieldProvider>
            <LivingInkFieldProvider bounds={inkBounds}>
              <LivingScrollScene
                active={active}
                onContextLost={onContextLost}
                onReady={onReady}
                reducedMotion={reducedMotion}
              />
            </LivingInkFieldProvider>
          </WindFieldProvider>
        </ArtDirectorProvider>
      </Suspense>
    </Canvas>
  )
}
