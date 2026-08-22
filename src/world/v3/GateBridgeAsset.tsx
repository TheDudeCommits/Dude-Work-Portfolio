import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { V3_GATE_BRIDGE_ASSET_URL } from './composition'
import { createV3MaterialRequest } from './materialAdapter'
import type { V3SumiMaterialAdapter, V3Vector3Tuple } from './types'

const NON_RENDER_PREFIX = /^(COLLIDER|SOCKET|HELPER|NAVMESH|CAMERA|LIGHT)__?/i

function cloneWindAttribute(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute('aSumiWind')) return
  const color = geometry.getAttribute('color')
  if (!color || color.itemSize < 4) return
  const wind = new Float32Array(color.count)
  for (let index = 0; index < color.count; index += 1) wind[index] = color.getW(index)
  geometry.setAttribute('aSumiWind', new THREE.Float32BufferAttribute(wind, 1))
}

function renderMaterials(mesh: THREE.Mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

export interface GateBridgeAssetProps {
  assetUrl?: string
  materialAdapter: V3SumiMaterialAdapter
  onReady?: (scene: THREE.Group) => void
  position?: V3Vector3Tuple
  reducedMotion?: boolean
  rotation?: V3Vector3Tuple
  scale?: number
  sceneRef?: RefObject<THREE.Group | null>
}

export function GateBridgeAsset({
  assetUrl = V3_GATE_BRIDGE_ASSET_URL,
  materialAdapter,
  onReady,
  position = [0, 0, 0],
  reducedMotion = false,
  rotation = [0, 0, 0],
  scale = 1,
  sceneRef,
}: GateBridgeAssetProps) {
  const gltf = useGLTF(assetUrl)
  const lodClock = useRef(0)
  const cameraWorldPosition = useMemo(() => new THREE.Vector3(), [])
  const lodWorldPosition = useMemo(() => new THREE.Vector3(), [])
  const styledAsset = useMemo(() => {
    const scene = gltf.scene.clone(true)
    const lodGroups = new Map<string, { high?: THREE.Object3D; low?: THREE.Object3D }>()
    const pineObjects: THREE.Object3D[] = []
    const sourceMaterials = new Map<THREE.Mesh, THREE.Material[]>()
    scene.name = 'v3-gate-bridge-authored-asset'
    scene.traverse((object) => {
      // Multi-primitive glTF meshes arrive as a named group with generated
      // child meshes. Pair only the canonical, exact LOD roots so both detail
      // levels can never render together.
      const lodMatch = object.name.match(/^(.*)_LOD([01])$/i)
      if (lodMatch) {
        const entry = lodGroups.get(lodMatch[1]) ?? {}
        if (lodMatch[2] === '0') entry.high = object
        else entry.low = object
        lodGroups.set(lodMatch[1], entry)
        if (/OldPine/i.test(object.name)) pineObjects.push(object)
      }
      if (!(object instanceof THREE.Mesh)) return
      object.geometry = object.geometry.clone()
      cloneWindAttribute(object.geometry)
      sourceMaterials.set(object, renderMaterials(object))
    })
    lodGroups.forEach(({ high, low }) => {
      if (high) high.visible = true
      if (low) low.visible = false
    })
    return { lodGroups, pineObjects, scene, sourceMaterials }
  }, [gltf.scene])
  const styledScene = styledAsset.scene

  useLayoutEffect(() => {
    styledScene.traverse((object) => {
      if (NON_RENDER_PREFIX.test(object.name)) {
        object.visible = false
        return
      }
      if (!(object instanceof THREE.Mesh)) return

      const sourceMaterials = styledAsset.sourceMaterials.get(object) ?? renderMaterials(object)
      const requests = sourceMaterials.map((sourceMaterial) => createV3MaterialRequest(object, sourceMaterial))
      object.material = Array.isArray(object.material)
        ? requests.map((request) => materialAdapter.resolve(request))
        : materialAdapter.resolve(requests[0])
      const roles = new Set(requests.map((request) => request.role))
      if (/CourtPineArch/i.test(object.name) && roles.has('pine')) {
        object.visible = false
      }
      object.castShadow = !roles.has('water') && !roles.has('spirit')
      object.receiveShadow = !roles.has('spirit')
      object.userData.v3SumiRoles = [...roles]
      object.userData.v3Styled = true
    })
  }, [materialAdapter, styledAsset.sourceMaterials, styledScene])

  useEffect(() => {
    onReady?.(styledScene)
  }, [onReady, styledScene])

  useEffect(() => () => {
    styledScene.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose()
    })
  }, [styledScene])

  useFrame(({ camera, clock }, delta) => {
    materialAdapter.update?.({
      delta,
      elapsed: clock.elapsedTime,
      reducedMotion,
    })
    lodClock.current += delta
    if (lodClock.current < 0.25) return
    lodClock.current = 0
    camera.getWorldPosition(cameraWorldPosition)
    styledAsset.lodGroups.forEach(({ high, low }, lodName) => {
      if (!high || !low) return
      // The exported court pine is useful as a spatial/layout reference, but
      // even its reduced LOD reads as faceted geometry in the hero reveal.
      // The destination is instead framed by the authored ink-bough matte in
      // CSS, so no polygonal canopy is allowed back into either LOD.
      if (/CourtPineArch|CourtDais/i.test(lodName)) {
        high.visible = false
        low.visible = false
        return
      }
      // The near garden-frame bamboo is a useful parallax wipe through the
      // bridge, but becomes a faceted obstruction once the camera arrives at
      // the sanctuary. Hand the final frame over to the painted bough layer.
      if (/GardenFrame/i.test(lodName) && cameraWorldPosition.x > 3.5 && cameraWorldPosition.z < 8) {
        high.visible = false
        low.visible = false
        return
      }
      if (/OldPine/i.test(lodName)) {
        const pineDistanceSquared = (cameraWorldPosition.x + 8.65) ** 2
          + (cameraWorldPosition.z + 6.3) ** 2
        if (pineDistanceSquared < 49) {
          high.visible = false
          low.visible = false
          return
        }
      }
      high.getWorldPosition(lodWorldPosition)
      const screenCoverage = Number(high.userData.screen_coverage ?? 0.18)
      const highDetailDistance = 34 + THREE.MathUtils.clamp(screenCoverage, 0, 0.4) * 72
      const useHigh = cameraWorldPosition.distanceToSquared(lodWorldPosition) <= highDetailDistance ** 2
      high.visible = useHigh
      low.visible = !useHigh
    })
    const nearPine = (cameraWorldPosition.x + 8.65) ** 2
      + (cameraWorldPosition.z + 6.3) ** 2 < 49
    if (nearPine) styledAsset.pineObjects.forEach((object) => { object.visible = false })
  }, -24)

  return (
    <group
      name="v3-gate-bridge-asset-root"
      position={position}
      ref={sceneRef}
      rotation={rotation}
      scale={scale}
    >
      <primitive object={styledScene} />
    </group>
  )
}
