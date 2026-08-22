import type { V3InkRingEmitter, V3Vector3Tuple, V3WaterRegion } from './types'

// Version the canonical payload in the URL so long-lived portfolio sessions
// never keep an earlier art pass from the browser or Drei loader cache.
export const V3_GATE_BRIDGE_ASSET_URL = '/art/v3/gate-bridge/gate-bridge.glb?v=0bca02d2'
export const V3_PROJECT_COURT_FRAME_ASSET_URL = '/art/v3/project-court/project-court-frame.glb?v=aea8680c'

/**
 * The GLB is authored in metres around this frame: the visitor arrives from
 * positive Z, crosses the torii at Z=10, and reaches the bridge on negative Z.
 * Keeping these anchors explicit makes rail, physics, audio and interaction
 * authoring converge on the same composition.
 */
export const V3_GATE_BRIDGE_ANCHORS = {
  spawn: [-6.8, 1.12, 27.8] as V3Vector3Tuple,
  threshold: [0, 1.05, 13.8] as V3Vector3Tuple,
  toriiFocus: [0, 4.65, 11.7] as V3Vector3Tuple,
  pondReveal: [-2.8, 0.18, 0.6] as V3Vector3Tuple,
  bridgeApproach: [-7.05, 1.3, -3.4] as V3Vector3Tuple,
  bridgeCrest: [0, 2.98, -3.4] as V3Vector3Tuple,
  bridgeExit: [7.05, 1.3, -3.4] as V3Vector3Tuple,
  projectCourt: [12.4, 0, -10.3] as V3Vector3Tuple,
  projectCourtFocus: [12.4, 3, -12.9] as V3Vector3Tuple,
  distantFocus: [12.4, 3, -12.9] as V3Vector3Tuple,
} as const

export const V3_GATE_BRIDGE_WATER_REGIONS: readonly V3WaterRegion[] = [
  { minX: -11.5, maxX: 11.5, minZ: -10.5, maxZ: -4.75, surfaceY: -0.12 },
  { minX: -11.5, maxX: 11.5, minZ: -2.05, maxZ: 5.25, surfaceY: -0.12 },
]

export const V3_GATE_BRIDGE_RING_EMITTERS: readonly V3InkRingEmitter[] = [
  { position: [-5.7, -0.105, 0.9], strength: 0.74 },
  { position: [4.9, -0.105, -7.1], strength: 0.62 },
  { position: [1.5, -0.105, 1.2], strength: 0.54 },
]
