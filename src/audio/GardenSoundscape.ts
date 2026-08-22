const MIN_GAIN = 0.0001

type SoundscapeState = 'idle' | 'running' | 'disposed'

export interface GardenSoundscapeOptions {
  context: AudioContext
  destination?: AudioNode
  masterGain?: number
  natureGain?: number
  seed?: number
}

function clampGain(value: number) {
  return Math.max(0, Math.min(Number.isFinite(value) ? value : 0, 2))
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function disconnectNode(node: AudioNode) {
  try {
    node.disconnect()
  } catch {
    // A node can already be disconnected by its natural `ended` callback.
  }
}

function stopSource(source: AudioScheduledSourceNode, when: number) {
  try {
    source.stop(when)
  } catch {
    // Stopping an already-ended one-shot is harmless during teardown.
  }
}

/**
 * A small, asset-free Web Audio ecology. The caller owns the AudioContext and
 * must invoke `start()` from its user-gesture path. Context resume/suspend and
 * document-visibility policy intentionally remain outside this class.
 */
export class GardenSoundscape {
  readonly context: AudioContext
  readonly masterGain: GainNode
  readonly natureGain: GainNode
  readonly output: GainNode

  private readonly connectedDestinations = new Set<AudioNode>()
  private readonly ownedNodes = new Set<AudioNode>()
  private readonly ownedSources = new Set<AudioScheduledSourceNode>()
  private readonly random: () => number
  private readonly seed: number
  private readonly timers = new Set<number>()
  private masterLevel: number
  private muted = false
  private natureLevel: number
  private noiseBuffer: AudioBuffer | null = null
  private state: SoundscapeState = 'idle'

  constructor({
    context,
    destination,
    masterGain = 0.46,
    natureGain = 0.56,
    seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
  }: GardenSoundscapeOptions) {
    this.context = context
    this.seed = seed >>> 0
    this.random = createRandom(this.seed || 0x7f4a7c15)
    this.masterLevel = clampGain(masterGain)
    this.natureLevel = clampGain(natureGain)

    this.masterGain = context.createGain()
    this.masterGain.gain.value = this.masterLevel
    this.natureGain = context.createGain()
    this.natureGain.gain.value = this.natureLevel
    this.natureGain.connect(this.masterGain)
    this.output = this.masterGain

    if (destination) this.connect(destination)
  }

  get isRunning() {
    return this.state === 'running'
  }

  connect(destination: AudioNode) {
    this.assertUsable()
    if (!this.connectedDestinations.has(destination)) {
      this.output.connect(destination)
      this.connectedDestinations.add(destination)
    }
    return this
  }

  disconnect(destination?: AudioNode) {
    if (destination) {
      if (!this.connectedDestinations.has(destination)) return this
      try {
        this.output.disconnect(destination)
      } catch {
        // Treat a destination disconnected outside this class as already gone.
      }
      this.connectedDestinations.delete(destination)
      return this
    }

    disconnectNode(this.output)
    this.connectedDestinations.clear()
    return this
  }

  /** Start ambience and wildlife scheduling. Call this only from a user gesture. */
  start() {
    this.assertUsable()
    if (this.state === 'running') return this
    if (this.context.state === 'closed') {
      throw new Error('Cannot start GardenSoundscape with a closed AudioContext')
    }

    this.state = 'running'
    this.startAmbientBed()
    this.scheduleBirdPhrase(this.range(1.6, 4.8))
    this.scheduleFrog(this.range(7.5, 14.5))
    return this
  }

  /** Stop all owned timers and audio nodes. The instance remains restartable. */
  stop() {
    if (this.state === 'disposed') return this
    this.state = 'idle'

    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers.clear()

    const now = this.context.currentTime
    for (const source of this.ownedSources) stopSource(source, now)
    for (const node of this.ownedNodes) disconnectNode(node)
    this.ownedSources.clear()
    this.ownedNodes.clear()
    return this
  }

  setMuted(muted: boolean, rampSeconds = 0.32) {
    this.assertUsable()
    this.muted = muted
    this.rampParam(this.masterGain.gain, muted ? 0 : this.masterLevel, rampSeconds)
    return this
  }

  setMasterGain(value: number, rampSeconds = 0.32) {
    this.assertUsable()
    this.masterLevel = clampGain(value)
    this.rampParam(
      this.masterGain.gain,
      this.muted ? 0 : this.masterLevel,
      rampSeconds,
    )
    return this
  }

  setNatureGain(value: number, rampSeconds = 0.4) {
    this.assertUsable()
    this.natureLevel = clampGain(value)
    this.rampParam(this.natureGain.gain, this.natureLevel, rampSeconds)
    return this
  }

  dispose() {
    if (this.state === 'disposed') return
    this.stop()
    this.disconnect()
    disconnectNode(this.natureGain)
    this.noiseBuffer = null
    this.state = 'disposed'
  }

  private assertUsable() {
    if (this.state === 'disposed') {
      throw new Error('GardenSoundscape has been disposed')
    }
  }

  private range(minimum: number, maximum: number) {
    return minimum + (maximum - minimum) * this.random()
  }

  private rampParam(param: AudioParam, target: number, rampSeconds: number) {
    const now = this.context.currentTime
    const duration = Math.max(0, Number.isFinite(rampSeconds) ? rampSeconds : 0)
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    if (duration <= 0.001) param.setValueAtTime(target, now)
    else param.linearRampToValueAtTime(target, now + duration)
  }

  private ownNode<T extends AudioNode>(node: T) {
    this.ownedNodes.add(node)
    return node
  }

  private ownSource<T extends AudioScheduledSourceNode>(source: T) {
    this.ownedSources.add(source)
    this.ownedNodes.add(source)
    return source
  }

  private releaseTransient(
    primary: AudioScheduledSourceNode,
    sources: readonly AudioScheduledSourceNode[],
    nodes: readonly AudioNode[],
  ) {
    primary.addEventListener('ended', () => {
      for (const source of sources) {
        this.ownedSources.delete(source)
        this.ownedNodes.delete(source)
        disconnectNode(source)
      }
      for (const node of nodes) {
        this.ownedNodes.delete(node)
        disconnectNode(node)
      }
    }, { once: true })
  }

  private schedule(callback: () => void, delaySeconds: number) {
    if (this.state !== 'running') return
    const timer = window.setTimeout(() => {
      this.timers.delete(timer)
      if (this.state === 'running') callback()
    }, Math.max(0, delaySeconds) * 1000)
    this.timers.add(timer)
  }

  private ensureNoiseBuffer() {
    if (this.noiseBuffer) return this.noiseBuffer
    const seconds = 4
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * seconds))
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate)
    const samples = buffer.getChannelData(0)
    const noiseRandom = createRandom(this.seed ^ 0xa53c9e17)
    let previous = 0
    for (let index = 0; index < samples.length; index += 1) {
      const white = noiseRandom() * 2 - 1
      previous = previous * 0.72 + white * 0.28
      samples[index] = previous * 0.82 + white * 0.18
    }
    this.noiseBuffer = buffer
    return buffer
  }

  private startAmbientBed() {
    const now = this.context.currentTime
    const noise = this.ensureNoiseBuffer()

    const wind = this.ownSource(this.context.createBufferSource())
    const windHighpass = this.ownNode(this.context.createBiquadFilter())
    const windLowpass = this.ownNode(this.context.createBiquadFilter())
    const windGain = this.ownNode(this.context.createGain())
    const windFilterLfo = this.ownSource(this.context.createOscillator())
    const windFilterDepth = this.ownNode(this.context.createGain())
    const windGainLfo = this.ownSource(this.context.createOscillator())
    const windGainDepth = this.ownNode(this.context.createGain())

    wind.buffer = noise
    wind.loop = true
    wind.playbackRate.value = 0.52
    windHighpass.type = 'highpass'
    windHighpass.frequency.value = 54
    windHighpass.Q.value = 0.28
    windLowpass.type = 'lowpass'
    windLowpass.frequency.value = 610
    windLowpass.Q.value = 0.42
    windGain.gain.value = 0.044
    windFilterLfo.type = 'sine'
    windFilterLfo.frequency.value = 0.061
    windFilterDepth.gain.value = 185
    windGainLfo.type = 'sine'
    windGainLfo.frequency.value = 0.034
    windGainDepth.gain.value = 0.013

    wind.connect(windHighpass).connect(windLowpass).connect(windGain).connect(this.natureGain)
    windFilterLfo.connect(windFilterDepth).connect(windLowpass.frequency)
    windGainLfo.connect(windGainDepth).connect(windGain.gain)

    const water = this.ownSource(this.context.createBufferSource())
    const waterBand = this.ownNode(this.context.createBiquadFilter())
    const waterLowpass = this.ownNode(this.context.createBiquadFilter())
    const waterGain = this.ownNode(this.context.createGain())
    const waterPan = this.ownNode(this.context.createStereoPanner())
    const waterLfo = this.ownSource(this.context.createOscillator())
    const waterLfoDepth = this.ownNode(this.context.createGain())

    water.buffer = noise
    water.loop = true
    water.loopStart = 0.83
    water.playbackRate.value = 0.78
    waterBand.type = 'bandpass'
    waterBand.frequency.value = 980
    waterBand.Q.value = 0.52
    waterLowpass.type = 'lowpass'
    waterLowpass.frequency.value = 2_650
    waterLowpass.Q.value = 0.26
    waterGain.gain.value = 0.018
    waterPan.pan.value = -0.14
    waterLfo.type = 'triangle'
    waterLfo.frequency.value = 0.118
    waterLfoDepth.gain.value = 310

    water.connect(waterBand).connect(waterLowpass).connect(waterGain).connect(waterPan).connect(this.natureGain)
    waterLfo.connect(waterLfoDepth).connect(waterBand.frequency)

    wind.start(now)
    windFilterLfo.start(now)
    windGainLfo.start(now)
    water.start(now, 0.83)
    waterLfo.start(now)
  }

  private scheduleBirdPhrase(delaySeconds: number) {
    this.schedule(() => {
      this.playBirdPhrase()
      this.scheduleBirdPhrase(this.range(6.8, 15.5))
    }, delaySeconds)
  }

  private playBirdPhrase() {
    const start = this.context.currentTime + 0.025
    const noteCount = 2 + Math.floor(this.range(0, 4))
    const base = this.range(1_650, 2_750)
    const phrasePan = this.range(-0.72, 0.72)
    let cursor = start

    for (let index = 0; index < noteCount; index += 1) {
      const duration = this.range(0.075, 0.19)
      const leap = index % 3 === 1 ? this.range(1.25, 1.58) : this.range(0.88, 1.2)
      const from = base * leap * this.range(0.94, 1.08)
      const to = from * this.range(1.14, 1.72)
      this.playBirdNote(
        cursor,
        duration,
        from,
        to,
        this.range(0.026, 0.052),
        clamp(phrasePan + this.range(-0.16, 0.16), -1, 1),
        index % 2 === 0 ? 'sine' : 'triangle',
      )
      cursor += duration + this.range(0.035, 0.13)
    }
  }

  private playBirdNote(
    start: number,
    duration: number,
    fromFrequency: number,
    toFrequency: number,
    amplitude: number,
    pan: number,
    type: OscillatorType,
  ) {
    const oscillator = this.ownSource(this.context.createOscillator())
    const filter = this.ownNode(this.context.createBiquadFilter())
    const gain = this.ownNode(this.context.createGain())
    const panner = this.ownNode(this.context.createStereoPanner())
    const end = start + duration

    oscillator.type = type
    oscillator.frequency.setValueAtTime(Math.max(80, fromFrequency), start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, toFrequency), start + duration * 0.68)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, toFrequency * 0.87), end)
    filter.type = 'bandpass'
    filter.frequency.value = Math.sqrt(fromFrequency * toFrequency)
    filter.Q.value = this.range(2.1, 4.3)
    gain.gain.setValueAtTime(MIN_GAIN, start)
    gain.gain.exponentialRampToValueAtTime(amplitude, start + Math.min(0.018, duration * 0.24))
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, end)
    panner.pan.value = pan

    oscillator.connect(filter).connect(gain).connect(panner).connect(this.natureGain)
    this.releaseTransient(oscillator, [oscillator], [filter, gain, panner])
    oscillator.start(start)
    oscillator.stop(end + 0.012)
  }

  private scheduleFrog(delaySeconds: number) {
    this.schedule(() => {
      this.playFrogCroak()
      this.scheduleFrog(this.range(19, 42))
    }, delaySeconds)
  }

  private playFrogCroak() {
    const start = this.context.currentTime + 0.03
    const pulseCount = this.random() < 0.34 ? 3 : 2
    const end = start + pulseCount * 0.23 + 0.08
    const baseFrequency = this.range(82, 128)
    const carrier = this.ownSource(this.context.createOscillator())
    const modulator = this.ownSource(this.context.createOscillator())
    const modulationDepth = this.ownNode(this.context.createGain())
    const filter = this.ownNode(this.context.createBiquadFilter())
    const gain = this.ownNode(this.context.createGain())
    const panner = this.ownNode(this.context.createStereoPanner())

    carrier.type = 'triangle'
    carrier.frequency.setValueAtTime(baseFrequency, start)
    carrier.frequency.exponentialRampToValueAtTime(baseFrequency * 0.68, start + 0.16)
    carrier.frequency.exponentialRampToValueAtTime(baseFrequency * 0.9, end)
    modulator.type = 'sine'
    modulator.frequency.value = this.range(24, 38)
    modulationDepth.gain.value = baseFrequency * 0.095
    filter.type = 'lowpass'
    filter.frequency.value = this.range(250, 390)
    filter.Q.value = 1.1
    panner.pan.value = this.range(-0.82, 0.82)
    gain.gain.setValueAtTime(MIN_GAIN, start)

    for (let pulse = 0; pulse < pulseCount; pulse += 1) {
      const pulseStart = start + pulse * 0.23
      gain.gain.setValueAtTime(MIN_GAIN, pulseStart)
      gain.gain.exponentialRampToValueAtTime(this.range(0.026, 0.048), pulseStart + 0.038)
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, pulseStart + 0.165)
    }

    carrier.connect(filter).connect(gain).connect(panner).connect(this.natureGain)
    modulator.connect(modulationDepth).connect(carrier.frequency)
    this.releaseTransient(
      carrier,
      [carrier, modulator],
      [modulationDepth, filter, gain, panner],
    )
    carrier.start(start)
    modulator.start(start)
    carrier.stop(end)
    modulator.stop(end)
  }
}

export function createGardenSoundscape(options: GardenSoundscapeOptions) {
  return new GardenSoundscape(options)
}
