import { PerformanceMonitor, Preload } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Garden } from './Garden'
import { PlayerRig } from './PlayerRig'
import { Sanctuary } from './Sanctuary'
import type { JourneyInputRef, ProgressRef } from './types'

function SkyWash() {
  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color('#9eb9af') },
    middleColor: { value: new THREE.Color('#d7d9c8') },
    bottomColor: { value: new THREE.Color('#eee7d6') },
  }), [])

  return (
    <mesh scale={85}>
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        depthWrite={false}
        fragmentShader={/* glsl */ `
          uniform vec3 topColor;
          uniform vec3 middleColor;
          uniform vec3 bottomColor;
          varying vec3 vWorld;
          void main() {
            float h = normalize(vWorld).y * 0.5 + 0.5;
            vec3 lower = mix(bottomColor, middleColor, smoothstep(0.0, 0.52, h));
            vec3 color = mix(lower, topColor, smoothstep(0.48, 1.0, h));
            gl_FragColor = vec4(color, 1.0);
          }
        `}
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
      />
    </mesh>
  )
}

function PaperGround() {
  return (
    <mesh position={[0, -0.22, -2]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[72, 112, 1, 1]} />
      <meshStandardMaterial color="#c9c5af" roughness={1} />
    </mesh>
  )
}

function LightRig() {
  return (
    <>
      <hemisphereLight color="#fff4d9" groundColor="#43544d" intensity={2.4} />
      <directionalLight
        castShadow
        color="#ffe7bd"
        intensity={3.3}
        position={[-12, 18, 14]}
        shadow-bias={-0.00012}
        shadow-camera-bottom={-22}
        shadow-camera-far={90}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={24}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <pointLight color="#b45e4e" distance={28} intensity={4.2} position={[11, 9, -13]} />
    </>
  )
}

function PigmentSun() {
  return (
    <group position={[11, 12, -33]}>
      <mesh>
        <sphereGeometry args={[3.4, 48, 32]} />
        <meshBasicMaterial color="#ad655b" opacity={0.62} transparent toneMapped={false} />
      </mesh>
      <pointLight color="#ca7767" distance={26} intensity={3} />
    </group>
  )
}

function PerformanceTuner() {
  const setDpr = useThree((state) => state.setDpr)
  return (
    <PerformanceMonitor
      bounds={(refreshRate) => [Math.min(42, refreshRate * 0.7), Math.min(56, refreshRate * 0.93)]}
      flipflops={3}
      onDecline={() => setDpr(1)}
      onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.35))}
    />
  )
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady])
  return null
}

function Scene({
  active,
  inputRef,
  onProgress,
  onReady,
  progressRef,
  reducedMotion,
}: {
  active: boolean
  inputRef: JourneyInputRef
  onProgress: (progress: number) => void
  onReady: () => void
  progressRef: ProgressRef
  reducedMotion: boolean
}) {
  return (
    <>
      <color attach="background" args={['#d8dacb']} />
      <fog attach="fog" args={['#d3d7c9', 21, 76]} />
      <SkyWash />
      <PaperGround />
      <LightRig />
      <PigmentSun />
      <Garden />
      <Sanctuary progressRef={progressRef} />
      <PlayerRig
        active={active}
        inputRef={inputRef}
        onProgress={onProgress}
        progressRef={progressRef}
      />
      {!reducedMotion && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.34} luminanceSmoothing={0.72} luminanceThreshold={0.78} mipmapBlur />
          <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} premultiply />
          <Vignette darkness={0.5} eskil={false} offset={0.18} />
        </EffectComposer>
      )}
      <PerformanceTuner />
      <Preload all />
      <ReadySignal onReady={onReady} />
    </>
  )
}

export function PortfolioWorld({
  active,
  inputRef,
  onContextLost,
  onProgress,
  onReady,
  progressRef,
  reducedMotion,
}: {
  active: boolean
  inputRef: JourneyInputRef
  onContextLost: (lost: boolean) => void
  onProgress: (progress: number) => void
  onReady: () => void
  progressRef: ProgressRef
  reducedMotion: boolean
}) {
  return (
    <Canvas
      camera={{ far: 130, fov: 53, near: 0.08, position: [0, 1.72, 36.5] }}
      dpr={[1, 1.35]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.08
        gl.shadowMap.enabled = true
        gl.domElement.addEventListener('webglcontextlost', () => onContextLost(true))
        gl.domElement.addEventListener('webglcontextrestored', () => onContextLost(false))
      }}
      shadows="basic"
    >
      <Suspense fallback={null}>
        <Scene
          active={active}
          inputRef={inputRef}
          onProgress={onProgress}
          onReady={onReady}
          progressRef={progressRef}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    </Canvas>
  )
}
