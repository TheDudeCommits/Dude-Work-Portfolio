import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../../art'
import { freeRoamStore } from '../v2/runtime/store'
import {
  V3_GATE_BRIDGE_RING_EMITTERS,
  V3_GATE_BRIDGE_WATER_REGIONS,
} from './composition'
import type { V3InkRingEmitter, V3WaterRegion } from './types'

const MAX_RINGS = 8
const RING_LIFETIME = 2.85

const ringVertexShader = /* glsl */ `
  varying vec2 vRingUv;
  void main() {
    vRingUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ringFragmentShader = /* glsl */ `
  uniform vec3 uInkColor;
  uniform float uOpacity;
  uniform float uSeed;
  varying vec2 vRingUv;

  float ringHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32 + uSeed);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 centered = vRingUv - 0.5;
    float angle = atan(centered.y, centered.x);
    float dryBrush = ringHash(vec2(floor(angle * 41.0), floor(length(centered) * 97.0)));
    float bristle = smoothstep(0.14, 0.82, dryBrush);
    float alpha = uOpacity * mix(0.26, 1.0, bristle);
    if (alpha < 0.018) discard;
    gl_FragColor = vec4(uInkColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

interface RingSlot {
  age: number
  material: THREE.ShaderMaterial
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>
  strength: number
}

function contains(region: V3WaterRegion, x: number, z: number) {
  return x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ
}

function waterSurfaceAt(regions: readonly V3WaterRegion[], x: number, z: number) {
  return regions.find((region) => contains(region, x, z))?.surfaceY
}

export interface InkRingFieldProps {
  emitters?: readonly V3InkRingEmitter[]
  enabled?: boolean
  reducedMotion?: boolean
  waterRegions?: readonly V3WaterRegion[]
}

export function InkRingField({
  emitters = V3_GATE_BRIDGE_RING_EMITTERS,
  enabled = true,
  reducedMotion = false,
  waterRegions = V3_GATE_BRIDGE_WATER_REGIONS,
}: InkRingFieldProps) {
  const root = useRef<THREE.Group>(null)
  const nextSlot = useRef(0)
  const lastPlayerPosition = useRef(new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN))
  const lastAmbientBeat = useRef(-1)
  const geometry = useMemo(() => new THREE.RingGeometry(0.78, 1, 72, 1), [])
  const slots = useMemo<RingSlot[]>(() => Array.from({ length: MAX_RINGS }, (_, index) => {
    const material = new THREE.ShaderMaterial({
      depthWrite: false,
      fragmentShader: ringFragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: {
        uInkColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.soot)),
        uOpacity: new THREE.Uniform(0),
        uSeed: new THREE.Uniform(index * 0.731),
      },
      vertexShader: ringVertexShader,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `v3-ink-water-ring-${index}`
    mesh.renderOrder = 5
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    return { age: RING_LIFETIME, material, mesh, strength: 0 }
  }), [geometry])

  useEffect(() => {
    const group = root.current
    if (!group) return
    slots.forEach((slot) => group.add(slot.mesh))
    return () => slots.forEach((slot) => group.remove(slot.mesh))
  }, [slots])

  useEffect(() => () => {
    geometry.dispose()
    slots.forEach((slot) => slot.material.dispose())
  }, [geometry, slots])

  const emit = (x: number, y: number, z: number, strength: number) => {
    const slot = slots[nextSlot.current]
    nextSlot.current = (nextSlot.current + 1) % slots.length
    slot.age = 0
    slot.strength = strength
    slot.mesh.position.set(x, y + 0.012, z)
    slot.mesh.scale.setScalar(0.16)
    slot.mesh.visible = true
  }

  useFrame(({ clock }, delta) => {
    if (!enabled) {
      slots.forEach((slot) => { slot.mesh.visible = false })
      return
    }

    const runtime = freeRoamStore.getState()
    const player = runtime.motion.position
    const waterY = waterSurfaceAt(waterRegions, player[0], player[2])
    const inShallowWater = waterY !== undefined && Math.abs(player[1] - waterY) < 1.12
    if (runtime.motion.moving && inShallowWater) {
      const previous = lastPlayerPosition.current
      const moved = Number.isFinite(previous.x)
        ? Math.hypot(player[0] - previous.x, player[2] - previous.z)
        : Number.POSITIVE_INFINITY
      if (moved > (reducedMotion ? 1.6 : 0.78)) {
        emit(player[0], waterY, player[2], runtime.motion.sprinting ? 0.78 : 0.58)
        previous.set(player[0], player[1], player[2])
      }
    } else {
      lastPlayerPosition.current.set(Number.NaN, Number.NaN, Number.NaN)
    }

    if (!reducedMotion && emitters.length > 0) {
      const ambientBeat = Math.floor(clock.elapsedTime / 3.8)
      if (ambientBeat !== lastAmbientBeat.current) {
        lastAmbientBeat.current = ambientBeat
        const emitter = emitters[ambientBeat % emitters.length]
        emit(emitter.position[0], emitter.position[1], emitter.position[2], emitter.strength ?? 0.58)
      }
    }

    slots.forEach((slot) => {
      if (!slot.mesh.visible) return
      slot.age += delta * (reducedMotion ? 0.55 : 1)
      const progress = THREE.MathUtils.clamp(slot.age / RING_LIFETIME, 0, 1)
      const eased = 1 - Math.pow(1 - progress, 2.2)
      const radius = 0.18 + eased * (1.55 + slot.strength * 1.25)
      slot.mesh.scale.setScalar(radius)
      slot.mesh.rotation.z = slot.material.uniforms.uSeed.value * 0.21 + eased * 0.08
      slot.material.uniforms.uOpacity.value = Math.sin(progress * Math.PI)
        * slot.strength
        * (reducedMotion ? 0.34 : 0.62)
      if (progress >= 1) slot.mesh.visible = false
    })
  })

  return <group name="v3-deliberate-ink-rings" ref={root} />
}
