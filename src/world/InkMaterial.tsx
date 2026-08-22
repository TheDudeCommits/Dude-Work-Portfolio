import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'

interface SumiMaterialProps {
  color: THREE.ColorRepresentation
  emissive?: THREE.ColorRepresentation
  emissiveIntensity?: number
  inkStrength?: number
  mapUrl?: string
  metalness?: number
  opacity?: number
  paperScale?: number
  roughness?: number
  side?: THREE.Side
  transparent?: boolean
  vertexColors?: boolean
  wind?: number
}

interface CompiledShader {
  fragmentShader: string
  uniforms: Record<string, { value: unknown }>
  vertexShader: string
}

export function SumiMaterial({
  color,
  emissive = '#000000',
  emissiveIntensity = 0,
  inkStrength = 0.28,
  mapUrl = '/assets/kozo-washi.webp',
  metalness = 0,
  opacity = 1,
  paperScale = 3,
  roughness = 0.92,
  side = THREE.FrontSide,
  transparent = false,
  vertexColors = false,
  wind = 0,
}: SumiMaterialProps) {
  const material = useRef<THREE.MeshStandardMaterial>(null)
  const source = useTexture(mapUrl)
  const map = useMemo(() => {
    const texture = source.clone()
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(paperScale, paperScale)
    texture.needsUpdate = true
    return texture
  }, [paperScale, source])

  const onBeforeCompile = useCallback((shader: CompiledShader) => {
    shader.uniforms.uSumiTime = { value: 0 }
    shader.uniforms.uInkStrength = { value: inkStrength }
    shader.uniforms.uWind = { value: wind }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSumiTime;
        uniform float uWind;
        varying vec3 vSumiWorld;
        varying vec3 vSumiNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sumiWave = sin(uSumiTime * 0.72 + position.y * 1.7 + position.x * 0.83);
        transformed.x += sumiWave * uWind * (0.03 + max(position.y, 0.0) * 0.016);
        transformed.z += cos(uSumiTime * 0.54 + position.y * 1.3) * uWind * 0.022;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vSumiWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSumiNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uInkStrength;
        varying vec3 vSumiWorld;
        varying vec3 vSumiNormal;
        float sumiHash(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float sumiGrain = sumiHash(floor(vSumiWorld * 19.0));
        float sumiLuma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        float sumiBands = floor(clamp(sumiLuma, 0.0, 0.999) * 5.0) / 5.0;
        float sumiRatio = mix(1.0, (sumiBands + 0.08) / max(sumiLuma, 0.08), uInkStrength);
        float sumiEdge = pow(1.0 - abs(dot(normalize(vSumiNormal), normalize(vViewPosition))), 2.8);
        gl_FragColor.rgb *= sumiRatio;
        gl_FragColor.rgb *= 1.0 - sumiEdge * uInkStrength * 0.42;
        gl_FragColor.rgb += (sumiGrain - 0.5) * 0.018;`,
      )
    if (material.current) material.current.userData.shader = shader
  }, [inkStrength, wind])

  useFrame(({ clock }) => {
    const shader = material.current?.userData.shader as CompiledShader | undefined
    if (shader) shader.uniforms.uSumiTime.value = clock.elapsedTime
  })

  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      map={map}
      metalness={metalness}
      onBeforeCompile={onBeforeCompile}
      opacity={opacity}
      ref={material}
      roughness={roughness}
      side={side}
      transparent={transparent}
      vertexColors={vertexColors}
    />
  )
}

const waterVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    vUv = uv;
    vec3 transformed = position;
    float waveA = sin(position.x * 1.65 + uTime * 0.72) * 0.035;
    float waveB = cos(position.y * 2.2 - uTime * 0.53) * 0.025;
    float waveC = sin((position.x + position.y) * 3.4 + uTime * 0.31) * 0.012;
    transformed.z += waveA + waveB + waveC;
    vWave = waveA + waveB + waveC;
    vec4 world = modelMatrix * vec4(transformed, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vWave;
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
    vec3 eye = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(eye.y, 0.0), 3.0);
    float ink = noise(vUv * 14.0 + vec2(uTime * 0.035, -uTime * 0.022));
    float caustic = smoothstep(0.72, 0.95, sin(vUv.x * 84.0 + uTime + ink * 7.0) * 0.5 + 0.5);
    vec3 color = mix(uShallow, uDeep, 0.42 + fresnel * 0.48 + ink * 0.1);
    color += vec3(0.42, 0.68, 0.65) * caustic * 0.075;
    color += vWave * 0.18;
    float alpha = 0.76 + fresnel * 0.18;
    gl_FragColor = vec4(color, alpha);
  }
`

export function InkWaterMaterial({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uDeep: { value: new THREE.Color('#030909') },
    uShallow: { value: new THREE.Color('#17322f') },
    uTime: { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })

  return (
    <shaderMaterial
      depthWrite={false}
      fragmentShader={waterFragment}
      ref={material}
      side={THREE.DoubleSide}
      transparent
      uniforms={uniforms}
      vertexShader={waterVertex}
    />
  )
}
