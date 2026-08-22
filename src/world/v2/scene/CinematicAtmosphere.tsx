import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SumiSurfaceMaterial } from '../../../art'
import {
  circleStrokePoints,
  createDrapedVeilGeometry,
  createOrganicPlateGeometry,
  createOrganicSurfaceGeometry,
  createTaperedTubeGeometry,
} from './geometry'
import { GardenSurface, GardenWater } from './materials'

interface MistBankSpec {
  drift: number
  opacity: number
  phase: number
  position: readonly [number, number, number]
  role: 'indigo' | 'washi'
  rotation: readonly [number, number, number]
  scale: readonly [number, number, number]
}

const MIST_BANKS: readonly MistBankSpec[] = [
  {
    drift: 0.2,
    opacity: 0.12,
    phase: 0.2,
    position: [-2.8, 3.45, 23.6],
    role: 'washi',
    rotation: [0.02, 0.08, -0.025],
    scale: [18, 5.8, 1],
  },
  {
    drift: 0.28,
    opacity: 0.075,
    phase: 2.4,
    position: [7.4, 4.3, 17.2],
    role: 'indigo',
    rotation: [-0.03, -0.18, 0.055],
    scale: [14, 4.6, 1],
  },
  {
    drift: 0.16,
    opacity: 0.1,
    phase: 4.5,
    position: [-8.5, 3.15, 8.4],
    role: 'washi',
    rotation: [0.04, 0.23, -0.04],
    scale: [20, 4.9, 1],
  },
  {
    drift: 0.24,
    opacity: 0.065,
    phase: 1.6,
    position: [10.2, 3.65, -4.2],
    role: 'indigo',
    rotation: [-0.02, -0.24, 0.045],
    scale: [18, 5.4, 1],
  },
  {
    drift: 0.13,
    opacity: 0.11,
    phase: 3.3,
    position: [-7.4, 4.4, -14.9],
    role: 'washi',
    rotation: [0.03, 0.18, -0.035],
    scale: [22, 6.4, 1],
  },
  {
    drift: 0.18,
    opacity: 0.08,
    phase: 5.7,
    position: [5.4, 6.1, -25.8],
    role: 'indigo',
    rotation: [0.01, -0.12, 0.03],
    scale: [29, 9.4, 1],
  },
] as const

const MIRROR_FIELDS = [
  { position: [-7.3, -0.16, 20.8] as const, radius: [5.1, 3.1] as const, rotation: -0.2, seed: 421 },
  { position: [8.1, -0.17, 18.4] as const, radius: [5.7, 3.45] as const, rotation: 0.28, seed: 449 },
  { position: [-10.7, -0.18, -24.9] as const, radius: [6.7, 3.75] as const, rotation: 0.36, seed: 487 },
  { position: [11.4, -0.19, -27.1] as const, radius: [7.2, 4.15] as const, rotation: -0.32, seed: 521 },
] as const

function addWindMask(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const weights = new Float32Array(position.count)

  for (let index = 0; index < position.count; index += 1) {
    const height = uv ? uv.getY(index) : THREE.MathUtils.clamp(position.getY(index) + 0.5, 0, 1)
    weights[index] = 0.18 + THREE.MathUtils.smoothstep(height, 0.04, 1) * 0.82
  }

  geometry.setAttribute('aSumiWind', new THREE.BufferAttribute(weights, 1))
  return geometry
}

function ProcessionalMist({ reducedMotion }: { reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null)
  const veil = useMemo(() => addWindMask(createDrapedVeilGeometry(1, 1, 34, 26)), [])

  useFrame(({ clock }) => {
    if (!root.current) return
    const time = reducedMotion ? 0 : clock.elapsedTime
    root.current.children.forEach((child, index) => {
      const bank = MIST_BANKS[index]
      child.position.set(
        bank.position[0] + Math.sin(time * bank.drift + bank.phase) * (0.28 + index * 0.055),
        bank.position[1] + Math.cos(time * bank.drift * 0.72 + bank.phase) * 0.075,
        bank.position[2],
      )
      child.rotation.z = bank.rotation[2] + Math.sin(time * bank.drift * 0.54 + bank.phase) * 0.018
    })
  })

  return (
    <group name="cinematic-processional-mist" ref={root}>
      {MIST_BANKS.map((bank, index) => (
        <mesh
          geometry={veil}
          key={`${bank.position[2]}-${bank.role}`}
          position={[...bank.position]}
          renderOrder={30 + index}
          rotation={[...bank.rotation]}
          scale={[...bank.scale]}
        >
          <SumiSurfaceMaterial
            depthWrite={false}
            inkResponse={bank.role === 'indigo' ? 0.58 : 0.18}
            opacity={bank.opacity}
            paperResponse={0.92}
            role={bank.role}
            side={THREE.DoubleSide}
            transparent
            windResponse={reducedMotion ? 0.015 : 0.34 + index * 0.035}
          />
        </mesh>
      ))}
    </group>
  )
}

function ShallowMirrorFields({ reducedMotion }: { reducedMotion: boolean }) {
  const fields = useMemo(() => MIRROR_FIELDS.map((field) => ({
    ...field,
    basin: createOrganicPlateGeometry(
      field.radius[0] + 0.38,
      field.radius[1] + 0.32,
      0.34,
      field.seed + 13,
      72,
    ),
    water: createOrganicSurfaceGeometry(field.radius[0], field.radius[1], field.seed, 86),
  })), [])

  return (
    <group name="cinematic-shallow-mirror-fields">
      {fields.map((field, index) => (
        <group
          key={field.seed}
          position={[...field.position]}
          rotation={[0, field.rotation, 0]}
        >
          <mesh geometry={field.basin} position={[0, -0.23, 0]} receiveShadow>
            <GardenSurface role={index % 2 === 0 ? 'indigo' : 'stone'} />
          </mesh>
          <mesh geometry={field.water} position={[0, 0, 0]} renderOrder={8}>
            <GardenWater reducedMotion={reducedMotion} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function DistantVermilionSun() {
  const geometry = useMemo(() => ({
    disc: createOrganicSurfaceGeometry(5.35, 5.05, 631, 112),
    enso: createTaperedTubeGeometry(circleStrokePoints(5.72, 5.48, -2.72, 3.23, 32), {
      endScale: 0.02,
      irregularity: 0.14,
      radialSegments: 7,
      radius: 0.105,
      seed: 647,
      startScale: 0.86,
      tubularSegments: 116,
    }),
  }), [])

  return (
    <group name="distant-vermilion-sun" position={[9.4, 13.8, -44.5]}>
      <mesh geometry={geometry.disc} renderOrder={-8} rotation={[Math.PI / 2, 0, 0]}>
        <SumiSurfaceMaterial
          depthWrite={false}
          opacity={0.24}
          role="vermilion"
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <mesh geometry={geometry.enso} renderOrder={-7}>
        <GardenSurface role="vermilion" />
      </mesh>
    </group>
  )
}

export function CinematicAtmosphere({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group name="cinematic-atmosphere">
      <ShallowMirrorFields reducedMotion={reducedMotion} />
      <DistantVermilionSun />
      <ProcessionalMist reducedMotion={reducedMotion} />
    </group>
  )
}
