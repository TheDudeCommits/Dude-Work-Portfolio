import * as THREE from 'three'

function hash(value: number) {
  const x = Math.sin(value * 91.713 + 17.197) * 43758.5453
  return x - Math.floor(x)
}

export function createOrganicShape(radiusX: number, radiusZ: number, segments = 64, seed = 1) {
  const shape = new THREE.Shape()
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const angle = t * Math.PI * 2
    const irregularity = 1
      + Math.sin(angle * 3 + seed * 1.7) * 0.045
      + Math.sin(angle * 7 - seed * 0.81) * 0.021
      + (hash(index + seed * 19) - 0.5) * 0.018
    const x = Math.cos(angle) * radiusX * irregularity
    const z = Math.sin(angle) * radiusZ * irregularity
    if (index === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  }
  shape.closePath()
  return shape
}

export function createOrganicPlateGeometry(
  radiusX: number,
  radiusZ: number,
  depth: number,
  seed = 1,
  segments = 64,
) {
  const geometry = new THREE.ExtrudeGeometry(createOrganicShape(radiusX, radiusZ, segments, seed), {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(depth * 0.28, 0.18),
    bevelThickness: Math.min(depth * 0.24, 0.12),
    curveSegments: segments,
    depth,
    steps: 1,
  })
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, depth * 0.35, 0)
  geometry.computeVertexNormals()
  return geometry
}

export function createOrganicSurfaceGeometry(radiusX: number, radiusZ: number, seed = 1, segments = 72) {
  const geometry = new THREE.ShapeGeometry(createOrganicShape(radiusX, radiusZ, segments, seed), 12)
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

export interface TaperedTubeOptions {
  endScale?: number
  irregularity?: number
  radialSegments?: number
  radius: number
  seed?: number
  startScale?: number
  tubularSegments?: number
}

export function createTaperedTubeGeometry(points: readonly THREE.Vector3[], options: TaperedTubeOptions) {
  const {
    endScale = 0.72,
    irregularity = 0.045,
    radialSegments = 8,
    radius,
    seed = 1,
    startScale = 1,
    tubularSegments = Math.max(24, points.length * 12),
  } = options
  const curve = new THREE.CatmullRomCurve3([...points], false, 'centripetal', 0.42)
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const uv = geometry.attributes.uv as THREE.BufferAttribute
  const windWeights = new Float32Array(position.count)
  const center = new THREE.Vector3()
  const radial = new THREE.Vector3()

  for (let index = 0; index < position.count; index += 1) {
    const u = uv.getX(index)
    windWeights[index] = THREE.MathUtils.smoothstep(u, 0.08, 1)
    curve.getPointAt(u, center)
    radial.set(position.getX(index), position.getY(index), position.getZ(index)).sub(center)
    const taper = THREE.MathUtils.lerp(startScale, endScale, THREE.MathUtils.smoothstep(u, 0, 1))
    const brush = 1
      + Math.sin(u * 39 + seed) * irregularity
      + Math.sin(u * 83 - seed * 1.3) * irregularity * 0.45
    radial.multiplyScalar(taper * brush)
    center.add(radial)
    position.setXYZ(index, center.x, center.y, center.z)
  }
  geometry.setAttribute('aSumiWind', new THREE.BufferAttribute(windWeights, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export interface RibbonGeometryOptions {
  thickness?: number
  tubularSegments?: number
  width: number
  widthVariation?: number
}

export function createRibbonGeometry(points: readonly THREE.Vector3[], options: RibbonGeometryOptions) {
  const {
    thickness = 0.08,
    tubularSegments = Math.max(20, points.length * 12),
    width,
    widthVariation = 0.035,
  } = options
  const curve = new THREE.CatmullRomCurve3([...points], false, 'centripetal', 0.38)
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const center = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  for (let index = 0; index <= tubularSegments; index += 1) {
    const u = index / tubularSegments
    curve.getPointAt(u, center)
    curve.getTangentAt(u, tangent).normalize()
    side.crossVectors(up, tangent).normalize()
    if (side.lengthSq() < 0.01) side.set(1, 0, 0)
    const halfWidth = width * 0.5 * (1 + Math.sin(u * 27.1) * widthVariation)
    const left = center.clone().addScaledVector(side, halfWidth)
    const right = center.clone().addScaledVector(side, -halfWidth)
    positions.push(
      left.x, left.y, left.z,
      right.x, right.y, right.z,
      left.x, left.y - thickness, left.z,
      right.x, right.y - thickness, right.z,
    )
    uvs.push(u, 0, u, 1, u, 0, u, 1)
  }

  for (let index = 0; index < tubularSegments; index += 1) {
    const a = index * 4
    const b = a + 4
    indices.push(
      a, a + 1, b,
      a + 1, b + 1, b,
      a + 2, b + 2, a + 3,
      a + 3, b + 2, b + 3,
      a, b, a + 2,
      a + 2, b, b + 2,
      a + 1, a + 3, b + 1,
      a + 3, b + 3, b + 1,
    )
  }
  indices.push(0, 2, 1, 1, 2, 3)
  const end = tubularSegments * 4
  indices.push(end, end + 1, end + 2, end + 1, end + 3, end + 2)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function createBrushLeafGeometry(length = 1, width = 0.24, bend = 0.12, segments = 8) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const taper = Math.pow(Math.sin(t * Math.PI), 0.68) * (1 - t * 0.18)
    const centerX = Math.sin(t * Math.PI) * bend + Math.sin(t * 7.2) * width * 0.025
    const centerY = t * length
    const half = width * taper * 0.5
    positions.push(centerX - half, centerY, Math.sin(t * Math.PI) * 0.028)
    positions.push(centerX + half, centerY, -Math.sin(t * Math.PI) * 0.028)
    uvs.push(0, t, 1, t)
    if (index < segments) {
      const vertex = index * 2
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const windWeights = new Float32Array((segments + 1) * 2)
  for (let index = 0; index <= segments; index += 1) {
    const weight = THREE.MathUtils.smoothstep(index / segments, 0.05, 1)
    windWeights[index * 2] = weight
    windWeights[index * 2 + 1] = weight
  }
  geometry.setAttribute('aSumiWind', new THREE.BufferAttribute(windWeights, 1))
  geometry.computeVertexNormals()
  return geometry
}

export function createScholarStoneGeometry(radius = 1, seed = 1, detail = 20) {
  const geometry = new THREE.SphereGeometry(radius, detail, Math.max(12, Math.round(detail * 0.75)))
  const position = geometry.attributes.position as THREE.BufferAttribute
  const normal = new THREE.Vector3()
  for (let index = 0; index < position.count; index += 1) {
    normal.fromBufferAttribute(position, index).normalize()
    const vertical = normal.y * 0.5 + 0.5
    const inkErosion = 1
      + Math.sin(normal.x * 7.3 + seed) * 0.08
      + Math.sin(normal.z * 11.7 - seed * 0.6) * 0.055
      + Math.sin((normal.x + normal.y) * 17.1 + seed * 2.2) * 0.028
    const x = position.getX(index) * inkErosion * (0.77 + vertical * 0.08)
    const y = position.getY(index) * (1.22 + Math.sin(seed) * 0.12)
    const z = position.getZ(index) * inkErosion * (0.68 + vertical * 0.12)
    position.setXYZ(index, x, y, z)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function createDrapedVeilGeometry(width = 2.3, height = 3.1, segmentsX = 20, segmentsY = 26) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let yIndex = 0; yIndex <= segmentsY; yIndex += 1) {
    const v = yIndex / segmentsY
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const u = xIndex / segmentsX
      const x = (u - 0.5) * width * (1 - v * 0.06)
      const y = (v - 0.5) * height + Math.sin(u * Math.PI * 3) * (1 - v) * 0.055
      const fold = Math.sin(u * Math.PI * 5 + v * 2.1) * 0.12 + Math.cos(v * 8.2) * 0.035
      const lowerFray = v < 0.1 ? Math.sin(u * 29.0) * 0.1 * (0.1 - v) * 10 : 0
      positions.push(x, y + lowerFray, fold)
      uvs.push(u, v)
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
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createPortalMembraneGeometry(width = 2.25, height = 2.9, segmentsX = 22, segmentsY = 28) {
  const geometry = createDrapedVeilGeometry(width, height, segmentsX, segmentsY)
  const position = geometry.attributes.position as THREE.BufferAttribute
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    position.setZ(index, position.getZ(index) + (x * x) * 0.038 - Math.cos(y * 1.4) * 0.018)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function createKoiBodyGeometry(length = 1.1, girth = 0.22) {
  const profile = [
    new THREE.Vector2(0.02, -length * 0.52),
    new THREE.Vector2(girth * 0.62, -length * 0.34),
    new THREE.Vector2(girth, -length * 0.08),
    new THREE.Vector2(girth * 0.82, length * 0.23),
    new THREE.Vector2(girth * 0.36, length * 0.48),
    new THREE.Vector2(0.02, length * 0.54),
  ]
  const geometry = new THREE.LatheGeometry(profile, 14)
  geometry.rotateZ(Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

export function createPaperBoatGeometry(scale = 1) {
  const vertices = new Float32Array([
    -1.0, 0, -0.55, 1.0, 0, -0.55, 0, -0.22, 0,
    -1.0, 0, 0.55, 0, -0.22, 0, 1.0, 0, 0.55,
    -1.0, 0, -0.55, 0, 0.64, 0, 1.0, 0, -0.55,
    -1.0, 0, 0.55, 1.0, 0, 0.55, 0, 0.64, 0,
    -1.0, 0, -0.55, -1.0, 0, 0.55, 0, 0.64, 0,
    1.0, 0, 0.55, 1.0, 0, -0.55, 0, 0.64, 0,
  ])
  for (let index = 0; index < vertices.length; index += 1) vertices[index] *= scale
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function circleStrokePoints(
  radiusX: number,
  radiusY: number,
  start = -Math.PI * 0.48,
  end = Math.PI * 1.36,
  count = 18,
  z = 0,
) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1)
    const angle = THREE.MathUtils.lerp(start, end, t)
    const irregularity = 1 + Math.sin(index * 1.77) * 0.018 + Math.sin(index * 0.51) * 0.026
    return new THREE.Vector3(
      Math.cos(angle) * radiusX * irregularity,
      Math.sin(angle) * radiusY * irregularity,
      z + Math.sin(angle * 3) * 0.035,
    )
  })
}
