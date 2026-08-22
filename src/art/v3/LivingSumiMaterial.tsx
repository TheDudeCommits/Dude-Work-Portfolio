import type { ThreeElements } from '@react-three/fiber'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Ref,
} from 'react'
import * as THREE from 'three'
import { LIVING_SUMI_VERSION, type LivingSumiMaskDefaults } from './contract'
import { LivingSumiContext } from './context'
import { livingSumiFragmentShader, livingSumiVertexShader } from './shaders'
import { LIVING_SUMI_ROLES, type LivingSumiRole } from './tokens'

type ShaderMaterialProps = ThreeElements['shaderMaterial']

export interface LivingSumiMaterialProps extends Omit<
  ShaderMaterialProps,
  | 'fragmentShader'
  | 'lights'
  | 'opacity'
  | 'ref'
  | 'uniforms'
  | 'vertexShader'
> {
  alphaCutoff?: number
  alphaFeather?: number
  brushDirection?: readonly [x: number, y: number]
  brushScale?: number
  drynessGain?: number
  fogStrength?: number
  maskDefaults?: LivingSumiMaskDefaults
  materialRef?: Ref<THREE.ShaderMaterial>
  motionStrength?: number
  opacity?: number
  pigmentGain?: number
  role: LivingSumiRole
  silhouetteStrength?: number
  strokeInfluence?: number
  wetnessGain?: number
  windAmplitude?: number
  windResponse?: number
}

/**
 * Non-PBR material for authored living-sumi meshes. Mount one
 * `LivingSumiProvider` above the scene, normalize geometry attributes once via
 * `ensureLivingSumiAttributes`, then use this exactly like any mesh material.
 */
export function LivingSumiMaterial({
  alphaCutoff = 0.01,
  alphaFeather,
  brushDirection,
  brushScale,
  depthWrite,
  drynessGain = 1,
  fogStrength = 1,
  maskDefaults,
  materialRef,
  motionStrength = 0.035,
  opacity,
  pigmentGain = 1,
  role,
  side,
  silhouetteStrength,
  strokeInfluence = 0.72,
  transparent,
  wetnessGain = 1,
  windAmplitude = 0.12,
  windResponse = 0,
  ...materialProps
}: LivingSumiMaterialProps) {
  const context = useContext(LivingSumiContext)
  if (!context) throw new Error('LivingSumiMaterial must be used inside LivingSumiProvider')
  const internalRef = useRef<THREE.ShaderMaterial>(null)
  const roleTokens = LIVING_SUMI_ROLES[role]
  const resolvedBrushDirection = brushDirection ?? roleTokens.brushDirection
  const resolvedOpacity = THREE.MathUtils.clamp(opacity ?? roleTokens.opacity, 0, 1)
  const resolvedAlphaFeather = THREE.MathUtils.clamp(
    alphaFeather ?? roleTokens.alphaFeather,
    0,
    1,
  )
  const resolvedTransparent = transparent ?? (resolvedOpacity < 0.999 || resolvedAlphaFeather > 0)
  const resolvedDepthWrite = depthWrite ?? !resolvedTransparent
  const resolvedSide = side ?? (role === 'pine' || role === 'washi'
    ? THREE.DoubleSide
    : THREE.FrontSide)

  const uniforms = useMemo(() => ({
    ...context.uniforms,
    uAbsorbency: new THREE.Uniform(roleTokens.absorbency),
    uAlphaCutoff: new THREE.Uniform(THREE.MathUtils.clamp(alphaCutoff, 0, 1)),
    uAlphaFeather: new THREE.Uniform(resolvedAlphaFeather),
    uBrushDirection: new THREE.Uniform(new THREE.Vector2(...resolvedBrushDirection).normalize()),
    uBrushScale: new THREE.Uniform(Math.max(0.001, brushScale ?? roleTokens.brushScale)),
    uBrushScatter: new THREE.Uniform(roleTokens.brushScatter),
    uContourWidth: new THREE.Uniform(roleTokens.contourWidth),
    uDryGranulation: new THREE.Uniform(roleTokens.dryGranulation),
    uDryLift: new THREE.Uniform(roleTokens.dryLift),
    uDrynessGain: new THREE.Uniform(Math.max(0, drynessGain)),
    uFogStrength: new THREE.Uniform(THREE.MathUtils.clamp(fogStrength, 0, 1)),
    uInkLoad: new THREE.Uniform(roleTokens.inkLoad),
    uLightBand: new THREE.Uniform(new THREE.Color(roleTokens.light)),
    uLightResponse: new THREE.Uniform(roleTokens.lightResponse),
    uMidBand: new THREE.Uniform(new THREE.Color(roleTokens.mid)),
    uMotionStrength: new THREE.Uniform(Math.max(0, motionStrength)),
    uOpacity: new THREE.Uniform(resolvedOpacity),
    uPaperResponse: new THREE.Uniform(roleTokens.paperResponse),
    uPigmentDepth: new THREE.Uniform(roleTokens.pigmentDepth),
    uPigmentGain: new THREE.Uniform(Math.max(0, pigmentGain)),
    uShadowBand: new THREE.Uniform(new THREE.Color(roleTokens.shadow)),
    uSilhouetteStrength: new THREE.Uniform(
      Math.max(0, silhouetteStrength ?? roleTokens.silhouetteStrength),
    ),
    uStrokeInfluence: new THREE.Uniform(THREE.MathUtils.clamp(strokeInfluence, 0, 1)),
    uWetDarkening: new THREE.Uniform(roleTokens.wetDarkening),
    uWetnessGain: new THREE.Uniform(Math.max(0, wetnessGain)),
    uWaterFlow: new THREE.Uniform(role === 'water' ? 1 : 0),
    uWeathering: new THREE.Uniform(roleTokens.weathering),
    uWindAmplitude: new THREE.Uniform(Math.max(0, windAmplitude)),
    uWindResponse: new THREE.Uniform(THREE.MathUtils.clamp(windResponse, 0, 1)),
  }), [
    alphaCutoff,
    brushScale,
    context.uniforms,
    drynessGain,
    fogStrength,
    motionStrength,
    pigmentGain,
    resolvedAlphaFeather,
    resolvedBrushDirection,
    resolvedOpacity,
    role,
    roleTokens,
    silhouetteStrength,
    strokeInfluence,
    wetnessGain,
    windAmplitude,
    windResponse,
  ])

  const assignRef = useCallback((material: THREE.ShaderMaterial | null) => {
    internalRef.current = material
    if (typeof materialRef === 'function') materialRef(material)
    else if (materialRef && 'current' in materialRef) materialRef.current = material
  }, [materialRef])

  useEffect(() => {
    const material = internalRef.current
    if (!material) return
    const defaultStroke = maskDefaults?.stroke ?? resolvedBrushDirection
    Object.assign(
      material.defaultAttributeValues as unknown as Record<string, number[]>,
      {
        aSumiDryness: [THREE.MathUtils.clamp(maskDefaults?.dryness ?? 0.32, 0, 1)],
        aSumiPigment: [THREE.MathUtils.clamp(maskDefaults?.pigment ?? 0.68, 0, 1)],
        aSumiStroke: [defaultStroke[0], defaultStroke[1]],
        aSumiWetness: [THREE.MathUtils.clamp(maskDefaults?.wetness ?? 0.12, 0, 1)],
        aSumiWind: [THREE.MathUtils.clamp(maskDefaults?.wind ?? 0, 0, 1)],
      },
    )
    material.userData.livingSumi = {
      role,
      version: LIVING_SUMI_VERSION,
    }
  }, [maskDefaults, resolvedBrushDirection, role])

  return (
    <shaderMaterial
      {...materialProps}
      depthWrite={resolvedDepthWrite}
      dithering
      fragmentShader={livingSumiFragmentShader}
      ref={assignRef}
      side={resolvedSide}
      transparent={resolvedTransparent}
      uniforms={uniforms}
      vertexShader={livingSumiVertexShader}
    />
  )
}
