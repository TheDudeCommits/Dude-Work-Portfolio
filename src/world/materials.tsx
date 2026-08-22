import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const inkVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }

  void main() {
    vUv = uv;
    vec3 displaced = position;
    float current = noise(uv * vec2(7.0, 19.0) + vec2(uTime * 0.025, -uTime * 0.018));
    displaced.z += (current - 0.5) * 0.12;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const inkFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPaper;
  uniform vec3 uSage;
  uniform vec3 uInk;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += noise(p) * amp;
      p = p * 2.03 + 13.17;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 flowUv = vUv * vec2(5.0, 24.0);
    float slow = uTime * 0.035;
    float flow = fbm(flowUv + vec2(fbm(flowUv * 0.46 + slow), -slow));
    float veins = smoothstep(0.42, 0.76, flow);
    float pools = smoothstep(0.58, 0.91, fbm(flowUv * 0.42 - slow * 0.7));
    float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, 1.0 - vUv.x);
    vec3 base = mix(uPaper, uSage, 0.35 + flow * 0.36);
    vec3 color = mix(base, uInk, veins * 0.36 + pools * 0.14);
    float shimmer = sin((vUv.y + flow * 0.08) * 290.0 - uTime * 0.8) * 0.012;
    color += shimmer;
    gl_FragColor = vec4(color, (0.7 + veins * 0.16) * edge);
  }
`

export function LivingInkMaterial() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPaper: { value: new THREE.Color('#d9d5c3') },
    uSage: { value: new THREE.Color('#6f897a') },
    uInk: { value: new THREE.Color('#1f2927') },
  }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <shaderMaterial
      ref={material}
      fragmentShader={inkFragment}
      transparent
      uniforms={uniforms}
      vertexShader={inkVertex}
    />
  )
}

const mistVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y += sin(p.x * 0.32 + uTime * 0.2) * 0.08;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const mistFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.0, 289.0))) * 45758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.)), f.x), f.y);
  }
  void main() {
    vec2 p = vUv * vec2(4.0, 2.0) + vec2(uTime * 0.018, 0.0);
    float n = noise(p) * 0.55 + noise(p * 2.1) * 0.28 + noise(p * 4.2) * 0.17;
    float feather = smoothstep(0.0, .28, vUv.y) * smoothstep(0.0, .35, 1.0-vUv.y);
    gl_FragColor = vec4(0.86, 0.87, 0.81, n * feather * 0.2);
  }
`

export function BreathingMistMaterial() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <shaderMaterial
      ref={material}
      depthWrite={false}
      fragmentShader={mistFragment}
      side={THREE.DoubleSide}
      transparent
      uniforms={uniforms}
      vertexShader={mistVertex}
    />
  )
}
