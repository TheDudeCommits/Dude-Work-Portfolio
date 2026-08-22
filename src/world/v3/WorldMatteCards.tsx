import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ART_PALETTE } from '../../art'

const matteVertexShader = /* glsl */ `
  varying vec2 vMatteUv;
  varying vec3 vMatteWorld;
  void main() {
    vMatteUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vMatteWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const matteFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform sampler2D uMatteTexture;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uUseTexture;
  uniform float uVariant;
  varying vec2 vMatteUv;
  varying vec3 vMatteWorld;

  float matteHash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float matteNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(matteHash(cell), matteHash(cell + vec2(1.0, 0.0)), local.x),
      mix(matteHash(cell + vec2(0.0, 1.0)), matteHash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  float matteFbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      value += matteNoise(point) * amplitude;
      point = point * 2.03 + vec2(7.1, 11.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vMatteUv;
    float worldWash = matteFbm(
      vMatteWorld.xz * 0.055
      + vec2(uTime * 0.08, -uTime * 0.035)
      + uVariant * 8.7
    );
    float fibres = matteNoise(floor(vMatteWorld.xy * 8.0 + uVariant * 17.0));
    float alpha;
    vec3 color = uColor;
    if (uUseTexture > 0.5) {
      vec4 matte = texture2D(uMatteTexture, uv);
      color = mix(matte.rgb, matte.rgb * uColor, 0.08);
      alpha = uVariant > 0.5 ? smoothstep(0.16, 0.62, matte.a) : matte.a;
    } else {
      float band = exp(-pow((uv.y - 0.47) * 3.1, 2.0));
      alpha = band * smoothstep(0.24, 0.84, worldWash);
    }
    alpha *= mix(0.88, 1.0, fibres) * uOpacity;
    if (alpha < 0.018) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

interface MatteCardProps {
  color: THREE.ColorRepresentation
  followCamera?: boolean
  opacity: number
  position: readonly [number, number, number]
  reducedMotion: boolean
  rotation: readonly [number, number, number]
  size: readonly [number, number]
  texture?: THREE.Texture
  variant: 0 | 1
}

function MatteCard({ color, followCamera = false, opacity, position, reducedMotion, rotation, size, texture, variant }: MatteCardProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const cameraDirection = useMemo(() => new THREE.Vector3(), [])
  const uniforms = useMemo(() => ({
    uColor: new THREE.Uniform(new THREE.Color(color)),
    uMatteTexture: new THREE.Uniform<THREE.Texture | null>(texture ?? null),
    uOpacity: new THREE.Uniform(opacity),
    uTime: new THREE.Uniform(0),
    uUseTexture: new THREE.Uniform(texture ? 1 : 0),
    uVariant: new THREE.Uniform(variant),
  }), [color, opacity, texture, variant])

  useFrame(({ camera, clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime * 0.06
    material.current.uniforms.uOpacity.value = variant === 1
      ? opacity * THREE.MathUtils.smoothstep(camera.position.z, 14.75, 16.4)
      : opacity
    if (followCamera && mesh.current && camera instanceof THREE.PerspectiveCamera) {
      const distance = 4.5
      const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance * 1.025
      camera.getWorldDirection(cameraDirection)
      mesh.current.position.copy(camera.position).addScaledVector(cameraDirection, distance)
      mesh.current.quaternion.copy(camera.quaternion)
      mesh.current.scale.set(height * camera.aspect, height, 1)
    }
  })

  return (
    <mesh
      position={position}
      ref={mesh}
      renderOrder={followCamera ? -100 : variant === 1 ? 8 : -4}
      rotation={rotation}
      scale={[size[0], size[1], 1]}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        depthTest={!followCamera && variant === 0}
        depthWrite={false}
        fragmentShader={matteFragmentShader}
        ref={material}
        side={THREE.DoubleSide}
        transparent={!followCamera}
        uniforms={uniforms}
        vertexShader={matteVertexShader}
      />
    </mesh>
  )
}

export function WorldMatteCards({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const mountainMatte = useTexture('/art/v3/mattes/mountain-valley.webp')

  useLayoutEffect(() => {
    mountainMatte.colorSpace = THREE.SRGBColorSpace
    mountainMatte.wrapS = THREE.ClampToEdgeWrapping
    mountainMatte.wrapT = THREE.ClampToEdgeWrapping
    mountainMatte.needsUpdate = true
  }, [mountainMatte])

  return (
    <group name="v3-world-space-matte-cards">
      <MatteCard
        color={ART_PALETTE.pine}
        followCamera
        opacity={1}
        position={[0, 0, 0]}
        reducedMotion={reducedMotion}
        rotation={[0, 0, 0]}
        size={[1, 1]}
        texture={mountainMatte}
        variant={0}
      />
    </group>
  )
}
