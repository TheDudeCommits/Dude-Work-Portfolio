import { useEffect, useMemo, useRef, type Ref } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { useLivingInkField } from '../ink/LivingInkFieldProvider'
import { SUMI_MATERIAL_ROLES, type SumiMaterialRole } from '../artTokens'
import { useWindField } from '../wind/WindFieldProvider'

interface CompiledShader {
  fragmentShader: string
  uniforms: Record<string, THREE.Uniform<unknown>>
  vertexShader: string
}

type MeshStandardMaterialProps = ThreeElements['meshStandardMaterial']

export interface SumiSurfaceMaterialProps extends Omit<
  MeshStandardMaterialProps,
  'color' | 'emissive' | 'emissiveIntensity' | 'metalness' | 'onBeforeCompile' | 'roughness'
> {
  inkResponse?: number
  materialRef?: Ref<THREE.MeshStandardMaterial>
  paperResponse?: number
  ritualResponse?: number
  role: SumiMaterialRole
  windResponse?: number
}

const vertexDeclarations = /* glsl */ `
  uniform float uArtTime;
  uniform vec2 uWindDirection;
  uniform float uWindGust;
  uniform float uWindStrength;
  uniform float uSumiWindResponse;
  attribute float aSumiWind;
  varying vec3 vSumiObjectNormal;
  varying vec3 vSumiObjectPosition;
  varying vec3 vSumiWorldPosition;
`

const vertexWind = /* glsl */ `
  float sumiWindMask = clamp(aSumiWind, 0.0, 1.0);
  float sumiWindPhase = uArtTime * (0.72 + uWindGust * 0.16)
    + position.y * 1.31
    + position.x * 0.19
    + position.z * 0.27;
  float sumiWindAmount = (uWindStrength + uWindGust) * uSumiWindResponse * sumiWindMask;
  transformed.x += uWindDirection.x * sin(sumiWindPhase) * sumiWindAmount * 0.075;
  transformed.z += uWindDirection.y * sin(sumiWindPhase * 0.91 + 0.83) * sumiWindAmount * 0.075;
  transformed.y += cos(sumiWindPhase * 1.37) * sumiWindAmount * 0.012;
`

const vertexWorldVaryings = /* glsl */ `
  vSumiObjectNormal = normalize(objectNormal);
  vSumiObjectPosition = position;
  vec4 sumiWorldPosition = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    sumiWorldPosition = batchingMatrix * sumiWorldPosition;
  #endif
  #ifdef USE_INSTANCING
    sumiWorldPosition = instanceMatrix * sumiWorldPosition;
  #endif
  vSumiWorldPosition = (modelMatrix * sumiWorldPosition).xyz;
`

const fragmentDeclarations = /* glsl */ `
  uniform vec4 uInkBounds;
  uniform sampler2D uInkField;
  uniform vec3 uInkColor;
  uniform sampler2D uPaperTexture;
  uniform float uBroadPaperScale;
  uniform float uFineFiberScale;
  uniform vec3 uRitualColor;
  uniform float uRitualIntensity;
  uniform float uSumiInkResponse;
  uniform float uSumiPaperResponse;
  uniform float uSumiRitualResponse;
  varying vec3 vSumiObjectNormal;
  varying vec3 vSumiObjectPosition;
  varying vec3 vSumiWorldPosition;

  float sumiInsideUnitSquare(vec2 uv) {
    vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    return inside.x * inside.y;
  }
`

const fragmentFinish = /* glsl */ `
  vec2 sumiInkUv = (vSumiWorldPosition.xz - uInkBounds.xy) * uInkBounds.zw;
  float sumiInkValid = sumiInsideUnitSquare(sumiInkUv);
  vec4 sumiField = texture2D(uInkField, clamp(sumiInkUv, 0.0, 1.0)) * sumiInkValid;

  vec3 sumiNormalWeight = pow(abs(normalize(vSumiObjectNormal)), vec3(4.0));
  sumiNormalWeight /= max(sumiNormalWeight.x + sumiNormalWeight.y + sumiNormalWeight.z, 0.001);
  float sumiBroadPaper =
    texture2D(uPaperTexture, vSumiObjectPosition.yz * uBroadPaperScale).r * sumiNormalWeight.x
    + texture2D(uPaperTexture, vSumiObjectPosition.xz * uBroadPaperScale).r * sumiNormalWeight.y
    + texture2D(uPaperTexture, vSumiObjectPosition.xy * uBroadPaperScale).r * sumiNormalWeight.z;
  float sumiFinePaper =
    texture2D(uPaperTexture, vSumiObjectPosition.yz / max(uFineFiberScale, 0.001)).g * sumiNormalWeight.x
    + texture2D(uPaperTexture, vSumiObjectPosition.xz / max(uFineFiberScale, 0.001)).g * sumiNormalWeight.y
    + texture2D(uPaperTexture, vSumiObjectPosition.xy / max(uFineFiberScale, 0.001)).g * sumiNormalWeight.z;

  float sumiLuma = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  float sumiBands = floor(clamp(sumiLuma, 0.0, 0.999) * 4.0) / 4.0;
  float sumiBandRatio = (sumiBands + 0.075) / max(sumiLuma, 0.075);
  outgoingLight *= mix(1.0, sumiBandRatio, uSumiInkResponse * 0.7);

  float sumiPaperValue = (sumiBroadPaper - 0.5) * 0.075 + (sumiFinePaper - 0.5) * 0.026;
  outgoingLight += sumiPaperValue * uSumiPaperResponse;
  float sumiDryBrush = smoothstep(0.31, 0.72, sumiBroadPaper) * (1.0 - smoothstep(0.18, 0.62, sumiLuma));
  outgoingLight = mix(outgoingLight, outgoingLight * 0.72, sumiDryBrush * uSumiInkResponse * 0.38);

  float sumiPigment = sumiField.r * uSumiInkResponse;
  outgoingLight = mix(outgoingLight, uInkColor, sumiPigment * (0.3 + sumiField.g * 0.34));
  outgoingLight += uRitualColor
    * sumiField.b
    * uRitualIntensity
    * uSumiRitualResponse
    * 0.32;
`

export function SumiSurfaceMaterial({
  inkResponse,
  materialRef,
  paperResponse,
  ritualResponse,
  role,
  windResponse = 0,
  ...materialProps
}: SumiSurfaceMaterialProps) {
  const internalRef = useRef<THREE.MeshStandardMaterial>(null)
  const { uniforms: artUniforms } = useArtDirector()
  const { uniforms: inkUniforms } = useLivingInkField()
  const { uniforms: windUniforms } = useWindField()
  const roleTokens = SUMI_MATERIAL_ROLES[role]

  const localUniforms = useMemo(() => ({
    uSumiInkResponse: new THREE.Uniform(inkResponse ?? roleTokens.inkResponse),
    uSumiPaperResponse: new THREE.Uniform(paperResponse ?? roleTokens.paperResponse),
    uSumiRitualResponse: new THREE.Uniform(ritualResponse ?? roleTokens.ritualResponse),
    uSumiWindResponse: new THREE.Uniform(Math.max(0, windResponse)),
  }), [inkResponse, paperResponse, ritualResponse, roleTokens, windResponse])

  const cacheKey = `living-scroll-sumi:${role}:${windResponse > 0 ? 'wind' : 'still'}`

  useEffect(() => {
    const material = internalRef.current
    if (!material) return
    material.customProgramCacheKey = () => cacheKey
    material.userData.sumiRole = role
    ;(material as THREE.MeshStandardMaterial & { defaultAttributeValues?: Record<string, number[]> })
      .defaultAttributeValues = { aSumiWind: [0] }
    material.needsUpdate = true
  }, [cacheKey, role])

  const onBeforeCompile = useMemo(() => (shader: CompiledShader) => {
    Object.assign(shader.uniforms, artUniforms, inkUniforms, windUniforms, localUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexDeclarations}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexWind}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${vertexWorldVaryings}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentDeclarations}`)
      .replace('#include <opaque_fragment>', `${fragmentFinish}\n#include <opaque_fragment>`)
    if (internalRef.current) internalRef.current.userData.sumiShader = shader
  }, [artUniforms, inkUniforms, localUniforms, windUniforms])

  const assignRef = (material: THREE.MeshStandardMaterial | null) => {
    internalRef.current = material
    if (typeof materialRef === 'function') materialRef(material)
    else if (materialRef && 'current' in materialRef) materialRef.current = material
  }

  return (
    <meshStandardMaterial
      {...materialProps}
      color={roleTokens.base}
      emissive={roleTokens.emissive}
      emissiveIntensity={roleTokens.emissiveIntensity}
      metalness={roleTokens.metalness}
      onBeforeCompile={onBeforeCompile}
      ref={assignRef}
      roughness={roleTokens.roughness}
    />
  )
}
