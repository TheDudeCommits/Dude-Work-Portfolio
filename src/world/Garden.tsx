import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BreathingMistMaterial, LivingInkMaterial } from './materials'

const seedValue = (seed: number) => {
  const value = Math.sin(seed * 91.731) * 43758.5453
  return value - Math.floor(value)
}

function ToriiGate({ position = [0, 0, 28] as [number, number, number] }) {
  const vermilion = '#934c3f'
  const dark = '#3a2d2a'

  return (
    <group position={position}>
      <mesh castShadow position={[-3.15, 3.1, 0]}>
        <cylinderGeometry args={[0.27, 0.38, 6.2, 12]} />
        <meshStandardMaterial color={vermilion} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[3.15, 3.1, 0]}>
        <cylinderGeometry args={[0.27, 0.38, 6.2, 12]} />
        <meshStandardMaterial color={vermilion} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 5.3, 0]}>
        <boxGeometry args={[7.6, 0.48, 0.54]} />
        <meshStandardMaterial color={vermilion} roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 5.9, 0]} rotation={[0, 0, -0.008]}>
        <boxGeometry args={[8.55, 0.33, 0.72]} />
        <meshStandardMaterial color={dark} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 5.72, 0]}>
        <boxGeometry args={[8.2, 0.22, 0.5]} />
        <meshStandardMaterial color={vermilion} roughness={0.76} />
      </mesh>
      <mesh castShadow position={[0, 4.48, 0]}>
        <boxGeometry args={[4.85, 0.33, 0.38]} />
        <meshStandardMaterial color={vermilion} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 4.88, -0.02]}>
        <boxGeometry args={[1.5, 0.72, 0.3]} />
        <meshStandardMaterial color={dark} roughness={0.9} />
      </mesh>
      <mesh position={[-3.15, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.72, 0.24, 10]} />
        <meshStandardMaterial color="#77746c" roughness={1} />
      </mesh>
      <mesh position={[3.15, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.72, 0.24, 10]} />
        <meshStandardMaterial color="#77746c" roughness={1} />
      </mesh>
    </group>
  )
}

function StonePath() {
  const stones = useMemo(() => Array.from({ length: 46 }, (_, index) => {
    const z = 34 - index * 1.38
    const bend = Math.sin(index * 0.19) * 0.34
    return {
      z,
      x: bend,
      rotation: (seedValue(index + 11) - 0.5) * 0.08,
      width: 3.75 + seedValue(index + 2) * 0.7,
      depth: 1.02 + seedValue(index + 5) * 0.22,
      y: Math.sin(index * 0.36) * 0.035,
    }
  }), [])

  return (
    <group>
      {stones.map((stone, index) => (
        <mesh
          castShadow
          key={index}
          position={[stone.x, stone.y, stone.z]}
          receiveShadow
          rotation={[0, stone.rotation, 0]}
        >
          <boxGeometry args={[stone.width, 0.16, stone.depth]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? '#99988e' : '#b2afa1'}
            metalness={0.02}
            roughness={0.94}
          />
        </mesh>
      ))}
    </group>
  )
}

function InkStream() {
  return (
    <mesh position={[6.4, -0.08, 1]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[7.2, 78, 24, 120]} />
      <LivingInkMaterial />
    </mesh>
  )
}

function Mountain({
  colorA,
  colorB,
  depth,
  height,
  position,
  seed,
  width,
}: {
  colorA: string
  colorB: string
  depth: number
  height: number
  position: [number, number, number]
  seed: number
  width: number
}) {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(width, depth, 36, 18)
    const positions = plane.attributes.position
    const colors: number[] = []
    const low = new THREE.Color(colorA)
    const high = new THREE.Color(colorB)

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index) / width
      const y = positions.getY(index) / depth
      const ridge = Math.exp(-Math.pow(x * 2.5, 2))
      const second = Math.exp(-Math.pow((x - 0.25) * 4.2, 2)) * 0.5
      const taper = Math.max(0, 1 - Math.abs(y) * 1.8)
      const rough = (seedValue(index * 0.37 + seed) - 0.5) * 0.48
      const elevation = Math.max(0, (ridge + second) * taper * height + rough)
      positions.setZ(index, elevation)
      const color = low.clone().lerp(high, Math.min(1, elevation / Math.max(1, height)))
      colors.push(color.r, color.g, color.b)
    }

    plane.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    plane.rotateX(-Math.PI / 2)
    plane.computeVertexNormals()
    return plane
  }, [colorA, colorB, depth, height, seed, width])

  return (
    <mesh geometry={geometry} position={position} receiveShadow>
      <meshStandardMaterial
        color="#ffffff"
        flatShading
        roughness={1}
        transparent
        opacity={0.9}
        vertexColors
      />
    </mesh>
  )
}

function MountainWorld() {
  return (
    <group>
      <Mountain colorA="#536960" colorB="#c9cbbd" depth={24} height={10.5} position={[-18.5, -0.45, 0]} seed={4} width={22} />
      <Mountain colorA="#5f746a" colorB="#cfd0c2" depth={26} height={9.2} position={[19, -0.6, -5]} seed={12} width={23} />
      <Mountain colorA="#71847b" colorB="#d7d7c9" depth={24} height={8} position={[-13, -0.6, -64]} seed={28} width={29} />
      <Mountain colorA="#788a80" colorB="#dedbcd" depth={30} height={7.2} position={[14, -0.72, -71]} seed={37} width={31} />
    </group>
  )
}

function InkBackdrop() {
  const texture = useTexture('/assets/command-sumi-field.webp')
  texture.colorSpace = THREE.SRGBColorSpace

  return (
    <mesh position={[0, 10.5, -70]}>
      <planeGeometry args={[74, 40]} />
      <meshBasicMaterial
        color="#aebbb0"
        depthWrite={false}
        map={texture}
        opacity={0.2}
        transparent
      />
    </mesh>
  )
}

function PineTree({ position, scale = 1, seed = 0 }: {
  position: [number, number, number]
  scale?: number
  seed?: number
}) {
  const clusters = useMemo(() => Array.from({ length: 7 }, (_, index) => ({
    x: (seedValue(seed + index * 2.4) - 0.5) * 2.1,
    y: 2.3 + index * 0.48 + seedValue(seed + index) * 0.3,
    z: (seedValue(seed + index * 5.7) - 0.5) * 1.2,
    s: 0.72 + seedValue(seed + index * 1.7) * 0.52,
  })), [seed])

  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 2.05, 0]} rotation={[0.03, 0, -0.08]}>
        <cylinderGeometry args={[0.12, 0.3, 4.2, 7]} />
        <meshStandardMaterial color="#4b4035" roughness={1} />
      </mesh>
      {clusters.map((cluster, index) => (
        <mesh
          castShadow
          key={index}
          position={[cluster.x, cluster.y, cluster.z]}
          rotation={[0, seedValue(index + seed) * Math.PI, 0]}
          scale={[cluster.s * 1.45, cluster.s * 0.42, cluster.s]}
        >
          <dodecahedronGeometry args={[0.92, 1]} />
          <meshStandardMaterial
            color={index % 2 ? '#30473e' : '#3d5749'}
            flatShading
            roughness={0.96}
          />
        </mesh>
      ))}
    </group>
  )
}

function BambooGrove({ mirror = false }: { mirror?: boolean }) {
  const stems = useMemo(() => Array.from({ length: 15 }, (_, index) => ({
    x: (mirror ? -1 : 1) * (7.8 + seedValue(index + 8) * 4.8),
    z: 16 - index * 2.9 + seedValue(index + 42) * 2.1,
    height: 4.6 + seedValue(index + 19) * 3.8,
    lean: (seedValue(index + 90) - 0.5) * 0.16,
  })), [mirror])

  return (
    <group>
      {stems.map((stem, index) => (
        <group key={index} position={[stem.x, 0, stem.z]} rotation={[stem.lean * 0.25, 0, stem.lean]}>
          <mesh position={[0, stem.height / 2, 0]}>
            <cylinderGeometry args={[0.07, 0.11, stem.height, 7]} />
            <meshStandardMaterial color={index % 3 ? '#6d8065' : '#809172'} roughness={0.9} />
          </mesh>
          {Array.from({ length: 5 }, (_, leaf) => (
            <mesh
              key={leaf}
              position={[(leaf % 2 ? -1 : 1) * 0.28, stem.height * (0.55 + leaf * 0.08), 0]}
              rotation={[0.2, 0, leaf % 2 ? -0.85 : 0.85]}
              scale={[0.12, 0.58, 0.25]}
            >
              <sphereGeometry args={[0.55, 6, 4]} />
              <meshStandardMaterial color="#6b7f68" flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function StoneLantern({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.42, 0.56, 0.64, 6]} />
        <meshStandardMaterial color="#777a70" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.18, 0.26, 1.55, 7]} />
        <meshStandardMaterial color="#83847a" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 2.18, 0]}>
        <boxGeometry args={[0.8, 0.62, 0.8]} />
        <meshStandardMaterial color="#777a70" roughness={1} />
      </mesh>
      <pointLight color="#e9b773" distance={5.2} intensity={1.5} position={[0, 2.2, 0]} />
      <mesh position={[0, 2.2, 0.41]}>
        <planeGeometry args={[0.44, 0.34]} />
        <meshBasicMaterial color="#efc98a" toneMapped={false} />
      </mesh>
      <mesh castShadow position={[0, 2.58, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.25, 0.72, 0.38, 4]} />
        <meshStandardMaterial color="#60645d" roughness={1} />
      </mesh>
    </group>
  )
}

function RockGarden() {
  const rocks = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    x: (index % 2 ? -1 : 1) * (5.7 + seedValue(index + 12) * 4.5),
    z: 22 - index * 3.15 + seedValue(index + 52) * 2,
    s: 0.45 + seedValue(index + 70) * 1.1,
  })), [])

  return (
    <group>
      {rocks.map((rock, index) => (
        <mesh
          castShadow
          key={index}
          position={[rock.x, rock.s * 0.32 - 0.06, rock.z]}
          rotation={[seedValue(index) * 0.2, seedValue(index + 22) * Math.PI, 0]}
          scale={[rock.s * 1.25, rock.s * 0.62, rock.s]}
        >
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color={index % 2 ? '#72766f' : '#8e8e83'} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function DriftingPigment() {
  const group = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(240 * 3)
    const colors = new Float32Array(240 * 3)
    const sage = new THREE.Color('#5d7669')
    const blush = new THREE.Color('#ba7c76')

    for (let index = 0; index < 240; index += 1) {
      positions[index * 3] = (seedValue(index + 2) - 0.5) * 30
      positions[index * 3 + 1] = 0.5 + seedValue(index + 31) * 9
      positions[index * 3 + 2] = 34 - seedValue(index + 73) * 82
      const color = index % 5 === 0 ? blush : sage
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }

    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    result.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return result
  }, [])

  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.045) * 0.05
    group.current.position.y = Math.sin(clock.elapsedTime * 0.18) * 0.22
  })

  return (
    <points ref={group} geometry={geometry}>
      <pointsMaterial
        alphaTest={0.2}
        color="#ffffff"
        depthWrite={false}
        opacity={0.5}
        size={0.065}
        transparent
        vertexColors
      />
    </points>
  )
}

function MistLayers() {
  return (
    <group>
      {[-2, -14, -28].map((z, index) => (
        <mesh key={z} position={[index % 2 ? 2 : -2, 2.2 + index * 0.35, z]} rotation={[0, 0, 0]}>
          <planeGeometry args={[28, 5.2, 20, 8]} />
          <BreathingMistMaterial />
        </mesh>
      ))}
    </group>
  )
}

export function Garden() {
  const pines = useMemo(() => [
    [-7, 0, 24, 0.9, 1], [8.5, 0, 19, 1.05, 5], [-9, 0, 11, 1.2, 8],
    [10, 0, 4, 1.45, 12], [-8, 0, -5, 1.15, 18], [8.4, 0, -10, 1.1, 22],
    [-10.5, 0, -18, 1.45, 28], [10.5, 0, -22, 1.3, 31],
  ] as const, [])

  return (
    <group>
      <InkBackdrop />
      <MountainWorld />
      <InkStream />
      <StonePath />
      <ToriiGate />
      <BambooGrove />
      <BambooGrove mirror />
      <RockGarden />
      {pines.map(([x, y, z, scale, seed]) => (
        <PineTree key={`${x}-${z}`} position={[x, y, z]} scale={scale} seed={seed} />
      ))}
      <StoneLantern position={[-4.6, 0, 19]} rotation={0.2} />
      <StoneLantern position={[4.8, 0, 8]} rotation={-0.15} />
      <StoneLantern position={[-4.8, 0, -5]} rotation={0.1} />
      <StoneLantern position={[4.6, 0, -17]} rotation={-0.2} />
      <DriftingPigment />
      <MistLayers />
    </group>
  )
}
