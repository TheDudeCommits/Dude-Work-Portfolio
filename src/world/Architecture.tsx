import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ProgressRef } from './types'

type ArchitectureMaterials = {
  ember: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  paper: THREE.MeshStandardMaterial
  roof: THREE.MeshStandardMaterial
  rope: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  timber: THREE.MeshStandardMaterial
  vermilion: THREE.MeshStandardMaterial
}

type Point3 = [number, number, number]

const lanternPositions: Array<{ position: Point3; rotation: number; scale: number }> = [
  { position: [-4.25, 0, 2.2], rotation: 0.08, scale: 0.94 },
  { position: [4.55, 0, -3.2], rotation: -0.12, scale: 1.05 },
  { position: [-4.45, 0, -8.8], rotation: 0.16, scale: 0.9 },
  { position: [4.35, 0, -14.4], rotation: -0.08, scale: 0.98 },
  { position: [-4.6, 0, -20.1], rotation: 0.1, scale: 1.08 },
  { position: [4.5, 0, -26.1], rotation: -0.14, scale: 1.02 },
  { position: [-4.75, 0, -31.1], rotation: 0.06, scale: 1.13 },
  { position: [4.75, 0, -31.1], rotation: -0.05, scale: 1.13 },
]

function makeTubeGeometry(points: THREE.Vector3[], radius: number, tubularSegments = 48, radialSegments = 7) {
  const curve = new THREE.CatmullRomCurve3(points)
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)
}

function makeSweptRoofGeometry(
  width: number,
  depth: number,
  rise: number,
  thickness: number,
  segmentsX = 18,
  segmentsZ = 14,
) {
  const geometry = new THREE.BufferGeometry()
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const rowSize = segmentsX + 1
  const layerSize = rowSize * (segmentsZ + 1)
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const surfaceY = (x: number, z: number) => {
    const xEdge = Math.abs(x) / halfWidth
    const zEdge = Math.abs(z) / halfDepth
    const gable = rise * (1 - zEdge)
    const cornerSweep = Math.pow(xEdge, 4) * 0.42 + Math.pow(zEdge, 8) * 0.2
    return gable + cornerSweep
  }

  for (let layer = 0; layer < 2; layer += 1) {
    for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
      const v = zIndex / segmentsZ
      const z = THREE.MathUtils.lerp(-halfDepth, halfDepth, v)
      for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
        const u = xIndex / segmentsX
        const x = THREE.MathUtils.lerp(-halfWidth, halfWidth, u)
        positions.push(x, surfaceY(x, z) - layer * thickness, z)
        uvs.push(u, v)
      }
    }
  }

  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const a = zIndex * rowSize + xIndex
      const b = a + 1
      const c = a + rowSize + 1
      const d = a + rowSize
      indices.push(a, d, b, b, d, c)
      indices.push(layerSize + a, layerSize + b, layerSize + d)
      indices.push(layerSize + b, layerSize + c, layerSize + d)
    }
  }

  const addSide = (a: number, b: number) => {
    const lowerA = layerSize + a
    const lowerB = layerSize + b
    indices.push(a, b, lowerA, b, lowerB, lowerA)
  }

  for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
    addSide(xIndex, xIndex + 1)
    const far = segmentsZ * rowSize + xIndex
    addSide(far + 1, far)
  }
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    const near = zIndex * rowSize
    addSide(near + rowSize, near)
    const far = zIndex * rowSize + segmentsX
    addSide(far, far + rowSize)
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function CurvedBeam({
  material,
  points,
  radius,
  radialSegments = 7,
}: {
  material: THREE.Material
  points: Point3[]
  radius: number
  radialSegments?: number
}) {
  const geometry = useMemo(
    () => makeTubeGeometry(points.map((point) => new THREE.Vector3(...point)), radius, 52, radialSegments),
    [points, radialSegments, radius],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh castShadow geometry={geometry} material={material} receiveShadow />
}

function Shide({ x, materials }: { x: number; materials: ArchitectureMaterials }) {
  return (
    <group position={[x, 5.67, 0.48]}>
      <mesh castShadow material={materials.paper} position={[0, -0.18, 0]}>
        <boxGeometry args={[0.12, 0.43, 0.045]} />
      </mesh>
      <mesh castShadow material={materials.paper} position={[0.12, -0.39, 0]} rotation={[0, 0, -0.54]}>
        <boxGeometry args={[0.12, 0.34, 0.045]} />
      </mesh>
      <mesh castShadow material={materials.paper} position={[0.24, -0.62, 0]}>
        <boxGeometry args={[0.12, 0.4, 0.045]} />
      </mesh>
      <mesh castShadow material={materials.paper} position={[0.36, -0.83, 0]} rotation={[0, 0, -0.54]}>
        <boxGeometry args={[0.12, 0.32, 0.045]} />
      </mesh>
      <mesh castShadow material={materials.paper} position={[0.48, -1.04, 0]}>
        <boxGeometry args={[0.12, 0.38, 0.045]} />
      </mesh>
    </group>
  )
}

function HeroTorii({ materials }: { materials: ArchitectureMaterials }) {
  const crownPoints = useMemo<Point3[]>(() => [
    [-5.15, 7.54, 0],
    [-3.7, 7.7, 0],
    [0, 7.78, 0],
    [3.7, 7.7, 0],
    [5.15, 7.54, 0],
  ], [])
  const ropePoints = useMemo<Point3[]>(() => [
    [-3.2, 6.08, 0.42],
    [-1.65, 5.82, 0.52],
    [0, 5.72, 0.56],
    [1.65, 5.82, 0.52],
    [3.2, 6.08, 0.42],
  ], [])

  return (
    <group position={[0, 0, 31]}>
      <mesh material={materials.stone} position={[-3.55, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.82, 0.32, 8]} />
      </mesh>
      <mesh material={materials.stone} position={[3.55, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.82, 0.32, 8]} />
      </mesh>
      {[-3.55, 3.55].map((x) => (
        <group key={x}>
          <mesh castShadow material={materials.vermilion} position={[x, 3.75, 0]} receiveShadow>
            <cylinderGeometry args={[0.34, 0.48, 7.35, 12]} />
          </mesh>
          <mesh castShadow material={materials.timber} position={[x, 6.45, 0]}>
            <cylinderGeometry args={[0.48, 0.48, 0.22, 12]} />
          </mesh>
          <mesh castShadow material={materials.gold} position={[x, 1.12, 0]}>
            <cylinderGeometry args={[0.43, 0.49, 0.11, 12]} />
          </mesh>
        </group>
      ))}
      <mesh castShadow material={materials.vermilion} position={[0, 6.62, 0]} receiveShadow>
        <boxGeometry args={[8.55, 0.52, 0.62]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[0, 7.18, 0]}>
        <boxGeometry args={[9.3, 0.25, 0.7]} />
      </mesh>
      <CurvedBeam material={materials.vermilion} points={crownPoints} radius={0.27} radialSegments={6} />
      <mesh castShadow material={materials.timber} position={[0, 5.88, -0.04]}>
        <boxGeometry args={[7.45, 0.18, 0.45]} />
      </mesh>
      {[-2.85, 2.85].map((x) => (
        <mesh castShadow key={x} material={materials.timber} position={[x, 6.28, -0.02]} rotation={[0, 0, x < 0 ? -0.28 : 0.28]}>
          <boxGeometry args={[0.27, 1.35, 0.48]} />
        </mesh>
      ))}
      <CurvedBeam material={materials.rope} points={ropePoints} radius={0.075} radialSegments={8} />
      {[-2.35, -1.18, 0, 1.18, 2.35].map((x) => <Shide key={x} materials={materials} x={x} />)}
      <mesh castShadow material={materials.gold} position={[0, 6.6, 0.36]}>
        <cylinderGeometry args={[0.19, 0.19, 0.12, 24]} />
      </mesh>
    </group>
  )
}

function SacredBridge({ materials }: { materials: ArchitectureMaterials }) {
  const path = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.45, 4.25),
    new THREE.Vector3(0, 1.55, 2.1),
    new THREE.Vector3(0, 2.15, 0),
    new THREE.Vector3(0, 1.55, -2.1),
    new THREE.Vector3(0, 0.45, -4.25),
  ]), [])
  const railGeometries = useMemo(() => [-2.05, 2.05].map((x) => {
    const points = Array.from({ length: 25 }, (_, index) => {
      const point = path.getPointAt(index / 24)
      return new THREE.Vector3(x, point.y + 1.2, point.z)
    })
    return makeTubeGeometry(points, 0.115, 58, 7)
  }), [path])

  useEffect(() => () => railGeometries.forEach((geometry) => geometry.dispose()), [railGeometries])

  return (
    <group position={[0, 0, 12]}>
      <mesh material={materials.stone} position={[-2.1, 0.24, 4.5]} receiveShadow>
        <boxGeometry args={[1.35, 0.48, 1.25]} />
      </mesh>
      <mesh material={materials.stone} position={[2.1, 0.24, 4.5]} receiveShadow>
        <boxGeometry args={[1.35, 0.48, 1.25]} />
      </mesh>
      <mesh material={materials.stone} position={[-2.1, 0.24, -4.5]} receiveShadow>
        <boxGeometry args={[1.35, 0.48, 1.25]} />
      </mesh>
      <mesh material={materials.stone} position={[2.1, 0.24, -4.5]} receiveShadow>
        <boxGeometry args={[1.35, 0.48, 1.25]} />
      </mesh>
      {Array.from({ length: 21 }, (_, index) => {
        const t = index / 20
        const point = path.getPointAt(t)
        const tangent = path.getTangentAt(t)
        const slope = Math.atan2(tangent.y, -tangent.z)
        return (
          <mesh
            castShadow
            key={`deck-${index}`}
            material={index % 4 === 0 ? materials.vermilion : materials.timber}
            position={[0, point.y, point.z]}
            receiveShadow
            rotation={[slope, 0, 0]}
          >
            <boxGeometry args={[4.15, 0.18, 0.48]} />
          </mesh>
        )
      })}
      {railGeometries.map((geometry, index) => (
        <mesh castShadow geometry={geometry} key={index} material={materials.vermilion} />
      ))}
      {Array.from({ length: 7 }, (_, index) => {
        const t = index / 6
        const point = path.getPointAt(t)
        return [-2.05, 2.05].map((x) => (
          <group key={`${index}-${x}`} position={[x, point.y + 0.58, point.z]}>
            <mesh castShadow material={materials.vermilion}>
              <boxGeometry args={[0.16, 1.35, 0.16]} />
            </mesh>
            <mesh castShadow material={materials.gold} position={[0, 0.73, 0]}>
              <sphereGeometry args={[0.16, 10, 8]} />
            </mesh>
          </group>
        ))
      })}
      {[-1.18, 1.18].map((x) => (
        <mesh castShadow key={x} material={materials.timber} position={[x, 0.2, 0]}>
          <boxGeometry args={[0.34, 1.25, 0.34]} />
        </mesh>
      ))}
    </group>
  )
}

function StoneLantern({
  materials,
  position,
  rotation,
  scale,
}: {
  materials: ArchitectureMaterials
  position: Point3
  rotation: number
  scale: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh castShadow material={materials.stone} position={[0, 0.14, 0]} receiveShadow>
        <cylinderGeometry args={[0.64, 0.76, 0.28, 8]} />
      </mesh>
      <mesh castShadow material={materials.stone} position={[0, 0.4, 0]} receiveShadow>
        <boxGeometry args={[0.9, 0.2, 0.9]} />
      </mesh>
      <mesh castShadow material={materials.stone} position={[0, 1.15, 0]} receiveShadow>
        <cylinderGeometry args={[0.25, 0.34, 1.4, 6]} />
      </mesh>
      <mesh castShadow material={materials.stone} position={[0, 1.85, 0]}>
        <boxGeometry args={[0.9, 0.18, 0.9]} />
      </mesh>
      {[-0.33, 0.33].flatMap((x) => [-0.33, 0.33].map((z) => (
        <mesh castShadow key={`${x}-${z}`} material={materials.stone} position={[x, 2.25, z]}>
          <boxGeometry args={[0.15, 0.72, 0.15]} />
        </mesh>
      )))}
      <mesh material={materials.ember} position={[0, 2.23, 0]}>
        <boxGeometry args={[0.28, 0.42, 0.28]} />
      </mesh>
      <mesh castShadow material={materials.stone} position={[0, 2.63, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.95, 0.48, 4]} />
      </mesh>
      <mesh castShadow material={materials.stone} position={[0, 2.93, 0]}>
        <sphereGeometry args={[0.16, 8, 6]} />
      </mesh>
    </group>
  )
}

function BracketSet({ materials, position }: { materials: ArchitectureMaterials; position: Point3 }) {
  return (
    <group position={position}>
      <mesh castShadow material={materials.vermilion} position={[0, 0.1, 0]}>
        <boxGeometry args={[0.7, 0.18, 0.55]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[0, -0.12, 0]}>
        <boxGeometry args={[0.45, 0.25, 0.82]} />
      </mesh>
      <mesh castShadow material={materials.gold} position={[0, -0.3, 0]}>
        <boxGeometry args={[0.22, 0.2, 0.48]} />
      </mesh>
    </group>
  )
}

function PaperBay({
  materials,
  position,
  rotation = 0,
  width,
}: {
  materials: ArchitectureMaterials
  position: Point3
  rotation?: number
  width: number
}) {
  const verticals = Math.max(2, Math.round(width / 0.7))
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow material={materials.paper} receiveShadow>
        <boxGeometry args={[width, 3.75, 0.12]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[0, 1.92, 0.08]}>
        <boxGeometry args={[width + 0.18, 0.14, 0.18]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[0, -1.92, 0.08]}>
        <boxGeometry args={[width + 0.18, 0.14, 0.18]} />
      </mesh>
      {Array.from({ length: verticals + 1 }, (_, index) => (
        <mesh
          castShadow
          key={index}
          material={materials.timber}
          position={[THREE.MathUtils.lerp(-width / 2, width / 2, index / verticals), 0, 0.09]}
        >
          <boxGeometry args={[0.075, 3.84, 0.14]} />
        </mesh>
      ))}
      {[-0.95, 0, 0.95].map((y) => (
        <mesh castShadow key={y} material={materials.timber} position={[0, y, 0.09]}>
          <boxGeometry args={[width, 0.075, 0.14]} />
        </mesh>
      ))}
    </group>
  )
}

function FusumaDoors({
  doorMaps,
  materials,
  progressRef,
}: {
  doorMaps: [THREE.Texture, THREE.Texture]
  materials: ArchitectureMaterials
  progressRef: ProgressRef
}) {
  const leftDoor = useRef<THREE.Group>(null)
  const rightDoor = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const rawOpen = THREE.MathUtils.smoothstep(progressRef.current, 0.63, 0.76)
    const open = rawOpen * rawOpen * (3 - 2 * rawOpen)
    if (leftDoor.current) {
      leftDoor.current.position.x = THREE.MathUtils.damp(leftDoor.current.position.x, -1.9 - open * 3.65, 7.2, delta)
    }
    if (rightDoor.current) {
      rightDoor.current.position.x = THREE.MathUtils.damp(rightDoor.current.position.x, 1.9 + open * 3.65, 7.2, delta)
    }
  })

  const door = (side: 'left' | 'right', map: THREE.Texture) => (
    <group position={[side === 'left' ? -1.9 : 1.9, 3.6, 9.18]} ref={side === 'left' ? leftDoor : rightDoor}>
      <mesh castShadow material={materials.paper} receiveShadow>
        <boxGeometry args={[3.75, 4.45, 0.18]} />
      </mesh>
      <mesh castShadow position={[0, 0, 0.115]} receiveShadow>
        <boxGeometry args={[3.47, 4.15, 0.045]} />
        <meshPhysicalMaterial
          clearcoat={0.08}
          clearcoatRoughness={0.72}
          map={map}
          roughness={0.82}
          sheen={0.12}
          sheenColor="#b5986d"
          sheenRoughness={0.86}
          toneMapped={false}
        />
      </mesh>
      {[-1.82, 0, 1.82].map((x) => (
        <mesh castShadow key={x} material={materials.timber} position={[x, 0, 0.16]}>
          <boxGeometry args={[0.1, 4.55, 0.12]} />
        </mesh>
      ))}
      {[-2.18, 2.18].map((y) => (
        <mesh castShadow key={y} material={materials.timber} position={[0, y, 0.16]}>
          <boxGeometry args={[3.82, 0.1, 0.12]} />
        </mesh>
      ))}
      <mesh castShadow material={materials.gold} position={[side === 'left' ? 1.46 : -1.46, 0, 0.23]}>
        <boxGeometry args={[0.1, 0.58, 0.08]} />
      </mesh>
    </group>
  )

  return <>{door('left', doorMaps[0])}{door('right', doorMaps[1])}</>
}

function TempleRoof({
  depth,
  materials,
  position,
  rise,
  width,
}: {
  depth: number
  materials: ArchitectureMaterials
  position: Point3
  rise: number
  width: number
}) {
  const roofGeometry = useMemo(
    () => makeSweptRoofGeometry(width, depth, rise, 0.28),
    [depth, rise, width],
  )
  const frontEave = useMemo<Point3[]>(() => [
    [-width / 2, 0.42, depth / 2],
    [-width / 4, 0.13, depth / 2 + 0.06],
    [0, 0.04, depth / 2 + 0.08],
    [width / 4, 0.13, depth / 2 + 0.06],
    [width / 2, 0.42, depth / 2],
  ], [depth, width])
  const rearEave = useMemo<Point3[]>(() => frontEave.map(([x, y, z]) => [x, y, -z]), [frontEave])
  const ridge = useMemo<Point3[]>(() => [
    [-width / 2, rise + 0.43, 0],
    [-width / 4, rise + 0.12, 0],
    [0, rise + 0.04, 0],
    [width / 4, rise + 0.12, 0],
    [width / 2, rise + 0.43, 0],
  ], [rise, width])

  useEffect(() => () => roofGeometry.dispose(), [roofGeometry])

  return (
    <group position={position}>
      <mesh castShadow geometry={roofGeometry} material={materials.roof} receiveShadow />
      <CurvedBeam material={materials.vermilion} points={frontEave} radius={0.13} radialSegments={6} />
      <CurvedBeam material={materials.vermilion} points={rearEave} radius={0.13} radialSegments={6} />
      <CurvedBeam material={materials.gold} points={ridge} radius={0.1} radialSegments={7} />
      {[-width / 2, width / 2].map((x) => (
        <mesh castShadow key={x} material={materials.gold} position={[x, rise + 0.45, 0]}>
          <sphereGeometry args={[0.2, 10, 8]} />
        </mesh>
      ))}
    </group>
  )
}

function MonumentalPavilion({
  doorMaps,
  materials,
  progressRef,
}: {
  doorMaps: [THREE.Texture, THREE.Texture]
  materials: ArchitectureMaterials
  progressRef: ProgressRef
}) {
  const postPositions = useMemo(() => [
    [-6.25, -8.1],
    [6.25, -8.1],
    [-6.25, 0],
    [6.25, 0],
    [-6.25, 8.1],
    [6.25, 8.1],
  ] as const, [])
  const frontBrackets = useMemo(() => [-6.2, -4.1, -2.05, 0, 2.05, 4.1, 6.2], [])

  return (
    <group position={[0, 0, -43]}>
      <mesh castShadow material={materials.stone} position={[0, 0.43, 0]} receiveShadow>
        <boxGeometry args={[15.4, 0.86, 18.2]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[0, 1.02, 0]} receiveShadow>
        <boxGeometry args={[14.55, 0.36, 17.35]} />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh
          castShadow
          key={index}
          material={index === 4 ? materials.timber : materials.stone}
          position={[0, 0.16 + index * 0.19, 10.42 - index * 0.43]}
          receiveShadow
        >
          <boxGeometry args={[7.3 + index * 0.6, 0.32, 1.12]} />
        </mesh>
      ))}
      {postPositions.map(([x, z]) => (
        <group key={`${x}-${z}`}>
          <mesh castShadow material={materials.stone} position={[x, 1.17, z]}>
            <cylinderGeometry args={[0.46, 0.55, 0.34, 8]} />
          </mesh>
          <mesh castShadow material={materials.timber} position={[x, 4.15, z]} receiveShadow>
            <cylinderGeometry args={[0.31, 0.35, 5.75, 10]} />
          </mesh>
          <mesh castShadow material={materials.vermilion} position={[x, 6.78, z]}>
            <cylinderGeometry args={[0.41, 0.41, 0.22, 10]} />
          </mesh>
        </group>
      ))}
      <mesh castShadow material={materials.timber} position={[0, 6.45, 8.12]}>
        <boxGeometry args={[14.3, 0.48, 0.5]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[0, 6.45, -8.12]}>
        <boxGeometry args={[14.3, 0.48, 0.5]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[-6.24, 6.45, 0]}>
        <boxGeometry args={[0.5, 0.48, 16.5]} />
      </mesh>
      <mesh castShadow material={materials.timber} position={[6.24, 6.45, 0]}>
        <boxGeometry args={[0.5, 0.48, 16.5]} />
      </mesh>
      <PaperBay materials={materials} position={[-4.52, 3.72, 8.03]} width={2.7} />
      <PaperBay materials={materials} position={[4.52, 3.72, 8.03]} width={2.7} />
      <PaperBay materials={materials} position={[-6.16, 3.72, 0]} rotation={Math.PI / 2} width={15.5} />
      <PaperBay materials={materials} position={[6.16, 3.72, 0]} rotation={Math.PI / 2} width={15.5} />
      <FusumaDoors doorMaps={doorMaps} materials={materials} progressRef={progressRef} />
      {frontBrackets.map((x) => (
        <BracketSet key={`front-${x}`} materials={materials} position={[x, 6.18, 8.62]} />
      ))}
      {frontBrackets.map((x) => (
        <BracketSet key={`rear-${x}`} materials={materials} position={[x, 6.18, -8.62]} />
      ))}
      {[-5.8, -3, 0, 3, 5.8].map((z) => (
        <BracketSet key={`left-${z}`} materials={materials} position={[-6.7, 6.18, z]} />
      ))}
      {[-5.8, -3, 0, 3, 5.8].map((z) => (
        <BracketSet key={`right-${z}`} materials={materials} position={[6.7, 6.18, z]} />
      ))}
      <TempleRoof depth={20.15} materials={materials} position={[0, 6.62, 0]} rise={2.25} width={16.7} />

      <mesh castShadow material={materials.timber} position={[0, 8.68, -0.25]} receiveShadow>
        <boxGeometry args={[8.4, 0.34, 8.2]} />
      </mesh>
      {[-3.55, 3.55].flatMap((x) => [-3.15, 3.15].map((z) => (
        <mesh castShadow key={`upper-${x}-${z}`} material={materials.vermilion} position={[x, 10.08, z]}>
          <cylinderGeometry args={[0.23, 0.27, 2.85, 10]} />
        </mesh>
      )))}
      <PaperBay materials={materials} position={[0, 10, 3.12]} width={6.6} />
      <PaperBay materials={materials} position={[0, 10, -3.12]} width={6.6} />
      <TempleRoof depth={10.4} materials={materials} position={[0, 11.3, 0]} rise={1.55} width={10.6} />

      <group position={[4.35, 1.62, -3.25]}>
        <mesh castShadow material={materials.vermilion} position={[0, 0.52, 0]}>
          <boxGeometry args={[4.5, 1.05, 2.6]} />
        </mesh>
        <mesh castShadow material={materials.gold} position={[0, 1.25, 0]}>
          <cylinderGeometry args={[0.74, 0.74, 0.18, 32]} />
        </mesh>
        <mesh material={materials.ember} position={[0, 1.25, 0.18]}>
          <sphereGeometry args={[0.34, 18, 12]} />
        </mesh>
      </group>
      <pointLight color="#d69b4c" decay={2} distance={15} intensity={16} position={[0, 5, -3]} />
    </group>
  )
}

function createMaterials(): ArchitectureMaterials {
  return {
    ember: new THREE.MeshStandardMaterial({
      color: '#d7a151',
      emissive: '#c7772d',
      emissiveIntensity: 2.4,
      roughness: 0.42,
      toneMapped: false,
    }),
    gold: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.16,
      clearcoatRoughness: 0.42,
      color: '#9a7134',
      metalness: 0.56,
      roughness: 0.4,
    }),
    paper: new THREE.MeshPhysicalMaterial({
      color: '#d3c4a2',
      roughness: 0.9,
      sheen: 0.34,
      sheenColor: new THREE.Color('#f0dfbd'),
      sheenRoughness: 0.92,
      side: THREE.DoubleSide,
    }),
    roof: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.1,
      clearcoatRoughness: 0.8,
      color: '#1e211d',
      metalness: 0.08,
      roughness: 0.78,
      sheen: 0.13,
      sheenColor: new THREE.Color('#514638'),
      sheenRoughness: 0.9,
    }),
    rope: new THREE.MeshStandardMaterial({ color: '#a48a58', roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({
      color: '#55574f',
      flatShading: true,
      metalness: 0.01,
      roughness: 0.94,
    }),
    timber: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.07,
      clearcoatRoughness: 0.86,
      color: '#151713',
      metalness: 0.03,
      roughness: 0.74,
      sheen: 0.2,
      sheenColor: new THREE.Color('#49392b'),
      sheenRoughness: 0.91,
    }),
    vermilion: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.18,
      clearcoatRoughness: 0.68,
      color: '#71251b',
      metalness: 0.02,
      roughness: 0.66,
      sheen: 0.16,
      sheenColor: new THREE.Color('#a54834'),
      sheenRoughness: 0.82,
    }),
  }
}

export function GardenArchitecture({ progressRef }: { progressRef: ProgressRef }) {
  const fusumaSource = useTexture('/assets/journey/03-koi-fusuma.webp')
  const materials = useMemo(createMaterials, [])
  const doorMaps = useMemo(() => {
    const left = fusumaSource.clone()
    const right = fusumaSource.clone()
    for (const texture of [left, right]) {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.repeat.set(0.5, 1)
      texture.anisotropy = 8
      texture.needsUpdate = true
    }
    left.offset.set(0, 0)
    right.offset.set(0.5, 0)
    return [left, right] as [THREE.Texture, THREE.Texture]
  }, [fusumaSource])

  useEffect(() => () => {
    Object.values(materials).forEach((material) => material.dispose())
    doorMaps.forEach((texture) => texture.dispose())
  }, [doorMaps, materials])

  return (
    <group name="garden-architecture">
      <HeroTorii materials={materials} />
      <SacredBridge materials={materials} />
      {lanternPositions.map(({ position, rotation, scale }, index) => (
        <StoneLantern
          key={index}
          materials={materials}
          position={position}
          rotation={rotation}
          scale={scale}
        />
      ))}
      <MonumentalPavilion doorMaps={doorMaps} materials={materials} progressRef={progressRef} />
    </group>
  )
}
