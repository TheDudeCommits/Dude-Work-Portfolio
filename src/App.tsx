import { GitFork, Mail, Volume2, VolumeX } from 'lucide-react'
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { projects } from './projects'
import { LivingScrollWorld } from './world/LivingScrollWorld'
import {
  freeRoamCommands,
  freeRoamTouch,
  getFreeRoamSnapshot,
  useFreeRoamStore,
} from './world/v2/runtime'

declare global {
  interface Window {
    __DUDE_WORK_DEBUG__?: {
      interact: () => void
      rail: (progress: number) => void
      reset: () => void
      snapshot: typeof getFreeRoamSnapshot
      teleport: typeof freeRoamCommands.teleport
    }
    __DUDE_WORK_DIAGNOSTICS__?: {
      activeZone: string | null
      drawCalls: number
      entered: boolean
      focusedInteraction: string | null
      fps: number
      grounded: boolean
      playerPosition: readonly [number, number, number]
      pointerLocked: boolean
      ready: boolean
      triangles: number
      webglContextLost: boolean
    }
  }
}

function ToriiSigil() {
  return (
    <svg aria-hidden="true" viewBox="0 0 180 180">
      <path d="M39 48c30 4 72 4 102 0" />
      <path d="M28 36c37 6 87 6 124 0" />
      <path d="M48 59h84" />
      <path d="M55 57v78M125 57v78" />
      <path d="M45 138h22M113 138h22" />
      <circle cx="90" cy="91" r="62" />
    </svg>
  )
}

function EntryVeil({ exiting, onEnter, ready }: { exiting: boolean; onEnter: () => void; ready: boolean }) {
  return (
    <div className={`entry-veil${ready ? ' is-ready' : ''}${exiting ? ' is-exiting' : ''}`}>
      <div className="entry-veil__wash" aria-hidden="true" />
      <button
        aria-label="Enter the garden"
        className="entry-sigil"
        disabled={!ready}
        onClick={onEnter}
        type="button"
      >
        <span className="entry-sigil__halo" aria-hidden="true" />
        <ToriiSigil />
        <span className="entry-sigil__pulse entry-sigil__pulse--one" aria-hidden="true" />
        <span className="entry-sigil__pulse entry-sigil__pulse--two" aria-hidden="true" />
      </button>
      <div className="entry-veil__inkline" aria-hidden="true" />
    </div>
  )
}

function JourneyHint({ visible }: { visible: boolean }) {
  return (
    <div aria-hidden="true" className={`journey-hint${visible ? ' is-visible' : ''}`}>
      <span className="journey-hint__orbit" />
      <span className="journey-hint__stroke" />
      <i className="journey-hint__wash" />
    </div>
  )
}

function CinematicFrame() {
  return (
    <div aria-hidden="true" className="cinematic-frame">
      <span className="cinematic-frame__top" />
      <span className="cinematic-frame__bottom" />
      <i className="cinematic-frame__left" />
      <i className="cinematic-frame__right" />
    </div>
  )
}

function TouchJoystick() {
  const root = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLSpanElement>(null)

  const update = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!root.current) return
    const bounds = root.current.getBoundingClientRect()
    const rawX = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.36)
    const rawY = (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height * 0.36)
    const magnitude = Math.hypot(rawX, rawY)
    const scale = magnitude > 1 ? 1 / magnitude : 1
    const x = rawX * scale
    const y = rawY * scale
    freeRoamTouch.setMove(x, -y)
    freeRoamTouch.setSprint(magnitude > 0.92)
    if (knob.current) knob.current.style.transform = `translate3d(${x * 27}px, ${y * 27}px, 0)`
  }, [])

  const reset = useCallback(() => {
    freeRoamTouch.setMove(0, 0)
    freeRoamTouch.setSprint(false)
    if (knob.current) knob.current.style.transform = 'translate3d(0, 0, 0)'
  }, [])

  useEffect(() => () => freeRoamTouch.release(), [])

  return (
    <div
      aria-label="Movement control"
      className="touch-joystick"
      onPointerCancel={reset}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event)
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        reset()
      }}
      ref={root}
      role="application"
    >
      <span aria-hidden="true" className="touch-joystick__ring" />
      <span aria-hidden="true" className="touch-joystick__knob" ref={knob} />
    </div>
  )
}

function TouchLookPad() {
  const lastPosition = useRef<[number, number] | null>(null)
  const release = useCallback(() => {
    lastPosition.current = null
  }, [])

  return (
    <div
      aria-label="View control"
      className="touch-look-pad"
      onPointerCancel={release}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        lastPosition.current = [event.clientX, event.clientY]
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId) || !lastPosition.current) return
        const [lastX, lastY] = lastPosition.current
        freeRoamTouch.addLookDelta(event.clientX - lastX, event.clientY - lastY)
        lastPosition.current = [event.clientX, event.clientY]
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        release()
      }}
      role="application"
    >
      <span aria-hidden="true" />
      <i aria-hidden="true" />
    </div>
  )
}

function InteractionSeal({ visible }: { visible: boolean }) {
  return (
    <button
      aria-label="Awaken nearby garden element"
      className={`interaction-seal${visible ? ' is-visible' : ''}`}
      onClick={() => freeRoamTouch.interact()}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      <span aria-hidden="true" />
      <i aria-hidden="true" />
    </button>
  )
}

function SymbolicHud({
  depth,
  interactionAvailable,
  muted,
  onMuteToggle,
  showJourneyHint,
  showSocials,
}: {
  depth: number
  interactionAvailable: boolean
  muted: boolean
  onMuteToggle: () => void
  showJourneyHint: boolean
  showSocials: boolean
}) {
  return (
    <div className="symbolic-hud" style={{ '--garden-depth': depth } as CSSProperties}>
      <div aria-hidden="true" className="identity-seal" />
      <button
        aria-label={muted ? 'Unmute ambient music' : 'Mute ambient music'}
        className="sound-toggle"
        onClick={onMuteToggle}
        type="button"
      >
        {muted ? <VolumeX /> : <Volume2 />}
        <span aria-hidden="true" />
      </button>
      <JourneyHint visible={showJourneyHint} />
      <TouchJoystick />
      <TouchLookPad />
      <InteractionSeal visible={interactionAvailable} />
      <nav aria-label="Social links" className={`social-glyphs${showSocials ? ' is-visible' : ''}`}>
        <a aria-label="GitHub" href="https://github.com/TheDudeCommits" rel="noreferrer" target="_blank">
          <GitFork />
        </a>
        <a aria-label="Email" href="mailto:hello@dude.work">
          <Mail />
        </a>
      </nav>
    </div>
  )
}

function AccessibleProjectLinks() {
  return (
    <nav aria-label="Projects" className="sr-only">
      {projects.map((project) => (
        <a href={project.href} key={project.slug} rel="noreferrer" target="_blank">{project.title}</a>
      ))}
    </nav>
  )
}

function App() {
  const audio = useRef<HTMLAudioElement>(null)
  const audioGraph = useRef<{
    context: AudioContext
    filter: BiquadFilterNode
    gain: GainNode
  } | null>(null)
  const veilTimer = useRef<number | undefined>(undefined)
  const [contextLost, setContextLost] = useState(false)
  const [entered, setEntered] = useState(false)
  const [muted, setMuted] = useState(false)
  const [ready, setReady] = useState(false)
  const [veilVisible, setVeilVisible] = useState(true)
  const motion = useFreeRoamStore((state) => state.motion)
  const activeZone = useFreeRoamStore((state) => state.activeZone)
  const interaction = useFreeRoamStore((state) => state.interaction)
  const diagnostics = useFreeRoamStore((state) => state.diagnostics)
  const pointerLocked = useFreeRoamStore((state) => state.pointerLocked)
  const explorationMode = useFreeRoamStore((state) => state.exploration.mode)
  const railProgress = useFreeRoamStore((state) => state.exploration.railProgress)
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const handleEnter = useCallback(() => {
    if (!ready || entered) return
    const player = audio.current
    if (player) {
      if (!audioGraph.current && typeof AudioContext !== 'undefined') {
        const context = new AudioContext()
        const source = context.createMediaElementSource(player)
        const filter = context.createBiquadFilter()
        const gain = context.createGain()
        filter.type = 'lowpass'
        filter.frequency.value = 460
        filter.Q.value = 0.72
        gain.gain.value = 0.025
        source.connect(filter).connect(gain).connect(context.destination)
        audioGraph.current = { context, filter, gain }
        player.volume = 1
        void context.resume()
      } else {
        player.volume = 0.025
      }
      void player.play().catch(() => undefined)
    }
    setEntered(true)
    veilTimer.current = window.setTimeout(() => setVeilVisible(false), reducedMotion ? 120 : 1300)
  }, [entered, ready, reducedMotion])

  useEffect(() => () => {
    window.clearTimeout(veilTimer.current)
    const graph = audioGraph.current
    audioGraph.current = null
    if (graph) void graph.context.close()
  }, [])

  useEffect(() => {
    const player = audio.current
    if (!player) return
    const distanceToHeart = Math.hypot(
      motion.position[0] - 12.4,
      motion.position[2] + 10.3,
    )
    const proximity = 1 - smoothstep(distanceToHeart, 8, 30)
    const targetGain = muted ? 0 : Math.min(0.58, 0.025 + proximity * 0.53)
    const graph = audioGraph.current
    if (graph) {
      const now = graph.context.currentTime
      graph.gain.gain.setTargetAtTime(targetGain, now, 0.42)
      graph.filter.frequency.setTargetAtTime(460 + proximity * 7_400, now, 0.55)
      graph.filter.Q.setTargetAtTime(0.72 + proximity * 0.9, now, 0.6)
    } else {
      player.volume = targetGain
    }
  }, [motion.position, muted])

  useEffect(() => {
    const onVisibility = () => {
      const player = audio.current
      if (!player || !entered) return
      const graph = audioGraph.current
      if (document.hidden) {
        player.pause()
        if (graph) void graph.context.suspend()
      } else if (!muted) {
        if (graph) void graph.context.resume()
        void player.play().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [entered, muted])

  useEffect(() => {
    window.__DUDE_WORK_DIAGNOSTICS__ = {
      activeZone: activeZone?.id ?? null,
      drawCalls: diagnostics.drawCalls,
      entered,
      focusedInteraction: interaction.nearbyId,
      fps: diagnostics.fps,
      grounded: motion.grounded,
      playerPosition: motion.position,
      pointerLocked,
      ready,
      triangles: diagnostics.triangles,
      webglContextLost: contextLost,
    }
  }, [activeZone, contextLost, diagnostics, entered, interaction.nearbyId, motion, pointerLocked, ready])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__DUDE_WORK_DEBUG__ = {
      interact: () => freeRoamTouch.interact(),
      rail: (progress) => freeRoamCommands.resumeCinematicRail(progress),
      reset: () => freeRoamCommands.teleport([-6.8, 2.32, 27.8]),
      snapshot: getFreeRoamSnapshot,
      teleport: freeRoamCommands.teleport,
    }
    return () => {
      delete window.__DUDE_WORK_DEBUG__
    }
  }, [])

  const gardenDepth = explorationMode === 'free'
    ? Math.max(0, Math.min(1, (27.8 - motion.position[2]) / 31.6))
    : railProgress
  const showJourneyHint = motion.speed < 0.08 && Math.hypot(motion.position[0] + 6.8, motion.position[2] - 27.8) < 1.8
  const reachedProjectCourt = gardenDepth > 0.96
  const showSocials = reachedProjectCourt

  return (
    <main
      className={`experience${entered ? ' has-entered' : ''}${contextLost ? ' has-context-loss' : ''}${explorationMode !== 'free' ? ' is-cinematic-rail' : ' is-free-roam'}${reachedProjectCourt ? ' is-project-court' : ''}`}
      style={{ '--garden-depth': gardenDepth } as CSSProperties}
    >
      <LivingScrollWorld
        active={entered && !contextLost}
        onContextLost={setContextLost}
        onReady={() => setReady(true)}
        reducedMotion={reducedMotion}
      />
      <audio loop playsInline preload="metadata" ref={audio} src="/assets/audio/bamboo-flute.webm" />
      {veilVisible && <EntryVeil exiting={entered} onEnter={handleEnter} ready={ready} />}
      <div aria-hidden="true" className="foreground-ink-frame" />
      {entered && (
        <SymbolicHud
          depth={gardenDepth}
          interactionAvailable={interaction.available}
          muted={muted}
          onMuteToggle={() => {
            if (muted && audio.current?.paused) void audio.current.play().catch(() => undefined)
            setMuted((value) => !value)
          }}
          showJourneyHint={showJourneyHint}
          showSocials={showSocials}
        />
      )}
      <CinematicFrame />
      <div aria-hidden="true" className="paper-grain" />
      <div aria-hidden="true" className="context-loss-mark" />
      <AccessibleProjectLinks />
    </main>
  )
}

function smoothstep(value: number, min: number, max: number) {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return normalized * normalized * (3 - 2 * normalized)
}

export default App
