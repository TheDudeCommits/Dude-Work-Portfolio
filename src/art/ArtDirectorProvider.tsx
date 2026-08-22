import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { ART_ASSETS, ART_PALETTE, ART_RUNTIME } from './artTokens'

export interface ArtDirectorUniforms {
  uArtTime: THREE.Uniform<number>
  uBroadPaperScale: THREE.Uniform<number>
  uFineFiberScale: THREE.Uniform<number>
  uInkColor: THREE.Uniform<THREE.Color>
  uPaperTexture: THREE.Uniform<THREE.Texture>
  uRitualColor: THREE.Uniform<THREE.Color>
  uRitualIntensity: THREE.Uniform<number>
}

export interface ArtDirectorApi {
  pulseRitual: (amount?: number, duration?: number) => void
  setRitualIntensity: (intensity: number) => void
}

interface ArtDirectorContextValue extends ArtDirectorApi {
  reducedMotion: boolean
  uniforms: ArtDirectorUniforms
}

interface RitualPulse {
  amount: number
  remaining: number
  total: number
}

const ArtDirectorContext = createContext<ArtDirectorContextValue | null>(null)

export interface ArtDirectorProviderProps {
  children: ReactNode
  initialRitualIntensity?: number
  reducedMotion?: boolean
}

export function ArtDirectorProvider({
  children,
  initialRitualIntensity = 0,
  reducedMotion = false,
}: ArtDirectorProviderProps) {
  const paperTexture = useTexture(ART_ASSETS.washiPaper)
  const ritualTarget = useRef(THREE.MathUtils.clamp(initialRitualIntensity, 0, 1))
  const ritualPulse = useRef<RitualPulse>({ amount: 0, remaining: 0, total: 1 })

  useLayoutEffect(() => {
    paperTexture.colorSpace = THREE.NoColorSpace
    paperTexture.wrapS = THREE.RepeatWrapping
    paperTexture.wrapT = THREE.RepeatWrapping
    paperTexture.anisotropy = 4
    paperTexture.needsUpdate = true
  }, [paperTexture])

  const uniforms = useMemo<ArtDirectorUniforms>(() => ({
    uArtTime: new THREE.Uniform(0),
    uBroadPaperScale: new THREE.Uniform(ART_RUNTIME.broadPaperScale),
    uFineFiberScale: new THREE.Uniform(ART_RUNTIME.fineFiberScale),
    uInkColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.soot)),
    uPaperTexture: new THREE.Uniform(paperTexture),
    uRitualColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.oldGold)),
    uRitualIntensity: new THREE.Uniform(ritualTarget.current),
  }), [paperTexture])

  useEffect(() => {
    ritualTarget.current = THREE.MathUtils.clamp(initialRitualIntensity, 0, 1)
  }, [initialRitualIntensity])

  const setRitualIntensity = useCallback((intensity: number) => {
    ritualTarget.current = THREE.MathUtils.clamp(intensity, 0, 1)
  }, [])

  const pulseRitual = useCallback((amount = 1, duration = 1.6) => {
    const safeDuration = Math.max(duration, 0.01)
    ritualPulse.current = {
      amount: THREE.MathUtils.clamp(amount, 0, 1),
      remaining: safeDuration,
      total: safeDuration,
    }
  }, [])

  useFrame(({ clock }, delta) => {
    uniforms.uArtTime.value = reducedMotion ? 0 : clock.elapsedTime * ART_RUNTIME.timeScale

    const pulse = ritualPulse.current
    let pulseValue = 0
    if (!reducedMotion && pulse.remaining > 0) {
      pulse.remaining = Math.max(0, pulse.remaining - delta)
      const normalized = pulse.remaining / pulse.total
      pulseValue = Math.sin(normalized * Math.PI) * pulse.amount
    }

    const target = Math.max(ritualTarget.current, pulseValue)
    const ease = 1 - Math.exp(-delta * ART_RUNTIME.ritualEase)
    uniforms.uRitualIntensity.value = THREE.MathUtils.lerp(
      uniforms.uRitualIntensity.value,
      target,
      ease,
    )
  }, -120)

  const value = useMemo<ArtDirectorContextValue>(() => ({
    pulseRitual,
    reducedMotion,
    setRitualIntensity,
    uniforms,
  }), [pulseRitual, reducedMotion, setRitualIntensity, uniforms])

  return <ArtDirectorContext.Provider value={value}>{children}</ArtDirectorContext.Provider>
}

export function useArtDirector(): ArtDirectorContextValue {
  const value = useContext(ArtDirectorContext)
  if (!value) throw new Error('useArtDirector must be used inside ArtDirectorProvider')
  return value
}
