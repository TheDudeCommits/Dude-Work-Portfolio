import * as THREE from 'three'
import type { Vector3Tuple } from '../v2/runtime/types'

export interface V3CinematicRailBeat {
  fov: number
  id: string
  lookAt: Vector3Tuple
  position: Vector3Tuple
  progress: number
  roll: number
}

export interface V3CinematicRailPose {
  fov: number
  lookAt: THREE.Vector3
  position: THREE.Vector3
  roll: number
}

/**
 * Scroll beats are intentionally uneven: the threshold and bridge crest have
 * extra screen time, while the physical capsule continues along one smooth
 * path that can hand off to free roaming at any point.
 */
export const V3_GATE_BRIDGE_RAIL_BEATS = [
  {
    fov: 38,
    id: 'washi-arrival',
    lookAt: [0.85, 2.2, 11.7],
    position: [-6.8, 2.32, 27.8],
    progress: 0,
    roll: -0.008,
  },
  {
    fov: 42,
    id: 'gate-in-landscape',
    lookAt: [0, 2.7, 11.7],
    position: [3.9, 1.75, 22.2],
    progress: 0.12,
    roll: 0.012,
  },
  {
    fov: 44,
    id: 'torii-crown',
    lookAt: [0, 3.4, 11.7],
    position: [-1.4, 1.25, 17.3],
    progress: 0.25,
    roll: -0.006,
  },
  {
    fov: 48,
    id: 'threshold-parallax',
    lookAt: [-4.8, 2.35, -2.5],
    position: [-2.1, 1.05, 10.8],
    progress: 0.35,
    roll: -0.014,
  },
  {
    fov: 51,
    id: 'pond-reveal',
    lookAt: [-2.8, 0.55, -3.4],
    position: [-4.9, 1.05, 6.4],
    progress: 0.48,
    roll: 0.01,
  },
  {
    fov: 52,
    id: 'bridge-ink-profile',
    lookAt: [0, 1.5, -3.4],
    position: [-10.5, 2.4, 0.8],
    progress: 0.6,
    roll: -0.012,
  },
  {
    fov: 42,
    id: 'bridge-left-landing',
    lookAt: [-0.4, 2.72, -3.4],
    position: [-7.05, 1.3, -3.4],
    progress: 0.7,
    roll: -0.004,
  },
  {
    fov: 50,
    id: 'bridge-crest',
    lookAt: [12.4, 2.6, -11.5],
    position: [0, 2.98, -3.4],
    progress: 0.82,
    roll: 0.009,
  },
  {
    fov: 54,
    id: 'bridge-right-descent',
    lookAt: [12.4, 2.65, -11.5],
    position: [6.7, 3.35, -2.5],
    progress: 0.92,
    roll: -0.009,
  },
  {
    fov: 60,
    id: 'project-reliquary',
    lookAt: [12.4, 3, -12.9],
    position: [12.4, 1.9, -3.8],
    progress: 1,
    roll: 0.006,
  },
] as const satisfies readonly V3CinematicRailBeat[]

const positionCurve = new THREE.CatmullRomCurve3(
  V3_GATE_BRIDGE_RAIL_BEATS.map((beat) => new THREE.Vector3(...beat.position)),
  false,
  'centripetal',
  0.42,
)

const lookCurve = new THREE.CatmullRomCurve3(
  V3_GATE_BRIDGE_RAIL_BEATS.map((beat) => new THREE.Vector3(...beat.lookAt)),
  false,
  'centripetal',
  0.42,
)

const clampProgress = (progress: number) => THREE.MathUtils.clamp(progress, 0, 1)

export function locateV3CinematicRailBeat(progress: number) {
  const normalized = clampProgress(progress)
  const finalIndex = V3_GATE_BRIDGE_RAIL_BEATS.length - 1
  if (normalized >= 1) return { index: finalIndex - 1, localProgress: 1 }

  let index = 0
  while (
    index < finalIndex - 1
    && normalized >= V3_GATE_BRIDGE_RAIL_BEATS[index + 1].progress
  ) index += 1
  const current = V3_GATE_BRIDGE_RAIL_BEATS[index]
  const next = V3_GATE_BRIDGE_RAIL_BEATS[index + 1]
  const span = Math.max(next.progress - current.progress, 0.0001)
  return {
    index,
    localProgress: THREE.MathUtils.clamp((normalized - current.progress) / span, 0, 1),
  }
}

function sampleScalar(index: number, localProgress: number, property: 'fov' | 'roll') {
  const current = V3_GATE_BRIDGE_RAIL_BEATS[index]
  const next = V3_GATE_BRIDGE_RAIL_BEATS[index + 1]
  const eased = THREE.MathUtils.smoothstep(localProgress, 0, 1)
  return THREE.MathUtils.lerp(current[property], next[property], eased)
}

export const V3_GATE_BRIDGE_RAIL_LENGTH = positionCurve.getLength()

export function createV3CinematicRailPose(): V3CinematicRailPose {
  const initial = V3_GATE_BRIDGE_RAIL_BEATS[0]
  return {
    fov: initial.fov,
    lookAt: new THREE.Vector3(...initial.lookAt),
    position: new THREE.Vector3(...initial.position),
    roll: initial.roll,
  }
}

/** Allocation-free authored rail sampling for the camera and Rapier loop. */
export function sampleV3CinematicRail(progress: number, target: V3CinematicRailPose) {
  const location = locateV3CinematicRailBeat(progress)
  const eased = THREE.MathUtils.smootherstep(location.localProgress, 0, 1)
  const curveProgress = (location.index + eased) / (V3_GATE_BRIDGE_RAIL_BEATS.length - 1)
  positionCurve.getPoint(curveProgress, target.position)
  lookCurve.getPoint(curveProgress, target.lookAt)
  target.fov = sampleScalar(location.index, location.localProgress, 'fov')
  target.roll = sampleScalar(location.index, location.localProgress, 'roll')
  return target
}

export function findNearestV3CinematicRailProgress(
  position: Pick<THREE.Vector3, 'x' | 'y' | 'z'>,
  samples = 192,
) {
  let closestDistanceSquared = Number.POSITIVE_INFINITY
  let closestProgress = 0
  const pose = createV3CinematicRailPose()
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples
    sampleV3CinematicRail(progress, pose)
    const x = pose.position.x - position.x
    const z = pose.position.z - position.z
    const distanceSquared = x * x + z * z
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared
      closestProgress = progress
    }
  }
  return closestProgress
}

export const V3_GATE_BRIDGE_RAIL_ADAPTER = {
  createPose: createV3CinematicRailPose,
  findNearestProgress: findNearestV3CinematicRailProgress,
  keyframes: V3_GATE_BRIDGE_RAIL_BEATS,
  length: V3_GATE_BRIDGE_RAIL_LENGTH,
  sample: sampleV3CinematicRail,
} as const

/**
 * Drop-in aliases for the existing FreeRoamPlayer and FreeRoamCamera imports.
 * Root integration only needs to switch their rail import path to this module.
 */
export type CinematicRailKeyframe = V3CinematicRailBeat
export type CinematicRailPose = V3CinematicRailPose
export const CINEMATIC_GARDEN_RAIL_KEYFRAMES = V3_GATE_BRIDGE_RAIL_BEATS
export const CINEMATIC_GARDEN_RAIL_LENGTH = V3_GATE_BRIDGE_RAIL_LENGTH
export const createCinematicRailPose = createV3CinematicRailPose
export const sampleCinematicGardenRail = sampleV3CinematicRail
export const findNearestCinematicRailProgress = findNearestV3CinematicRailProgress
