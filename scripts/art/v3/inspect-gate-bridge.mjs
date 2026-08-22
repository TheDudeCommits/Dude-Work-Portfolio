#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const MAX_BYTES = 3 * 1024 * 1024
const REQUIRED_MATERIALS = [
  'MAT_SUMI_FOLIAGE',
  'MAT_SUMI_METAL',
  'MAT_SUMI_STONE',
  'MAT_SUMI_TIMBER',
  'MAT_SUMI_VERMILION',
  'MAT_SUMI_WATER',
  'MAT_SUMI_WASHI',
]
const REQUIRED_VISUALS = [
  'Torii',
  'RopeBells',
  'MoonBridge',
  'RockComposition',
  'OldPine',
  'SteppingApproach',
  'GardenFrame',
]

function parseArgs(argv) {
  const args = { file: '', json: '' }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--json') args.json = argv[++index]
    else if (!args.file) args.file = argv[index]
  }
  if (!args.file) throw new Error('Usage: inspect-gate-bridge.mjs <asset.glb> [--json report.json]')
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

function fail(message, failures) {
  failures.push(message)
}

const args = parseArgs(process.argv.slice(2))
const absolute = path.resolve(args.file)
const buffer = await readFile(absolute)
const gltf = parseGlb(buffer)
const failures = []
const materials = (gltf.materials ?? []).map((material) => material.name).filter(Boolean).sort()
const nodes = (gltf.nodes ?? []).map((node) => node.name).filter(Boolean).sort()
const nodesByName = new Map((gltf.nodes ?? []).filter((node) => node.name).map((node) => [node.name, node]))
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
    nodeTriangles += count
    triangles += count
    if (primitive.attributes?.COLOR_0 == null) colorlessPrimitives += 1
  }
  meshRows.push({ name: node.name ?? mesh.name ?? `mesh-${node.mesh}`, primitives: mesh.primitives?.length ?? 0, triangles: nodeTriangles })
}

for (const material of REQUIRED_MATERIALS) {
  if (!materials.includes(material)) fail(`missing semantic material ${material}`, failures)
}
for (const visual of REQUIRED_VISUALS) {
  for (const lod of [0, 1]) {
    const name = `VIS_${visual}_LOD${lod}`
    if (!nodes.includes(name)) fail(`missing visual node ${name}`, failures)
    else if (nodesByName.get(name)?.extras?.lod !== lod) fail(`${name} has invalid lod extra`, failures)
  }
}
if (colorlessPrimitives) fail(`${colorlessPrimitives} primitives are missing COLOR_0 / SumiData`, failures)
if (buffer.length > MAX_BYTES) fail(`payload ${buffer.length} exceeds ${MAX_BYTES} byte budget`, failures)
if (!nodes.includes('ROOT_GateBridge_V3')) fail('missing ROOT_GateBridge_V3', failures)
else if (nodesByName.get('ROOT_GateBridge_V3')?.extras?.asset_contract !== 'dude.work.sumi-v3/1') {
  fail('ROOT_GateBridge_V3 has invalid asset_contract extra', failures)
}

const contractNodes = {
  colliders: nodes.filter((name) => name.startsWith('COL_')).length,
  sockets: nodes.filter((name) => name.startsWith('SOCKET_')).length,
  triggers: nodes.filter((name) => name.startsWith('TRG_')).length,
  effects: nodes.filter((name) => name.startsWith('FX_')).length,
  audio: nodes.filter((name) => name.startsWith('AUD_')).length,
}
if (contractNodes.colliders !== 11) fail(`expected 11 collider nodes, found ${contractNodes.colliders}`, failures)
if (contractNodes.sockets !== 2) fail(`expected 2 socket nodes, found ${contractNodes.sockets}`, failures)
if (contractNodes.triggers !== 1) fail(`expected 1 trigger node, found ${contractNodes.triggers}`, failures)
if (contractNodes.effects !== 1) fail(`expected 1 effect node, found ${contractNodes.effects}`, failures)
if (contractNodes.audio !== 1) fail(`expected 1 audio node, found ${contractNodes.audio}`, failures)

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
if (lodSummary.lod0.triangles > 100_000) {
  fail(`LOD0 triangle count ${lodSummary.lod0.triangles} exceeds 100000 budget`, failures)
}

const report = {
  contract: 'dude.work.sumi-v3/1',
  file: path.relative(process.cwd(), absolute),
  bytes: buffer.length,
  mebibytes: Number((buffer.length / 1024 / 1024).toFixed(3)),
  sha256: createHash('sha256').update(buffer).digest('hex'),
  triangles,
  meshNodes: meshRows.length,
  primitives,
  contractNodes,
  lodSummary,
  materials,
  extensions,
  vertexColor: { attribute: 'COLOR_0', sourceName: 'SumiData', semantics: ['pigment', 'wetness', 'dry-edge', 'wind'] },
  meshes: meshRows.sort((a, b) => a.name.localeCompare(b.name)),
  failures,
}

if (args.json) {
  await writeFile(path.resolve(args.json), `${JSON.stringify(report, null, 2)}\n`)
}
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
