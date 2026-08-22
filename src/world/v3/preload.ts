import { useGLTF } from '@react-three/drei'
import { V3_GATE_BRIDGE_ASSET_URL } from './composition'

export function preloadGateBridgeAsset(assetUrl = V3_GATE_BRIDGE_ASSET_URL) {
  useGLTF.preload(assetUrl)
}
