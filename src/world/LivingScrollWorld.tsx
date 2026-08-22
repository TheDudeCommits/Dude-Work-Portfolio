import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../art/artTokens'
import {
  LivingSumiContactWash,
  LivingSumiProvider,
  useLivingSumiMaterialAdapter,
} from '../art/v3'
import { FreeRoamRuntimeSystems } from './v2/runtime'
import {
  CinematicNightLayer,
  LeanFreeRoamPlayer,
  NightGardenEnvironment,
  V3_GATE_BRIDGE_ANCHORS,
  V3GateBridgeWorld,
} from './v3'

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

/** Keep the painterly frame crisp without letting retina DPR dominate the budget. */
function AdaptiveQuality() {
  const setDpr = useThree((state) => state.setDpr)
  return (
    <PerformanceMonitor
      bounds={(refreshRate) => [Math.min(40, refreshRate * 0.67), Math.min(56, refreshRate * 0.94)]}
      flipflops={3}
      onDecline={() => setDpr(0.78)}
      onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.18))}
    />
  )
}

function GroundingWashes() {
  return (
    <group name="v3-authored-contact-washes">
      <LivingSumiContactWash
        material={{ feather: 0.72, opacity: 0.22, pigment: 0.72, seed: 1.7 }}
        position={[-2.57, 0.035, 11.7]}
        role="vermilion"
        size={[2.15, 1.48]}
        yaw={0.13}
      />
      <LivingSumiContactWash
        material={{ feather: 0.72, opacity: 0.22, pigment: 0.72, seed: 2.4 }}
        position={[2.56, 0.035, 11.7]}
        role="vermilion"
        size={[2.15, 1.48]}
        yaw={-0.1}
      />
      <LivingSumiContactWash
        material={{ brushScale: 0.18, feather: 0.66, opacity: 0.34, pigment: 0.9, seed: 4.1 }}
        position={[-8.65, 0.04, -6.3]}
        role="pine"
        size={[5.2, 3.35]}
        yaw={0.28}
      />
      <LivingSumiContactWash
        material={{ brushScale: 0.19, feather: 0.62, opacity: 0.3, pigment: 0.82, seed: 5.6 }}
        position={[6.65, 0.04, -0.8]}
        role="stone"
        size={[5.8, 3.8]}
        yaw={-0.24}
      />
      <LivingSumiContactWash
        material={{ feather: 0.68, opacity: 0.2, pigment: 0.84, seed: 6.8 }}
        position={[-7.05, 0.045, -3.4]}
        role="wood"
        size={[3.2, 2.1]}
        yaw={0.08}
      />
      <LivingSumiContactWash
        material={{ feather: 0.68, opacity: 0.2, pigment: 0.84, seed: 7.7 }}
        position={[7.05, 0.045, -3.4]}
        role="wood"
        size={[3.2, 2.1]}
        yaw={-0.1}
      />
    </group>
  )
}

function V3LivingScene({
  active,
  onContextLost,
  onReady,
  reducedMotion,
}: LivingScrollWorldProps) {
  const adapter = useLivingSumiMaterialAdapter({
    fogStrength: 0.92,
    motionStrength: reducedMotion ? 0 : 0.035,
    strokeInfluence: 0.74,
    windAmplitude: reducedMotion ? 0 : 0.1,
  })
  const signalReady = useCallback(() => {
    // The GLB is styled synchronously here; one paint lets the first visible
    // frame arrive complete behind the entry veil.
    requestAnimationFrame(onReady)
  }, [onReady])

  return (
    <>
      <WebGLContextBridge onContextLost={onContextLost} />
      <NightGardenEnvironment reducedMotion={reducedMotion} />
      <V3GateBridgeWorld
        materialAdapter={adapter}
        onAssetReady={signalReady}
        reducedMotion={reducedMotion}
        showMatteCards={false}
        showProjectGarden
      />
      <CinematicNightLayer quality="auto" reducedMotion={reducedMotion} />
      <GroundingWashes />
      <LeanFreeRoamPlayer
        active={active}
        initialCameraPitch={0.08}
        initialCameraYaw={0}
        railProgressDamping={5.1}
        railScrollSensitivity={0.00046}
        railTravelSpeed={5.2}
        spawn={V3_GATE_BRIDGE_ANCHORS.spawn}
      />
      <FreeRoamRuntimeSystems active={active} interactions={false} />
      <AdaptiveQuality />
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
    gl.toneMappingExposure = 0.88
    gl.shadowMap.enabled = false
    gl.setClearColor(ART_PALETTE.nightZenith, 1)
  }, [])

  return (
    <Canvas
      dpr={1}
      flat
      gl={{
        antialias: false,
        alpha: false,
        depth: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        stencil: false,
      }}
      onCreated={handleCreated}
      shadows={false}
    >
      <Suspense fallback={null}>
        <LivingSumiProvider
          fogColor={ART_PALETTE.nightMist}
          fogFar={96}
          fogHeight={2.4}
          fogHeightDensity={0.08}
          fogNear={18}
          fogOpacity={0.44}
          keyDirection={[-0.42, 0.68, -0.6]}
          paperColor={ART_PALETTE.mist}
          reducedMotion={reducedMotion}
        >
          <V3LivingScene
            active={active}
            onContextLost={onContextLost}
            onReady={onReady}
            reducedMotion={reducedMotion}
          />
        </LivingSumiProvider>
      </Suspense>
    </Canvas>
  )
}
