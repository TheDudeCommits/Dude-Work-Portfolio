import { useFrame } from '@react-three/fiber'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'

export interface WindFieldUniforms {
  uWindDirection: THREE.Uniform<THREE.Vector2>
  uWindGust: THREE.Uniform<number>
  uWindStrength: THREE.Uniform<number>
}

export interface WindGustOptions {
  direction?: readonly [x: number, z: number]
  duration?: number
  strength?: number
}

interface WindGustState {
  direction: THREE.Vector2
  duration: number
  remaining: number
  strength: number
}

interface WindFieldContextValue {
  gust: (options?: WindGustOptions) => void
  uniforms: WindFieldUniforms
}

const WindFieldContext = createContext<WindFieldContextValue | null>(null)

export interface WindFieldProviderProps {
  children: ReactNode
  direction?: readonly [x: number, z: number]
  strength?: number
}

export function WindFieldProvider({
  children,
  direction = [0.82, 0.57],
  strength = 0.42,
}: WindFieldProviderProps) {
  const { reducedMotion } = useArtDirector()
  const baseDirection = useRef(new THREE.Vector2(direction[0], direction[1]).normalize())
  const baseStrength = useRef(Math.max(0, strength))
  const activeGust = useRef<WindGustState>({
    direction: baseDirection.current.clone(),
    duration: 1,
    remaining: 0,
    strength: 0,
  })

  const uniforms = useMemo<WindFieldUniforms>(() => ({
    uWindDirection: new THREE.Uniform(baseDirection.current.clone()),
    uWindGust: new THREE.Uniform(0),
    uWindStrength: new THREE.Uniform(reducedMotion ? 0 : baseStrength.current),
  }), [reducedMotion])

  useEffect(() => {
    const next = new THREE.Vector2(direction[0], direction[1])
    if (next.lengthSq() < 0.0001) next.set(1, 0)
    baseDirection.current.copy(next.normalize())
  }, [direction])

  useEffect(() => {
    baseStrength.current = Math.max(0, strength)
  }, [strength])

  const gust = useCallback((options: WindGustOptions = {}) => {
    if (reducedMotion) return
    const duration = Math.max(options.duration ?? 1.8, 0.01)
    const nextDirection = options.direction
      ? new THREE.Vector2(options.direction[0], options.direction[1])
      : baseDirection.current.clone()
    if (nextDirection.lengthSq() < 0.0001) nextDirection.copy(baseDirection.current)
    activeGust.current = {
      direction: nextDirection.normalize(),
      duration,
      remaining: duration,
      strength: Math.max(0, options.strength ?? 0.85),
    }
  }, [reducedMotion])

  useFrame((_, delta) => {
    if (reducedMotion) {
      uniforms.uWindStrength.value = 0
      uniforms.uWindGust.value = 0
      return
    }

    const active = activeGust.current
    const ease = 1 - Math.exp(-delta * 2.8)
    let gustStrength = 0
    let targetDirection = baseDirection.current
    if (active.remaining > 0) {
      active.remaining = Math.max(0, active.remaining - delta)
      const normalized = active.remaining / active.duration
      gustStrength = Math.sin(normalized * Math.PI) * active.strength
      targetDirection = active.direction
    }

    uniforms.uWindDirection.value.lerp(targetDirection, ease).normalize()
    uniforms.uWindStrength.value = THREE.MathUtils.lerp(
      uniforms.uWindStrength.value,
      baseStrength.current,
      ease,
    )
    uniforms.uWindGust.value = THREE.MathUtils.lerp(uniforms.uWindGust.value, gustStrength, ease)
  }, -110)

  const value = useMemo<WindFieldContextValue>(() => ({ gust, uniforms }), [gust, uniforms])
  return <WindFieldContext.Provider value={value}>{children}</WindFieldContext.Provider>
}

export function useWindField(): WindFieldContextValue {
  const value = useContext(WindFieldContext)
  if (!value) throw new Error('useWindField must be used inside WindFieldProvider')
  return value
}
