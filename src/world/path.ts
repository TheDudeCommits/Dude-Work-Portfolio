import * as THREE from 'three'

const clampProgress = (progress: number) => (
  Number.isFinite(progress) ? THREE.MathUtils.clamp(progress, 0, 1) : 0
)

const controlPoints = [
  [0, 0.04, 44],
  [0.08, 0.06, 38],
  [-0.34, 0.1, 31],
  [-0.54, 0.15, 24],
  [-0.16, 0.22, 19],
  [0, 0.45, 16],
  [0.03, 1.55, 14],
  [0, 2.15, 12],
  [-0.03, 1.55, 10],
  [0, 0.45, 8],
  [0.34, 0.32, 3],
  [-0.28, 0.34, -4],
  [-0.64, 0.4, -12],
  [0.44, 0.46, -20],
  [0.22, 0.53, -27],
  [0, 0.6, -32.5],
  [0, 0.78, -34],
  [0, 1.16, -35.5],
  [0, 1.2, -39],
  [0, 1.2, -45],
  [0, 1.18, -50],
  [0, 1.05, -53.5],
  [0, 0.86, -57],
  [0, 0.8, -62.5],
] as const

const WORLD_UP = new THREE.Vector3(0, 1, 0)

export const JOURNEY_EYE_HEIGHT = 1.64

export const JOURNEY_PATH = new THREE.CatmullRomCurve3(
  controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  'catmullrom',
  0.34,
)

JOURNEY_PATH.arcLengthDivisions = 720
JOURNEY_PATH.updateArcLengths()

export const JOURNEY_PATH_LENGTH = JOURNEY_PATH.getLength()

const findProgressAtZ = (z: number) => {
  const point = new THREE.Vector3()
  let lower = 0
  let upper = 1

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const progress = (lower + upper) * 0.5
    JOURNEY_PATH.getPointAt(progress, point)
    if (point.z > z) lower = progress
    else upper = progress
  }

  return (lower + upper) * 0.5
}

export const JOURNEY_BRIDGE_PROGRESS = findProgressAtZ(12)
export const JOURNEY_PAVILION_FRONT_PROGRESS = findProgressAtZ(-32.5)
export const JOURNEY_PAVILION_THRESHOLD_PROGRESS = findProgressAtZ(-35.5)
export const JOURNEY_REAR_THRESHOLD_PROGRESS = findProgressAtZ(-53.5)
export const JOURNEY_SANCTUARY_PROGRESS = findProgressAtZ(-57)

export interface JourneyFrame {
  position: THREE.Vector3
  right: THREE.Vector3
  tangent: THREE.Vector3
  up: THREE.Vector3
}

export function createJourneyFrame(): JourneyFrame {
  return {
    position: new THREE.Vector3(),
    right: new THREE.Vector3(1, 0, 0),
    tangent: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
  }
}

/** Returns the ground-level centre of the authored journey at arc-length progress 0..1. */
export function sampleJourney(progress: number, target = new THREE.Vector3()) {
  return JOURNEY_PATH.getPointAt(clampProgress(progress), target)
}

export function sampleJourneyTangent(progress: number, target = new THREE.Vector3()) {
  return JOURNEY_PATH.getTangentAt(clampProgress(progress), target).normalize()
}

/**
 * Samples an orthonormal, world-up frame. Reuse a frame created by
 * `createJourneyFrame` in per-frame callers to avoid allocations.
 */
export function sampleJourneyFrame(progress: number, target = createJourneyFrame()) {
  sampleJourney(progress, target.position)
  sampleJourneyTangent(progress, target.tangent)
  target.right.crossVectors(target.tangent, WORLD_UP).normalize()
  target.up.crossVectors(target.right, target.tangent).normalize()
  return target
}

/** Half-width, in metres, available to the player around the centreline. */
export function sampleJourneyWidth(progress: number) {
  const p = clampProgress(progress)
  const bridgeNarrowing = Math.exp(-Math.pow((p - JOURNEY_BRIDGE_PROGRESS) / 0.045, 2))
  const pavilionThresholdNarrowing = Math.exp(
    -Math.pow((p - JOURNEY_PAVILION_THRESHOLD_PROGRESS) / 0.034, 2),
  )
  const rearThresholdNarrowing = Math.exp(
    -Math.pow((p - JOURNEY_REAR_THRESHOLD_PROGRESS) / 0.032, 2),
  )
  const sanctuaryOpening = THREE.MathUtils.smoothstep(
    p,
    JOURNEY_REAR_THRESHOLD_PROGRESS,
    JOURNEY_SANCTUARY_PROGRESS,
  )
  return THREE.MathUtils.lerp(1.45, 3.15, sanctuaryOpening)
    - bridgeNarrowing * 0.48
    - pavilionThresholdNarrowing * 0.44
    - rearThresholdNarrowing * 0.42
}

/** Produces stable centreline samples for path stones, terrain shaping, and debug guides. */
export function createJourneySamples(count: number, start = 0, end = 1) {
  const safeCount = Math.max(2, Math.floor(count))
  const from = clampProgress(start)
  const to = clampProgress(end)
  return Array.from({ length: safeCount }, (_, index) => (
    sampleJourney(THREE.MathUtils.lerp(from, to, index / (safeCount - 1)))
  ))
}
