import * as THREE from 'three'
import type { Vector3Tuple } from './types'

export interface CinematicRailKeyframe {
  /** Perspective FOV for this authored composition. */
  fov: number
  /** The point the camera composes around at this moment. */
  lookAt: Vector3Tuple
  /** Ground-level position for the invisible navigation capsule. */
  position: Vector3Tuple
  /** Subtle local camera roll, in radians. */
  roll: number
}

export interface CinematicRailPose {
  fov: number
  lookAt: THREE.Vector3
  position: THREE.Vector3
  roll: number
}

/**
 * A twelve-shot pilgrimage: threshold, torii, pond, bridge, pine, project
 * court, and the distant sanctuary. The camera never exposes a visible avatar.
 */
export const CINEMATIC_GARDEN_RAIL_KEYFRAMES = [
  { fov: 44, lookAt: [0, 3.0, 11.7], position: [0, 1.05, 18.6], roll: -0.006 },
  { fov: 41, lookAt: [0.15, 2.88, 11.25], position: [-0.55, 1.05, 15.35], roll: 0.004 },
  { fov: 47, lookAt: [-5.8, 4.1, 0.8], position: [0.18, 1.05, 10.15], roll: 0.012 },
  { fov: 51, lookAt: [0.2, -0.08, -3.4], position: [-2.45, 1.05, 6.7], roll: -0.01 },
  { fov: 43, lookAt: [-7.36, 1.58, -3.4], position: [-8.5, 1.25, 1.2], roll: -0.016 },
  { fov: 42, lookAt: [-0.4, 3.05, -3.4], position: [-7.48, 1.52, -3.4], roll: 0.004 },
  { fov: 47, lookAt: [7.22, 1.62, -3.4], position: [0.82, 3.2, -3.4], roll: 0.014 },
  { fov: 50, lookAt: [8.55, 1.18, -9.75], position: [7.46, 1.52, -3.4], roll: -0.004 },
  { fov: 42, lookAt: [14.2, 2.25, -9.1], position: [8.0, 1.05, -9.0], roll: -0.018 },
  { fov: 39, lookAt: [0, 2.45, -19.4], position: [2.6, 1.05, -16.0], roll: 0.006 },
  { fov: 43, lookAt: [-14.4, 2.2, -8.7], position: [-6.6, 1.05, -13.15], roll: 0.018 },
  { fov: 53, lookAt: [0, 2.18, -19.4], position: [0, 1.05, -14.8], roll: 0 },
] as const satisfies readonly CinematicRailKeyframe[]

const positionCurve = new THREE.CatmullRomCurve3(
  CINEMATIC_GARDEN_RAIL_KEYFRAMES.map((keyframe) => new THREE.Vector3(...keyframe.position)),
  false,
  'centripetal',
  0.42,
)

const lookCurve = new THREE.CatmullRomCurve3(
  CINEMATIC_GARDEN_RAIL_KEYFRAMES.map((keyframe) => new THREE.Vector3(...keyframe.lookAt)),
  false,
  'centripetal',
  0.42,
)

/** Arc length in world metres, used to keep rail travel physically paced. */
export const CINEMATIC_GARDEN_RAIL_LENGTH = positionCurve.getLength()

const clampProgress = (progress: number) => THREE.MathUtils.clamp(progress, 0, 1)

const sampleScalar = (progress: number, property: 'fov' | 'roll') => {
  const scaled = clampProgress(progress) * (CINEMATIC_GARDEN_RAIL_KEYFRAMES.length - 1)
  const index = Math.min(Math.floor(scaled), CINEMATIC_GARDEN_RAIL_KEYFRAMES.length - 2)
  const localProgress = THREE.MathUtils.smoothstep(scaled - index, 0, 1)
  return THREE.MathUtils.lerp(
    CINEMATIC_GARDEN_RAIL_KEYFRAMES[index][property],
    CINEMATIC_GARDEN_RAIL_KEYFRAMES[index + 1][property],
    localProgress,
  )
}

export function createCinematicRailPose(): CinematicRailPose {
  return {
    fov: CINEMATIC_GARDEN_RAIL_KEYFRAMES[0].fov,
    lookAt: new THREE.Vector3(...CINEMATIC_GARDEN_RAIL_KEYFRAMES[0].lookAt),
    position: new THREE.Vector3(...CINEMATIC_GARDEN_RAIL_KEYFRAMES[0].position),
    roll: CINEMATIC_GARDEN_RAIL_KEYFRAMES[0].roll,
  }
}

/** Allocation-free authored-rail sampling for render and physics loops. */
export function sampleCinematicGardenRail(progress: number, target: CinematicRailPose) {
  const normalized = clampProgress(progress)
  positionCurve.getPointAt(normalized, target.position)
  lookCurve.getPointAt(normalized, target.lookAt)
  target.fov = sampleScalar(normalized, 'fov')
  target.roll = sampleScalar(normalized, 'roll')
  return target
}

/** Finds a stable re-entry point after the visitor has wandered off the rail. */
export function findNearestCinematicRailProgress(
  position: Pick<THREE.Vector3, 'x' | 'y' | 'z'>,
  samples = 160,
) {
  let closestDistanceSquared = Number.POSITIVE_INFINITY
  let closestProgress = 0
  const sample = new THREE.Vector3()
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples
    positionCurve.getPointAt(progress, sample)
    const x = sample.x - position.x
    const z = sample.z - position.z
    const distanceSquared = x * x + z * z
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared
      closestProgress = progress
    }
  }
  return closestProgress
}
