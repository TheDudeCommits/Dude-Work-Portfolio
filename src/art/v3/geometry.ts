import * as THREE from 'three'
import {
  LIVING_SUMI_ATTRIBUTES,
  type LivingSumiMaskDefaults,
} from './contract'

export interface EnsureLivingSumiAttributesOptions extends LivingSumiMaskDefaults {
  clone?: boolean
  decodeColorMasks?: boolean
}

const ATTRIBUTE_ALIASES = {
  dryness: ['_SUMI_DRYNESS', '_sumi_dryness'],
  pigment: ['_SUMI_PIGMENT', '_sumi_pigment'],
  stroke: ['_SUMI_STROKE', '_sumi_stroke'],
  wetness: ['_SUMI_WETNESS', '_sumi_wetness'],
  wind: ['_SUMI_WIND', '_sumi_wind'],
} as const

function clampMask(value: number) {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1)
}

function findAttribute(
  geometry: THREE.BufferGeometry,
  canonical: string,
  aliases: readonly string[],
) {
  const direct = geometry.getAttribute(canonical)
  if (direct) return direct
  for (const alias of aliases) {
    const attribute = geometry.getAttribute(alias)
    if (attribute) return attribute
  }
  return null
}

function scalarAttribute(count: number, value: number) {
  const values = new Float32Array(count)
  values.fill(clampMask(value))
  return new THREE.BufferAttribute(values, 1).setUsage(THREE.StaticDrawUsage)
}

function scalarFromSource(source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const values = new Float32Array(source.count)
  for (let index = 0; index < source.count; index += 1) values[index] = clampMask(source.getX(index))
  return new THREE.BufferAttribute(values, 1).setUsage(THREE.StaticDrawUsage)
}

function scalarFromColor(
  color: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  channel: 'r' | 'g' | 'b' | 'a',
) {
  const values = new Float32Array(color.count)
  const read = channel === 'r'
    ? (index: number) => color.getX(index)
    : channel === 'g'
      ? (index: number) => color.getY(index)
      : channel === 'b'
        ? (index: number) => color.getZ(index)
        : (index: number) => color.getW(index)
  for (let index = 0; index < color.count; index += 1) values[index] = clampMask(read(index))
  return new THREE.BufferAttribute(values, 1).setUsage(THREE.StaticDrawUsage)
}

function strokeAttribute(
  count: number,
  source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null,
  fallback: readonly [number, number],
) {
  const values = new Float32Array(count * 2)
  for (let index = 0; index < count; index += 1) {
    const x = source ? source.getX(index) : fallback[0]
    const y = source && source.itemSize > 1 ? source.getY(index) : fallback[1]
    const length = Math.hypot(x, y)
    values[index * 2] = length > 0.0001 ? x / length : 1
    values[index * 2 + 1] = length > 0.0001 ? y / length : 0
  }
  return new THREE.BufferAttribute(values, 2).setUsage(THREE.StaticDrawUsage)
}

/**
 * Normalizes a DCC or procedural geometry to the v3 shader contract. Call this
 * once during asset loading, never inside a frame loop. When COLOR_0 exists and
 * custom masks do not, R/G/B/A decode to pigment/wetness/dryness/wind.
 */
export function ensureLivingSumiAttributes(
  sourceGeometry: THREE.BufferGeometry,
  {
    clone = false,
    decodeColorMasks = true,
    dryness = 0.32,
    pigment = 0.68,
    stroke = [1, 0],
    wetness = 0.12,
    wind = 0,
  }: EnsureLivingSumiAttributesOptions = {},
) {
  const geometry = clone ? sourceGeometry.clone() : sourceGeometry
  const position = geometry.getAttribute('position')
  if (!position) throw new Error('Living sumi geometry requires a position attribute')
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const color = decodeColorMasks ? geometry.getAttribute('color') : null

  const pigmentSource = findAttribute(
    geometry,
    LIVING_SUMI_ATTRIBUTES.pigment,
    ATTRIBUTE_ALIASES.pigment,
  )
  const wetnessSource = findAttribute(
    geometry,
    LIVING_SUMI_ATTRIBUTES.wetness,
    ATTRIBUTE_ALIASES.wetness,
  )
  const drynessSource = findAttribute(
    geometry,
    LIVING_SUMI_ATTRIBUTES.dryness,
    ATTRIBUTE_ALIASES.dryness,
  )
  const strokeSource = findAttribute(
    geometry,
    LIVING_SUMI_ATTRIBUTES.stroke,
    ATTRIBUTE_ALIASES.stroke,
  )
  const windSource = findAttribute(
    geometry,
    LIVING_SUMI_ATTRIBUTES.wind,
    ATTRIBUTE_ALIASES.wind,
  )

  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.pigment,
    pigmentSource
      ? scalarFromSource(pigmentSource)
      : color
        ? scalarFromColor(color, 'r')
        : scalarAttribute(position.count, pigment),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.wetness,
    wetnessSource
      ? scalarFromSource(wetnessSource)
      : color
        ? scalarFromColor(color, 'g')
        : scalarAttribute(position.count, wetness),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.dryness,
    drynessSource
      ? scalarFromSource(drynessSource)
      : color
        ? scalarFromColor(color, 'b')
        : scalarAttribute(position.count, dryness),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.stroke,
    strokeAttribute(position.count, strokeSource, stroke),
  )
  geometry.setAttribute(
    LIVING_SUMI_ATTRIBUTES.wind,
    windSource
      ? scalarFromSource(windSource)
      : color && color.itemSize > 3
        ? scalarFromColor(color, 'a')
        : scalarAttribute(position.count, wind),
  )
  return geometry
}
