import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { JourneyInputRef, ProgressRef } from './types'

const sharedNoise = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += noise21(p) * amplitude;
      p = p * 2.03 + vec2(9.17, 13.41);
      amplitude *= 0.5;
    }
    return value;
  }
`

const plateVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const plateFragment = /* glsl */ `
  uniform sampler2D uPlate1;
  uniform sampler2D uPlate2;
  uniform sampler2D uPlate3;
  uniform sampler2D uPlate4;
  uniform vec2 uResolution;
  uniform vec2 uLook;
  uniform float uProgress;
  uniform float uTime;
  varying vec2 vUv;
  ${sharedNoise}

  vec2 coverUv(vec2 uv, float imageAspect, float zoom, float parallax) {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 crop = vec2(1.0);
    if (screenAspect > imageAspect) crop.y = imageAspect / screenAspect;
    else crop.x = screenAspect / imageAspect;
    vec2 centered = (uv - 0.5) * crop / zoom + 0.5;
    centered += uLook * parallax;
    return clamp(centered, vec2(0.002), vec2(0.998));
  }

  vec3 plate(sampler2D image, vec2 uv, float aspect, float zoom, float parallax) {
    return texture2D(image, coverUv(uv, aspect, zoom, parallax)).rgb;
  }

  void main() {
    float breathing = sin(uTime * 0.19) * 0.5 + 0.5;
    float wet = fbm(vUv * vec2(5.5, 3.4) + vec2(uTime * 0.018, -uTime * 0.011));
    float fine = noise21(vUv * vec2(62.0, 39.0) - uTime * 0.007);
    vec2 fluidUv = vUv;
    fluidUv.x += (wet - 0.5) * 0.0045 + sin(vUv.y * 22.0 + uTime * 0.24) * 0.0012;
    fluidUv.y += (fine - 0.5) * 0.0022;

    float stageOneZoom = 1.0 + min(uProgress / 0.34, 1.0) * 0.075;
    float stageTwoLocal = clamp((uProgress - 0.25) / 0.38, 0.0, 1.0);
    float stageThreeLocal = clamp((uProgress - 0.58) / 0.28, 0.0, 1.0);
    vec3 first = plate(uPlate1, fluidUv, 1.5, stageOneZoom, 0.020);
    vec3 second = plate(uPlate2, fluidUv, 2.157, 1.0 + stageTwoLocal * 0.07, 0.014);
    vec3 third = plate(uPlate3, fluidUv, 1.5, 1.0 + stageThreeLocal * 0.055, 0.010);
    vec3 fourth = plate(uPlate4, fluidUv, 1.5, 1.025 + breathing * 0.009, 0.006);

    float tide = fbm(vUv * 4.6 + vec2(-uTime * 0.025, uTime * 0.009));
    float firstWash = smoothstep(0.18, 0.40, uProgress + (tide - 0.5) * 0.14);
    float secondWash = smoothstep(0.48, 0.70, uProgress + (wet - 0.5) * 0.12);
    vec3 journey = mix(first, second, firstWash);
    journey = mix(journey, third, secondWash);

    float doors = smoothstep(0.73, 0.94, uProgress);
    float splitNoise = (fbm(vec2(vUv.y * 7.0, uTime * 0.05)) - 0.5) * 0.038;
    float openWidth = doors * 0.54 - 0.02;
    float sanctuaryMask = 1.0 - smoothstep(
      openWidth - 0.028,
      openWidth + 0.028,
      abs(vUv.x - 0.5) + splitNoise
    );

    vec2 movingDoorUv = fluidUv;
    movingDoorUv.x += movingDoorUv.x < 0.5 ? doors * 0.25 : -doors * 0.25;
    vec3 movingDoors = plate(uPlate3, movingDoorUv, 1.5, 1.055, 0.006);
    journey = mix(journey, movingDoors, smoothstep(0.70, 0.76, uProgress));
    journey = mix(journey, fourth, sanctuaryMask);

    float waterZone = smoothstep(0.47, 0.0, vUv.y);
    float waterLight = sin(vUv.x * 170.0 + uTime * 0.7 + wet * 9.0) * 0.006 * waterZone;
    journey += vec3(waterLight * 0.55, waterLight * 0.9, waterLight);

    float paperFiber = (hash21(vUv * uResolution * 0.42) - 0.5) * 0.025;
    journey += paperFiber;
    journey = mix(journey, journey * vec3(0.76, 0.72, 0.66), wet * 0.045);

    vec2 vignetteUv = vUv * (1.0 - vUv.yx);
    float vignette = pow(vignetteUv.x * vignetteUv.y * 18.0, 0.2);
    journey *= mix(0.72, 1.0, clamp(vignette, 0.0, 1.0));

    gl_FragColor = vec4(journey, 1.0);
  }
`

export function JourneyPlateMaterial({
  inputRef,
  progressRef,
  reducedMotion,
  textures,
}: {
  inputRef: JourneyInputRef
  progressRef: ProgressRef
  reducedMotion: boolean
  textures: [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture]
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const size = useThree((state) => state.size)
  const uniforms = useMemo(() => ({
    uLook: { value: new THREE.Vector2() },
    uPlate1: { value: textures[0] },
    uPlate2: { value: textures[1] },
    uPlate3: { value: textures[2] },
    uPlate4: { value: textures[3] },
    uProgress: { value: 0 },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uTime: { value: 0 },
  }), [size.height, size.width, textures])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    material.current.uniforms.uProgress.value = progressRef.current
    material.current.uniforms.uLook.value.set(inputRef.current.lookX, inputRef.current.lookY)
    material.current.uniforms.uResolution.value.set(size.width, size.height)
  })

  return (
    <shaderMaterial
      depthTest={false}
      depthWrite={false}
      fragmentShader={plateFragment}
      ref={material}
      toneMapped={false}
      uniforms={uniforms}
      vertexShader={plateVertex}
    />
  )
}

const portalFragment = /* glsl */ `
  uniform sampler2D uImage;
  uniform float uHover;
  uniform float uReveal;
  uniform float uSeed;
  uniform float uTime;
  varying vec2 vUv;
  ${sharedNoise}

  void main() {
    vec2 p = vUv - 0.5;
    float living = fbm(vUv * 7.2 + vec2(uSeed * 3.1, uTime * 0.055));
    float angle = (uSeed - 2.0) * 0.19;
    mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 shaped = turn * p;
    float contour = length(shaped * vec2(1.0, 1.13 + fract(uSeed) * 0.15));
    float bristle = sin((vUv.y + uSeed) * 21.0) * 0.006 + sin((vUv.x - uSeed) * 37.0) * 0.004;
    float outside = 0.482 + (living - 0.5) * 0.082 + bristle;
    float inside = 0.465 + (living - 0.5) * 0.065;
    float outerAlpha = smoothstep(outside, outside - 0.014, contour);
    float imageAlpha = smoothstep(inside, inside - 0.019, contour);

    vec2 imageUv = vUv;
    imageUv.y = (imageUv.y - 0.5) * 0.66 + 0.5;
    imageUv.x += sin(imageUv.y * 13.0 + uTime * 0.22 + uSeed) * 0.0025;
    vec3 image = texture2D(uImage, imageUv).rgb;
    float luminance = dot(image, vec3(0.299, 0.587, 0.114));
    image = mix(vec3(luminance), image, 0.92);
    image *= 0.92 + living * 0.14;

    vec3 ink = mix(vec3(0.012, 0.014, 0.012), vec3(0.66, 0.46, 0.18), uHover * 0.78);
    vec3 color = mix(ink, image, imageAlpha);
    color += vec3(0.24, 0.13, 0.035) * uHover * (1.0 - imageAlpha) * 0.9;
    float revealedAlpha = outerAlpha * smoothstep(0.0, 0.24, uReveal);
    if (revealedAlpha < 0.008) discard;
    gl_FragColor = vec4(color, revealedAlpha);
  }
`

export function InkPortalMaterial({
  hovered,
  index,
  progressRef,
  texture,
}: {
  hovered: boolean
  index: number
  progressRef: ProgressRef
  texture: THREE.Texture
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uHover: { value: 0 },
    uImage: { value: texture },
    uReveal: { value: 0 },
    uSeed: { value: index * 0.731 + 0.23 },
    uTime: { value: 0 },
  }), [index, texture])

  useFrame(({ clock }, delta) => {
    if (!material.current) return
    const revealStart = 0.845 + index * 0.011
    const reveal = THREE.MathUtils.smoothstep(progressRef.current, revealStart, revealStart + 0.075)
    material.current.uniforms.uTime.value = clock.elapsedTime
    material.current.uniforms.uHover.value = THREE.MathUtils.damp(
      material.current.uniforms.uHover.value,
      hovered ? 1 : 0,
      7,
      delta,
    )
    material.current.uniforms.uReveal.value = reveal
  })

  return (
    <shaderMaterial
      depthWrite={false}
      fragmentShader={portalFragment}
      ref={material}
      side={THREE.DoubleSide}
      toneMapped={false}
      transparent
      uniforms={uniforms}
      vertexShader={plateVertex}
    />
  )
}
