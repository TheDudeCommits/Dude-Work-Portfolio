import { Suspense, type RefObject } from 'react'
import * as THREE from 'three'
import { V3BaseEnvironment } from './BaseEnvironment'
import {
  V3_GATE_BRIDGE_ANCHORS,
  V3_GATE_BRIDGE_ASSET_URL,
} from './composition'
import { GardenEcology } from './GardenEcology'
import { GateBridgeAsset } from './GateBridgeAsset'
import { InkRingField, type InkRingFieldProps } from './InkRingField'
import { ProjectGarden } from './ProjectGarden'
import type { V3SumiMaterialAdapter, V3Vector3Tuple } from './types'
import { WorldMatteCards } from './WorldMatteCards'

function HiddenLoadingFallback() {
  return <group name="v3-gate-bridge-loading-hidden" visible={false} />
}

function CompositionAnchors() {
  return (
    <group name="v3-gate-bridge-composition-anchors" visible={false}>
      {Object.entries(V3_GATE_BRIDGE_ANCHORS).map(([name, position]) => (
        <group key={name} name={`ANCHOR__${name}`} position={position} />
      ))}
    </group>
  )
}

export interface V3GateBridgeWorldProps {
  assetPosition?: V3Vector3Tuple
  assetRotation?: V3Vector3Tuple
  assetScale?: number
  assetUrl?: string
  materialAdapter: V3SumiMaterialAdapter
  onAssetReady?: (scene: THREE.Group) => void
  reducedMotion?: boolean
  ringOptions?: Omit<InkRingFieldProps, 'reducedMotion'>
  sceneRef?: RefObject<THREE.Group | null>
  showBaseEnvironment?: boolean
  showGardenEcology?: boolean
  showInkRings?: boolean
  showMatteCards?: boolean
  showProjectGarden?: boolean
}

/**
 * Isolated hero-world vertical slice. Lighting, atmosphere, physics and player
 * remain owned by their existing providers; this component supplies only the
 * authored gate/bridge asset and three deliberate living layers: semantic
 * vertex-alpha wind, water rings, and exactly two world-space matte cards.
 */
export function V3GateBridgeWorld({
  assetPosition = [0, 0, 0],
  assetRotation = [0, 0, 0],
  assetScale = 1,
  assetUrl = V3_GATE_BRIDGE_ASSET_URL,
  materialAdapter,
  onAssetReady,
  reducedMotion = false,
  ringOptions,
  sceneRef,
  showBaseEnvironment = true,
  showGardenEcology = true,
  showInkRings = true,
  showMatteCards = true,
  showProjectGarden = true,
}: V3GateBridgeWorldProps) {
  return (
    <group name="living-scroll-gate-bridge-v3">
      <CompositionAnchors />
      {showBaseEnvironment && <V3BaseEnvironment materialAdapter={materialAdapter} />}
      <Suspense fallback={<HiddenLoadingFallback />}>
        <GateBridgeAsset
          assetUrl={assetUrl}
          materialAdapter={materialAdapter}
          onReady={onAssetReady}
          position={assetPosition}
          reducedMotion={reducedMotion}
          rotation={assetRotation}
          scale={assetScale}
          sceneRef={sceneRef}
        />
      </Suspense>
      {showInkRings && <InkRingField {...ringOptions} reducedMotion={reducedMotion} />}
      {showGardenEcology && <GardenEcology reducedMotion={reducedMotion} />}
      {showProjectGarden && (
        <Suspense fallback={<HiddenLoadingFallback />}>
          <ProjectGarden materialAdapter={materialAdapter} reducedMotion={reducedMotion} />
        </Suspense>
      )}
      {showMatteCards && (
        <Suspense fallback={<HiddenLoadingFallback />}>
          <WorldMatteCards reducedMotion={reducedMotion} />
        </Suspense>
      )}
    </group>
  )
}
