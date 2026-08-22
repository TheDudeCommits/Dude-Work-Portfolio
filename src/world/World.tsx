import { PerformanceMonitor, Preload, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { JourneyPlateMaterial } from './materials'
import { PlayerRig } from './PlayerRig'
import { Sanctuary } from './Sanctuary'
import type { JourneyInputRef, ProgressRef } from './types'

const journeyPlates: string[] = [
  '/assets/journey/01-torii-threshold.webp',
  '/assets/journey/02-waterfall-path.webp',
  '/assets/journey/03-koi-fusuma.webp',
  '/assets/journey/04-enso-sanctuary.webp',
]

function PaintedJourney({
  inputRef,
  progressRef,
  reducedMotion,
}: {
  inputRef: JourneyInputRef
  progressRef: ProgressRef
  reducedMotion: boolean
}) {
  const viewport = useThree((state) => state.viewport)
  const loaded = useTexture(journeyPlates) as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture]
  loaded.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
  })

  return (
    <mesh position={[0, 0, 0]} renderOrder={0} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <JourneyPlateMaterial
        inputRef={inputRef}
        progressRef={progressRef}
        reducedMotion={reducedMotion}
        textures={loaded}
      />
    </mesh>
  )
}

const pigmentVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uPixelRatio;
  uniform float uTime;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec3 p = position;
    float fall = uTime * (0.018 + aSeed * 0.028);
    p.y = mod(p.y - fall + 0.5, 1.0) - 0.5;
    p.x += sin(uTime * 0.16 + aSeed * 31.0 + p.y * 8.0) * (0.008 + aSeed * 0.012);
    vColor = color;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (1.4 + aSeed * 4.8) * uPixelRatio;
  }
`

const pigmentFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    p.x *= 0.72 + vSeed * 0.55;
    float alpha = smoothstep(0.5, 0.12, length(p));
    alpha *= 0.22 + vSeed * 0.44;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function PigmentField({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const viewport = useThree((state) => state.viewport)
  const pixelRatio = useThree((state) => state.gl.getPixelRatio())
  const data = useMemo(() => {
    const count = 180
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const palette = ['#151714', '#8d3427', '#9a7432', '#6f8f83'].map((value) => new THREE.Color(value))

    for (let index = 0; index < count; index += 1) {
      const seed = ((index * 47) % 181) / 181
      positions[index * 3] = ((index * 83) % 199) / 199 - 0.5
      positions[index * 3 + 1] = ((index * 113) % 211) / 211 - 0.5
      positions[index * 3 + 2] = 1.25 + seed * 0.18
      const color = palette[index % palette.length]
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
      seeds[index] = seed
    }
    return { colors, positions, seeds }
  }, [])
  const uniforms = useMemo(() => ({
    uPixelRatio: { value: pixelRatio },
    uTime: { value: 0 },
  }), [pixelRatio])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    material.current.uniforms.uPixelRatio.value = pixelRatio
  })

  return (
    <points renderOrder={3} scale={[viewport.width, viewport.height, 1]}>
      <bufferGeometry>
        <bufferAttribute args={[data.positions, 3]} attach="attributes-position" />
        <bufferAttribute args={[data.colors, 3]} attach="attributes-color" />
        <bufferAttribute args={[data.seeds, 1]} attach="attributes-aSeed" />
      </bufferGeometry>
      <shaderMaterial
        blending={THREE.NormalBlending}
        depthTest={false}
        depthWrite={false}
        fragmentShader={pigmentFragment}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexColors
        vertexShader={pigmentVertex}
      />
    </points>
  )
}

function PerformanceTuner() {
  const setDpr = useThree((state) => state.setDpr)
  return (
    <PerformanceMonitor
      bounds={(refreshRate) => [Math.min(42, refreshRate * 0.7), Math.min(56, refreshRate * 0.93)]}
      flipflops={3}
      onDecline={() => setDpr(1)}
      onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.5))}
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
      <PaintedJourney inputRef={inputRef} progressRef={progressRef} reducedMotion={reducedMotion} />
      <PigmentField reducedMotion={reducedMotion} />
      <Sanctuary progressRef={progressRef} />
      <PlayerRig active={active} inputRef={inputRef} onProgress={onProgress} progressRef={progressRef} />
      {!reducedMotion && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.42} luminanceSmoothing={0.78} luminanceThreshold={0.84} mipmapBlur />
          <Vignette darkness={0.36} eskil={false} offset={0.2} />
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
      camera={{ far: 20, near: 0.1, position: [0, 0, 10], zoom: 100 }}
      dpr={[1, 1.5]}
      flat
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.NoToneMapping
        gl.domElement.addEventListener('webglcontextlost', () => onContextLost(true))
        gl.domElement.addEventListener('webglcontextrestored', () => onContextLost(false))
      }}
      orthographic
    >
      <color args={['#14130f']} attach="background" />
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
