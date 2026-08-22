import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../../art'
import {
  ensureLivingSumiAttributes,
  LIVING_SUMI_ATTRIBUTES,
  LivingSumiMaterial,
} from '../../art/v3'

const POND_SURFACE_Y = -0.12
const DESKTOP_KOI_COUNT = 7
const MOBILE_KOI_COUNT = 4
const Y_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * Deliberately tighter than the oversized runtime water carrier. Nothing alive
 * is allowed beneath the land carrier or through the bridge landing corridor.
 */
const VISIBLE_POND_ZONES = [
  { centerX: 0, centerZ: -7.55, radiusX: 4.55, radiusZ: 1.68 },
  { centerX: 0, centerZ: 1.42, radiusX: 4.45, radiusZ: 2.12 },
] as const

const koiVertexShader = /* glsl */ `
  attribute float aKoiAccent;
  attribute float aKoiSeed;
  uniform float uMotion;
  uniform float uTime;
  varying float vKoiAccent;
  varying float vKoiSeed;
  varying vec2 vKoiUv;

  void main() {
    vec3 localPosition = position;
    float tailMask = 1.0 - smoothstep(-0.98, -0.45, localPosition.x);
    float tailWave = sin(
      uTime * 3.35 + aKoiSeed * 11.7 + localPosition.x * 4.8
    ) * tailMask * uMotion;
    localPosition.z += tailWave * 0.115;

    vec4 instancePosition = vec4(localPosition, 1.0);
    #ifdef USE_INSTANCING
      instancePosition = instanceMatrix * instancePosition;
    #endif

    vec4 worldPosition = modelMatrix * instancePosition;
    vKoiAccent = aKoiAccent;
    vKoiSeed = aKoiSeed;
    vKoiUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const koiFragmentShader = /* glsl */ `
  uniform vec3 uDeepWater;
  uniform vec3 uInk;
  uniform float uOpacity;
  uniform vec3 uPaper;
  uniform vec3 uVermilion;
  varying float vKoiAccent;
  varying float vKoiSeed;
  varying vec2 vKoiUv;

  float koiHash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21) + vKoiSeed * 3.17);
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  void main() {
    float longBristle = sin(
      vKoiUv.x * 27.0 + sin(vKoiUv.y * 8.0 + vKoiSeed * 5.0) * 1.4
    ) * 0.5 + 0.5;
    float dryBreak = smoothstep(
      0.52,
      0.91,
      koiHash(floor(vKoiUv * vec2(29.0, 11.0))) * 0.62 + longBristle * 0.38
    );
    float paperBand = smoothstep(
      0.18,
      0.82,
      sin(vKoiUv.x * 8.7 + vKoiSeed * 4.3) * 0.5 + 0.5
    );
    float vermilionPatch = smoothstep(
      0.57,
      0.83,
      sin(vKoiUv.x * 14.0 - vKoiUv.y * 9.0 + vKoiSeed * 8.2) * 0.5 + 0.5
    ) * vKoiAccent;

    vec3 color = mix(uInk, uPaper, 0.24 + paperBand * 0.48);
    color = mix(color, uVermilion, vermilionPatch * 0.82);
    color = mix(color, uDeepWater, 0.22 + dryBreak * 0.12);
    color = mix(color, uInk, dryBreak * 0.2);
    float alpha = uOpacity * mix(0.7, 1.0, longBristle) * (0.88 + vKoiAccent * 0.12);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const lifeVertexShader = /* glsl */ `
  attribute float aKind;
  attribute float aScale;
  attribute float aSeed;
  uniform float uMotion;
  uniform float uTime;
  varying float vLifeAlpha;
  varying float vLifeKind;
  varying float vLifeSeed;

  void main() {
    vec3 animated = position;
    float alpha = 1.0;

    if (aKind < 0.5) {
      animated.x += sin(uTime * 0.29 + aSeed * 15.7) * 0.26 * uMotion;
      animated.y += sin(uTime * 0.41 + aSeed * 21.1) * 0.17 * uMotion;
      animated.z += cos(uTime * 0.23 + aSeed * 17.3) * 0.2 * uMotion;
      float pulse = 0.58 + sin(uTime * 0.47 + aSeed * 31.0) * 0.18;
      alpha = mix(0.34, pulse, uMotion);
    } else if (aKind < 1.5) {
      animated.x += sin(uTime * 0.63 + aSeed * 13.0) * 0.52 * uMotion;
      animated.y += sin(uTime * 0.91 + aSeed * 19.0) * 0.08 * uMotion;
      animated.z += cos(uTime * 0.51 + aSeed * 9.0) * 0.38 * uMotion;
      alpha = 0.56 * uMotion;
    } else {
      float flight = fract(aSeed + uTime * 0.018 * uMotion);
      animated.x = mix(-27.0, 27.0, flight);
      animated.y += sin(flight * 3.14159265) * 2.2;
      animated.z += sin(flight * 6.2831853 + aSeed * 8.0) * 1.8;
      alpha = smoothstep(0.0, 0.12, flight)
        * (1.0 - smoothstep(0.82, 1.0, flight))
        * uMotion;
    }

    vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aScale * (260.0 / max(2.0, -viewPosition.z)), 1.0, 15.0);
    vLifeAlpha = alpha;
    vLifeKind = aKind;
    vLifeSeed = aSeed;
  }
`

const lifeFragmentShader = /* glsl */ `
  uniform vec3 uCeladon;
  uniform vec3 uFirefly;
  uniform vec3 uInk;
  varying float vLifeAlpha;
  varying float vLifeKind;
  varying float vLifeSeed;

  float segmentDistance(vec2 point, vec2 start, vec2 end) {
    vec2 offset = point - start;
    vec2 segment = end - start;
    float amount = clamp(dot(offset, segment) / max(dot(segment, segment), 0.0001), 0.0, 1.0);
    return length(offset - segment * amount);
  }

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float alpha = 0.0;
    vec3 color = uInk;

    if (vLifeKind < 0.5) {
      float angle = atan(point.y, point.x);
      float raggedRadius = length(point)
        * (1.0 + sin(angle * 5.0 + vLifeSeed * 27.0) * 0.13);
      float wash = 1.0 - smoothstep(0.24, 0.94, raggedRadius);
      float core = 1.0 - smoothstep(0.0, 0.28, length(point));
      alpha = wash * vLifeAlpha * 0.72;
      color = mix(uCeladon, uFirefly, 0.68 + core * 0.24);
    } else if (vLifeKind < 1.5) {
      float body = 1.0 - smoothstep(0.045, 0.13, abs(point.y));
      body *= 1.0 - smoothstep(0.25, 0.92, abs(point.x));
      float upperWing = 1.0 - smoothstep(0.055, 0.15, abs(point.y - point.x * 0.38));
      float lowerWing = 1.0 - smoothstep(0.055, 0.15, abs(point.y + point.x * 0.38));
      float wingBounds = smoothstep(0.1, 0.34, abs(point.x))
        * (1.0 - smoothstep(0.58, 0.96, abs(point.x)));
      alpha = max(body, max(upperWing, lowerWing) * wingBounds * 0.64) * vLifeAlpha;
      color = mix(uInk, uCeladon, 0.18);
    } else {
      float leftWing = segmentDistance(point, vec2(-0.82, 0.2), vec2(0.0, -0.2));
      float rightWing = segmentDistance(point, vec2(0.0, -0.2), vec2(0.82, 0.2));
      float birdStroke = 1.0 - smoothstep(0.055, 0.16, min(leftWing, rightWing));
      alpha = birdStroke * vLifeAlpha * 0.84;
      color = uInk;
    }

    if (alpha < 0.015) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

interface KoiSeed {
  centerX: number
  centerZ: number
  depth: number
  phase: number
  radiusX: number
  radiusZ: number
  scale: number
  speed: number
}

interface KoiScratch {
  matrix: THREE.Matrix4
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
}

interface PlantPlacement {
  pitch: number
  roll: number
  scaleX: number
  scaleY: number
  scaleZ: number
  x: number
  y: number
  yaw: number
  z: number
}

type GreeneryKind = 'broad' | 'reed'

function hash01(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453
  return value - Math.floor(value)
}

function createKoiSeeds(count: number): KoiSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const zone = VISIBLE_POND_ZONES[index % VISIBLE_POND_ZONES.length]
    return {
      centerX: zone.centerX + (hash01(index, 1.3) - 0.5) * 0.5,
      centerZ: zone.centerZ + (hash01(index, 2.7) - 0.5) * 0.26,
      depth: 0.025 + hash01(index, 3.1) * 0.055,
      phase: hash01(index, 4.9) * Math.PI * 2,
      radiusX: zone.radiusX * (0.74 + hash01(index, 5.2) * 0.22),
      radiusZ: zone.radiusZ * (0.68 + hash01(index, 6.6) * 0.24),
      scale: 0.34 + hash01(index, 7.4) * 0.15,
      speed: 0.075 + hash01(index, 8.8) * 0.065,
    }
  })
}

function createKoiGeometry(count: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-0.58, 0)
  shape.bezierCurveTo(-0.34, 0.29, 0.5, 0.27, 0.76, 0)
  shape.bezierCurveTo(0.5, -0.27, -0.34, -0.29, -0.58, 0)
  shape.lineTo(-1.02, -0.31)
  shape.lineTo(-0.91, 0)
  shape.lineTo(-1.02, 0.31)
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape, 6)
  geometry.rotateX(-Math.PI / 2)

  const seeds = new Float32Array(count)
  const accents = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    seeds[index] = hash01(index, 10.3)
    accents[index] = index === 0 ? 1 : index === 3 ? 0.52 : hash01(index, 11.8) * 0.12
  }
  geometry.setAttribute('aKoiSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  geometry.setAttribute('aKoiAccent', new THREE.InstancedBufferAttribute(accents, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function writeKoiTransforms(
  mesh: THREE.InstancedMesh,
  seeds: readonly KoiSeed[],
  scratch: KoiScratch,
  time: number,
) {
  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index]
    const angle = seed.phase + time * seed.speed
    const x = seed.centerX + Math.cos(angle) * seed.radiusX
    const z = seed.centerZ + Math.sin(angle) * seed.radiusZ
    const tangentX = -Math.sin(angle) * seed.radiusX
    const tangentZ = Math.cos(angle) * seed.radiusZ
    const yaw = Math.atan2(-tangentZ, tangentX)
    const bob = Math.sin(time * 0.72 + seed.phase * 1.7) * 0.012
    scratch.position.set(x, POND_SURFACE_Y - seed.depth + bob, z)
    scratch.quaternion.setFromAxisAngle(Y_AXIS, yaw)
    scratch.scale.set(seed.scale, seed.scale * 0.72, seed.scale)
    scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale)
    mesh.setMatrixAt(index, scratch.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

function KoiSchool({ active, compact, reducedMotion }: EcologyLayerProps) {
  const count = compact ? MOBILE_KOI_COUNT : DESKTOP_KOI_COUNT
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => createKoiGeometry(count), [count])
  const seeds = useMemo(() => createKoiSeeds(count), [count])
  const scratch = useMemo<KoiScratch>(() => ({
    matrix: new THREE.Matrix4(),
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
  }), [])
  const uniforms = useMemo(() => ({
    uDeepWater: new THREE.Uniform(new THREE.Color(ART_PALETTE.deepWater)),
    uInk: new THREE.Uniform(new THREE.Color(ART_PALETTE.soot)),
    uMotion: new THREE.Uniform(1),
    uOpacity: new THREE.Uniform(0.54),
    uPaper: new THREE.Uniform(new THREE.Color(ART_PALETTE.washi)),
    uTime: new THREE.Uniform(0),
    uVermilion: new THREE.Uniform(new THREE.Color(ART_PALETTE.vermilion)),
  }), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    writeKoiTransforms(mesh.current, seeds, scratch, 0)
  }, [reducedMotion, scratch, seeds])

  useFrame(({ clock }) => {
    uniforms.uMotion.value = reducedMotion ? 0 : 1
    uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    if (!active || reducedMotion || !mesh.current) return
    writeKoiTransforms(mesh.current, seeds, scratch, clock.elapsedTime)
  })

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh
      args={[geometry, undefined, count]}
      castShadow={false}
      count={count}
      frustumCulled={false}
      name="V3_LivingKoiSchool"
      receiveShadow={false}
      ref={mesh}
      renderOrder={2}
      visible={active}
    >
      <shaderMaterial
        blending={THREE.NormalBlending}
        depthTest
        depthWrite={false}
        fragmentShader={koiFragmentShader}
        side={THREE.DoubleSide}
        transparent
        uniforms={uniforms}
        vertexShader={koiVertexShader}
      />
    </instancedMesh>
  )
}

function createLifeFieldGeometry(compact: boolean) {
  const fireflyCount = compact ? 10 : 26
  const dragonflyCount = compact ? 3 : 6
  const birdCount = compact ? 0 : 3
  const positions: number[] = []
  const kinds: number[] = []
  const scales: number[] = []
  const seeds: number[] = []

  for (let index = 0; index < fireflyCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const approachFirefly = index % 3 === 0
    positions.push(
      side * (5.75 + hash01(index, 12.4) * 2.2),
      0.7 + hash01(index, 13.1) * 2.4,
      approachFirefly
        ? 7 + hash01(index, 14.8) * 15.5
        : -9.3 + hash01(index, 14.8) * 13.6,
    )
    kinds.push(0)
    scales.push(0.34 + hash01(index, 15.6) * 0.2)
    seeds.push(hash01(index, 16.2))
  }

  for (let index = 0; index < dragonflyCount; index += 1) {
    const zone = VISIBLE_POND_ZONES[index % VISIBLE_POND_ZONES.length]
    positions.push(
      zone.centerX + (hash01(index, 17.4) - 0.5) * zone.radiusX * 1.72,
      POND_SURFACE_Y + 0.22 + hash01(index, 18.7) * 0.38,
      zone.centerZ + (hash01(index, 19.1) - 0.5) * zone.radiusZ * 1.55,
    )
    kinds.push(1)
    scales.push(0.3 + hash01(index, 20.6) * 0.12)
    seeds.push(hash01(index, 21.9))
  }

  for (let index = 0; index < birdCount; index += 1) {
    positions.push(0, 10.8 + hash01(index, 22.2) * 3.8, -24 - hash01(index, 23.5) * 9)
    kinds.push(2)
    scales.push(1.1 + hash01(index, 24.7) * 0.42)
    seeds.push(hash01(index, 25.3))
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1))
  geometry.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, -7), 42)
  return geometry
}

function GardenLifeField({ active, compact, reducedMotion }: EcologyLayerProps) {
  const geometry = useMemo(() => createLifeFieldGeometry(compact), [compact])
  const uniforms = useMemo(() => ({
    uCeladon: new THREE.Uniform(new THREE.Color(ART_PALETTE.celadon)),
    uFirefly: new THREE.Uniform(new THREE.Color(ART_PALETTE.oldGold)),
    uInk: new THREE.Uniform(new THREE.Color(ART_PALETTE.soot)),
    uMotion: new THREE.Uniform(1),
    uTime: new THREE.Uniform(0),
  }), [])

  useFrame(({ clock }) => {
    uniforms.uMotion.value = reducedMotion ? 0 : 1
    uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  })

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points
      frustumCulled={false}
      geometry={geometry}
      name="V3_RestrainedGardenLifeField"
      renderOrder={5}
      visible={active}
    >
      <shaderMaterial
        blending={THREE.NormalBlending}
        depthTest
        depthWrite={false}
        fragmentShader={lifeFragmentShader}
        transparent
        uniforms={uniforms}
        vertexShader={lifeVertexShader}
      />
    </points>
  )
}

function paintGreeneryMasks(geometry: THREE.BufferGeometry, kind: GreeneryKind) {
  ensureLivingSumiAttributes(geometry, {
    decodeColorMasks: false,
    dryness: kind === 'reed' ? 0.52 : 0.38,
    pigment: kind === 'reed' ? 0.76 : 0.84,
    stroke: kind === 'reed' ? [0.94, 0.34] : [0.72, 0.69],
    wetness: kind === 'reed' ? 0.18 : 0.24,
    wind: 0,
  })
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  const position = geometry.getAttribute('position')
  const height = Math.max(0.001, (bounds?.max.y ?? 1) - (bounds?.min.y ?? 0))
  const minimumY = bounds?.min.y ?? 0
  const dryness = new Float32Array(position.count)
  const pigment = new Float32Array(position.count)
  const wetness = new Float32Array(position.count)
  const wind = new Float32Array(position.count)

  for (let index = 0; index < position.count; index += 1) {
    const amount = THREE.MathUtils.clamp((position.getY(index) - minimumY) / height, 0, 1)
    dryness[index] = (kind === 'reed' ? 0.42 : 0.3) + amount * 0.32
    pigment[index] = (kind === 'reed' ? 0.68 : 0.76) + amount * 0.2
    wetness[index] = (kind === 'reed' ? 0.28 : 0.34) - amount * 0.15
    wind[index] = amount * amount
  }

  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.dryness,
    new THREE.Float32BufferAttribute(dryness, 1).setUsage(THREE.StaticDrawUsage),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.pigment,
    new THREE.Float32BufferAttribute(pigment, 1).setUsage(THREE.StaticDrawUsage),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.wetness,
    new THREE.Float32BufferAttribute(wetness, 1).setUsage(THREE.StaticDrawUsage),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.wind,
    new THREE.Float32BufferAttribute(wind, 1).setUsage(THREE.StaticDrawUsage),
  )
  geometry.computeBoundingSphere()
  return geometry
}

function createReedGeometry() {
  const sections = 5
  const centers = [0, 0.026, -0.018, 0.022, 0.006]
  const widths = [0.055, 0.052, 0.04, 0.025, 0.004]
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let section = 0; section < sections; section += 1) {
    const amount = section / (sections - 1)
    const y = amount * 1.18
    const z = Math.sin(amount * Math.PI) * 0.035
    positions.push(
      centers[section] - widths[section], y, z,
      centers[section] + widths[section], y, z,
    )
    uvs.push(0, amount, 1, amount)
    if (section < sections - 1) {
      const vertex = section * 2
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return paintGreeneryMasks(geometry, 'reed')
}

function createBroadLeafGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(-0.3, 0.24, -0.42, 0.7, 0, 1.08)
  shape.bezierCurveTo(0.42, 0.7, 0.3, 0.24, 0, 0)
  const geometry = new THREE.ShapeGeometry(shape, 7)
  return paintGreeneryMasks(geometry, 'broad')
}

function distanceToSegment(
  x: number,
  z: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
) {
  const segmentX = endX - startX
  const segmentZ = endZ - startZ
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ
  const amount = lengthSquared > 0
    ? THREE.MathUtils.clamp(
      ((x - startX) * segmentX + (z - startZ) * segmentZ) / lengthSquared,
      0,
      1,
    )
    : 0
  return Math.hypot(
    x - (startX + segmentX * amount),
    z - (startZ + segmentZ * amount),
  )
}

function excludedFromGreenery(x: number, z: number) {
  if (distanceToSegment(x, z, 0, 11.7, -3.3, 4.2) < 2.25) return true
  if (distanceToSegment(x, z, -3.3, 4.2, -7.05, -3.4) < 1.9) return true
  if (distanceToSegment(x, z, -7.05, -3.4, 7.05, -3.4) < 1.65) return true
  if (distanceToSegment(x, z, 7.05, -3.4, 9.65, -6.1) < 2.05) return true
  if (Math.hypot(x + 7.05, z + 3.4) < 2.4) return true
  if (Math.hypot(x - 7.05, z + 3.4) < 2.4) return true
  if (Math.abs(x) < 4.6 && z > 8) return true
  return false
}

function groundHeight(x: number, z: number) {
  const broad = Math.sin(x * 0.23 + z * 0.11) * 0.055
    + Math.cos(z * 0.19 - x * 0.08) * 0.035
  const outerBank = THREE.MathUtils.smoothstep(Math.abs(x), 9, 18) * 0.34
  const thresholdLift = THREE.MathUtils.smoothstep(z, 6, 24) * 0.055
  return broad + outerBank + thresholdLift
}

function createPlantPlacements(count: number, kind: GreeneryKind): PlantPlacement[] {
  const placements: PlantPlacement[] = []
  const outerOffset = kind === 'broad' ? 0.42 : 0

  for (let candidate = 0; placements.length < count && candidate < count * 80; candidate += 1) {
    const edge = candidate % 4
    const along = hash01(candidate, kind === 'reed' ? 31.1 : 41.3)
    const band = hash01(candidate, kind === 'reed' ? 32.4 : 42.8)
    let x = 0
    let z = 0

    if (kind === 'broad' && candidate % 3 === 0) {
      const side = candidate % 2 === 0 ? -1 : 1
      x = side * (8.2 + band * 4.5)
      z = -12 + along * 35.5
    } else if (edge === 0 || edge === 1) {
      const side = edge === 0 ? -1 : 1
      x = side * (6.48 + outerOffset + band * 1.48)
      z = -10.18 + along * 15.18
    } else if (edge === 2) {
      x = -5.9 + along * 11.8
      z = 5.38 + outerOffset + band * 1.32
    } else {
      x = -5.9 + along * 11.8
      z = -10.58 - outerOffset - band * 1.25
    }

    if (excludedFromGreenery(x, z)) continue
    const scaleSeed = hash01(candidate, kind === 'reed' ? 33.7 : 43.9)
    const leanX = hash01(candidate, 45.1) - 0.5
    const leanZ = hash01(candidate, 46.6) - 0.5
    placements.push({
      pitch: leanX * (kind === 'reed' ? 0.18 : 0.7),
      roll: leanZ * (kind === 'reed' ? 0.2 : 0.92),
      scaleX: kind === 'reed' ? 0.72 + scaleSeed * 0.54 : 0.58 + scaleSeed * 0.58,
      scaleY: kind === 'reed' ? 0.64 + scaleSeed * 0.86 : 0.52 + scaleSeed * 0.68,
      scaleZ: kind === 'reed' ? 0.72 + scaleSeed * 0.54 : 0.58 + scaleSeed * 0.58,
      x,
      y: groundHeight(x, z) - 0.025,
      yaw: hash01(candidate, 47.2) * Math.PI * 2,
      z,
    })
  }

  return placements
}

interface EcologyLayerProps {
  active: boolean
  compact: boolean
  reducedMotion: boolean
}

function GreeneryBatch({ active, compact, kind, reducedMotion }: EcologyLayerProps & { kind: GreeneryKind }) {
  const count = kind === 'reed'
    ? compact ? 72 : 160
    : compact ? 28 : 72
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(
    () => kind === 'reed' ? createReedGeometry() : createBroadLeafGeometry(),
    [kind],
  )
  const placements = useMemo(() => createPlantPlacements(count, kind), [count, kind])
  const transform = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    mesh.current.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    placements.forEach((placement, index) => {
      transform.position.set(placement.x, placement.y, placement.z)
      transform.rotation.set(placement.pitch, placement.yaw, placement.roll)
      transform.scale.set(placement.scaleX, placement.scaleY, placement.scaleZ)
      transform.updateMatrix()
      mesh.current?.setMatrixAt(index, transform.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingBox()
    mesh.current.computeBoundingSphere()
  }, [placements, transform])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh
      args={[geometry, undefined, count]}
      castShadow={false}
      count={count}
      frustumCulled
      name={kind === 'reed' ? 'V3_PondReedBrushes' : 'V3_PondBankFoliage'}
      receiveShadow={false}
      ref={mesh}
      visible={active}
    >
      <LivingSumiMaterial
        alphaFeather={0}
        fogStrength={0.9}
        role="pine"
        side={THREE.DoubleSide}
        strokeInfluence={kind === 'reed' ? 0.84 : 0.72}
        windAmplitude={kind === 'reed' ? 0.105 : 0.075}
        windResponse={reducedMotion ? 0 : kind === 'reed' ? 0.52 : 0.34}
      />
    </instancedMesh>
  )
}

export interface GardenEcologyProps {
  active?: boolean
  reducedMotion?: boolean
}

/**
 * Four-draw procedural ecology layer: one koi school, one mixed life field and
 * two instanced pond-bank plant batches. Mount beneath LivingSumiProvider.
 */
export function GardenEcology({
  active = true,
  reducedMotion = false,
}: GardenEcologyProps) {
  const compact = useThree((state) => state.size.width < 720)

  return (
    <group name="v3-procedural-garden-ecology" visible={active}>
      <KoiSchool active={active} compact={compact} reducedMotion={reducedMotion} />
      <GardenLifeField active={active} compact={compact} reducedMotion={reducedMotion} />
      <GreeneryBatch active={active} compact={compact} kind="reed" reducedMotion={reducedMotion} />
      <GreeneryBatch active={active} compact={compact} kind="broad" reducedMotion={reducedMotion} />
    </group>
  )
}
