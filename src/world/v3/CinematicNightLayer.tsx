import { useFrame, useThree } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactElement,
} from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../../art'

const MAX_LOCAL_LANTERNS = 4
const LIGHT_PATCH_DECLARATION_MARKER = 'uniform float uWeathering;'
const LIGHT_PATCH_BODY_MARKER = 'float depthFog = smoothstep'
const LIGHT_PATCH_FLAG = 'cinematicNightLightPatchV1'
const DEFAULT_MOON_POSITION = [31, 27, -62] as const
const DEFAULT_WATER_REFLECTION_ORIGIN = [1.15, -0.101, 1.2] as const

const DEFAULT_LANTERNS = [
  { intensity: 0.82, phase: 0.13, poolY: 0.045, position: [-1.72, 2.72, 11.24], radius: 5.2, size: 0.7 },
  { intensity: 0.82, phase: 0.61, poolY: 0.045, position: [1.72, 2.72, 11.24], radius: 5.2, size: 0.7 },
  { intensity: 0.68, phase: 0.34, poolY: -0.095, position: [-5.78, 1.14, -3.06], radius: 4.6, size: 0.58 },
  { intensity: 0.68, phase: 0.87, poolY: -0.095, position: [5.78, 1.14, -3.06], radius: 4.6, size: 0.58 },
] as const satisfies readonly CinematicLantern[]

const LOCAL_LIGHT_DECLARATIONS = /* glsl */ `
  uniform vec4 uNightLanternLights[${MAX_LOCAL_LANTERNS}];
  uniform vec4 uNightLanternParams[${MAX_LOCAL_LANTERNS}];
  uniform vec3 uNightLanternColor;
  uniform vec3 uNightMoonColor;
  uniform vec3 uNightMoonPosition;
  uniform vec3 uNightWaterReflectionOrigin;
  uniform float uNightMoonIntensity;
  uniform float uNightTime;
`

const LOCAL_LIGHT_BODY = /* glsl */ `
    vec3 nightLocalLight = vec3(0.0);
    for (int nightLightIndex = 0; nightLightIndex < ${MAX_LOCAL_LANTERNS}; nightLightIndex++) {
      vec4 nightLight = uNightLanternLights[nightLightIndex];
      vec3 nightToLight = nightLight.xyz - vSumiWorldPosition;
      float nightLightDistance = length(nightToLight);
      float nightLightRadius = max(0.001, nightLight.w);
      float nightAttenuation = 1.0 - smoothstep(
        nightLightRadius * 0.08,
        nightLightRadius,
        nightLightDistance
      );
      vec3 nightLightDirection = nightToLight / max(nightLightDistance, 0.001);
      float nightFacing = 0.24 + max(dot(worldNormal, nightLightDirection), 0.0) * 0.76;
      float nightLanternPulse = 0.96 + sin(
        uNightTime * 0.47 + uNightLanternParams[nightLightIndex].y * 6.2831853
      ) * 0.04;
      nightLocalLight += uNightLanternColor
        * nightAttenuation
        * nightFacing
        * uNightLanternParams[nightLightIndex].x
        * nightLanternPulse;
    }

    vec3 nightMoonDirection = normalize(uNightMoonPosition - vSumiWorldPosition);
    float nightMoonFacing = smoothstep(-0.18, 0.82, dot(worldNormal, nightMoonDirection));
    float nightMoonRim = pow(
      clamp(1.0 - abs(dot(worldNormal, viewDirection)), 0.0, 1.0),
      2.35
    );
    vec3 nightMoonLight = uNightMoonColor
      * (nightMoonFacing * 0.1 + nightMoonRim * 0.2)
      * uNightMoonIntensity;

    pigmentColor += nightLocalLight * (0.16 + uLightResponse * 0.22);
    pigmentColor += nightMoonLight * (0.32 + uLightResponse * 0.16);

    if (uWaterFlow > 0.5) {
      vec2 nightReflectionDelta = vSumiWorldPosition.xz - uNightWaterReflectionOrigin.xz;
      float nightReflectionWidth = exp(-abs(nightReflectionDelta.x) * 0.78);
      float nightReflectionLength = 1.0 - smoothstep(1.6, 10.5, abs(nightReflectionDelta.y));
      float nightReflectionBreak = sin(
        nightReflectionDelta.y * 5.8
        + sin(nightReflectionDelta.x * 3.7) * 1.6
        - uNightTime * 0.18
      ) * 0.5 + 0.5;
      float nightReflection = nightReflectionWidth
        * nightReflectionLength
        * smoothstep(0.42, 0.9, nightReflectionBreak);
      pigmentColor += uNightMoonColor * nightReflection * uNightMoonIntensity * 0.16;
      pigmentColor += nightLocalLight * paintedWaterBand * 0.1;
    }
`

const lanternVertexShader = /* glsl */ `
  attribute float aIntensity;
  attribute float aPhase;
  attribute float aSize;
  uniform float uMotion;
  uniform float uTime;
  varying float vIntensity;
  varying float vPhase;

  void main() {
    vec3 animated = position;
    animated.x += sin(uTime * 0.31 + aPhase * 11.0) * 0.045 * uMotion;
    animated.y += sin(uTime * 0.23 + aPhase * 17.0) * 0.025 * uMotion;
    vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * (430.0 / max(2.0, -viewPosition.z)), 10.0, 58.0);
    vIntensity = aIntensity;
    vPhase = aPhase;
  }
`

const lanternFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uMotion;
  uniform float uTime;
  varying float vIntensity;
  varying float vPhase;

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    vec2 lanternPoint = vec2(point.x * 1.7, point.y * 0.78);
    float angle = atan(lanternPoint.y, lanternPoint.x);
    float ragged = 1.0 + sin(angle * 7.0 + vPhase * 19.0) * 0.055;
    float distanceToCenter = length(lanternPoint) * ragged;
    float haze = 1.0 - smoothstep(0.08, 1.0, distanceToCenter);
    float core = 1.0 - smoothstep(0.0, 0.24, distanceToCenter);
    float paperBand = 0.82 + sin(point.y * 13.0 + vPhase * 9.0) * 0.18;
    float breath = mix(1.0, 0.94 + sin(uTime * 0.47 + vPhase * 6.2831853) * 0.06, uMotion);
    float alpha = (haze * 0.24 + core * 0.72) * paperBand * vIntensity * breath;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(uColor * (0.78 + core * 0.62), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const poolVertexShader = /* glsl */ `
  varying vec2 vPoolUv;
  varying vec3 vPoolWorld;

  void main() {
    vPoolUv = uv;
    vec4 localPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif
    vec4 worldPosition = modelMatrix * localPosition;
    vPoolWorld = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const poolFragmentShader = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uWarm;
  uniform float uMotion;
  uniform float uTime;
  varying vec2 vPoolUv;
  varying vec3 vPoolWorld;

  float poolHash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 centered = vPoolUv - 0.5;
    float angle = atan(centered.y, centered.x);
    float radial = length(centered) * 2.0;
    float paper = poolHash(floor(vPoolWorld.xz * 19.0));
    float ragged = radial * (1.0 + sin(angle * 9.0 + paper * 5.0) * 0.08);
    float outer = 1.0 - smoothstep(0.48, 1.0, ragged);
    float center = 1.0 - smoothstep(0.0, 0.58, ragged);
    float ring = smoothstep(0.48, 0.72, ragged) * (1.0 - smoothstep(0.72, 0.98, ragged));
    float breath = mix(1.0, 0.96 + sin(uTime * 0.31 + paper * 7.0) * 0.04, uMotion);
    vec3 color = mix(uInk, uWarm, center * 0.86);
    float alpha = (outer * 0.045 + center * 0.115 + ring * 0.028) * breath;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const reflectionVertexShader = /* glsl */ `
  attribute float aIntensity;
  attribute float aKind;
  attribute float aPhase;
  varying float vIntensity;
  varying float vKind;
  varying float vPhase;
  varying vec2 vReflectionUv;

  void main() {
    vIntensity = aIntensity;
    vKind = aKind;
    vPhase = aPhase;
    vReflectionUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const reflectionFragmentShader = /* glsl */ `
  uniform vec3 uMoonColor;
  uniform vec3 uWarmColor;
  uniform float uMotion;
  uniform float uTime;
  varying float vIntensity;
  varying float vKind;
  varying float vPhase;
  varying vec2 vReflectionUv;

  float reflectionHash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32 + vPhase);
    return fract(point.x * point.y);
  }

  void main() {
    vec2 centered = vReflectionUv - 0.5;
    float width = 1.0 - smoothstep(0.04, 0.5, abs(centered.x));
    float lengthFade = sin(vReflectionUv.y * 3.14159265);
    float band = sin(vReflectionUv.y * 74.0 + centered.x * 9.0 + vPhase * 13.0
      - uTime * 0.28 * uMotion) * 0.5 + 0.5;
    float dry = reflectionHash(floor(vReflectionUv * vec2(43.0, 61.0)));
    float brokenBand = smoothstep(0.46, 0.88, band * 0.72 + dry * 0.28);
    float alpha = width * lengthFade * brokenBand * vIntensity * 0.19;
    if (alpha < 0.01) discard;
    vec3 color = mix(uMoonColor, uWarmColor, step(0.5, vKind));
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const fullscreenVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const bloomExtractFragmentShader = /* glsl */ `
  uniform sampler2D uSource;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(uSource, vUv).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float warm = smoothstep(0.04, 0.42, color.r - color.b * 0.72);
    float gold = smoothstep(0.02, 0.34, min(color.r, color.g) - color.b * 0.6);
    float brightness = smoothstep(0.5, 0.94, luma) + warm * 0.28 + gold * 0.22;
    gl_FragColor = vec4(color * clamp(brightness, 0.0, 1.0), 1.0);
  }
`

const bloomBlurFragmentShader = /* glsl */ `
  uniform vec2 uDirection;
  uniform sampler2D uSource;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(uSource, vUv).rgb * 0.227027;
    color += texture2D(uSource, vUv + uDirection * 1.384615).rgb * 0.316216;
    color += texture2D(uSource, vUv - uDirection * 1.384615).rgb * 0.316216;
    color += texture2D(uSource, vUv + uDirection * 3.230769).rgb * 0.070270;
    color += texture2D(uSource, vUv - uDirection * 3.230769).rgb * 0.070270;
    gl_FragColor = vec4(color, 1.0);
  }
`

const compositeFragmentShader = /* glsl */ `
  uniform sampler2D uBloom;
  uniform sampler2D uDepth;
  uniform sampler2D uScene;
  uniform vec3 uGold;
  uniform vec3 uIndigo;
  uniform vec3 uMist;
  uniform vec3 uVermilion;
  uniform vec3 uWarm;
  uniform float uBloomStrength;
  uniform float uCameraFar;
  uniform float uCameraNear;
  uniform float uDepthMistStrength;
  uniform float uGrainStrength;
  uniform float uTime;
  uniform float uVignetteStrength;
  varying vec2 vUv;

  float compositeHash(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float perspectiveDepthToDistance(float depth) {
    return (uCameraNear * uCameraFar)
      / max(0.00001, uCameraFar - depth * (uCameraFar - uCameraNear));
  }

  void main() {
    vec3 source = texture2D(uScene, vUv).rgb;
    vec3 bloom = texture2D(uBloom, vUv).rgb;
    float luma = dot(source, vec3(0.2126, 0.7152, 0.0722));

    vec3 monochrome = vec3(luma);
    vec3 graded = mix(monochrome, source, 0.82);
    float vermilionHold = 1.0 - smoothstep(0.12, 0.58, distance(source, uVermilion));
    float goldHold = 1.0 - smoothstep(0.1, 0.54, distance(source, uGold));
    graded = mix(graded, source, max(vermilionHold, goldHold) * 0.72);
    graded = mix(graded, graded * uIndigo * 2.15, (1.0 - smoothstep(0.04, 0.42, luma)) * 0.12);
    graded += bloom * uBloomStrength * mix(uWarm, vec3(1.0), 0.38);

    float rawDepth = texture2D(uDepth, vUv).r;
    float viewDistance = perspectiveDepthToDistance(rawDepth);
    float depthMist = smoothstep(uCameraFar * 0.18, uCameraFar * 0.72, viewDistance)
      * (1.0 - step(0.9996, rawDepth));
    graded = mix(graded, uMist, depthMist * uDepthMistStrength);

    vec2 vignettePoint = vUv * 2.0 - 1.0;
    vignettePoint.x *= 0.82;
    float vignette = smoothstep(0.42, 1.28, dot(vignettePoint, vignettePoint));
    graded *= 1.0 - vignette * uVignetteStrength;

    float grain = compositeHash(floor(gl_FragCoord.xy * vec2(0.5, 0.25)) + floor(uTime * 7.0));
    float fibre = sin(gl_FragCoord.y * 0.91 + sin(gl_FragCoord.x * 0.071) * 2.3);
    graded += ((grain - 0.5) * 0.78 + fibre * 0.08)
      * uGrainStrength
      * (0.36 + luma * 0.64);

    gl_FragColor = vec4(max(graded, vec3(0.0)), 1.0);
    #include <colorspace_fragment>
  }
`

export type CinematicNightQuality = 'auto' | 'high' | 'low' | 'medium'

export interface CinematicLantern {
  intensity?: number
  phase?: number
  poolY?: number
  position: readonly [x: number, y: number, z: number]
  radius?: number
  size?: number
}

export interface CinematicNightLayerProps {
  composite?: boolean
  enabled?: boolean
  lanterns?: readonly CinematicLantern[]
  moonPosition?: readonly [x: number, y: number, z: number]
  quality?: CinematicNightQuality
  reducedMotion?: boolean
  showLanternWisps?: boolean
  waterReflectionOrigin?: readonly [x: number, y: number, z: number]
}

interface NormalizedLantern {
  intensity: number
  phase: number
  poolY: number
  position: readonly [number, number, number]
  radius: number
  size: number
}

interface NightLightUniforms {
  uNightLanternColor: THREE.Uniform<THREE.Color>
  uNightLanternLights: THREE.Uniform<THREE.Vector4[]>
  uNightLanternParams: THREE.Uniform<THREE.Vector4[]>
  uNightMoonColor: THREE.Uniform<THREE.Color>
  uNightMoonIntensity: THREE.Uniform<number>
  uNightMoonPosition: THREE.Uniform<THREE.Vector3>
  uNightTime: THREE.Uniform<number>
  uNightWaterReflectionOrigin: THREE.Uniform<THREE.Vector3>
}

interface QualityProfile {
  bloomScale: number
  bloomStrength: number
  depthMistStrength: number
  grainStrength: number
  sceneScale: number
  vignetteStrength: number
}

const QUALITY_PROFILES = {
  high: {
    bloomScale: 0.42,
    bloomStrength: 0.62,
    depthMistStrength: 0.18,
    grainStrength: 0.014,
    sceneScale: 1,
    vignetteStrength: 0.24,
  },
  low: {
    bloomScale: 0.22,
    bloomStrength: 0.42,
    depthMistStrength: 0.11,
    grainStrength: 0.009,
    sceneScale: 0.72,
    vignetteStrength: 0.18,
  },
  medium: {
    bloomScale: 0.32,
    bloomStrength: 0.54,
    depthMistStrength: 0.15,
    grainStrength: 0.012,
    sceneScale: 0.86,
    vignetteStrength: 0.21,
  },
} as const satisfies Record<Exclude<CinematicNightQuality, 'auto'>, QualityProfile>

function normalizedLanterns(lanterns: readonly CinematicLantern[]): NormalizedLantern[] {
  return lanterns.slice(0, MAX_LOCAL_LANTERNS).map((lantern, index) => ({
    intensity: THREE.MathUtils.clamp(lantern.intensity ?? 0.72, 0, 2),
    phase: lantern.phase ?? index / Math.max(1, lanterns.length),
    poolY: lantern.poolY ?? 0.045,
    position: lantern.position,
    radius: Math.max(0.1, lantern.radius ?? 4.8),
    size: Math.max(0.08, lantern.size ?? 0.62),
  }))
}

function useNightLightUniforms(
  lanterns: readonly NormalizedLantern[],
  moonPosition: readonly [number, number, number],
  waterReflectionOrigin: readonly [number, number, number],
) {
  const uniforms = useMemo<NightLightUniforms>(() => ({
    uNightLanternColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.lanternAmber)),
    uNightLanternLights: new THREE.Uniform(Array.from(
      { length: MAX_LOCAL_LANTERNS },
      () => new THREE.Vector4(),
    )),
    uNightLanternParams: new THREE.Uniform(Array.from(
      { length: MAX_LOCAL_LANTERNS },
      () => new THREE.Vector4(),
    )),
    uNightMoonColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.coolLight)),
    uNightMoonIntensity: new THREE.Uniform(0.94),
    uNightMoonPosition: new THREE.Uniform(new THREE.Vector3()),
    uNightTime: new THREE.Uniform(0),
    uNightWaterReflectionOrigin: new THREE.Uniform(new THREE.Vector3()),
  }), [])

  useLayoutEffect(() => {
    uniforms.uNightMoonPosition.value.set(...moonPosition)
    uniforms.uNightWaterReflectionOrigin.value.set(...waterReflectionOrigin)
    for (let index = 0; index < MAX_LOCAL_LANTERNS; index += 1) {
      const lantern = lanterns[index]
      if (lantern) {
        uniforms.uNightLanternLights.value[index].set(
          lantern.position[0],
          lantern.position[1],
          lantern.position[2],
          lantern.radius,
        )
        uniforms.uNightLanternParams.value[index].set(lantern.intensity, lantern.phase, 0, 0)
      } else {
        uniforms.uNightLanternLights.value[index].set(0, -1000, 0, 0.001)
        uniforms.uNightLanternParams.value[index].set(0, 0, 0, 0)
      }
    }
  }, [lanterns, moonPosition, uniforms, waterReflectionOrigin])

  return uniforms
}

function useLivingSumiNightLightPatch(
  uniforms: NightLightUniforms,
  enabled: boolean,
  reducedMotion: boolean,
) {
  const scene = useThree((state) => state.scene)
  const originals = useRef(new Map<THREE.ShaderMaterial, string>())
  const nextScanAt = useRef(0)

  const patchMaterial = useCallback((material: THREE.Material) => {
    if (!(material instanceof THREE.ShaderMaterial)) return
    if (material.userData[LIGHT_PATCH_FLAG] === true) return
    if (!material.userData.livingSumi) return
    if (
      !material.fragmentShader.includes(LIGHT_PATCH_DECLARATION_MARKER)
      || !material.fragmentShader.includes(LIGHT_PATCH_BODY_MARKER)
    ) return

    originals.current.set(material, material.fragmentShader)
    material.fragmentShader = material.fragmentShader
      .replace(
        LIGHT_PATCH_DECLARATION_MARKER,
        `${LIGHT_PATCH_DECLARATION_MARKER}\n${LOCAL_LIGHT_DECLARATIONS}`,
      )
      .replace(LIGHT_PATCH_BODY_MARKER, `${LOCAL_LIGHT_BODY}\n    ${LIGHT_PATCH_BODY_MARKER}`)
    Object.assign(material.uniforms, uniforms)
    material.userData[LIGHT_PATCH_FLAG] = true
    material.needsUpdate = true
  }, [uniforms])

  const patchObject = useCallback((object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach(patchMaterial)
  }, [patchMaterial])

  const scan = useCallback(() => {
    if (enabled) scene.traverse(patchObject)
  }, [enabled, patchObject, scene])

  const restore = useCallback(() => {
    originals.current.forEach((fragmentShader, material) => {
      material.fragmentShader = fragmentShader
      delete material.userData[LIGHT_PATCH_FLAG]
      for (const uniformName of Object.keys(uniforms)) delete material.uniforms[uniformName]
      material.needsUpdate = true
    })
    originals.current.clear()
  }, [uniforms])

  useLayoutEffect(scan, [scan])

  useEffect(() => {
    if (!enabled) restore()
  }, [enabled, restore])

  useFrame(({ clock }) => {
    uniforms.uNightTime.value = reducedMotion ? 0 : clock.elapsedTime
    if (!enabled || clock.elapsedTime < nextScanAt.current) return
    nextScanAt.current = clock.elapsedTime + 0.75
    scan()
  }, -18)

  useEffect(() => restore, [restore])
}

function LanternWisps({ lanterns, reducedMotion }: {
  lanterns: readonly NormalizedLantern[]
  reducedMotion: boolean
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(lanterns.length * 3)
    const intensities = new Float32Array(lanterns.length)
    const phases = new Float32Array(lanterns.length)
    const sizes = new Float32Array(lanterns.length)
    lanterns.forEach((lantern, index) => {
      positions.set(lantern.position, index * 3)
      intensities[index] = lantern.intensity
      phases[index] = lantern.phase
      sizes[index] = lantern.size
    })
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('aIntensity', new THREE.BufferAttribute(intensities, 1))
    buffer.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    buffer.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    buffer.computeBoundingSphere()
    return buffer
  }, [lanterns])
  const shaderUniforms = useMemo(() => ({
    uColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.lanternAmber)),
    uMotion: new THREE.Uniform(1),
    uTime: new THREE.Uniform(0),
  }), [])

  useFrame(({ clock }) => {
    shaderUniforms.uMotion.value = reducedMotion ? 0 : 1
    shaderUniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points frustumCulled={false} geometry={geometry} name="V3_CinematicLanternWisps" renderOrder={8}>
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthTest
        depthWrite={false}
        fragmentShader={lanternFragmentShader}
        ref={material}
        transparent
        uniforms={shaderUniforms}
        vertexShader={lanternVertexShader}
      />
    </points>
  )
}

function ContactLightPools({ lanterns, reducedMotion }: {
  lanterns: readonly NormalizedLantern[]
  reducedMotion: boolean
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1, 1, 1), [])
  const transform = useMemo(() => new THREE.Object3D(), [])
  const shaderUniforms = useMemo(() => ({
    uInk: new THREE.Uniform(new THREE.Color(ART_PALETTE.nightHorizon)),
    uMotion: new THREE.Uniform(1),
    uTime: new THREE.Uniform(0),
    uWarm: new THREE.Uniform(new THREE.Color(ART_PALETTE.lanternAmber)),
  }), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    lanterns.forEach((lantern, index) => {
      transform.position.set(lantern.position[0], lantern.poolY, lantern.position[2])
      transform.rotation.set(-Math.PI / 2, 0, lantern.phase * Math.PI)
      transform.scale.set(lantern.radius * 1.22, lantern.radius * 0.68, 1)
      transform.updateMatrix()
      mesh.current?.setMatrixAt(index, transform.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingBox()
    mesh.current.computeBoundingSphere()
  }, [lanterns, transform])

  useFrame(({ clock }) => {
    shaderUniforms.uMotion.value = reducedMotion ? 0 : 1
    shaderUniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh
      args={[geometry, undefined, lanterns.length]}
      count={lanterns.length}
      frustumCulled
      name="V3_CinematicContactLightPools"
      ref={mesh}
      renderOrder={3}
    >
      <shaderMaterial
        blending={THREE.NormalBlending}
        depthTest
        depthWrite={false}
        fragmentShader={poolFragmentShader}
        polygonOffset
        polygonOffsetFactor={-2}
        side={THREE.DoubleSide}
        transparent
        uniforms={shaderUniforms}
        vertexShader={poolVertexShader}
      />
    </instancedMesh>
  )
}

function createReflectionGeometry(
  lanterns: readonly NormalizedLantern[],
  origin: readonly [number, number, number],
) {
  const positions: number[] = []
  const uvs: number[] = []
  const intensities: number[] = []
  const kinds: number[] = []
  const phases: number[] = []
  const indices: number[] = []

  const addReflection = (
    x: number,
    y: number,
    z: number,
    width: number,
    length: number,
    intensity: number,
    kind: number,
    phase: number,
  ) => {
    const vertex = positions.length / 3
    positions.push(
      x - width / 2, y, z - length / 2,
      x + width / 2, y, z - length / 2,
      x - width / 2, y, z + length / 2,
      x + width / 2, y, z + length / 2,
    )
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
    for (let index = 0; index < 4; index += 1) {
      intensities.push(intensity)
      kinds.push(kind)
      phases.push(phase)
    }
    indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3)
  }

  addReflection(origin[0], origin[1], origin[2], 4.6, 8.8, 0.88, 0, 0.27)
  lanterns.forEach((lantern) => {
    const [x, , z] = lantern.position
    if (Math.abs(x) > 6.15 || z < -10.2 || z > 5.1) return
    addReflection(x, -0.101, z, 1.45, 3.6, lantern.intensity * 0.74, 1, lantern.phase)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1))
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1))
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function WaterReflectionStrokes({
  lanterns,
  origin,
  reducedMotion,
}: {
  lanterns: readonly NormalizedLantern[]
  origin: readonly [number, number, number]
  reducedMotion: boolean
}) {
  const geometry = useMemo(() => createReflectionGeometry(lanterns, origin), [lanterns, origin])
  const shaderUniforms = useMemo(() => ({
    uMoonColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.moonGlow)),
    uMotion: new THREE.Uniform(1),
    uTime: new THREE.Uniform(0),
    uWarmColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.lanternAmber)),
  }), [])

  useFrame(({ clock }) => {
    shaderUniforms.uMotion.value = reducedMotion ? 0 : 1
    shaderUniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} name="V3_CinematicWaterReflectionStrokes" renderOrder={5}>
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthTest
        depthWrite={false}
        fragmentShader={reflectionFragmentShader}
        polygonOffset
        polygonOffsetFactor={-3}
        side={THREE.DoubleSide}
        transparent
        uniforms={shaderUniforms}
        vertexShader={reflectionVertexShader}
      />
    </mesh>
  )
}

function createFullscreenMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader,
    toneMapped: false,
    uniforms,
    vertexShader: fullscreenVertexShader,
  })
}

function createFullscreenScene(geometry: THREE.PlaneGeometry, material: THREE.ShaderMaterial) {
  const scene = new THREE.Scene()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  scene.add(mesh)
  return { mesh, scene }
}

function createCompositeResources(profile: QualityProfile) {
  const targetOptions: THREE.RenderTargetOptions = {
    depthBuffer: true,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
  }
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, targetOptions)
  sceneTarget.texture.colorSpace = THREE.LinearSRGBColorSpace
  sceneTarget.texture.generateMipmaps = false
  sceneTarget.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
  sceneTarget.depthTexture.format = THREE.DepthFormat
  sceneTarget.depthTexture.magFilter = THREE.NearestFilter
  sceneTarget.depthTexture.minFilter = THREE.NearestFilter

  const bloomA = new THREE.WebGLRenderTarget(1, 1, {
    ...targetOptions,
    depthBuffer: false,
  })
  const bloomB = bloomA.clone()
  bloomA.texture.colorSpace = THREE.LinearSRGBColorSpace
  bloomB.texture.colorSpace = THREE.LinearSRGBColorSpace
  bloomA.texture.generateMipmaps = false
  bloomB.texture.generateMipmaps = false

  const geometry = new THREE.PlaneGeometry(2, 2)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const extractMaterial = createFullscreenMaterial(bloomExtractFragmentShader, {
    uSource: new THREE.Uniform(sceneTarget.texture),
  })
  const blurMaterial = createFullscreenMaterial(bloomBlurFragmentShader, {
    uDirection: new THREE.Uniform(new THREE.Vector2(1, 0)),
    uSource: new THREE.Uniform(bloomA.texture),
  })
  const compositeMaterial = createFullscreenMaterial(compositeFragmentShader, {
    uBloom: new THREE.Uniform(bloomA.texture),
    uBloomStrength: new THREE.Uniform(profile.bloomStrength),
    uCameraFar: new THREE.Uniform(125),
    uCameraNear: new THREE.Uniform(0.055),
    uDepth: new THREE.Uniform(sceneTarget.depthTexture),
    uDepthMistStrength: new THREE.Uniform(profile.depthMistStrength),
    uGold: new THREE.Uniform(new THREE.Color(ART_PALETTE.oldGold)),
    uGrainStrength: new THREE.Uniform(profile.grainStrength),
    uIndigo: new THREE.Uniform(new THREE.Color(ART_PALETTE.indigo)),
    uMist: new THREE.Uniform(new THREE.Color(ART_PALETTE.nightMist)),
    uScene: new THREE.Uniform(sceneTarget.texture),
    uTime: new THREE.Uniform(0),
    uVermilion: new THREE.Uniform(new THREE.Color(ART_PALETTE.vermilion)),
    uVignetteStrength: new THREE.Uniform(profile.vignetteStrength),
    uWarm: new THREE.Uniform(new THREE.Color(ART_PALETTE.warmLight)),
  })
  const extract = createFullscreenScene(geometry, extractMaterial)
  const blur = createFullscreenScene(geometry, blurMaterial)
  const composite = createFullscreenScene(geometry, compositeMaterial)

  return {
    bloomA,
    bloomB,
    blurMaterial,
    blurScene: blur.scene,
    camera,
    compositeMaterial,
    compositeScene: composite.scene,
    extractMaterial,
    extractScene: extract.scene,
    geometry,
    sceneTarget,
  }
}

function CinematicComposite({
  profile,
  reducedMotion,
}: {
  profile: QualityProfile
  reducedMotion: boolean
}) {
  const size = useThree((state) => state.size)
  const resources = useMemo(() => createCompositeResources(profile), [profile])
  const drawingBufferSize = useMemo(() => new THREE.Vector2(), [])

  useEffect(() => () => {
    resources.bloomA.dispose()
    resources.bloomB.dispose()
    resources.blurMaterial.dispose()
    resources.compositeMaterial.dispose()
    resources.extractMaterial.dispose()
    resources.geometry.dispose()
    resources.sceneTarget.dispose()
  }, [resources])

  useFrame(({ camera, clock, gl, scene }) => {
    gl.getDrawingBufferSize(drawingBufferSize)
    const sceneWidth = Math.max(1, Math.round(drawingBufferSize.x * profile.sceneScale))
    const sceneHeight = Math.max(1, Math.round(drawingBufferSize.y * profile.sceneScale))
    const bloomWidth = Math.max(1, Math.round(drawingBufferSize.x * profile.bloomScale))
    const bloomHeight = Math.max(1, Math.round(drawingBufferSize.y * profile.bloomScale))
    if (resources.sceneTarget.width !== sceneWidth || resources.sceneTarget.height !== sceneHeight) {
      resources.sceneTarget.setSize(sceneWidth, sceneHeight)
    }
    if (resources.bloomA.width !== bloomWidth || resources.bloomA.height !== bloomHeight) {
      resources.bloomA.setSize(bloomWidth, bloomHeight)
      resources.bloomB.setSize(bloomWidth, bloomHeight)
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      resources.compositeMaterial.uniforms.uCameraNear.value = camera.near
      resources.compositeMaterial.uniforms.uCameraFar.value = camera.far
    }
    resources.compositeMaterial.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime

    const previousTarget = gl.getRenderTarget()
    const previousAutoClear = gl.autoClear
    const previousInfoAutoReset = gl.info.autoReset
    const previousXr = gl.xr.enabled
    gl.autoClear = false
    gl.info.autoReset = false
    gl.info.reset()
    gl.xr.enabled = false

    gl.setRenderTarget(resources.sceneTarget)
    gl.clear(true, true, false)
    gl.render(scene, camera)

    gl.setRenderTarget(resources.bloomA)
    gl.clear(true, false, false)
    gl.render(resources.extractScene, resources.camera)

    resources.blurMaterial.uniforms.uSource.value = resources.bloomA.texture
    resources.blurMaterial.uniforms.uDirection.value.set(1 / bloomWidth, 0)
    gl.setRenderTarget(resources.bloomB)
    gl.clear(true, false, false)
    gl.render(resources.blurScene, resources.camera)

    resources.blurMaterial.uniforms.uSource.value = resources.bloomB.texture
    resources.blurMaterial.uniforms.uDirection.value.set(0, 1 / bloomHeight)
    gl.setRenderTarget(resources.bloomA)
    gl.clear(true, false, false)
    gl.render(resources.blurScene, resources.camera)

    gl.setRenderTarget(previousTarget)
    gl.clear(true, true, false)
    gl.render(resources.compositeScene, resources.camera)

    gl.xr.enabled = previousXr
    gl.info.autoReset = previousInfoAutoReset
    gl.autoClear = previousAutoClear
  }, 100)

  useEffect(() => {
    resources.compositeMaterial.uniforms.uBloomStrength.value = profile.bloomStrength
    resources.compositeMaterial.uniforms.uDepthMistStrength.value = profile.depthMistStrength
    resources.compositeMaterial.uniforms.uGrainStrength.value = profile.grainStrength
    resources.compositeMaterial.uniforms.uVignetteStrength.value = profile.vignetteStrength
  }, [profile, resources.compositeMaterial, size])

  return null
}

function resolveQualityProfile(
  quality: CinematicNightQuality,
  viewportWidth: number,
): QualityProfile {
  if (quality !== 'auto') return QUALITY_PROFILES[quality]
  if (viewportWidth < 720) return QUALITY_PROFILES.low
  if (viewportWidth < 1180) return QUALITY_PROFILES.medium
  return QUALITY_PROFILES.high
}

/**
 * Lightweight authored night renderer for the active living-sumi world.
 *
 * Mount once inside `LivingSumiProvider`, after the world geometry. The layer
 * patches only tagged LivingSumi ShaderMaterials, so Three lights are not
 * required for local moon and lantern response. Its five-render composite is
 * deliberately bounded: scene, bloom extraction, two separable blur passes and
 * the final depth-mist/pigment grade.
 */
export function CinematicNightLayer({
  composite = true,
  enabled = true,
  lanterns = DEFAULT_LANTERNS,
  moonPosition = DEFAULT_MOON_POSITION,
  quality = 'auto',
  reducedMotion = false,
  showLanternWisps = true,
  waterReflectionOrigin = DEFAULT_WATER_REFLECTION_ORIGIN,
}: CinematicNightLayerProps): ReactElement | null {
  const viewportWidth = useThree((state) => state.size.width)
  const resolvedLanterns = useMemo(() => normalizedLanterns(lanterns), [lanterns])
  const profile = resolveQualityProfile(quality, viewportWidth)
  const lightUniforms = useNightLightUniforms(
    resolvedLanterns,
    moonPosition,
    waterReflectionOrigin,
  )
  useLivingSumiNightLightPatch(lightUniforms, enabled, reducedMotion)

  if (!enabled) return null
  return (
    <group name="v3-cinematic-night-render-layer">
      {showLanternWisps && (
        <LanternWisps lanterns={resolvedLanterns} reducedMotion={reducedMotion} />
      )}
      <ContactLightPools lanterns={resolvedLanterns} reducedMotion={reducedMotion} />
      <WaterReflectionStrokes
        lanterns={resolvedLanterns}
        origin={waterReflectionOrigin}
        reducedMotion={reducedMotion}
      />
      {composite && <CinematicComposite profile={profile} reducedMotion={reducedMotion} />}
    </group>
  )
}
