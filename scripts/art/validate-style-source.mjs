import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const activeRoots = [
  'src/art',
  'src/world/v2',
  'src/world/LivingScrollWorld.tsx',
]

async function collectFiles(relativePath) {
  const absolutePath = path.join(root, relativePath)
  if (/\.[cm]?[jt]sx?$/.test(relativePath)) return [relativePath]

  const entries = await readdir(absolutePath, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => {
    const child = path.join(relativePath, entry.name)
    return entry.isDirectory() ? collectFiles(child) : [child]
  }))
  return files.flat().filter((file) => /\.[cm]?[jt]sx?$/.test(file))
}

const files = (await Promise.all(activeRoots.map(collectFiles))).flat()
const failures = []

for (const file of files) {
  const source = await readFile(path.join(root, file), 'utf8')
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    if (file !== 'src/art/artTokens.ts' && /#[0-9a-f]{3,8}\b/i.test(line)) {
      failures.push(`${file}:${index + 1} contains a raw color; use artTokens`)
    }

    if (
      file !== 'src/art/materials/SumiSurfaceMaterial.tsx'
      && /<mesh(?:Standard|Physical|Lambert|Phong)Material\b/.test(line)
    ) {
      failures.push(`${file}:${index + 1} bypasses SumiSurfaceMaterial`)
    }

    if (
      /<meshBasicMaterial\b/.test(line)
      && !(file.endsWith('FreeRoamPlayer.tsx') && line.includes('ART_PALETTE') && line.includes('wireframe'))
    ) {
      failures.push(`${file}:${index + 1} uses an unapproved basic material`)
    }
  })

  const forbidden = [
    ['legacy LivingInkEffect', /\bLivingInkEffect\b/],
    ['legacy InkMaterial', /\bInkMaterial\b/],
    ['generic postprocessing stack', /(?:@react-three\/postprocessing|<EffectComposer\b|<Outline\b|<Noise\b|<Vignette\b)/],
  ]

  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) failures.push(`${file} references ${label}`)
  }
}

if (failures.length > 0) {
  console.error('Living Scroll art-contract violations:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`Living Scroll art contract passed across ${files.length} active source files.`)
}
