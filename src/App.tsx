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
import type { JourneyInput } from './world/types'
import { PortfolioWorld } from './world/World'

declare global {
  interface Window {
    __DUDE_WORK_DIAGNOSTICS__?: {
      entered: boolean
      progress: number
      ready: boolean
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

function FootstepHint({ visible }: { visible: boolean }) {
  return (
    <div aria-hidden="true" className={`footstep-hint${visible ? ' is-visible' : ''}`}>
      <span />
      <span />
      <i />
    </div>
  )
}

function TouchJoystick({ input }: { input: React.MutableRefObject<JourneyInput> }) {
  const root = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLSpanElement>(null)

  const update = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!root.current) return
    const bounds = root.current.getBoundingClientRect()
    const dx = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.36)
    const dy = (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height * 0.36)
    const length = Math.max(1, Math.hypot(dx, dy))
    const x = dx / length
    const y = dy / length
    input.current.strafe = x
    input.current.forward = -y
    if (knob.current) knob.current.style.transform = `translate3d(${x * 26}px, ${y * 26}px, 0)`
  }, [input])

  const reset = useCallback(() => {
    input.current.strafe = 0
    input.current.forward = 0
    if (knob.current) knob.current.style.transform = 'translate3d(0, 0, 0)'
  }, [input])

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

function SymbolicHud({
  input,
  muted,
  onMuteToggle,
  progress,
}: {
  input: React.MutableRefObject<JourneyInput>
  muted: boolean
  onMuteToggle: () => void
  progress: number
}) {
  return (
    <div className="symbolic-hud" style={{ '--journey-progress': progress } as CSSProperties}>
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
      <div aria-hidden="true" className="journey-stroke"><i /></div>
      <FootstepHint visible={progress < 0.025} />
      <TouchJoystick input={input} />
      <nav aria-label="Social links" className={`social-glyphs${progress > 0.86 ? ' is-visible' : ''}`}>
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
  const input = useRef<JourneyInput>({ forward: 0, lookX: 0, lookY: 0, strafe: 0, wheel: 0 })
  const progressRef = useRef(0)
  const veilTimer = useRef<number | undefined>(undefined)
  const [contextLost, setContextLost] = useState(false)
  const [entered, setEntered] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [veilVisible, setVeilVisible] = useState(true)
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const handleEnter = useCallback(() => {
    if (!ready || entered) return
    const player = audio.current
    if (player) {
      player.volume = 0.025
      void player.play().catch(() => undefined)
    }
    setEntered(true)
    veilTimer.current = window.setTimeout(() => setVeilVisible(false), reducedMotion ? 120 : 1450)
  }, [entered, ready, reducedMotion])

  useEffect(() => () => window.clearTimeout(veilTimer.current), [])

  useEffect(() => {
    const player = audio.current
    if (!player) return
    const distanceGain = THREE_SMOOTHSTEP(progress, 0.02, 0.83)
    player.volume = muted ? 0 : Math.min(0.58, 0.025 + distanceGain * 0.52)
  }, [muted, progress])

  useEffect(() => {
    const onVisibility = () => {
      const player = audio.current
      if (!player || !entered) return
      if (document.hidden) player.pause()
      else if (!muted) void player.play().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [entered, muted])

  useEffect(() => {
    window.__DUDE_WORK_DIAGNOSTICS__ = {
      entered,
      progress,
      ready,
      webglContextLost: contextLost,
    }
  }, [contextLost, entered, progress, ready])

  return (
    <main className={`experience${entered ? ' has-entered' : ''}${contextLost ? ' has-context-loss' : ''}`}>
      <PortfolioWorld
        active={entered && !contextLost}
        inputRef={input}
        onContextLost={setContextLost}
        onProgress={setProgress}
        onReady={() => setReady(true)}
        progressRef={progressRef}
        reducedMotion={reducedMotion}
      />
      <audio loop playsInline preload="metadata" ref={audio} src="/assets/audio/bamboo-flute.webm" />
      {veilVisible && <EntryVeil exiting={entered} onEnter={handleEnter} ready={ready} />}
      {entered && (
        <SymbolicHud
          input={input}
          muted={muted}
          onMuteToggle={() => setMuted((value) => !value)}
          progress={progress}
        />
      )}
      <div aria-hidden="true" className="paper-grain" />
      <div aria-hidden="true" className="context-loss-mark" />
      <AccessibleProjectLinks />
    </main>
  )
}

function THREE_SMOOTHSTEP(value: number, min: number, max: number) {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return normalized * normalized * (3 - 2 * normalized)
}

export default App
