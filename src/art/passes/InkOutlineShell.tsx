import { useMemo } from 'react'
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { ART_OUTLINE_PROFILES, ART_SCENE, type ArtOutlineProfile } from '../artTokens'

const outlineVertexShader = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uWidthPx;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vec4 clipPosition = projectionMatrix * viewPosition;
    vec2 projectedNormal = (projectionMatrix * vec4(viewNormal, 0.0)).xy;
    projectedNormal /= max(length(projectedNormal), 0.001);
    vec2 pixelOffset = projectedNormal * uWidthPx * 2.0 / max(uResolution, vec2(1.0));
    clipPosition.xy += pixelOffset * clipPosition.w;
    gl_Position = clipPosition;
  }
`

const outlineFragmentShader = /* glsl */ `
  uniform vec3 uOutlineColor;
  uniform float uOpacity;

  void main() {
    gl_FragColor = vec4(uOutlineColor, uOpacity);
  }
`

type MeshProps = ThreeElements['mesh']

export interface InkOutlineShellProps extends Omit<MeshProps, 'children' | 'geometry'> {
  geometry: THREE.BufferGeometry
  opacity?: number
  profile?: ArtOutlineProfile
  widthPx?: number
}

/**
 * A one-draw-call inverted hull for authored hero meshes. It is intentionally
 * selective: do not wrap water, particles, fog, or every leaf in the scene.
 * Animated skinned meshes should use an equivalent authored outline pass.
 */
export function InkOutlineShell({
  geometry,
  opacity,
  profile = 'architecture',
  renderOrder = -1,
  widthPx,
  ...meshProps
}: InkOutlineShellProps) {
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const profileTokens = ART_OUTLINE_PROFILES[profile]
  const uniforms = useMemo(() => ({
    uOpacity: new THREE.Uniform(opacity ?? profileTokens.opacity),
    uOutlineColor: new THREE.Uniform(new THREE.Color(ART_SCENE.outline)),
    uResolution: new THREE.Uniform(new THREE.Vector2()),
    uWidthPx: new THREE.Uniform(widthPx ?? profileTokens.widthPx),
  }), [opacity, profileTokens, widthPx])
  uniforms.uResolution.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())

  useFrame(() => {
    uniforms.uResolution.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())
  }, -60)

  return (
    <mesh {...meshProps} geometry={geometry} renderOrder={renderOrder}>
      <shaderMaterial
        depthWrite={false}
        fragmentShader={outlineFragmentShader}
        side={THREE.BackSide}
        toneMapped={false}
        transparent={uniforms.uOpacity.value < 1}
        uniforms={uniforms}
        vertexShader={outlineVertexShader}
      />
    </mesh>
  )
}
