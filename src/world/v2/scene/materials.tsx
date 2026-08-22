import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  ART_PALETTE,
  LivingWaterSurfaceMaterial,
  SumiSurfaceMaterial,
  type SumiMaterialRole,
} from '../../../art'

export const LIVING_SCROLL_PALETTE = {
  celadon: ART_PALETTE.celadon,
  gold: ART_PALETTE.oldGold,
  indigo: ART_PALETTE.indigo,
  mist: ART_PALETTE.mist,
  pine: ART_PALETTE.pine,
  soot: ART_PALETTE.soot,
  stone: ART_PALETTE.mist,
  vermilion: ART_PALETTE.vermilion,
  washi: ART_PALETTE.washi,
  water: ART_PALETTE.water,
} as const

const surfaceTokens = {
  bamboo: { role: 'foliage', windResponse: 0.34 },
  foliage: { role: 'foliage', windResponse: 0.5 },
  gold: { role: 'metal' },
  indigo: { role: 'indigo' },
  mist: { opacity: 0.42, role: 'washi', transparent: true },
  paper: { role: 'washi' },
  pineBark: { role: 'timber' },
  soot: { role: 'timber' },
  stone: { role: 'stone' },
  vermilion: { role: 'vermilion' },
} as const satisfies Readonly<Record<string, {
  opacity?: number
  role: SumiMaterialRole
  transparent?: boolean
  windResponse?: number
}>>

export type GardenSurfaceRole = keyof typeof surfaceTokens

interface GardenSurfaceProps {
  role: GardenSurfaceRole
  side?: THREE.Side
  transparent?: boolean
  vertexColors?: boolean
}

/**
 * The only bridge from the v2 scene to the legacy material system. Replacing
 * this component with the shared art registry migrates every v2 asset at once.
 */
export function GardenSurface({ role, side, transparent, vertexColors }: GardenSurfaceProps) {
  const token = surfaceTokens[role]
  return (
    <SumiSurfaceMaterial
      {...token}
      side={side}
      transparent={transparent ?? ('transparent' in token ? token.transparent : false)}
      vertexColors={vertexColors}
    />
  )
}

export function GardenWater({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <LivingWaterSurfaceMaterial
      alpha={reducedMotion ? 0.84 : 0.8}
      waveStrength={reducedMotion ? 0.012 : 0.065}
    />
  )
}

const portalVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const portalFragment = /* glsl */ `
  uniform sampler2D uImage;
  uniform float uTime;
  uniform float uEnergy;
  uniform vec3 uShadowInk;
  uniform vec3 uPaper;
  uniform vec3 uCeladon;
  uniform vec3 uGold;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float wash = noise(vUv * 5.0 + vec2(uTime * 0.025, -uTime * 0.018));
    float fibres = noise(vWorld.xy * 34.0);
    float frayed = noise(vUv * vec2(19.0, 27.0) + wash * 2.4);
    float scrollRadius = length(centered * vec2(0.82, 1.0));
    float edge = 1.0 - smoothstep(0.35 + frayed * 0.1, 0.52, scrollRadius);

    // Deliberately sample a low-resolution impression of the project. It keeps
    // the portal wordless and reads as pigment rather than a flat screenshot.
    vec2 sampleUv = (floor((vUv + vec2(wash * 0.008, 0.0)) * vec2(38.0, 48.0)) + 0.5) / vec2(38.0, 48.0);
    vec3 source = texture2D(uImage, clamp(sampleUv, 0.01, 0.99)).rgb;
    float luma = dot(source, vec3(0.299, 0.587, 0.114));
    vec3 pigment = mix(uShadowInk, uPaper, smoothstep(0.12, 0.86, luma));
    pigment = mix(pigment, uCeladon, smoothstep(0.5, 0.92, source.b - source.r * 0.35) * (0.3 + uEnergy * 0.28));
    pigment += (fibres - 0.5) * 0.035;
    pigment += uGold * uEnergy * pow(1.0 - length(centered) * 1.5, 3.0) * 0.4;
    float alpha = edge * (0.035 + uEnergy * 0.91) * smoothstep(0.06, 0.23, luma + frayed * 0.18);
    if (alpha < 0.025) discard;
    gl_FragColor = vec4(pigment, alpha);
  }
`

export function ProjectInkMembrane({
  active,
  focused,
  image,
  reducedMotion = false,
}: {
  active: boolean
  focused: boolean
  image: string
  reducedMotion?: boolean
}) {
  const texture = useTexture(image)
  const material = useRef<THREE.ShaderMaterial>(null)
  const energy = useRef(0)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const uniforms = useMemo(() => ({
    uCeladon: { value: new THREE.Color(ART_PALETTE.celadon) },
    uEnergy: { value: 0 },
    uGold: { value: new THREE.Color(ART_PALETTE.oldGold) },
    uImage: { value: texture },
    uPaper: { value: new THREE.Color(ART_PALETTE.washi) },
    uShadowInk: { value: new THREE.Color(ART_PALETTE.soot) },
    uTime: { value: 0 },
  }), [texture])

  useFrame(({ clock }, delta) => {
    if (!material.current) return
    energy.current = THREE.MathUtils.damp(energy.current, active ? 1 : focused ? 0.58 : 0.018, 5.5, delta)
    material.current.uniforms.uEnergy.value = energy.current
    material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })

  return (
    <shaderMaterial
      blending={THREE.NormalBlending}
      depthWrite={false}
      fragmentShader={portalFragment}
      ref={material}
      side={THREE.DoubleSide}
      transparent
      uniforms={uniforms}
      vertexShader={portalVertex}
    />
  )
}
