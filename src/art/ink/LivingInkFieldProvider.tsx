import { useFrame, useThree } from '@react-three/fiber'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { ART_PALETTE, ART_RUNTIME } from '../artTokens'

const MAX_INK_EVENTS = ART_RUNTIME.maxInkEventsPerFrame

const fullscreenVertexShader = /* glsl */ `
  varying vec2 vInkUv;

  void main() {
    vInkUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const inkSimulationFragmentShader = /* glsl */ `
  precision highp float;

  #define MAX_INK_EVENTS ${MAX_INK_EVENTS}

  uniform float uDelta;
  uniform int uEventCount;
  uniform vec4 uEventData[MAX_INK_EVENTS];
  uniform vec4 uEventPayload[MAX_INK_EVENTS];
  uniform float uMotion;
  uniform sampler2D uPrevious;
  uniform vec2 uTexel;
  uniform vec2 uWorldSize;
  varying vec2 vInkUv;

  void main() {
    vec4 center = texture2D(uPrevious, vInkUv);
    vec4 north = texture2D(uPrevious, vInkUv + vec2(0.0, uTexel.y));
    vec4 south = texture2D(uPrevious, vInkUv - vec2(0.0, uTexel.y));
    vec4 east = texture2D(uPrevious, vInkUv + vec2(uTexel.x, 0.0));
    vec4 west = texture2D(uPrevious, vInkUv - vec2(uTexel.x, 0.0));

    vec4 neighbours = (north + south + east + west) * 0.25;
    float diffusion = (0.11 + center.g * 0.34) * uMotion;
    vec4 nextField = mix(center, neighbours, min(diffusion * uDelta * 8.0, 0.38));
    nextField.r = max(0.0, nextField.r - uDelta * mix(0.004, 0.016, 1.0 - nextField.g));
    nextField.g = max(0.0, nextField.g - uDelta * 0.026);
    nextField.b *= exp(-uDelta * 1.85);
    nextField.a = min(1.0, nextField.a + uDelta * 0.075);

    for (int index = 0; index < MAX_INK_EVENTS; index += 1) {
      if (index >= uEventCount) break;
      vec4 eventData = uEventData[index];
      vec2 worldDelta = (vInkUv - eventData.xy) * uWorldSize;
      float falloff = 1.0 - smoothstep(0.0, eventData.z, length(worldDelta));
      falloff = falloff * falloff * eventData.w;
      vec4 payload = uEventPayload[index];
      nextField.r = max(nextField.r, payload.r * falloff);
      nextField.g = max(nextField.g, payload.g * falloff);
      nextField.b = max(nextField.b, payload.b * falloff);
      nextField.a = mix(nextField.a, 0.0, payload.a * falloff);
    }

    gl_FragColor = clamp(nextField, 0.0, 1.0);
  }
`

export type InkWorldPosition = THREE.Vector3 | readonly [x: number, y: number, z: number]

export interface LivingInkEvent {
  ageReset?: number
  disturbance?: number
  pigment?: number
  position: InkWorldPosition
  radius?: number
  strength?: number
  wetness?: number
}

export interface LivingInkFieldUniforms {
  uInkBounds: THREE.Uniform<THREE.Vector4>
  uInkField: THREE.Uniform<THREE.Texture>
}

interface LivingInkFieldContextValue {
  bounds: readonly [minX: number, minZ: number, maxX: number, maxZ: number]
  clearInk: () => void
  emitInk: (event: LivingInkEvent) => void
  uniforms: LivingInkFieldUniforms
  worldToUv: (position: InkWorldPosition, target?: THREE.Vector2) => THREE.Vector2
}

interface InkSimulationResources {
  camera: THREE.OrthographicCamera
  eventData: THREE.Vector4[]
  eventPayload: THREE.Vector4[]
  geometry: THREE.PlaneGeometry
  material: THREE.ShaderMaterial
  read: THREE.WebGLRenderTarget
  scene: THREE.Scene
  write: THREE.WebGLRenderTarget
}

const LivingInkFieldContext = createContext<LivingInkFieldContextValue | null>(null)

function createInkTarget(resolution: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(resolution, resolution, {
    depthBuffer: false,
    format: THREE.RGBAFormat,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    stencilBuffer: false,
    type: THREE.HalfFloatType,
  })
  target.texture.colorSpace = THREE.NoColorSpace
  target.texture.generateMipmaps = false
  return target
}

function createInkSimulation(resolution: number, width: number, depth: number): InkSimulationResources {
  const read = createInkTarget(resolution)
  const write = createInkTarget(resolution)
  const eventData = Array.from({ length: MAX_INK_EVENTS }, () => new THREE.Vector4())
  const eventPayload = Array.from({ length: MAX_INK_EVENTS }, () => new THREE.Vector4())
  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: inkSimulationFragmentShader,
    toneMapped: false,
    uniforms: {
      uDelta: new THREE.Uniform(0),
      uEventCount: new THREE.Uniform(0),
      uEventData: new THREE.Uniform(eventData),
      uEventPayload: new THREE.Uniform(eventPayload),
      uMotion: new THREE.Uniform(1),
      uPrevious: new THREE.Uniform(read.texture),
      uTexel: new THREE.Uniform(new THREE.Vector2(1 / resolution, 1 / resolution)),
      uWorldSize: new THREE.Uniform(new THREE.Vector2(width, depth)),
    },
    vertexShader: fullscreenVertexShader,
  })
  const scene = new THREE.Scene()
  const simulationMesh = new THREE.Mesh(geometry, material)
  simulationMesh.frustumCulled = false
  scene.add(simulationMesh)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
  camera.position.z = 1

  return {
    camera,
    eventData,
    eventPayload,
    geometry,
    material,
    read,
    scene,
    write,
  }
}

function positionComponents(position: InkWorldPosition): readonly [number, number] {
  return position instanceof THREE.Vector3 ? [position.x, position.z] : [position[0], position[2]]
}

export interface LivingInkFieldProviderProps {
  bounds?: readonly [minX: number, minZ: number, maxX: number, maxZ: number]
  children: ReactNode
  resolution?: number
}

export function LivingInkFieldProvider({
  bounds = [-42, -70, 42, 42],
  children,
  resolution = ART_RUNTIME.inkResolution,
}: LivingInkFieldProviderProps) {
  const gl = useThree((state) => state.gl)
  const { reducedMotion } = useArtDirector()
  const queue = useRef<LivingInkEvent[]>([])
  const clearRequested = useRef(true)
  const minX = bounds[0]
  const minZ = bounds[1]
  const width = Math.max(bounds[2] - minX, 0.001)
  const depth = Math.max(bounds[3] - minZ, 0.001)
  const resources = useMemo(
    () => createInkSimulation(Math.max(32, Math.round(resolution)), width, depth),
    [depth, resolution, width],
  )

  const uniforms = useMemo<LivingInkFieldUniforms>(() => ({
    uInkBounds: new THREE.Uniform(new THREE.Vector4(minX, minZ, 1 / width, 1 / depth)),
    uInkField: new THREE.Uniform(resources.read.texture),
  }), [depth, minX, minZ, resources, width])

  const worldToUv = useCallback((position: InkWorldPosition, target = new THREE.Vector2()) => {
    const [x, z] = positionComponents(position)
    return target.set((x - minX) / width, (z - minZ) / depth)
  }, [depth, minX, minZ, width])

  const emitInk = useCallback((event: LivingInkEvent) => {
    const nextQueue = queue.current
    if (nextQueue.length >= ART_RUNTIME.maxQueuedInkEvents) nextQueue.shift()
    nextQueue.push(event)
  }, [])

  const clearInk = useCallback(() => {
    queue.current.length = 0
    clearRequested.current = true
  }, [])

  useEffect(() => () => {
    resources.geometry.dispose()
    resources.material.dispose()
    resources.read.dispose()
    resources.write.dispose()
  }, [resources])

  useFrame((_, delta) => {
    const previousTarget = gl.getRenderTarget()
    const previousClearColor = gl.getClearColor(new THREE.Color())
    const previousClearAlpha = gl.getClearAlpha()

    if (clearRequested.current) {
      gl.setClearColor(ART_PALETTE.inkFieldClear, 0)
      gl.setRenderTarget(resources.read)
      gl.clear(true, false, false)
      gl.setRenderTarget(resources.write)
      gl.clear(true, false, false)
      clearRequested.current = false
    }

    const batch = queue.current.splice(0, MAX_INK_EVENTS)
    for (let index = 0; index < MAX_INK_EVENTS; index += 1) {
      const data = resources.eventData[index]
      const payload = resources.eventPayload[index]
      const event = batch[index]
      if (!event) {
        data.set(0, 0, 0, 0)
        payload.set(0, 0, 0, 0)
        continue
      }
      const uv = worldToUv(event.position)
      data.set(
        uv.x,
        uv.y,
        Math.max(event.radius ?? 1.8, 0.01),
        THREE.MathUtils.clamp(event.strength ?? 1, 0, 1),
      )
      payload.set(
        THREE.MathUtils.clamp(event.pigment ?? 0.8, 0, 1),
        THREE.MathUtils.clamp(event.wetness ?? 0.72, 0, 1),
        THREE.MathUtils.clamp(event.disturbance ?? 0.55, 0, 1),
        THREE.MathUtils.clamp(event.ageReset ?? 1, 0, 1),
      )
    }

    resources.material.uniforms.uPrevious.value = resources.read.texture
    resources.material.uniforms.uDelta.value = Math.min(delta, 1 / 20)
    resources.material.uniforms.uEventCount.value = batch.length
    resources.material.uniforms.uMotion.value = reducedMotion ? 0.18 : 1
    gl.setRenderTarget(resources.write)
    gl.render(resources.scene, resources.camera)

    const previousRead = resources.read
    resources.read = resources.write
    resources.write = previousRead
    uniforms.uInkField.value = resources.read.texture

    gl.setRenderTarget(previousTarget)
    gl.setClearColor(previousClearColor, previousClearAlpha)
  }, -100)

  const value = useMemo<LivingInkFieldContextValue>(() => ({
    bounds,
    clearInk,
    emitInk,
    uniforms,
    worldToUv,
  }), [bounds, clearInk, emitInk, uniforms, worldToUv])

  return <LivingInkFieldContext.Provider value={value}>{children}</LivingInkFieldContext.Provider>
}

export function useLivingInkField(): LivingInkFieldContextValue {
  const value = useContext(LivingInkFieldContext)
  if (!value) throw new Error('useLivingInkField must be used inside LivingInkFieldProvider')
  return value
}
