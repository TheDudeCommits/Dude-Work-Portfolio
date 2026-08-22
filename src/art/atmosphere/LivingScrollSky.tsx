import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { ART_PALETTE } from '../artTokens'

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDirection = normalize(world.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWashi;
  uniform vec3 uMist;
  uniform vec3 uCeladon;
  uniform vec3 uPine;
  uniform vec3 uWarm;
  varying vec3 vDirection;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave += 1) {
      value += noise(p) * amplitude;
      p = p * 2.03 + vec2(13.7, 8.2);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float height = direction.y * 0.5 + 0.5;
    vec3 color = mix(uCeladon, uMist, smoothstep(0.06, 0.48, height));
    color = mix(color, uWashi, smoothstep(0.42, 0.88, height));

    vec2 washUv = direction.xz * 2.25 / max(direction.y + 0.38, 0.14);
    float cloud = fbm(washUv + vec2(uTime * 0.0028, -uTime * 0.0018));
    float broadWash = smoothstep(0.48, 0.78, cloud) * smoothstep(0.18, 0.78, height);
    color = mix(color, mix(uCeladon, uPine, 0.28), broadWash * 0.24);

    float dryEdge = smoothstep(0.5, 0.58, cloud) - smoothstep(0.64, 0.73, cloud);
    color = mix(color, uPine, dryEdge * 0.055);

    vec3 sunDirection = normalize(vec3(-0.29, 0.2, -0.94));
    float sun = pow(max(dot(direction, sunDirection), 0.0), 420.0);
    float sunWash = pow(max(dot(direction, sunDirection), 0.0), 11.0);
    float horizonWarmth = (1.0 - smoothstep(0.28, 0.66, height))
      * pow(max(dot(normalize(direction.xz), normalize(sunDirection.xz)), 0.0), 5.0);
    color += uWarm * sun * 0.92 + uWarm * sunWash * 0.19 + uWarm * horizonWarmth * 0.065;

    float fibres = noise(direction.xy * 420.0 + direction.z * 130.0);
    color += (fibres - 0.5) * 0.024;
    gl_FragColor = vec4(color, 1.0);
  }
`

export function LivingScrollSky() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const { reducedMotion } = useArtDirector()
  const uniforms = useMemo(() => ({
    uCeladon: new THREE.Uniform(new THREE.Color(ART_PALETTE.celadon)),
    uMist: new THREE.Uniform(new THREE.Color(ART_PALETTE.mist)),
    uPine: new THREE.Uniform(new THREE.Color(ART_PALETTE.pine)),
    uTime: new THREE.Uniform(0),
    uWarm: new THREE.Uniform(new THREE.Color(ART_PALETTE.warmLight)),
    uWashi: new THREE.Uniform(new THREE.Color(ART_PALETTE.washi)),
  }), [])

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
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  )
}
