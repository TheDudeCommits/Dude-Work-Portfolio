import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sampleJourney } from './path'

const ROCK_SET_URL = '/assets/environment/rocks/rock-moss-set-02.glb'
const GRAVEL_URL = '/assets/environment/materials/sumi-gravel-ground.webp'
const GARDEN_END = 0.985
const PAVILION_GAP_START = 0.65
const PAVILION_GAP_END = 0.93

type WindUniform = { value: number }

interface JourneyFrame {
  normal: THREE.Vector3
  position: THREE.Vector3
  tangent: THREE.Vector3
  yaw: number
}

interface PlantPlacement {
  position: THREE.Vector3
  rotation: number
  scale: number
  seed: number
}

function mulberry32(seed: number) {
  let value = seed | 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let result = Math.imul(value ^ (value >>> 15), 1 | value)
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function journeyFrame(progress: number): JourneyFrame {
  const p = THREE.MathUtils.clamp(progress, 0, GARDEN_END)
  const position = sampleJourney(p, new THREE.Vector3())
  const before = sampleJourney(Math.max(0, p - 0.0025), new THREE.Vector3())
  const after = sampleJourney(Math.min(GARDEN_END, p + 0.0025), new THREE.Vector3())
  const tangent = after.sub(before).setY(0).normalize()
  const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
  return {
    normal,
    position,
    tangent,
    yaw: Math.atan2(tangent.x, tangent.z),
  }
}

function progressOutsidePavilion(normalized: number) {
  const start = 0.012
  const end = GARDEN_END - 0.008
  const firstSpan = PAVILION_GAP_START - start
  const secondSpan = end - PAVILION_GAP_END
  const distance = THREE.MathUtils.clamp(normalized, 0, 1) * (firstSpan + secondSpan)
  return distance <= firstSpan
    ? start + distance
    : PAVILION_GAP_END + distance - firstSpan
}

function setWindTime(material: THREE.Material, elapsed: number, strength: number) {
  const time = material.userData.windTime as WindUniform | undefined
  const amount = material.userData.windStrength as WindUniform | undefined
  if (time) time.value = elapsed
  if (amount) amount.value = strength
}

function windMaterial(
  color: THREE.ColorRepresentation,
  roughness: number,
  strength: number,
  phase: number,
) {
  const material = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: 0,
    roughness,
  })
  const windTime = { value: 0 }
  const windStrength = { value: strength }
  material.userData.windTime = windTime
  material.userData.windStrength = windStrength
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGardenWindTime = windTime
    shader.uniforms.uGardenWindStrength = windStrength
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform float uGardenWindTime;\nuniform float uGardenWindStrength;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float gardenHeight = smoothstep(-0.55, 1.15, position.y);
        float gardenWave = sin(uGardenWindTime * ${0.72 + phase * 0.07} + position.y * 1.71 + position.x * ${0.83 + phase * 0.03});
        transformed.x += gardenWave * uGardenWindStrength * (0.22 + gardenHeight * 0.78);
        transformed.z += cos(uGardenWindTime * 0.51 + position.y * 1.19 + ${phase}) * uGardenWindStrength * 0.32 * gardenHeight;`,
      )
  }
  material.customProgramCacheKey = () => `living-garden-wind-${phase}`
  return material
}

function createTerrainGeometry(compact: boolean) {
  const width = compact ? 44 : 58
  const length = 125
  const geometry = new THREE.PlaneGeometry(width, length, compact ? 30 : 48, compact ? 68 : 104)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, 0, -10)

  const samples = Array.from({ length: 48 }, (_, index) => sampleJourney(
    (index / 47) * GARDEN_END,
    new THREE.Vector3(),
  ))
  const position = geometry.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(position.count * 3)
  const pathColor = new THREE.Color('#ddd2b3')
  const bankColor = new THREE.Color('#6f796b')
  const shade = new THREE.Color()
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const z = position.getZ(index)
    let closest = samples[0]
    let closestDistance = Number.POSITIVE_INFINITY
    for (const sample of samples) {
      const dx = x - sample.x
      const dz = z - sample.z
      const distance = dx * dx + dz * dz
      if (distance < closestDistance) {
        closest = sample
        closestDistance = distance
      }
    }
    const pathDistance = Math.sqrt(closestDistance)
    const bank = THREE.MathUtils.smoothstep(pathDistance, 2.9, 15.5)
    const longNoise = Math.sin(x * 0.19 + z * 0.075) * 0.48
      + Math.sin(z * 0.17 - x * 0.11) * 0.31
      + Math.cos((x + z) * 0.31) * 0.12
    const edgeRise = Math.pow(Math.min(Math.abs(x) / (width * 0.5), 1), 2.05) * 3.35
    const surfaceNoise = Math.sin(x * 0.71 - z * 0.43) * 0.055 * (0.35 + bank * 0.65)
    position.setY(index, closest.y - 0.3 + surfaceNoise + bank * (longNoise + edgeRise))
    shade.copy(pathColor).lerp(bankColor, bank * 0.88)
    shade.multiplyScalar(0.89 + Math.sin(x * 0.31 + z * 0.23) * 0.06)
    colors[index * 3] = shade.r
    colors[index * 3 + 1] = shade.g
    colors[index * 3 + 2] = shade.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function Terrain({ compact }: { compact: boolean }) {
  const source = useTexture(GRAVEL_URL)
  const texture = useMemo(() => source.clone(), [source])
  const geometry = useMemo(() => createTerrainGeometry(compact), [compact])

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(compact ? 8 : 11, 24)
    texture.anisotropy = 8
    texture.needsUpdate = true
    return () => {
      texture.dispose()
      geometry.dispose()
    }
  }, [compact, geometry, texture])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#777364"
        envMapIntensity={0.28}
        map={texture}
        metalness={0}
        roughness={0.98}
        vertexColors
      />
    </mesh>
  )
}

function SteppingStones({ compact }: { compact: boolean }) {
  const count = compact ? 28 : 42
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => {
    const value = new THREE.CylinderGeometry(0.82, 0.96, 0.28, 9, 2)
    const position = value.attributes.position as THREE.BufferAttribute
    for (let index = 0; index < position.count; index += 1) {
      const y = position.getY(index)
      if (y > 0.05) position.setY(index, y + Math.sin(index * 2.17) * 0.035)
    }
    value.computeVertexNormals()
    return value
  }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#292d29',
    flatShading: true,
    metalness: 0.02,
    roughness: 0.92,
  }), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const random = mulberry32(4137)
    for (let index = 0; index < count; index += 1) {
      const progress = progressOutsidePavilion(index / Math.max(count - 1, 1))
      const frame = journeyFrame(progress)
      const offset = ((index % 2 === 0 ? -1 : 1) * (0.12 + random() * 0.23))
      const point = frame.position.clone().addScaledVector(frame.normal, offset)
      point.y += 0.02 + random() * 0.035
      quaternion.setFromEuler(new THREE.Euler(
        (random() - 0.5) * 0.08,
        frame.yaw + (random() - 0.5) * 0.34,
        (random() - 0.5) * 0.065,
      ))
      const size = 0.82 + random() * 0.42
      scale.set(size * (0.88 + random() * 0.28), 0.74 + random() * 0.3, size)
      matrix.compose(point, quaternion, scale)
      mesh.current.setMatrixAt(index, matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [count])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return (
    <instancedMesh
      args={[geometry, material, count]}
      castShadow
      count={count}
      receiveShadow
      ref={mesh}
    />
  )
}

function RockInstances({
  compact,
  geometry,
  geometryIndex,
  material,
}: {
  compact: boolean
  geometry: THREE.BufferGeometry
  geometryIndex: number
  material: THREE.MeshStandardMaterial
}) {
  const count = compact ? 2 : 4
  const mesh = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    if (!mesh.current) return
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const random = mulberry32(9721 + geometryIndex * 193)
    for (let index = 0; index < count; index += 1) {
      const slot = geometryIndex * count + index
      const progress = 0.04 + ((slot * 0.137 + geometryIndex * 0.071) % (GARDEN_END - 0.06))
      const frame = journeyFrame(progress)
      const side = slot % 2 === 0 ? -1 : 1
      const point = frame.position.clone().addScaledVector(frame.normal, side * (5.2 + random() * 13.5))
      point.y -= 0.08 + random() * 0.22
      quaternion.setFromEuler(new THREE.Euler(
        (random() - 0.5) * 0.25,
        random() * Math.PI * 2,
        (random() - 0.5) * 0.18,
      ))
      const size = 0.52 + random() * 1.52
      scale.set(size * (0.8 + random() * 0.5), size * (0.72 + random() * 0.42), size)
      matrix.compose(point, quaternion, scale)
      mesh.current.setMatrixAt(index, matrix)
      mesh.current.setColorAt(index, new THREE.Color().setHSL(
        0.18 + random() * 0.05,
        0.08 + random() * 0.13,
        0.29 + random() * 0.15,
      ))
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [count, geometryIndex])

  return (
    <instancedMesh
      args={[geometry, material, count]}
      castShadow
      count={count}
      receiveShadow
      ref={mesh}
    />
  )
}

function MossRocks({ compact }: { compact: boolean }) {
  const gltf = useGLTF(ROCK_SET_URL)
  const rockData = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = []
    let sourceMaterial: THREE.MeshStandardMaterial | null = null
    gltf.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      geometries.push(child.geometry.clone())
      if (!sourceMaterial) {
        const candidate = Array.isArray(child.material) ? child.material[0] : child.material
        if (candidate instanceof THREE.MeshStandardMaterial) sourceMaterial = candidate
      }
    })
    if (geometries.length === 0) geometries.push(new THREE.IcosahedronGeometry(1, 2))
    const material = sourceMaterial
      ? (sourceMaterial as THREE.MeshStandardMaterial).clone()
      : new THREE.MeshStandardMaterial()
    material.color.multiply(new THREE.Color('#66705d'))
    material.roughness = Math.max(material.roughness, 0.86)
    material.metalness = 0
    material.vertexColors = true
    material.flatShading = false
    material.needsUpdate = true
    return { geometries, material }
  }, [gltf.scene])

  useEffect(() => () => {
    rockData.geometries.forEach((geometry) => geometry.dispose())
    rockData.material.dispose()
  }, [rockData])

  return (
    <group>
      {rockData.geometries.map((geometry, geometryIndex) => (
        <RockInstances
          compact={compact}
          geometry={geometry}
          geometryIndex={geometryIndex}
          key={geometry.uuid}
          material={rockData.material}
        />
      ))}
    </group>
  )
}

function treePlacements(kind: 'maple' | 'pine', compact: boolean) {
  const count = compact ? (kind === 'pine' ? 8 : 7) : (kind === 'pine' ? 14 : 12)
  const random = mulberry32(kind === 'pine' ? 7441 : 5119)
  return Array.from({ length: count }, (_, index): PlantPlacement => {
    const progress = 0.035 + ((index + 0.45) / count) * (GARDEN_END - 0.05)
    const frame = journeyFrame(progress)
    const side = (index + (kind === 'maple' ? 1 : 0)) % 2 === 0 ? -1 : 1
    const distance = (kind === 'pine' ? 8.2 : 6.4) + random() * (kind === 'pine' ? 9.8 : 7.2)
    const position = frame.position.clone().addScaledVector(frame.normal, side * distance)
    position.y -= 0.05
    return {
      position,
      rotation: frame.yaw + random() * Math.PI * 2,
      scale: (kind === 'pine' ? 0.92 : 0.72) + random() * (kind === 'pine' ? 0.48 : 0.36),
      seed: random(),
    }
  })
}

function SculpturalTrees({
  compact,
  kind,
  reducedMotion,
}: {
  compact: boolean
  kind: 'maple' | 'pine'
  reducedMotion: boolean
}) {
  const placements = useMemo(() => treePlacements(kind, compact), [compact, kind])
  const trunk = useRef<THREE.InstancedMesh>(null)
  const crown = useRef<THREE.InstancedMesh>(null)
  const crownCount = placements.length * (kind === 'pine' ? 3 : 4)
  const geometry = useMemo(() => {
    const points = kind === 'pine'
      ? [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.16, 1.2, -0.04),
          new THREE.Vector3(-0.32, 2.35, 0.15),
          new THREE.Vector3(0.22, 3.55, 0.02),
          new THREE.Vector3(0.08, 4.7, -0.12),
        ]
      : [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-0.1, 1.05, 0.06),
          new THREE.Vector3(0.21, 2.12, -0.08),
          new THREE.Vector3(0.02, 3.35, 0.12),
        ]
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      kind === 'pine' ? 14 : 11,
      kind === 'pine' ? 0.24 : 0.19,
      7,
      false,
    )
  }, [kind])
  const crownGeometry = useMemo(() => kind === 'pine'
    ? new THREE.DodecahedronGeometry(0.95, 0)
    : new THREE.IcosahedronGeometry(0.83, 1), [kind])
  const trunkMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: kind === 'pine' ? '#342f28' : '#4b362d',
    flatShading: true,
    roughness: 0.97,
  }), [kind])
  const crownMaterial = useMemo(() => windMaterial(
    kind === 'pine' ? '#263b31' : '#7a3f32',
    0.91,
    kind === 'pine' ? 0.055 : 0.075,
    kind === 'pine' ? 1.7 : 4.1,
  ), [kind])

  useLayoutEffect(() => {
    if (!trunk.current || !crown.current) return
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const point = new THREE.Vector3()
    let crownIndex = 0
    placements.forEach((placement, index) => {
      quaternion.setFromEuler(new THREE.Euler(0, placement.rotation, 0))
      scale.setScalar(placement.scale)
      matrix.compose(placement.position, quaternion, scale)
      trunk.current?.setMatrixAt(index, matrix)

      const clusters = kind === 'pine' ? 3 : 4
      for (let cluster = 0; cluster < clusters; cluster += 1) {
        const angle = placement.rotation + cluster * (Math.PI * 2 / clusters) + placement.seed
        const radius = kind === 'pine' ? 0.55 + cluster * 0.16 : 0.55 + (cluster % 2) * 0.35
        const height = kind === 'pine' ? 3.25 + cluster * 0.52 : 2.72 + (cluster % 3) * 0.42
        point.copy(placement.position).add(new THREE.Vector3(
          Math.cos(angle) * radius * placement.scale,
          height * placement.scale,
          Math.sin(angle) * radius * placement.scale,
        ))
        quaternion.setFromEuler(new THREE.Euler(
          placement.seed * 0.18,
          angle,
          (cluster - 1) * 0.08,
        ))
        const broad = placement.scale * (kind === 'pine' ? 1.18 : 1.32)
        scale.set(
          broad * (1.05 + placement.seed * 0.28),
          broad * (kind === 'pine' ? 0.42 : 0.78),
          broad * (0.76 + cluster * 0.06),
        )
        matrix.compose(point, quaternion, scale)
        crown.current?.setMatrixAt(crownIndex, matrix)
        crownIndex += 1
      }
    })
    trunk.current.instanceMatrix.needsUpdate = true
    crown.current.instanceMatrix.needsUpdate = true
    trunk.current.computeBoundingSphere()
    crown.current.computeBoundingSphere()
  }, [crownCount, kind, placements])

  useFrame(({ clock }) => {
    setWindTime(crownMaterial, reducedMotion ? 0 : clock.elapsedTime, reducedMotion ? 0 : (kind === 'pine' ? 0.055 : 0.075))
  })

  useEffect(() => () => {
    geometry.dispose()
    crownGeometry.dispose()
    trunkMaterial.dispose()
    crownMaterial.dispose()
  }, [crownGeometry, crownMaterial, geometry, trunkMaterial])

  return (
    <group>
      <instancedMesh
        args={[geometry, trunkMaterial, placements.length]}
        castShadow
        count={placements.length}
        ref={trunk}
      />
      <instancedMesh
        args={[crownGeometry, crownMaterial, crownCount]}
        castShadow
        count={crownCount}
        ref={crown}
      />
    </group>
  )
}

function BambooGrove({ compact, reducedMotion }: { compact: boolean; reducedMotion: boolean }) {
  const count = compact ? 34 : 58
  const stalks = useRef<THREE.InstancedMesh>(null)
  const leaves = useRef<THREE.InstancedMesh>(null)
  const center = useMemo(() => {
    const frame = journeyFrame(0.47)
    return frame.position.clone().addScaledVector(frame.normal, 11.5)
  }, [])
  const data = useMemo(() => {
    const random = mulberry32(2811)
    return Array.from({ length: count }, () => ({
      angle: random() * Math.PI * 2,
      height: 3.2 + random() * 3.6,
      radius: Math.sqrt(random()) * 5.1,
      seed: random(),
      width: 0.72 + random() * 0.58,
    }))
  }, [count])
  const stalkGeometry = useMemo(() => new THREE.CylinderGeometry(0.07, 0.105, 1, 7, 3), [])
  const leafGeometry = useMemo(() => {
    const value = new THREE.ConeGeometry(0.18, 0.78, 3)
    value.rotateZ(Math.PI / 2)
    return value
  }, [])
  const stalkMaterial = useMemo(() => windMaterial('#465b41', 0.86, 0.075, 2.6), [])
  const leafMaterial = useMemo(() => windMaterial('#263d30', 0.93, 0.12, 5.3), [])

  useLayoutEffect(() => {
    if (!stalks.current || !leaves.current) return
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const point = new THREE.Vector3()
    data.forEach((item, index) => {
      const x = Math.cos(item.angle) * item.radius
      const z = Math.sin(item.angle) * item.radius * 0.72
      point.set(center.x + x, center.y + item.height * 0.5, center.z + z)
      quaternion.setFromEuler(new THREE.Euler(
        (item.seed - 0.5) * 0.055,
        item.angle,
        (item.seed - 0.5) * 0.04,
      ))
      scale.set(item.width, item.height, item.width)
      matrix.compose(point, quaternion, scale)
      stalks.current?.setMatrixAt(index, matrix)

      for (let leaf = 0; leaf < 2; leaf += 1) {
        const leafIndex = index * 2 + leaf
        const leafAngle = item.angle + leaf * Math.PI + item.seed * 2.4
        point.set(
          center.x + x + Math.cos(leafAngle) * 0.28,
          center.y + item.height * (0.68 + leaf * 0.18),
          center.z + z + Math.sin(leafAngle) * 0.28,
        )
        quaternion.setFromEuler(new THREE.Euler(
          (item.seed - 0.5) * 0.7,
          leafAngle,
          (leaf - 0.5) * 0.45,
        ))
        scale.setScalar(0.82 + item.seed * 0.45)
        matrix.compose(point, quaternion, scale)
        leaves.current?.setMatrixAt(leafIndex, matrix)
      }
    })
    stalks.current.instanceMatrix.needsUpdate = true
    leaves.current.instanceMatrix.needsUpdate = true
    stalks.current.computeBoundingSphere()
    leaves.current.computeBoundingSphere()
  }, [center, data])

  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime
    setWindTime(stalkMaterial, time, reducedMotion ? 0 : 0.075)
    setWindTime(leafMaterial, time, reducedMotion ? 0 : 0.12)
  })

  useEffect(() => () => {
    stalkGeometry.dispose()
    leafGeometry.dispose()
    stalkMaterial.dispose()
    leafMaterial.dispose()
  }, [leafGeometry, leafMaterial, stalkGeometry, stalkMaterial])

  return (
    <group>
      <instancedMesh
        args={[stalkGeometry, stalkMaterial, count]}
        castShadow
        count={count}
        ref={stalks}
      />
      <instancedMesh
        args={[leafGeometry, leafMaterial, count * 2]}
        count={count * 2}
        ref={leaves}
      />
    </group>
  )
}

function GroundCover({ compact, reducedMotion }: { compact: boolean; reducedMotion: boolean }) {
  const grassCount = compact ? 140 : 260
  const mossCount = compact ? 28 : 50
  const grass = useRef<THREE.InstancedMesh>(null)
  const moss = useRef<THREE.InstancedMesh>(null)
  const grassGeometry = useMemo(() => new THREE.ConeGeometry(0.12, 0.78, 3, 1), [])
  const mossGeometry = useMemo(() => new THREE.DodecahedronGeometry(0.48, 0), [])
  const grassMaterial = useMemo(() => windMaterial('#3b4c38', 0.94, 0.12, 3.8), [])
  const mossMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3f4b3d',
    flatShading: true,
    roughness: 1,
  }), [])

  useLayoutEffect(() => {
    if (!grass.current || !moss.current) return
    const random = mulberry32(8531)
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    for (let index = 0; index < grassCount; index += 1) {
      const frame = journeyFrame(random() * GARDEN_END)
      const side = random() < 0.5 ? -1 : 1
      const point = frame.position.clone().addScaledVector(frame.normal, side * (2.8 + random() * 15.5))
      point.y += 0.08
      quaternion.setFromEuler(new THREE.Euler((random() - 0.5) * 0.2, random() * Math.PI * 2, 0))
      const height = 0.42 + random() * 1.05
      scale.set(0.62 + random() * 0.9, height, 0.62 + random() * 0.82)
      matrix.compose(point, quaternion, scale)
      grass.current.setMatrixAt(index, matrix)
    }
    for (let index = 0; index < mossCount; index += 1) {
      const frame = journeyFrame(random() * GARDEN_END)
      const side = random() < 0.5 ? -1 : 1
      const point = frame.position.clone().addScaledVector(frame.normal, side * (4 + random() * 13))
      point.y -= 0.1
      quaternion.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0))
      const size = 0.45 + random() * 1.35
      scale.set(size * (0.9 + random() * 0.6), 0.16 + random() * 0.2, size)
      matrix.compose(point, quaternion, scale)
      moss.current.setMatrixAt(index, matrix)
    }
    grass.current.instanceMatrix.needsUpdate = true
    moss.current.instanceMatrix.needsUpdate = true
    grass.current.computeBoundingSphere()
    moss.current.computeBoundingSphere()
  }, [grassCount, mossCount])

  useFrame(({ clock }) => {
    setWindTime(grassMaterial, reducedMotion ? 0 : clock.elapsedTime, reducedMotion ? 0 : 0.12)
  })

  useEffect(() => () => {
    grassGeometry.dispose()
    mossGeometry.dispose()
    grassMaterial.dispose()
    mossMaterial.dispose()
  }, [grassGeometry, grassMaterial, mossGeometry, mossMaterial])

  return (
    <group>
      <instancedMesh args={[grassGeometry, grassMaterial, grassCount]} count={grassCount} ref={grass} />
      <instancedMesh args={[mossGeometry, mossMaterial, mossCount]} count={mossCount} receiveShadow ref={moss} />
    </group>
  )
}

const waterVertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    vec4 world = modelMatrix * vec4(p, 1.0);
    world.y += sin(world.x * 1.7 + uTime * 0.46) * 0.018;
    world.y += cos(world.z * 2.1 - uTime * 0.61) * 0.014;
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {
    float wx = sin(vWorldPosition.x * 1.8 + uTime * 0.55);
    float wz = cos(vWorldPosition.z * 2.3 - uTime * 0.72);
    vec3 normal = normalize(vec3(-wx * 0.095, 1.0, -wz * 0.075));
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 reflected = reflect(-viewDir, normal);
    float sky = smoothstep(-0.12, 0.82, reflected.y);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    float ripple = sin((vWorldPosition.x + vWorldPosition.z) * 7.0 + uTime * 1.2) * 0.5 + 0.5;
    vec3 bankInk = vec3(0.012, 0.025, 0.021);
    vec3 skyInk = vec3(0.13, 0.22, 0.205);
    vec3 color = mix(bankInk, skyInk, sky * 0.74 + fresnel * 0.26);
    color += vec3(0.12, 0.20, 0.18) * ripple * 0.045;
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
    gl_FragColor = vec4(color, uOpacity * mix(0.78, 1.0, edge));
  }
`

function createStreamGeometry() {
  const segments = 32
  const positions = new Float32Array((segments + 1) * 2 * 3)
  const uvs = new Float32Array((segments + 1) * 2 * 2)
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const local = index / segments
    const frame = journeyFrame(0.34 + local * 0.29)
    const center = frame.position.clone().addScaledVector(frame.normal, -8.6 + Math.sin(local * Math.PI) * 1.25)
    const width = 0.7 + Math.sin(local * Math.PI) * 0.72
    for (let side = 0; side < 2; side += 1) {
      const vertex = index * 2 + side
      const point = center.clone().addScaledVector(frame.normal, (side === 0 ? -1 : 1) * width)
      positions[vertex * 3] = point.x
      positions[vertex * 3 + 1] = point.y + 0.035
      positions[vertex * 3 + 2] = point.z
      uvs[vertex * 2] = side
      uvs[vertex * 2 + 1] = local
    }
    if (index < segments) {
      const a = index * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createKoiGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.72, 0)
  shape.bezierCurveTo(-0.38, 0.28, 0.34, 0.28, 0.68, 0)
  shape.bezierCurveTo(0.34, -0.28, -0.38, -0.28, -0.72, 0)
  shape.lineTo(-1.02, 0.30)
  shape.lineTo(-0.93, 0)
  shape.lineTo(-1.02, -0.30)
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape, 8)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function KoiSchool({
  center,
  compact,
  reducedMotion,
}: {
  center: THREE.Vector3
  compact: boolean
  reducedMotion: boolean
}) {
  const count = compact ? 6 : 10
  const fish = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => createKoiGeometry(), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#221b16',
    opacity: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  }), [])
  const seeds = useMemo(() => {
    const random = mulberry32(1493)
    return Array.from({ length: count }, () => ({
      angle: random() * Math.PI * 2,
      radius: 0.8 + random() * 3.55,
      scale: 0.28 + random() * 0.26,
      speed: 0.08 + random() * 0.12,
    }))
  }, [count])

  useFrame(({ clock }) => {
    if (!fish.current) return
    const time = reducedMotion ? 0 : clock.elapsedTime
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    seeds.forEach((seed, index) => {
      const angle = seed.angle + time * seed.speed
      const point = new THREE.Vector3(
        center.x + Math.cos(angle) * seed.radius,
        center.y - 0.055 - (index % 3) * 0.018,
        center.z + Math.sin(angle) * seed.radius * 0.72,
      )
      quaternion.setFromEuler(new THREE.Euler(0, -angle + Math.PI * 0.5, 0))
      scale.setScalar(seed.scale)
      matrix.compose(point, quaternion, scale)
      fish.current?.setMatrixAt(index, matrix)
    })
    fish.current.instanceMatrix.needsUpdate = true
    if (time === 0) fish.current.computeBoundingSphere()
  })

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return <instancedMesh args={[geometry, material, count]} count={count} ref={fish} renderOrder={1} />
}

function WaterGarden({ compact, reducedMotion }: { compact: boolean; reducedMotion: boolean }) {
  const pondCenter = useMemo(() => {
    const frame = journeyFrame(0.31)
    return frame.position.clone().addScaledVector(frame.normal, -9.8).add(new THREE.Vector3(0, 0.02, 0))
  }, [])
  const streamGeometry = useMemo(() => createStreamGeometry(), [])
  const waterMaterial = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false,
    fragmentShader: waterFragment,
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      uOpacity: { value: 0.86 },
      uTime: { value: 0 },
    },
    vertexShader: waterVertex,
  }), [])

  useFrame(({ clock }) => {
    waterMaterial.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })

  useEffect(() => () => {
    streamGeometry.dispose()
    waterMaterial.dispose()
  }, [streamGeometry, waterMaterial])

  return (
    <group>
      <mesh material={waterMaterial} position={pondCenter} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[compact ? 4.35 : 5.25, compact ? 36 : 56]} />
      </mesh>
      <mesh geometry={streamGeometry} material={waterMaterial} renderOrder={1} />
      <KoiSchool center={pondCenter} compact={compact} reducedMotion={reducedMotion} />
    </group>
  )
}

const waterfallVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.y * 18.0 + uTime * 1.2 + uv.x * 7.0) * 0.055 * sin(uv.y * 3.14159);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const waterfallFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float column = sin(vUv.x * 49.0 + sin(vUv.y * 13.0) * 2.0 + uTime * 1.3) * 0.5 + 0.5;
    float grain = hash(floor(vec2(vUv.x * 74.0, (vUv.y - uTime * 0.42) * 92.0)));
    float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x);
    float broken = smoothstep(0.16, 0.78, column * 0.58 + grain * 0.62);
    float alpha = edge * mix(0.16, 0.62, broken) * smoothstep(0.0, 0.12, vUv.y);
    vec3 inkWater = mix(vec3(0.18, 0.25, 0.24), vec3(0.74, 0.79, 0.72), broken);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(inkWater, alpha);
  }
`

const mistVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uPixelRatio;
  uniform float uTime;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    float age = fract(aSeed + uTime * (0.025 + aSeed * 0.022));
    p.y += age * 2.1;
    p.x += sin(uTime * 0.23 + aSeed * 31.0) * (0.35 + age * 1.1);
    p.z += cos(uTime * 0.18 + aSeed * 17.0) * (0.22 + age * 0.6);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (13.0 + aSeed * 26.0) * uPixelRatio * (1.0 - age * 0.45);
  }
`

const mistFragment = /* glsl */ `
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    p.x *= 0.62 + vSeed * 0.28;
    float alpha = smoothstep(0.52, 0.02, length(p)) * (0.10 + vSeed * 0.12);
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(0.73, 0.77, 0.70, alpha);
  }
`

function Waterfall({ compact, reducedMotion }: { compact: boolean; reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const mistMaterial = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((state) => state.gl.getPixelRatio())
  const frame = useMemo(() => journeyFrame(0.61), [])
  const position = useMemo(() => frame.position.clone().addScaledVector(frame.normal, -8.6), [frame])
  const mist = useMemo(() => {
    const count = compact ? 34 : 58
    const random = mulberry32(6169)
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 4.5
      positions[index * 3 + 1] = random() * 0.8
      positions[index * 3 + 2] = (random() - 0.5) * 2.3
      seeds[index] = random()
    }
    return { positions, seeds }
  }, [compact])
  const waterfallUniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const mistUniforms = useMemo(() => ({
    uPixelRatio: { value: pixelRatio },
    uTime: { value: 0 },
  }), [pixelRatio])

  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime
    if (material.current) material.current.uniforms.uTime.value = time
    if (mistMaterial.current) {
      mistMaterial.current.uniforms.uTime.value = time
      mistMaterial.current.uniforms.uPixelRatio.value = pixelRatio
    }
  })

  return (
    <group position={position} rotation={[0, frame.yaw, 0]}>
      <mesh position={[0, 3.15, 0]}>
        <planeGeometry args={[compact ? 3.15 : 4.1, 6.3, compact ? 10 : 16, compact ? 18 : 28]} />
        <shaderMaterial
          depthWrite={false}
          fragmentShader={waterfallFragment}
          ref={material}
          side={THREE.DoubleSide}
          transparent
          uniforms={waterfallUniforms}
          vertexShader={waterfallVertex}
        />
      </mesh>
      <points position={[0, 0.12, 0.4]} renderOrder={2}>
        <bufferGeometry>
          <bufferAttribute args={[mist.positions, 3]} attach="attributes-position" />
          <bufferAttribute args={[mist.seeds, 1]} attach="attributes-aSeed" />
        </bufferGeometry>
        <shaderMaterial
          blending={THREE.NormalBlending}
          depthWrite={false}
          fragmentShader={mistFragment}
          ref={mistMaterial}
          transparent
          uniforms={mistUniforms}
          vertexShader={mistVertex}
        />
      </points>
    </group>
  )
}

const leafVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uPixelRatio;
  uniform float uTime;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vColor = color;
    vSeed = aSeed;
    vec3 p = position;
    float fall = uTime * (0.26 + aSeed * 0.38);
    p.y = mod(p.y - fall + 2.0, 11.0) + 0.15;
    p.x += sin(uTime * 0.62 + aSeed * 47.0 + p.y * 0.54) * (0.5 + aSeed * 0.85);
    p.z += cos(uTime * 0.27 + aSeed * 19.0) * 0.48;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (2.2 + aSeed * 3.8) * uPixelRatio;
  }
`

const leafFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    p.x *= 1.8;
    float alpha = smoothstep(0.52, 0.18, length(p));
    alpha *= 0.48 + vSeed * 0.42;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function FallingLeaves({ compact, reducedMotion }: { compact: boolean; reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((state) => state.gl.getPixelRatio())
  const data = useMemo(() => {
    const count = compact ? 140 : 280
    const random = mulberry32(2027)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const palette = ['#6d3028', '#8a4d31', '#9b6a37', '#38473a'].map((color) => new THREE.Color(color))
    for (let index = 0; index < count; index += 1) {
      const frame = journeyFrame(random() * GARDEN_END)
      positions[index * 3] = frame.position.x + (random() - 0.5) * 31
      positions[index * 3 + 1] = frame.position.y + 1.2 + random() * 9.5
      positions[index * 3 + 2] = frame.position.z + (random() - 0.5) * 8
      const color = palette[index % palette.length]
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
      seeds[index] = random()
    }
    return { colors, positions, seeds }
  }, [compact])
  const uniforms = useMemo(() => ({
    uPixelRatio: { value: pixelRatio },
    uTime: { value: 0 },
  }), [pixelRatio])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    material.current.uniforms.uPixelRatio.value = pixelRatio
  })

  return (
    <points frustumCulled={false} renderOrder={3}>
      <bufferGeometry>
        <bufferAttribute args={[data.positions, 3]} attach="attributes-position" />
        <bufferAttribute args={[data.colors, 3]} attach="attributes-color" />
        <bufferAttribute args={[data.seeds, 1]} attach="attributes-aSeed" />
      </bufferGeometry>
      <shaderMaterial
        depthWrite={false}
        fragmentShader={leafFragment}
        ref={material}
        transparent
        uniforms={uniforms}
        vertexColors
        vertexShader={leafVertex}
      />
    </points>
  )
}

export function LivingGarden({ reducedMotion }: { reducedMotion: boolean }) {
  const compact = useThree((state) => state.size.width < 720)

  return (
    <group name="living-garden">
      <Terrain compact={compact} />
      <SteppingStones compact={compact} />
      <MossRocks compact={compact} />
      <SculpturalTrees compact={compact} kind="pine" reducedMotion={reducedMotion} />
      <SculpturalTrees compact={compact} kind="maple" reducedMotion={reducedMotion} />
      <BambooGrove compact={compact} reducedMotion={reducedMotion} />
      <GroundCover compact={compact} reducedMotion={reducedMotion} />
      <WaterGarden compact={compact} reducedMotion={reducedMotion} />
      <Waterfall compact={compact} reducedMotion={reducedMotion} />
      <FallingLeaves compact={compact} reducedMotion={reducedMotion} />
    </group>
  )
}

useGLTF.preload(ROCK_SET_URL)
