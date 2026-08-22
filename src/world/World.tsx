import { Environment, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Outline, Select, Selection, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GardenArchitecture } from './Architecture'
import { LivingInkEffect } from './LivingInkEffect'
import { LivingGarden } from './Nature'
import { PlayerRig } from './PlayerRig'
import { Sanctuary } from './Sanctuary'
import type { JourneyInputRef, ProgressRef } from './types'

const skyVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const skyFragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += noise(p) * a;
      p = p * 2.02 + vec2(17.3, 9.2);
      a *= 0.5;
    }
    return v;
  }
  void main() {
    vec3 direction = normalize(vWorld - cameraPosition);
    float height = direction.y * 0.5 + 0.5;
    vec3 low = vec3(0.075, 0.11, 0.09);
    vec3 middle = vec3(0.27, 0.31, 0.26);
    vec3 high = vec3(0.42, 0.38, 0.30);
    vec3 color = mix(low, middle, smoothstep(0.16, 0.56, height));
    color = mix(color, high, smoothstep(0.58, 0.94, height));
    vec2 cloudUv = direction.xz * 2.4 / max(direction.y + 0.34, 0.12);
    float cloud = fbm(cloudUv + vec2(uTime * 0.004, -uTime * 0.002));
    float inkCloud = smoothstep(0.48, 0.78, cloud) * smoothstep(0.08, 0.62, height);
    color = mix(color, vec3(0.075, 0.105, 0.085), inkCloud * 0.42);
    float glow = pow(max(dot(direction, normalize(vec3(-0.36, 0.72, -0.44))), 0.0), 72.0);
    color += vec3(0.48, 0.24, 0.065) * glow * 0.28;
    gl_FragColor = vec4(color, 1.0);
  }
`

function LivingSky({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })
  return (
    <mesh frustumCulled={false} scale={105}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        depthWrite={false}
        fragmentShader={skyFragment}
        ref={material}
        side={THREE.BackSide}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={skyVertex}
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
    p.y = mod(p.y - uTime * (0.035 + aSeed * 0.05), 18.0);
    p.x += sin(uTime * 0.22 + p.y * 0.31 + aSeed * 18.0) * (0.08 + aSeed * 0.14);
    vColor = color;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.2 + aSeed * 3.4) * uPixelRatio * (95.0 / max(-mv.z, 1.0));
  }
`

const pigmentFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    p.x *= 0.72 + vSeed * 0.5;
    float alpha = smoothstep(0.5, 0.1, length(p)) * (0.15 + vSeed * 0.32);
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function WorldPigment({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((state) => state.gl.getPixelRatio())
  const attributes = useMemo(() => {
    const count = 360
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const palette = ['#1b201b', '#a84431', '#b58a43', '#b9c8b6'].map((value) => new THREE.Color(value))
    for (let index = 0; index < count; index += 1) {
      const seed = ((index * 73) % 367) / 367
      positions[index * 3] = (((index * 97) % 359) / 359 - 0.5) * 44
      positions[index * 3 + 1] = (((index * 137) % 347) / 347) * 18
      positions[index * 3 + 2] = 40 - (((index * 181) % 353) / 353) * 112
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
    <points frustumCulled={false} renderOrder={8}>
      <bufferGeometry>
        <bufferAttribute args={[attributes.positions, 3]} attach="attributes-position" />
        <bufferAttribute args={[attributes.colors, 3]} attach="attributes-color" />
        <bufferAttribute args={[attributes.seeds, 1]} attach="attributes-aSeed" />
      </bufferGeometry>
      <shaderMaterial
        blending={THREE.NormalBlending}
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

function LightRig() {
  return (
    <>
      <hemisphereLight color="#eadfbe" groundColor="#18211d" intensity={0.72} />
      <directionalLight
        castShadow
        color="#f2cf98"
        intensity={1.72}
        position={[-18, 26, 22]}
        shadow-bias={-0.00012}
        shadow-camera-bottom={-24}
        shadow-camera-far={115}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={26}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <directionalLight color="#668b82" intensity={0.34} position={[16, 11, -34]} />
    </>
  )
}

function PerformanceTuner() {
  const setDpr = useThree((state) => state.setDpr)
  return (
    <PerformanceMonitor
      bounds={(refreshRate) => [Math.min(39, refreshRate * 0.64), Math.min(55, refreshRate * 0.92)]}
      flipflops={3}
      onDecline={() => setDpr(0.85)}
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
      <LivingSky reducedMotion={reducedMotion} />
      <Environment background={false} environmentIntensity={0.22} files="/assets/environment/ninomaru-teien-1k.hdr" />
      <LightRig />
      <Selection>
        <Select enabled>
          <LivingGarden reducedMotion={reducedMotion} />
          <GardenArchitecture progressRef={progressRef} />
          <Sanctuary progressRef={progressRef} reducedMotion={reducedMotion} />
        </Select>
        {!reducedMotion && (
          <EffectComposer multisampling={0}>
            <Outline
              blur
              edgeStrength={1.35}
              hiddenEdgeColor={0x4a4032}
              pulseSpeed={0}
              visibleEdgeColor={0x1c1b17}
              width={720}
              xRay={false}
            />
            <LivingInkEffect />
            <Bloom intensity={0.34} luminanceSmoothing={0.76} luminanceThreshold={1.05} mipmapBlur />
            <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.075} premultiply />
            <Vignette darkness={0.32} eskil={false} offset={0.2} />
          </EffectComposer>
        )}
      </Selection>
      <WorldPigment reducedMotion={reducedMotion} />
      <PlayerRig active={active} inputRef={inputRef} onProgress={onProgress} progressRef={progressRef} reducedMotion={reducedMotion} />
      <PerformanceTuner />
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
      camera={{ far: 150, fov: 51, near: 0.06, position: [0, 1.72, 38] }}
      dpr={[0.85, 1.5]}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl, scene }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.86
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.VSMShadowMap
        scene.fog = new THREE.FogExp2('#6f7d72', 0.009)
        gl.domElement.addEventListener('webglcontextlost', () => onContextLost(true))
        gl.domElement.addEventListener('webglcontextrestored', () => onContextLost(false))
      }}
      shadows
    >
      <color args={['#59675e']} attach="background" />
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
