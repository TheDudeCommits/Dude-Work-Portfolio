import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../../art'

const skyVertexShader = /* glsl */ `
  varying vec3 vSkyDirection;
  varying vec2 vSkyUv;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vSkyDirection = normalize(worldPosition.xyz - cameraPosition);
    vSkyUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uMist;
  uniform float uTime;
  uniform vec3 uZenith;
  varying vec3 vSkyDirection;
  varying vec2 vSkyUv;

  float skyHash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float skyNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(skyHash(cell), skyHash(cell + vec2(1.0, 0.0)), local.x),
      mix(skyHash(cell + vec2(0.0, 1.0)), skyHash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  float skyFbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.54;
    for (int octave = 0; octave < 5; octave++) {
      value += skyNoise(point) * amplitude;
      point = point * 2.03 + vec2(9.7, 4.3);
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vSkyDirection);
    float vertical = smoothstep(-0.18, 0.72, direction.y);
    float horizonBand = pow(1.0 - clamp(abs(direction.y), 0.0, 1.0), 3.2);
    vec3 color = mix(uHorizon, uZenith, vertical);

    vec2 cloudUv = vec2(vSkyUv.x * 5.4, vSkyUv.y * 2.2);
    float cloud = skyFbm(cloudUv + vec2(uTime * 0.004, -uTime * 0.0017));
    float inkCloud = smoothstep(0.47, 0.79, cloud) * (0.24 + horizonBand * 0.44);
    color = mix(color, uMist * 0.58, inkCloud);
    color += uMist * horizonBand * 0.12;

    vec2 starGrid = vSkyUv * vec2(980.0, 490.0);
    vec2 starCell = floor(starGrid);
    vec2 starLocal = fract(starGrid) - 0.5;
    float starSeed = skyHash(starCell);
    float starDab = 1.0 - smoothstep(0.035, 0.16, length(starLocal));
    float star = smoothstep(0.9962, 0.9999, starSeed) * starDab
      * smoothstep(0.02, 0.28, direction.y)
      * (0.66 + sin(uTime * 0.38 + starSeed * 81.0) * 0.22);
    color += vec3(0.72, 0.82, 0.88) * star * 0.54;

    float grain = skyHash(gl_FragCoord.xy + floor(uTime * 0.4));
    color *= mix(0.975, 1.02, grain);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

const moonVertexShader = /* glsl */ `
  varying vec2 vMoonUv;
  void main() {
    vMoonUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const moonFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vMoonUv;

  float moonHash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float moonNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(moonHash(cell), moonHash(cell + vec2(1.0, 0.0)), local.x),
      mix(moonHash(cell + vec2(0.0, 1.0)), moonHash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  void main() {
    vec2 centered = vMoonUv - 0.5;
    float radius = length(centered) * 2.0;
    float edge = 1.0 - smoothstep(0.94, 1.0, radius);
    if (edge < 0.01) discard;
    float broad = moonNoise(vMoonUv * 6.0 + 3.7);
    float crater = moonNoise(vMoonUv * 17.0 + broad * 2.4);
    float pigment = 0.72 + broad * 0.23 - smoothstep(0.63, 0.91, crater) * 0.2;
    pigment += sin(uTime * 0.17) * 0.012;
    gl_FragColor = vec4(uColor * pigment, edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const haloFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vMoonUv;
  void main() {
    float radius = length(vMoonUv - 0.5) * 2.0;
    float haloShape = max(0.0, 1.0 - radius);
    float halo = haloShape * haloShape * (0.13 + sin(uTime * 0.21) * 0.018);
    gl_FragColor = vec4(uColor, halo);
  }
`

const mistVertexShader = /* glsl */ `
  varying vec2 vMistUv;
  varying vec3 vMistWorld;
  void main() {
    vMistUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vMistWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const mistFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vMistUv;
  varying vec3 vMistWorld;

  float mistHash(vec2 point) {
    return fract(sin(dot(point, vec2(41.3, 289.7))) * 43758.5453);
  }

  float mistNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mistHash(cell), mistHash(cell + vec2(1.0, 0.0)), local.x),
      mix(mistHash(cell + vec2(0.0, 1.0)), mistHash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  void main() {
    float broad = mistNoise(vMistWorld.xz * 0.055 + vec2(uTime * 0.018, -uTime * 0.009));
    broad += mistNoise(vMistWorld.xz * 0.13 - vec2(uTime * 0.011, uTime * 0.006)) * 0.46;
    float vertical = sin(vMistUv.y * 3.14159265);
    float alpha = smoothstep(0.48, 1.12, broad) * vertical * 0.23;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

function ProceduralSky({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uHorizon: new THREE.Uniform(new THREE.Color(ART_PALETTE.nightHorizon)),
    uMist: new THREE.Uniform(new THREE.Color(ART_PALETTE.nightMist)),
    uTime: new THREE.Uniform(0),
    uZenith: new THREE.Uniform(new THREE.Color(ART_PALETTE.nightZenith)),
  }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  }, -110)

  return (
    <mesh frustumCulled={false} name="V3_ProceduralNightSky" renderOrder={-100}>
      <sphereGeometry args={[78, 64, 36]} />
      <shaderMaterial
        depthTest={false}
        depthWrite={false}
        fragmentShader={skyFragmentShader}
        ref={material}
        side={THREE.BackSide}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={skyVertexShader}
      />
    </mesh>
  )
}

function BloodMoon({ reducedMotion }: { reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null)
  const disc = useRef<THREE.ShaderMaterial>(null)
  const halo = useRef<THREE.ShaderMaterial>(null)
  const discUniforms = useMemo(() => ({
    uColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.moonCrimson)),
    uTime: new THREE.Uniform(0),
  }), [])
  const haloUniforms = useMemo(() => ({
    uColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.moonGlow)),
    uTime: new THREE.Uniform(0),
  }), [])

  useFrame(({ camera, clock }) => {
    root.current?.quaternion.copy(camera.quaternion)
    const time = reducedMotion ? 0 : clock.elapsedTime
    if (disc.current) disc.current.uniforms.uTime.value = time
    if (halo.current) halo.current.uniforms.uTime.value = time
  }, -100)

  return (
    <group name="V3_VermilionMoon" position={[22, 28, -62]} ref={root}>
      <mesh renderOrder={-6} scale={1.72}>
        <circleGeometry args={[7.4, 72]} />
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          fragmentShader={haloFragmentShader}
          ref={halo}
          transparent
          uniforms={haloUniforms}
          vertexShader={moonVertexShader}
        />
      </mesh>
      <mesh renderOrder={-5}>
        <circleGeometry args={[7.4, 72]} />
        <shaderMaterial
          depthTest={false}
          depthWrite={false}
          fragmentShader={moonFragmentShader}
          ref={disc}
          transparent
          uniforms={discUniforms}
          vertexShader={moonVertexShader}
        />
      </mesh>
    </group>
  )
}

function HorizonMist({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uColor: new THREE.Uniform(new THREE.Color(ART_PALETTE.nightMist)),
    uTime: new THREE.Uniform(0),
  }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  }, -96)

  return (
    <mesh name="V3_HorizonMistRing" position={[0, 2.4, 4]} renderOrder={-3}>
      <cylinderGeometry args={[45, 45, 12, 128, 1, true]} />
      <shaderMaterial
        depthWrite={false}
        fragmentShader={mistFragmentShader}
        ref={material}
        side={THREE.BackSide}
        transparent
        uniforms={uniforms}
        vertexShader={mistVertexShader}
      />
    </mesh>
  )
}

export function NightGardenEnvironment({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group name="v3-procedural-night-environment">
      <ProceduralSky reducedMotion={reducedMotion} />
      <BloodMoon reducedMotion={reducedMotion} />
      <HorizonMist reducedMotion={reducedMotion} />
    </group>
  )
}
