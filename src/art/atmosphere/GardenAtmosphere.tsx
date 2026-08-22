import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { ART_CINEMA, ART_SCENE } from '../artTokens'
import { useWindField } from '../wind/WindFieldProvider'

export interface GardenAtmosphereProps {
  densityScale?: number
}

const fogVertexShader = /* glsl */ `
  varying vec2 vFogUv;

  void main() {
    vFogUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fogFragmentShader = /* glsl */ `
  uniform vec3 uFogInk;
  uniform vec3 uFogMist;
  uniform vec3 uFogPaper;
  uniform float uFogOpacity;
  uniform float uFogPhase;
  uniform float uTime;
  uniform vec2 uWindDirection;
  uniform float uWindGust;
  uniform float uWindStrength;
  varying vec2 vFogUv;

  float fogHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float fogNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(fogHash(i), fogHash(i + vec2(1.0, 0.0)), f.x),
      mix(fogHash(i + vec2(0.0, 1.0)), fogHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fogFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int octave = 0; octave < 4; octave += 1) {
      value += fogNoise(p) * amplitude;
      p = p * 2.08 + vec2(8.31, 2.77);
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec2 centered = (vFogUv - 0.5) * vec2(3.4, 2.15);
    float wind = uWindStrength + uWindGust * 1.35;
    vec2 drift = uWindDirection * uTime * (0.018 + wind * 0.012);
    float broad = fogFbm(centered * 1.06 + drift + uFogPhase);
    float filament = fogFbm(centered * vec2(2.8, 1.45) - drift * 1.7 - uFogPhase * 2.3);
    float pooled = smoothstep(0.36, 0.76, broad * 0.72 + filament * 0.38);
    float tornEdge = smoothstep(0.47, 0.58, broad) - smoothstep(0.64, 0.78, broad);
    float frameFade = smoothstep(0.0, 0.16, vFogUv.x)
      * smoothstep(0.0, 0.16, 1.0 - vFogUv.x)
      * smoothstep(0.0, 0.18, vFogUv.y)
      * smoothstep(0.0, 0.18, 1.0 - vFogUv.y);
    vec3 color = mix(uFogMist, uFogPaper, broad * 0.58);
    color = mix(color, uFogInk, tornEdge * 0.09);
    float alpha = pooled * frameFade * uFogOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

const weatherVertexShader = /* glsl */ `
  uniform float uDpr;
  uniform float uTime;
  uniform vec2 uWindDirection;
  uniform float uWindGust;
  uniform float uWindStrength;
  attribute float aKind;
  attribute float aSeed;
  attribute float aSize;
  attribute float aTint;
  varying float vKind;
  varying float vSeed;
  varying float vTint;

  void main() {
    float storm = uWindStrength + uWindGust * 1.55;
    float fallRate = mix(0.075, 0.16, aKind) + storm * 0.018;
    float descent = fract(position.y - uTime * fallRate - aSeed * 0.37);
    vec3 weatherPosition = vec3(position.x, descent * 20.0 - 2.0, position.z);
    float fallDistance = (1.0 - descent) * (1.8 + storm * 2.8);
    weatherPosition.x += uWindDirection.x * fallDistance;
    weatherPosition.z += uWindDirection.y * fallDistance;
    weatherPosition.x += sin(uTime * (0.42 + aSeed * 0.31) + aSeed * 31.0) * aKind * 1.15;
    weatherPosition.z += cos(uTime * (0.31 + aSeed * 0.27) + aSeed * 19.0) * aKind * 0.74;

    vec4 viewPosition = modelViewMatrix * vec4(weatherPosition, 1.0);
    float perspectiveScale = 78.0 / max(4.0, -viewPosition.z);
    gl_PointSize = clamp(aSize * uDpr * perspectiveScale, 1.0, 15.0);
    gl_Position = projectionMatrix * viewPosition;
    vKind = aKind;
    vSeed = aSeed;
    vTint = aTint;
  }
`

const weatherFragmentShader = /* glsl */ `
  uniform vec3 uWeatherInk;
  uniform vec3 uWeatherPaper;
  uniform vec3 uWeatherPine;
  uniform vec3 uWeatherVermilion;
  varying float vKind;
  varying float vSeed;
  varying float vTint;

  float weatherHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float angle = vSeed * 6.2831853;
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 leafPoint = rotation * point;
    float rainStroke = 1.0 - smoothstep(0.045, 0.11, abs(point.x + point.y * 0.21));
    rainStroke *= 1.0 - smoothstep(0.28, 0.49, abs(point.y));
    float leafStroke = 1.0 - smoothstep(0.36, 0.5, abs(leafPoint.x) + pow(abs(leafPoint.y), 1.45));
    leafStroke *= 1.0 - smoothstep(
      0.04,
      0.48,
      abs(leafPoint.y + sin(leafPoint.x * 7.0) * 0.08)
    );
    float shape = mix(rainStroke, leafStroke, vKind);
    float dryBrush = smoothstep(0.12, 0.34, weatherHash(gl_PointCoord * 13.0 + vSeed));
    shape *= mix(0.52, 1.0, dryBrush);

    vec3 base = mix(uWeatherInk, uWeatherPine, vKind * 0.7);
    base = mix(base, uWeatherPaper, step(0.66, vTint) * 0.24);
    base = mix(base, uWeatherVermilion, step(0.965, vTint) * vKind);
    float opacity = mix(0.24, 0.62, vKind) * shape;
    if (opacity < 0.018) discard;
    gl_FragColor = vec4(base, opacity);
  }
`

function deterministicNoise(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function createWeatherGeometry(count: number) {
  const positions = new Float32Array(count * 3)
  const kinds = new Float32Array(count)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const tints = new Float32Array(count)

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const seed = deterministicNoise(index, 1)
    const kind = deterministicNoise(index, 2) > 0.71 ? 1 : 0
    positions[offset] = (deterministicNoise(index, 3) - 0.5) * 58
    positions[offset + 1] = deterministicNoise(index, 4)
    positions[offset + 2] = (deterministicNoise(index, 5) - 0.5) * 58
    kinds[index] = kind
    seeds[index] = seed
    sizes[index] = kind
      ? 1.35 + deterministicNoise(index, 6) * 1.7
      : 0.72 + deterministicNoise(index, 7) * 0.68
    tints[index] = deterministicNoise(index, 8)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1))
  return geometry
}

function CinematicAtmosphereFields() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const fogGroup = useRef<THREE.Group>(null)
  const weatherGroup = useRef<THREE.Points>(null)
  const { uniforms: artUniforms } = useArtDirector()
  const { uniforms: windUniforms } = useWindField()
  const fogGeometry = useMemo(() => new THREE.PlaneGeometry(92, 72), [])
  const weatherGeometry = useMemo(
    () => createWeatherGeometry(window.innerWidth < 780 ? 250 : 480),
    [],
  )
  const fogSheets = useMemo(() => [
    { opacity: 0.18, phase: 0.3, position: -0.04 },
    { opacity: 0.105, phase: 3.7, position: 0.56 },
    { opacity: 0.052, phase: 7.4, position: 1.2 },
  ].map((sheet) => ({
    ...sheet,
    uniforms: {
      uFogInk: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmosphereInk)),
      uFogMist: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmosphereMist)),
      uFogOpacity: new THREE.Uniform(sheet.opacity),
      uFogPaper: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmospherePaper)),
      uFogPhase: new THREE.Uniform(sheet.phase),
      uTime: artUniforms.uArtTime,
      uWindDirection: windUniforms.uWindDirection,
      uWindGust: windUniforms.uWindGust,
      uWindStrength: windUniforms.uWindStrength,
    },
  })), [artUniforms.uArtTime, windUniforms])
  const weatherUniforms = useMemo(() => ({
    uDpr: new THREE.Uniform(gl.getPixelRatio()),
    uTime: artUniforms.uArtTime,
    uWeatherInk: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmosphereInk)),
    uWeatherPaper: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmospherePaper)),
    uWeatherPine: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmospherePine)),
    uWeatherVermilion: new THREE.Uniform(new THREE.Color(ART_CINEMA.accentVermilion)),
    uWindDirection: windUniforms.uWindDirection,
    uWindGust: windUniforms.uWindGust,
    uWindStrength: windUniforms.uWindStrength,
  }), [artUniforms.uArtTime, gl, windUniforms])

  useEffect(() => () => {
    fogGeometry.dispose()
    weatherGeometry.dispose()
  }, [fogGeometry, weatherGeometry])

  useFrame(() => {
    if (fogGroup.current) {
      fogGroup.current.position.x = camera.position.x
      fogGroup.current.position.z = camera.position.z
    }
    if (weatherGroup.current) {
      weatherGroup.current.position.x = camera.position.x
      weatherGroup.current.position.z = camera.position.z
    }
    weatherUniforms.uDpr.value = gl.getPixelRatio()
  }, -72)

  return (
    <>
      <group name="rolling-ink-fog" ref={fogGroup}>
        {fogSheets.map((sheet) => (
          <mesh
            geometry={fogGeometry}
            key={sheet.phase}
            position={[0, sheet.position, 0]}
            renderOrder={-8}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <shaderMaterial
              depthTest
              depthWrite={false}
              fragmentShader={fogFragmentShader}
              side={THREE.DoubleSide}
              transparent
              uniforms={sheet.uniforms}
              vertexShader={fogVertexShader}
            />
          </mesh>
        ))}
      </group>
      <points frustumCulled={false} geometry={weatherGeometry} name="windborne-ink-weather" ref={weatherGroup}>
        <shaderMaterial
          depthTest
          depthWrite={false}
          fragmentShader={weatherFragmentShader}
          transparent
          uniforms={weatherUniforms}
          vertexShader={weatherVertexShader}
        />
      </points>
    </>
  )
}

/**
 * Establishes the shared filmic paper-mist baseline and the physical ink
 * weather. It intentionally avoids a generic post-processing stack.
 */
export function GardenAtmosphere({ densityScale = 1 }: GardenAtmosphereProps) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const { reducedMotion, uniforms } = useArtDirector()

  useEffect(() => {
    const previousBackground = scene.background
    const previousFog = scene.fog
    const previousColorSpace = gl.outputColorSpace
    const previousToneMapping = gl.toneMapping
    const previousExposure = gl.toneMappingExposure

    scene.background = new THREE.Color(ART_SCENE.background)
    scene.fog = new THREE.FogExp2(ART_SCENE.fog, ART_SCENE.fogDensity * densityScale)
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = ART_SCENE.exposure

    return () => {
      scene.background = previousBackground
      scene.fog = previousFog
      gl.outputColorSpace = previousColorSpace
      gl.toneMapping = previousToneMapping
      gl.toneMappingExposure = previousExposure
    }
  }, [densityScale, gl, scene])

  useFrame(() => {
    const ritual = uniforms.uRitualIntensity.value
    const breath = reducedMotion ? 0 : Math.sin(uniforms.uArtTime.value * 0.31) * ART_CINEMA.exposureBreath
    gl.toneMappingExposure = ART_SCENE.exposure + breath + ritual * ART_SCENE.ritualExposureLift
    if (scene.fog instanceof THREE.FogExp2) {
      const fogBreath = reducedMotion
        ? 1
        : 1 + Math.sin(uniforms.uArtTime.value * 0.17 + 1.2) * ART_CINEMA.fogBreath
      scene.fog.density = ART_SCENE.fogDensity
        * densityScale
        * fogBreath
        * (1 - ritual * 0.11)
    }
  }, -70)

  return <CinematicAtmosphereFields />
}
