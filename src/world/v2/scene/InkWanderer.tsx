import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { InkOutlineShell, SumiSurfaceMaterial } from '../../../art'
import { getFreeRoamSnapshot } from '../runtime'
import {
  createBrushLeafGeometry,
  createDrapedVeilGeometry,
  createScholarStoneGeometry,
  createTaperedTubeGeometry,
} from './geometry'

function createRobeGeometry(
  height: number,
  shoulderWidth: number,
  waistWidth: number,
  hemWidth: number,
  depth: number,
  seed: number,
) {
  const radialSegments = 16
  const rings = [
    { t: 0, width: hemWidth, depth: depth * 1.06 },
    { t: 0.13, width: hemWidth * 0.98, depth },
    { t: 0.48, width: THREE.MathUtils.lerp(hemWidth, waistWidth, 0.68), depth: depth * 0.82 },
    { t: 0.7, width: waistWidth, depth: depth * 0.75 },
    { t: 0.88, width: shoulderWidth * 0.92, depth: depth * 0.86 },
    { t: 1, width: shoulderWidth, depth: depth * 0.92 },
  ]
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const windWeights: number[] = []

  rings.forEach((ring, ringIndex) => {
    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const u = segment / radialSegments
      const angle = u * Math.PI * 2
      const handVariation = 1
        + Math.sin(angle * 3 + seed * 0.73) * 0.022
        + Math.sin(angle * 7 - seed * 0.41) * 0.012
      const tornHem = ringIndex === 0
        ? (0.025 + Math.abs(Math.sin(angle * 4.5 + seed)) * 0.045) * (0.55 + Math.abs(Math.cos(angle)))
        : 0
      const fold = Math.sin(angle * 5 + ring.t * 3.4 + seed) * depth * 0.055 * (1 - ring.t * 0.55)
      positions.push(
        Math.cos(angle) * ring.width * 0.5 * handVariation,
        ring.t * height + tornHem,
        Math.sin(angle) * ring.depth * 0.5 * handVariation + fold,
      )
      uvs.push(u, ring.t)
      windWeights.push(Math.pow(1 - ring.t, 1.65) * 0.72)

      if (ringIndex < rings.length - 1 && segment < radialSegments) {
        const a = ringIndex * (radialSegments + 1) + segment
        const b = a + radialSegments + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aSumiWind', new THREE.Float32BufferAttribute(windWeights, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createTornPanelGeometry(width: number, height: number, seed: number) {
  const segmentsX = 10
  const segmentsY = 12
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const windWeights: number[] = []

  for (let yIndex = 0; yIndex <= segmentsY; yIndex += 1) {
    const v = yIndex / segmentsY
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const u = xIndex / segmentsX
      const centeredX = u - 0.5
      const taper = THREE.MathUtils.lerp(1, 0.72, v)
      const tornHem = yIndex === 0
        ? 0.025 + Math.abs(Math.sin(u * 20.5 + seed * 1.17)) * 0.075
        : 0
      const fold = Math.sin(u * Math.PI * 4 + v * 2.2 + seed) * 0.024
      positions.push(centeredX * width * taper, v * height + tornHem, fold)
      uvs.push(u, v)
      windWeights.push(Math.pow(1 - v, 1.45))

      if (xIndex < segmentsX && yIndex < segmentsY) {
        const a = yIndex * (segmentsX + 1) + xIndex
        const b = a + segmentsX + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aSumiWind', new THREE.Float32BufferAttribute(windWeights, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createLimbSegmentGeometry(length: number, radius: number, side: number, seed: number, bend = 0.025) {
  return createTaperedTubeGeometry([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * bend, -length * 0.52, 0.008),
    new THREE.Vector3(side * bend * 0.56, -length, -0.012),
  ], {
    endScale: 0.68,
    irregularity: 0.018,
    radialSegments: 8,
    radius,
    seed,
    startScale: 1,
    tubularSegments: 18,
  })
}

function createBellGeometry() {
  const profile = [
    new THREE.Vector2(0.018, 0.115),
    new THREE.Vector2(0.056, 0.09),
    new THREE.Vector2(0.07, 0.045),
    new THREE.Vector2(0.074, -0.025),
    new THREE.Vector2(0.1, -0.082),
    new THREE.Vector2(0.104, -0.104),
    new THREE.Vector2(0.025, -0.11),
  ]
  const geometry = new THREE.LatheGeometry(profile, 18)
  geometry.computeVertexNormals()
  return geometry
}

const HAIR_LOCKS = [
  { position: [-0.105, 1.91, 0.115] as const, rotation: [0.08, -0.17, Math.PI - 0.13] as const, scale: [0.78, 0.8, 0.78] as const },
  { position: [-0.015, 1.94, 0.145] as const, rotation: [0.16, 0.02, Math.PI + 0.03] as const, scale: [0.92, 1, 0.92] as const },
  { position: [0.09, 1.9, 0.11] as const, rotation: [0.1, 0.18, Math.PI + 0.16] as const, scale: [0.74, 0.76, 0.74] as const },
]

export function InkWanderer({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const root = useRef<THREE.Group>(null)
  const cloak = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const leftForearm = useRef<THREE.Group>(null)
  const rightForearm = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)
  const leftCalf = useRef<THREE.Group>(null)
  const rightCalf = useRef<THREE.Group>(null)
  const hair = useRef<THREE.Group>(null)
  const cordTails = useRef<THREE.Group>(null)
  const bell = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const geometries = useMemo(() => ({
    bell: createBellGeometry(),
    bellClapper: createScholarStoneGeometry(0.032, 119, 12),
    cord: createTaperedTubeGeometry([
      new THREE.Vector3(-0.29, 1.035, 0.205),
      new THREE.Vector3(-0.13, 1.01, 0.258),
      new THREE.Vector3(0.04, 1.018, 0.276),
      new THREE.Vector3(0.2, 1.005, 0.248),
      new THREE.Vector3(0.3, 1.035, 0.2),
    ], {
      endScale: 0.82,
      irregularity: 0.018,
      radialSegments: 7,
      radius: 0.018,
      seed: 72,
      startScale: 0.82,
      tubularSegments: 30,
    }),
    cordTailLeft: createTaperedTubeGeometry([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.018, -0.16, 0.012),
      new THREE.Vector3(0.028, -0.34, -0.004),
    ], {
      endScale: 0.28,
      irregularity: 0.025,
      radialSegments: 6,
      radius: 0.017,
      seed: 132,
      startScale: 0.82,
      tubularSegments: 18,
    }),
    cordTailRight: createTaperedTubeGeometry([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.025, -0.13, 0.018),
      new THREE.Vector3(-0.015, -0.285, 0.008),
    ], {
      endScale: 0.24,
      irregularity: 0.025,
      radialSegments: 6,
      radius: 0.015,
      seed: 144,
      startScale: 0.78,
      tubularSegments: 18,
    }),
    cuff: createRobeGeometry(0.105, 0.115, 0.102, 0.092, 0.105, 91),
    foot: createScholarStoneGeometry(0.085, 103, 14),
    forearmLeft: createLimbSegmentGeometry(0.31, 0.047, -1, 31, 0.018),
    forearmRight: createLimbSegmentGeometry(0.31, 0.047, 1, 47, 0.018),
    hairCap: createScholarStoneGeometry(0.235, 93, 22),
    hairLock: createBrushLeafGeometry(0.49, 0.15, 0.1, 12),
    hand: createScholarStoneGeometry(0.072, 67, 14),
    head: createScholarStoneGeometry(0.215, 57, 22),
    innerRobe: createRobeGeometry(1.08, 0.42, 0.31, 0.49, 0.31, 17),
    knee: createScholarStoneGeometry(0.065, 88, 12),
    lowerLegLeft: createLimbSegmentGeometry(0.3, 0.052, -1, 59, 0.012),
    lowerLegRight: createLimbSegmentGeometry(0.3, 0.052, 1, 61, 0.012),
    mantle: createDrapedVeilGeometry(0.76, 0.42, 20, 16),
    neck: createTaperedTubeGeometry([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.15, 0),
    ], {
      endScale: 0.88,
      irregularity: 0.01,
      radialSegments: 10,
      radius: 0.075,
      seed: 39,
      tubularSegments: 10,
    }),
    outerRobe: createRobeGeometry(1.17, 0.5, 0.35, 0.61, 0.36, 23),
    sash: createRobeGeometry(0.135, 0.385, 0.37, 0.39, 0.315, 77),
    tornPanelInner: createTornPanelGeometry(0.4, 0.92, 46),
    tornPanelLeft: createTornPanelGeometry(0.37, 0.98, 28),
    tornPanelRight: createTornPanelGeometry(0.34, 0.88, 35),
    upperArmLeft: createLimbSegmentGeometry(0.33, 0.063, -1, 27),
    upperArmRight: createLimbSegmentGeometry(0.33, 0.063, 1, 41),
    upperLegLeft: createLimbSegmentGeometry(0.3, 0.068, -1, 73, 0.01),
    upperLegRight: createLimbSegmentGeometry(0.3, 0.068, 1, 79, 0.01),
  }), [])

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose())
  }, [geometries])

  useFrame((_, delta) => {
    const motion = getFreeRoamSnapshot().motion
    const locomotion = THREE.MathUtils.clamp(motion.speed / 4.8, 0, 1)
    if (!reducedMotion && motion.moving) phase.current += delta * (5.4 + locomotion * 3.2)

    const stride = reducedMotion || !motion.moving ? 0 : Math.sin(phase.current) * 0.58 * locomotion
    const settle = (group: THREE.Group | null, target: number, damping: number) => {
      if (group) group.rotation.x = THREE.MathUtils.damp(group.rotation.x, target, damping, delta)
    }
    settle(leftLeg.current, stride, 13)
    settle(rightLeg.current, -stride, 13)
    settle(leftArm.current, -stride * 0.68, 11)
    settle(rightArm.current, stride * 0.68, 11)
    settle(leftForearm.current, 0.12 + Math.max(0, stride) * 0.24, 12)
    settle(rightForearm.current, 0.12 + Math.max(0, -stride) * 0.24, 12)
    settle(leftCalf.current, -0.06 + Math.max(0, -stride) * 0.58, 14)
    settle(rightCalf.current, -0.06 + Math.max(0, stride) * 0.58, 14)

    if (root.current) {
      root.current.position.y = reducedMotion ? 0 : Math.abs(Math.sin(phase.current * 2)) * 0.022 * locomotion
    }
    if (cloak.current) {
      cloak.current.rotation.x = THREE.MathUtils.damp(
        cloak.current.rotation.x,
        reducedMotion ? -0.025 : -0.025 - locomotion * 0.045 + Math.sin(phase.current * 0.5) * 0.012,
        6,
        delta,
      )
    }
    if (hair.current) {
      hair.current.rotation.z = THREE.MathUtils.damp(
        hair.current.rotation.z,
        reducedMotion ? 0 : Math.sin(phase.current * 0.46) * 0.035 * locomotion,
        5,
        delta,
      )
    }
    if (cordTails.current) {
      cordTails.current.rotation.z = THREE.MathUtils.damp(
        cordTails.current.rotation.z,
        reducedMotion ? 0 : Math.sin(phase.current * 0.82 + 0.7) * 0.06 * locomotion,
        7,
        delta,
      )
    }
    if (bell.current) {
      bell.current.rotation.z = THREE.MathUtils.damp(
        bell.current.rotation.z,
        reducedMotion ? 0 : Math.sin(phase.current + 0.35) * 0.13 * locomotion,
        9,
        delta,
      )
    }
  })

  return (
    <group name="ink-wanderer" ref={root}>
      <group position={[0, 1.41, 0]} ref={cloak}>
        <mesh castShadow geometry={geometries.innerRobe} position={[0, -1.24, 0.005]}>
          <SumiSurfaceMaterial role="indigo" />
        </mesh>
        <mesh castShadow geometry={geometries.outerRobe} position={[0, -1.17, 0]}>
          <SumiSurfaceMaterial role="washi" />
        </mesh>
        <InkOutlineShell geometry={geometries.outerRobe} position={[0, -1.17, 0]} profile="hero" widthPx={1.6} />
        <mesh
          castShadow
          geometry={geometries.tornPanelInner}
          position={[0, -1.17, 0.205]}
          rotation={[0, 0, 0.015]}
        >
          <SumiSurfaceMaterial role="indigo" side={THREE.DoubleSide} windResponse={0.08} />
        </mesh>
        <mesh
          castShadow
          geometry={geometries.tornPanelLeft}
          position={[-0.115, -1.14, 0.218]}
          rotation={[0, -0.2, -0.035]}
        >
          <SumiSurfaceMaterial role="washi" side={THREE.DoubleSide} windResponse={0.1} />
        </mesh>
        <mesh
          castShadow
          geometry={geometries.tornPanelRight}
          position={[0.135, -1.08, 0.224]}
          rotation={[0, 0.22, 0.045]}
        >
          <SumiSurfaceMaterial role="washi" side={THREE.DoubleSide} windResponse={0.12} />
        </mesh>
      </group>

      <mesh castShadow geometry={geometries.sash} position={[0, 0.93, 0]}>
        <SumiSurfaceMaterial role="indigo" />
      </mesh>
      <mesh castShadow geometry={geometries.cord}>
        <SumiSurfaceMaterial role="vermilion" />
      </mesh>
      <group position={[0.22, 1.01, 0.255]} ref={cordTails}>
        <mesh castShadow geometry={geometries.cordTailLeft}>
          <SumiSurfaceMaterial role="vermilion" windResponse={0.18} />
        </mesh>
        <mesh castShadow geometry={geometries.cordTailRight} position={[0.045, 0.005, -0.012]}>
          <SumiSurfaceMaterial role="vermilion" windResponse={0.2} />
        </mesh>
      </group>
      <group position={[0.325, 0.91, 0.205]} ref={bell} rotation={[0.08, 0, -0.08]}>
        <mesh castShadow geometry={geometries.bell}>
          <SumiSurfaceMaterial role="metal" />
        </mesh>
        <InkOutlineShell geometry={geometries.bell} profile="detail" widthPx={0.7} />
        <mesh castShadow geometry={geometries.bellClapper} position={[0, -0.105, 0]} scale={[0.74, 0.84, 0.74]}>
          <SumiSurfaceMaterial role="timber" />
        </mesh>
      </group>

      <mesh castShadow geometry={geometries.mantle} position={[0, 1.35, 0.205]} scale={[1, 0.76, 1]}>
        <SumiSurfaceMaterial role="indigo" side={THREE.DoubleSide} />
      </mesh>
      <InkOutlineShell
        geometry={geometries.mantle}
        position={[0, 1.35, 0.205]}
        profile="detail"
        scale={[1, 0.76, 1]}
        widthPx={0.8}
      />
      <mesh castShadow geometry={geometries.neck} position={[0, 1.39, 0]}>
        <SumiSurfaceMaterial role="washi" />
      </mesh>
      <mesh castShadow geometry={geometries.head} position={[0, 1.7, -0.005]} scale={[0.76, 1.08, 0.74]}>
        <SumiSurfaceMaterial role="washi" />
      </mesh>
      <InkOutlineShell
        geometry={geometries.head}
        position={[0, 1.7, -0.005]}
        profile="detail"
        scale={[0.76, 1.08, 0.74]}
        widthPx={0.9}
      />
      <mesh castShadow geometry={geometries.hairCap} position={[0, 1.855, 0.025]} scale={[0.91, 0.7, 0.86]}>
        <SumiSurfaceMaterial role="timber" />
      </mesh>
      <InkOutlineShell
        geometry={geometries.hairCap}
        position={[0, 1.855, 0.025]}
        profile="detail"
        scale={[0.91, 0.7, 0.86]}
        widthPx={0.75}
      />
      <group ref={hair}>
        {HAIR_LOCKS.map((lock, index) => (
          <mesh
            castShadow
            geometry={geometries.hairLock}
            key={index}
            position={lock.position}
            rotation={lock.rotation}
            scale={lock.scale}
          >
            <SumiSurfaceMaterial role="timber" side={THREE.DoubleSide} windResponse={0.12 + index * 0.025} />
          </mesh>
        ))}
      </group>

      <group position={[-0.285, 1.36, 0]} ref={leftArm} rotation={[0.08, 0, -0.12]}>
        <mesh castShadow geometry={geometries.upperArmLeft}>
          <SumiSurfaceMaterial role="washi" />
        </mesh>
        <group position={[-0.01, -0.325, -0.005]} ref={leftForearm} rotation={[0.12, 0, 0.05]}>
          <mesh castShadow geometry={geometries.forearmLeft}>
            <SumiSurfaceMaterial role="washi" />
          </mesh>
          <mesh castShadow geometry={geometries.cuff} position={[-0.005, -0.265, 0]}>
            <SumiSurfaceMaterial role="indigo" />
          </mesh>
          <mesh castShadow geometry={geometries.hand} position={[-0.012, -0.33, -0.008]} scale={[0.58, 1.1, 0.58]}>
            <SumiSurfaceMaterial role="washi" />
          </mesh>
        </group>
      </group>
      <group position={[0.285, 1.36, 0]} ref={rightArm} rotation={[0.08, 0, 0.12]}>
        <mesh castShadow geometry={geometries.upperArmRight}>
          <SumiSurfaceMaterial role="washi" />
        </mesh>
        <group position={[0.01, -0.325, -0.005]} ref={rightForearm} rotation={[0.12, 0, -0.05]}>
          <mesh castShadow geometry={geometries.forearmRight}>
            <SumiSurfaceMaterial role="washi" />
          </mesh>
          <mesh castShadow geometry={geometries.cuff} position={[0.005, -0.265, 0]}>
            <SumiSurfaceMaterial role="indigo" />
          </mesh>
          <mesh castShadow geometry={geometries.hand} position={[0.012, -0.33, -0.008]} scale={[0.58, 1.1, 0.58]}>
            <SumiSurfaceMaterial role="washi" />
          </mesh>
        </group>
      </group>

      <group position={[-0.125, 0.68, 0]} ref={leftLeg}>
        <mesh castShadow geometry={geometries.upperLegLeft}>
          <SumiSurfaceMaterial role="indigo" />
        </mesh>
        <mesh castShadow geometry={geometries.knee} position={[-0.005, -0.3, 0]} scale={[0.82, 0.72, 0.78]}>
          <SumiSurfaceMaterial role="indigo" />
        </mesh>
        <group position={[-0.005, -0.3, 0]} ref={leftCalf} rotation={[-0.06, 0, 0]}>
          <mesh castShadow geometry={geometries.lowerLegLeft}>
            <SumiSurfaceMaterial role="indigo" />
          </mesh>
          <mesh castShadow geometry={geometries.foot} position={[-0.008, -0.315, -0.055]} scale={[0.72, 0.58, 1.32]}>
            <SumiSurfaceMaterial role="timber" />
          </mesh>
        </group>
      </group>
      <group position={[0.125, 0.68, 0]} ref={rightLeg}>
        <mesh castShadow geometry={geometries.upperLegRight}>
          <SumiSurfaceMaterial role="indigo" />
        </mesh>
        <mesh castShadow geometry={geometries.knee} position={[0.005, -0.3, 0]} scale={[0.82, 0.72, 0.78]}>
          <SumiSurfaceMaterial role="indigo" />
        </mesh>
        <group position={[0.005, -0.3, 0]} ref={rightCalf} rotation={[-0.06, 0, 0]}>
          <mesh castShadow geometry={geometries.lowerLegRight}>
            <SumiSurfaceMaterial role="indigo" />
          </mesh>
          <mesh castShadow geometry={geometries.foot} position={[0.008, -0.315, -0.055]} scale={[0.72, 0.58, 1.32]}>
            <SumiSurfaceMaterial role="timber" />
          </mesh>
        </group>
      </group>
    </group>
  )
}
