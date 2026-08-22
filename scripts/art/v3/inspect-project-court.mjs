#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const MAX_BYTES = Math.floor(1.5 * 1024 * 1024)
const MAX_LOD0_TRIANGLES = 80_000
const REQUIRED_MATERIALS = ['MAT_SUMI_FOLIAGE', 'MAT_SUMI_STONE', 'MAT_SUMI_TIMBER']
const REQUIRED_VISUALS = ['CourtPineArch', 'CourtDais', 'CourtRockRoots', 'CourtLanterns']
const RUNTIME_ANCHOR = [12.4, 0, -10.3]
const SCREEN_RADIUS = 4.6
const SCREEN_ARC_DEGREES = [208, 332]

function parseArgs(argv) {
  const args = { file: '', json: '' }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--json') args.json = argv[++index]
    else if (!args.file) args.file = argv[index]
  }
  if (!args.file) throw new Error('Usage: inspect-project-court.mjs <asset.glb> [--json report.json]')
  return args
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('Not a GLB file')
  if (buffer.readUInt32LE(4) !== 2) throw new Error('Only glTF 2.0 is supported')
  let offset = 12
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset)
    const type = buffer.readUInt32LE(offset + 4)
    if (type === JSON_CHUNK) {
      return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim())
    }
    offset += 8 + length
  }
  throw new Error('GLB does not contain a JSON chunk')
}

function primitiveTriangles(gltf, primitive) {
  const mode = primitive.mode ?? 4
  const accessor = primitive.indices == null
    ? gltf.accessors[primitive.attributes.POSITION]
    : gltf.accessors[primitive.indices]
  const count = accessor?.count ?? 0
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function sameVector(left, right, epsilon = 0.0001) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((value, index) => Math.abs(value - right[index]) <= epsilon)
}

const args = parseArgs(process.argv.slice(2))
const absolute = path.resolve(args.file)
const buffer = await readFile(absolute)
const gltf = parseGlb(buffer)
const failures = []
const fail = (message) => failures.push(message)
const materials = (gltf.materials ?? []).map((material) => material.name).filter(Boolean).sort()
const namedNodes = (gltf.nodes ?? []).filter((node) => node.name)
const nodes = namedNodes.map((node) => node.name).sort()
const nodesByName = new Map(namedNodes.map((node) => [node.name, node]))
const extensions = [...(gltf.extensionsUsed ?? [])].sort()
const meshRows = []
let triangles = 0
let primitives = 0
let colorlessPrimitives = 0

for (const node of gltf.nodes ?? []) {
  if (node.mesh == null) continue
  const mesh = gltf.meshes[node.mesh]
  let nodeTriangles = 0
  for (const primitive of mesh.primitives ?? []) {
    primitives += 1
    const count = primitiveTriangles(gltf, primitive)
    triangles += count
    nodeTriangles += count
    if (primitive.attributes?.COLOR_0 == null) colorlessPrimitives += 1
  }
  meshRows.push({
    name: node.name ?? mesh.name ?? `mesh-${node.mesh}`,
    primitives: mesh.primitives?.length ?? 0,
    triangles: nodeTriangles,
  })
}

for (const material of REQUIRED_MATERIALS) {
  if (!materials.includes(material)) fail(`missing semantic material ${material}`)
}
for (const visual of REQUIRED_VISUALS) {
  for (const lod of [0, 1]) {
    const name = `VIS_${visual}_LOD${lod}`
    const node = nodesByName.get(name)
    if (!node) fail(`missing visual node ${name}`)
    else if (node.extras?.lod !== lod) fail(`${name} has invalid lod extra`)
  }
}
if (colorlessPrimitives) fail(`${colorlessPrimitives} primitives are missing COLOR_0 / SumiData`)
if (buffer.length > MAX_BYTES) fail(`payload ${buffer.length} exceeds ${MAX_BYTES} byte budget`)
if (!extensions.includes('EXT_meshopt_compression')) fail('missing EXT_meshopt_compression')

const root = nodesByName.get('ROOT_ProjectCourtFrame_V3')
if (!root) fail('missing ROOT_ProjectCourtFrame_V3')
else {
  if (root.extras?.asset_contract !== 'dude.work.sumi-v3/1') fail('root has invalid asset_contract extra')
  if (!sameVector(root.extras?.runtime_anchor_three, RUNTIME_ANCHOR)) fail('root has invalid runtime_anchor_three')
  if (root.extras?.screen_count !== 9) fail('root has invalid screen_count')
  if (Math.abs(root.extras?.screen_radius - SCREEN_RADIUS) > 0.0001) fail('root has invalid screen_radius')
  if (!sameVector(root.extras?.screen_arc_degrees, SCREEN_ARC_DEGREES)) fail('root has invalid screen_arc_degrees')
}

const contractNodes = {
  colliders: nodes.filter((name) => name.startsWith('COL_')).length,
  sockets: nodes.filter((name) => name.startsWith('SOCKET_')).length,
  triggers: nodes.filter((name) => name.startsWith('TRG_')).length,
  effects: nodes.filter((name) => name.startsWith('FX_')).length,
  audio: nodes.filter((name) => name.startsWith('AUD_')).length,
}
if (contractNodes.colliders !== 7) fail(`expected 7 collider nodes, found ${contractNodes.colliders}`)
if (contractNodes.sockets !== 11) fail(`expected 11 socket nodes, found ${contractNodes.sockets}`)
if (contractNodes.triggers !== 1) fail(`expected 1 trigger node, found ${contractNodes.triggers}`)
if (contractNodes.effects !== 1) fail(`expected 1 effect node, found ${contractNodes.effects}`)
if (contractNodes.audio !== 1) fail(`expected 1 audio node, found ${contractNodes.audio}`)
for (let index = 0; index < 9; index += 1) {
  const name = `SOCKET_ProjectScreen_${String(index).padStart(2, '0')}`
  const screenNode = nodesByName.get(name)
  if (!screenNode) {
    fail(`missing ${name}`)
    continue
  }
  const progress = index / 8
  const angle = (SCREEN_ARC_DEGREES[0] + (SCREEN_ARC_DEGREES[1] - SCREEN_ARC_DEGREES[0]) * progress) * Math.PI / 180
  const expectedPosition = [Math.cos(angle) * SCREEN_RADIUS, 0, Math.sin(angle) * SCREEN_RADIUS]
  if (!sameVector(screenNode.extras?.three_position, expectedPosition, 0.00001)) fail(`${name} is not aligned to the live court fan`)
}
if (nodes.some((name) => name.startsWith('TEXT_'))) fail('text visual nodes are forbidden')

const lodSummary = meshRows.reduce((summary, mesh) => {
  const match = mesh.name.match(/_LOD([01])$/)
  if (!match) return summary
  const key = `lod${match[1]}`
  summary[key].triangles += mesh.triangles
  summary[key].primitives += mesh.primitives
  return summary
}, {
  lod0: { triangles: 0, primitives: 0 },
  lod1: { triangles: 0, primitives: 0 },
})
if (lodSummary.lod0.triangles > MAX_LOD0_TRIANGLES) {
  fail(`LOD0 triangle count ${lodSummary.lod0.triangles} exceeds ${MAX_LOD0_TRIANGLES} budget`)
}

const localBounds = root ? {
  min: root.extras?.bounds_local_three_min,
  max: root.extras?.bounds_local_three_max,
} : null
const worldBounds = root ? {
  min: root.extras?.bounds_world_three_min,
  max: root.extras?.bounds_world_three_max,
} : null
if (!Array.isArray(localBounds?.min) || !Array.isArray(localBounds?.max)) fail('root is missing local Three.js bounds')
if (!Array.isArray(worldBounds?.min) || !Array.isArray(worldBounds?.max)) fail('root is missing world Three.js bounds')

const report = {
  contract: 'dude.work.sumi-v3/1',
  file: path.relative(process.cwd(), absolute),
  bytes: buffer.length,
  mebibytes: Number((buffer.length / 1024 / 1024).toFixed(3)),
  sha256: createHash('sha256').update(buffer).digest('hex'),
  runtimeAnchorThree: RUNTIME_ANCHOR,
  bounds: { localThree: localBounds, worldThree: worldBounds },
  triangles,
  meshNodes: meshRows.length,
  primitives,
  contractNodes,
  lodSummary,
  materials,
  extensions,
  vertexColor: {
    attribute: 'COLOR_0',
    sourceName: 'SumiData',
    semantics: ['pigment', 'wetness', 'dry-edge', 'wind'],
  },
  integration: {
    rootNode: 'ROOT_ProjectCourtFrame_V3',
    placeAt: RUNTIME_ANCHOR,
    screenFan: { count: 9, radius: SCREEN_RADIUS, arcDegrees: SCREEN_ARC_DEGREES },
    screenSockets: Array.from({ length: 9 }, (_, index) => `SOCKET_ProjectScreen_${String(index).padStart(2, '0')}`),
    lodRule: 'show exactly one LOD per ASSET_* group before first rendered frame',
  },
  meshes: meshRows.sort((left, right) => left.name.localeCompare(right.name)),
  failures,
}

if (args.json) await writeFile(path.resolve(args.json), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
