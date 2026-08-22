import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { ART_CINEMA, ART_PALETTE } from '../artTokens'

const vertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDirection = normalize(world.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uRitualIntensity;
  uniform float uTime;
  uniform vec3 uWashi;
  uniform vec3 uMist;
  uniform vec3 uCeladon;
  uniform vec3 uPine;
  uniform vec3 uInk;
  uniform vec3 uWarm;
  uniform vec3 uVermilion;
  varying vec3 vDirection;

  float skyHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float skyNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), f.x),
      mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float skyFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    for (int octave = 0; octave < 5; octave += 1) {
      value += skyNoise(p) * amplitude;
      p = p * 2.04 + vec2(13.7, 8.2);
      amplitude *= 0.49;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float height = direction.y * 0.5 + 0.5;
    float azimuth = atan(direction.x, direction.z) / 6.2831853 + 0.5;
    vec3 color = mix(uCeladon, uMist, smoothstep(0.04, 0.43, height));
    color = mix(color, uWashi, smoothstep(0.38, 0.9, height));

    vec2 cloudUv = vec2(azimuth * 7.5, direction.y * 3.2);
    float cloud = skyFbm(cloudUv + vec2(uTime * 0.0032, -uTime * 0.0017));
    float cloudDetail = skyFbm(cloudUv * vec2(2.6, 1.35) - vec2(uTime * 0.005, 0.0));
    float stormWash = smoothstep(0.45, 0.76, cloud * 0.76 + cloudDetail * 0.31)
      * smoothstep(0.15, 0.74, height);
    float tornCloud = smoothstep(0.48, 0.57, cloud) - smoothstep(0.61, 0.71, cloud);
    color = mix(color, mix(uPine, uInk, 0.58), stormWash * 0.31);
    color = mix(color, uInk, tornCloud * 0.072 * smoothstep(0.16, 0.74, height));

    float ridgeNoise = skyFbm(vec2(azimuth * 10.0, 4.7));
    float farRidgeHeight = -0.035 + ridgeNoise * 0.075;
    float nearRidgeHeight = -0.005
      + skyFbm(vec2(azimuth * 17.0 + 6.1, 9.3)) * 0.105;
    float farRidge = 1.0 - smoothstep(farRidgeHeight, farRidgeHeight + 0.024, direction.y);
    float nearRidge = 1.0 - smoothstep(nearRidgeHeight, nearRidgeHeight + 0.017, direction.y);
    float horizonFade = smoothstep(-0.22, -0.025, direction.y);
    color = mix(color, uPine, farRidge * horizonFade * 0.58);
    color = mix(color, uInk, nearRidge * horizonFade * 0.72);

    vec3 sunDirection = normalize(vec3(-0.31, 0.19, -0.93));
    float sunAlignment = max(dot(direction, sunDirection), 0.0);
    float sunCore = pow(sunAlignment, 760.0);
    float sunBleed = pow(sunAlignment, 34.0);
    float sunWash = pow(sunAlignment, 8.0);
    float horizonWarmth = (1.0 - smoothstep(0.27, 0.62, height))
      * pow(max(dot(normalize(direction.xz), normalize(sunDirection.xz)), 0.0), 5.0);
    color = mix(color, uWarm, sunBleed * 0.84);
    color += uWarm * sunCore * 0.88 + uWarm * sunWash * 0.11;
    color = mix(color, uVermilion, sunCore * (0.13 + uRitualIntensity * 0.16));
    color += uWarm * horizonWarmth * (0.075 + uRitualIntensity * 0.035);

    float fibres = skyNoise(direction.xy * 430.0 + direction.z * 137.0);
    float broadFibre = skyNoise(direction.xz * 92.0 + direction.y * 38.0);
    color += (fibres - 0.5) * 0.025 + (broadFibre - 0.5) * 0.012;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function LivingScrollSky() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const { reducedMotion, uniforms: artUniforms } = useArtDirector()
  const uniforms = useMemo(() => ({
    uCeladon: new THREE.Uniform(new THREE.Color(ART_PALETTE.celadon)),
    uInk: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmosphereInk)),
    uMist: new THREE.Uniform(new THREE.Color(ART_PALETTE.mist)),
    uPine: new THREE.Uniform(new THREE.Color(ART_PALETTE.pine)),
    uRitualIntensity: artUniforms.uRitualIntensity,
    uTime: new THREE.Uniform(0),
    uVermilion: new THREE.Uniform(new THREE.Color(ART_CINEMA.accentVermilion)),
    uWarm: new THREE.Uniform(new THREE.Color(ART_PALETTE.warmLight)),
    uWashi: new THREE.Uniform(new THREE.Color(ART_PALETTE.washi)),
  }), [artUniforms.uRitualIntensity])

  useFrame(({ clock }) => {
    if (material.current) uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  }, -125)

  return (
    <mesh frustumCulled={false} scale={105}>
      <sphereGeometry args={[1, 64, 40]} />
      <shaderMaterial
        depthWrite={false}
        fragmentShader={fragmentShader}
        ref={material}
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  )
}
