import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LIVING_SUMI_VERSION, type LivingSumiMaskDefaults } from './contract'
import { LivingSumiContext, type LivingSumiSharedUniforms } from './context'
import { ensureLivingSumiAttributes } from './geometry'
import {
  livingSumiContourFragmentShader,
  livingSumiContourVertexShader,
  livingSumiFragmentShader,
  livingSumiVertexShader,
} from './shaders'
import { LIVING_SUMI_ROLES, type LivingSumiRole } from './tokens'

/**
 * Structural twin of `world/v3`'s request. Keeping it local prevents the art
 * package from importing its consumer and creating a world -> art -> world
 * cycle. Extra request fields are intentionally accepted and ignored.
 */
export interface LivingSumiMaterialRequest {
  mesh: THREE.Mesh
  outlineProfile?: string
  role: LivingSumiRole
  sourceMaterial: THREE.Material | null
  windResponse: number
}

export interface LivingSumiMaterialFrame {
  delta: number
  elapsed: number
  reducedMotion: boolean
}

export interface LivingSumiMaterialAdapter {
  readonly id: string
  dispose: () => void
  resolve: (request: LivingSumiMaterialRequest) => THREE.Material
  update: (frame: LivingSumiMaterialFrame) => void
}

export interface LivingSumiMaterialFactoryOptions {
  alphaCutoff?: number
  fogStrength?: number
  motionStrength?: number
  strokeInfluence?: number
  windAmplitude?: number
}

function readMaskDefaults(mesh: THREE.Mesh): LivingSumiMaskDefaults | undefined {
  const defaults = mesh.userData.livingSumi?.maskDefaults
  if (!defaults || typeof defaults !== 'object') return undefined
  return defaults as LivingSumiMaskDefaults
}

function readBrushDirection(
  mesh: THREE.Mesh,
  fallback: readonly [number, number],
): readonly [number, number] {
  const direction = mesh.userData.livingSumi?.brushDirection
  if (!Array.isArray(direction) || direction.length < 2) return fallback
  const x = Number(direction[0])
  const y = Number(direction[1])
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : fallback
}

function normalizedWindResponse(value: number) {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1)
}

function materialCacheKey(
  role: LivingSumiRole,
  side: THREE.Side,
  windResponse: number,
) {
  return `${role}|${side}|${windResponse.toFixed(3)}`
}

function createRoleMaterial(
  role: LivingSumiRole,
  side: THREE.Side,
  windResponse: number,
  shared: LivingSumiSharedUniforms,
  {
    alphaCutoff = 0.08,
    fogStrength = 1,
    motionStrength = 0.035,
    strokeInfluence = 0.72,
    windAmplitude = 0.12,
  }: LivingSumiMaterialFactoryOptions,
) {
  const tokens = LIVING_SUMI_ROLES[role]
  const brushDirection = new THREE.Vector2(...tokens.brushDirection).normalize()
  const transparent = tokens.opacity < 0.999 || tokens.alphaFeather > 0
  const material = new THREE.ShaderMaterial({
    depthWrite: !transparent,
    fragmentShader: livingSumiFragmentShader,
    side,
    transparent,
    uniforms: {
      ...shared,
      uAbsorbency: new THREE.Uniform(tokens.absorbency),
      uAlphaCutoff: new THREE.Uniform(THREE.MathUtils.clamp(alphaCutoff, 0, 1)),
      uAlphaFeather: new THREE.Uniform(tokens.alphaFeather),
      uBrushDirection: new THREE.Uniform(brushDirection),
      uBrushScale: new THREE.Uniform(tokens.brushScale),
      uBrushScatter: new THREE.Uniform(tokens.brushScatter),
      uContourWidth: new THREE.Uniform(tokens.contourWidth),
      uDryGranulation: new THREE.Uniform(tokens.dryGranulation),
      uDryLift: new THREE.Uniform(tokens.dryLift),
      uDrynessGain: new THREE.Uniform(1),
      uFogStrength: new THREE.Uniform(THREE.MathUtils.clamp(fogStrength, 0, 1)),
      uInkLoad: new THREE.Uniform(tokens.inkLoad),
      uLightBand: new THREE.Uniform(new THREE.Color(tokens.light)),
      uLightResponse: new THREE.Uniform(tokens.lightResponse),
      uMidBand: new THREE.Uniform(new THREE.Color(tokens.mid)),
      uMotionStrength: new THREE.Uniform(Math.max(0, motionStrength)),
      uOpacity: new THREE.Uniform(tokens.opacity),
      uPaperResponse: new THREE.Uniform(tokens.paperResponse),
      uPigmentDepth: new THREE.Uniform(tokens.pigmentDepth),
      uPigmentGain: new THREE.Uniform(1),
      uShadowBand: new THREE.Uniform(new THREE.Color(tokens.shadow)),
      uSilhouetteStrength: new THREE.Uniform(tokens.silhouetteStrength),
      uStrokeInfluence: new THREE.Uniform(THREE.MathUtils.clamp(strokeInfluence, 0, 1)),
      uWetDarkening: new THREE.Uniform(tokens.wetDarkening),
      uWetnessGain: new THREE.Uniform(1),
      uWaterFlow: new THREE.Uniform(role === 'water' ? 1 : 0),
      uWeathering: new THREE.Uniform(tokens.weathering),
      uWindAmplitude: new THREE.Uniform(Math.max(0, windAmplitude)),
      uWindResponse: new THREE.Uniform(windResponse),
    },
    vertexShader: livingSumiVertexShader,
  })
  Object.assign(
    material.defaultAttributeValues as unknown as Record<string, number[]>,
    {
      aSumiDryness: [0.32],
      aSumiPigment: [0.68],
      aSumiStroke: [brushDirection.x, brushDirection.y],
      aSumiWetness: [0.12],
      aSumiWind: [0],
    },
  )
  material.name = `LivingSumiV3:${role}:${windResponse.toFixed(3)}`
  material.userData.livingSumi = {
    imperative: true,
    role,
    version: LIVING_SUMI_VERSION,
    windResponse,
  }
  return material
}

function contourExpansion(profile: string | undefined) {
  if (profile === 'hero') return 0.034
  if (profile === 'architecture') return 0.022
  if (profile === 'vegetation') return 0.016
  if (profile === 'detail') return 0.014
  return 0
}

function createContourMaterial(
  role: LivingSumiRole,
  expansion: number,
  shared: LivingSumiSharedUniforms,
) {
  const tokens = LIVING_SUMI_ROLES[role]
  const material = new THREE.ShaderMaterial({
    depthWrite: true,
    fragmentShader: livingSumiContourFragmentShader,
    side: THREE.BackSide,
    uniforms: {
      uBrushScale: new THREE.Uniform(tokens.brushScale * 0.72),
      uBrushTexture: shared.uBrushTexture,
      uContourExpansion: new THREE.Uniform(expansion),
      uDryColor: new THREE.Uniform(new THREE.Color(tokens.mid)),
      uInkColor: new THREE.Uniform(new THREE.Color(tokens.shadow)),
    },
    vertexShader: livingSumiContourVertexShader,
  })
  material.name = `LivingSumiV3Contour:${role}:${expansion.toFixed(3)}`
  material.userData.livingSumi = {
    contour: true,
    role,
    version: LIVING_SUMI_VERSION,
  }
  return material
}

/**
 * Imperative factory for GLB loaders. It caches real ShaderMaterial instances
 * by semantic role, side and wind response, and prepares each cloned geometry
 * once. Call `dispose` when the owning world unmounts.
 */
export function createLivingSumiMaterialFactory(
  sharedUniforms: LivingSumiSharedUniforms,
  options: LivingSumiMaterialFactoryOptions = {},
): LivingSumiMaterialAdapter {
  const materials = new Map<string, THREE.ShaderMaterial>()
  const contourMaterials = new Map<string, THREE.ShaderMaterial>()
  const contourMeshes = new Set<THREE.Mesh>()
  const preparedGeometries = new WeakSet<THREE.BufferGeometry>()
  const outlinedMeshes = new WeakSet<THREE.Mesh>()
  let disposed = false

  return {
    id: 'living-sumi-v3-material-adapter',
    dispose() {
      if (disposed) return
      disposed = true
      materials.forEach((material) => material.dispose())
      materials.clear()
      contourMeshes.forEach((mesh) => mesh.parent?.remove(mesh))
      contourMeshes.clear()
      contourMaterials.forEach((material) => material.dispose())
      contourMaterials.clear()
    },
    resolve(request) {
      if (disposed) throw new Error('Cannot resolve a disposed living-sumi material adapter')
      if (request.mesh.userData.livingSumiContour === true && request.sourceMaterial) {
        return request.sourceMaterial
      }
      const roleTokens = LIVING_SUMI_ROLES[request.role]
      if (!preparedGeometries.has(request.mesh.geometry)) {
        const maskDefaults = readMaskDefaults(request.mesh)
        ensureLivingSumiAttributes(request.mesh.geometry, {
          ...maskDefaults,
          stroke: maskDefaults?.stroke ?? readBrushDirection(request.mesh, roleTokens.brushDirection),
        })
        preparedGeometries.add(request.mesh.geometry)
      }

      const expansion = contourExpansion(request.outlineProfile)
      // Court forms overlap deliberately to build one broad ink mass. Shell
      // contours on those intersections read as z-fighting, so their value
      // edges come from the material wash rather than duplicated hulls.
      const omitContour = expansion <= 0 || /GardenFrame|Court/i.test(request.mesh.name)
      if (!omitContour && !outlinedMeshes.has(request.mesh)) {
        const contourKey = `${request.role}|${expansion.toFixed(3)}`
        let contourMaterial = contourMaterials.get(contourKey)
        if (!contourMaterial) {
          contourMaterial = createContourMaterial(
            request.role,
            expansion,
            sharedUniforms,
          )
          contourMaterials.set(contourKey, contourMaterial)
        }
        const contourMesh = new THREE.Mesh(request.mesh.geometry, contourMaterial)
        contourMesh.name = `${request.mesh.name}__living-sumi-contour`
        contourMesh.frustumCulled = true
        contourMesh.renderOrder = -2
        contourMesh.userData.livingSumiContour = true
        contourMesh.raycast = () => undefined
        request.mesh.add(contourMesh)
        contourMeshes.add(contourMesh)
        outlinedMeshes.add(request.mesh)
      }

      const windResponse = normalizedWindResponse(request.windResponse)
      const authoredSide = request.sourceMaterial?.side ?? THREE.FrontSide
      const side = request.role === 'pine' || request.role === 'washi'
        ? THREE.DoubleSide
        : authoredSide
      const key = materialCacheKey(request.role, side, windResponse)
      let material = materials.get(key)
      if (!material) {
        material = createRoleMaterial(
          request.role,
          side,
          windResponse,
          sharedUniforms,
          options,
        )
        materials.set(key, material)
      }
      return material
    },
    update({ elapsed, reducedMotion }) {
      sharedUniforms.uTime.value = reducedMotion ? 0 : Math.max(0, elapsed)
    },
  }
}

/** React bridge for worlds mounted beneath `LivingSumiProvider`. */
export function useLivingSumiMaterialAdapter(
  options: LivingSumiMaterialFactoryOptions = {},
) {
  const context = useContext(LivingSumiContext)
  if (!context) {
    throw new Error('useLivingSumiMaterialAdapter must be used inside LivingSumiProvider')
  }
  const {
    alphaCutoff,
    fogStrength,
    motionStrength,
    strokeInfluence,
    windAmplitude,
  } = options
  const adapter = useMemo(() => createLivingSumiMaterialFactory(context.uniforms, {
    alphaCutoff,
    fogStrength,
    motionStrength,
    strokeInfluence,
    windAmplitude,
  }), [
    alphaCutoff,
    context.uniforms,
    fogStrength,
    motionStrength,
    strokeInfluence,
    windAmplitude,
  ])
  const lifecycleTokens = useRef(new WeakMap<LivingSumiMaterialAdapter, object>())
  useEffect(() => {
    const tokens = lifecycleTokens.current
    const mountedToken = {}
    tokens.set(adapter, mountedToken)
    return () => {
      const disposeToken = {}
      tokens.set(adapter, disposeToken)
      queueMicrotask(() => {
        if (tokens.get(adapter) !== disposeToken) return
        adapter.dispose()
        tokens.delete(adapter)
      })
    }
  }, [adapter])
  return adapter
}
