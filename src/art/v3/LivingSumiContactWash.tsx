import type { ThreeElements } from '@react-three/fiber'
import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  type Ref,
} from 'react'
import * as THREE from 'three'
import { LivingSumiContext } from './context'
import { LIVING_SUMI_ROLES, type LivingSumiRole } from './tokens'

type ShaderMaterialProps = ThreeElements['shaderMaterial']

const contactWashVertexShader = /* glsl */ `
  varying vec2 vWashUv;
  varying vec3 vWashWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWashUv = uv;
    vWashWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const contactWashFragmentShader = /* glsl */ `
  #include <dithering_pars_fragment>

  uniform sampler2D uBrushTexture;
  uniform sampler2D uPaperTexture;
  uniform vec3 uInkColor;
  uniform float uBrushScale;
  uniform float uFeather;
  uniform float uOpacity;
  uniform float uPaperScale;
  uniform float uPigment;
  uniform float uSeed;

  varying vec2 vWashUv;
  varying vec3 vWashWorldPosition;

  void main() {
    vec2 local = (vWashUv - 0.5) * 2.0;
    float radius = length(local);
    float radialWash = 1.0 - smoothstep(
      max(0.02, 1.0 - uFeather),
      1.0,
      radius
    );

    // World anchoring keeps the contact pigment locked to the garden while
    // the camera moves. Two broad brush lobes avoid a synthetic radial blob.
    vec2 worldUv = vWashWorldPosition.xz * uBrushScale;
    vec2 seedOffset = vec2(uSeed * 0.173, uSeed * 0.317);
    float longFibre = texture2D(
      uBrushTexture,
      worldUv * vec2(0.43, 1.31) + seedOffset
    ).r;
    float crossFibre = texture2D(
      uBrushTexture,
      worldUv.yx * vec2(0.71, 1.67) - seedOffset.yx
    ).g;
    float paper = texture2D(
      uPaperTexture,
      vWashWorldPosition.xz * uPaperScale + seedOffset * 0.19
    ).r;
    float brushBody = mix(longFibre, crossFibre, 0.28);
    float brokenEdge = smoothstep(0.18, 0.82, brushBody + radialWash * 0.42);
    float contactCore = 1.0 - smoothstep(0.02, 0.53, radius);
    float wash = radialWash
      * mix(0.58, 1.0, brokenEdge)
      * mix(0.82, 1.0, paper)
      * mix(0.74, 1.0, contactCore);
    float alpha = wash * uOpacity * mix(0.56, 1.0, uPigment);
    if (alpha < 0.008) discard;

    gl_FragColor = vec4(uInkColor, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <dithering_fragment>
  }
`

export interface LivingSumiContactWashMaterialProps extends Omit<
  ShaderMaterialProps,
  | 'blending'
  | 'depthWrite'
  | 'fragmentShader'
  | 'ref'
  | 'transparent'
  | 'uniforms'
  | 'vertexShader'
> {
  brushScale?: number
  feather?: number
  materialRef?: Ref<THREE.ShaderMaterial>
  opacity?: number
  pigment?: number
  role?: LivingSumiRole
  seed?: number
}

/**
 * Low-cost grounding material for authored horizontal decal geometry. It uses
 * the same semantic pigment and world-anchored brush field as the mesh stack,
 * but deliberately does not opt into Three's light or shadow-map programs.
 */
export function LivingSumiContactWashMaterial({
  brushScale = 0.23,
  feather = 0.52,
  materialRef,
  opacity = 0.3,
  pigment = 0.72,
  role = 'stone',
  seed = 0,
  ...materialProps
}: LivingSumiContactWashMaterialProps) {
  const context = useContext(LivingSumiContext)
  if (!context) {
    throw new Error('LivingSumiContactWashMaterial must be used inside LivingSumiProvider')
  }
  const internalRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uBrushScale: new THREE.Uniform(Math.max(0.001, brushScale)),
    uBrushTexture: context.uniforms.uBrushTexture,
    uFeather: new THREE.Uniform(THREE.MathUtils.clamp(feather, 0.02, 0.98)),
    uInkColor: new THREE.Uniform(new THREE.Color(LIVING_SUMI_ROLES[role].shadow)),
    uOpacity: new THREE.Uniform(THREE.MathUtils.clamp(opacity, 0, 1)),
    uPaperScale: context.uniforms.uPaperScale,
    uPaperTexture: context.uniforms.uPaperTexture,
    uPigment: new THREE.Uniform(THREE.MathUtils.clamp(pigment, 0, 1)),
    uSeed: new THREE.Uniform(seed),
  }), [brushScale, context.uniforms, feather, opacity, pigment, role, seed])

  const assignRef = useCallback((material: THREE.ShaderMaterial | null) => {
    internalRef.current = material
    if (typeof materialRef === 'function') materialRef(material)
    else if (materialRef && 'current' in materialRef) materialRef.current = material
  }, [materialRef])

  return (
    <shaderMaterial
      {...materialProps}
      blending={THREE.NormalBlending}
      depthWrite={false}
      fragmentShader={contactWashFragmentShader}
      polygonOffset
      polygonOffsetFactor={-1}
      polygonOffsetUnits={-1}
      ref={assignRef}
      transparent
      uniforms={uniforms}
      vertexShader={contactWashVertexShader}
    />
  )
}

export interface LivingSumiContactWashProps {
  material?: Omit<LivingSumiContactWashMaterialProps, 'role'>
  meshRef?: Ref<THREE.Mesh>
  position?: ThreeElements['group']['position']
  renderOrder?: number
  role?: LivingSumiRole
  size?: readonly [width: number, depth: number]
  visible?: boolean
  yaw?: number
}

/**
 * Place this a few millimetres above the receiving ground under a hero node.
 * `size` should cover only its footprint: this is contact pigment, not a cast
 * shadow. For many repeated props, merge equivalent planes into one geometry
 * and use `LivingSumiContactWashMaterial` directly to keep the draw count low.
 */
export function LivingSumiContactWash({
  material,
  meshRef,
  position,
  renderOrder = -1,
  role = 'stone',
  size = [2.4, 1.55],
  visible,
  yaw = 0,
}: LivingSumiContactWashProps) {
  return (
    <group position={position} rotation={[0, yaw, 0]} visible={visible}>
      <mesh
        frustumCulled
        ref={meshRef}
        renderOrder={renderOrder}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[Math.max(0.001, size[0]), Math.max(0.001, size[1]), 1]}
      >
        <planeGeometry args={[1, 1]} />
        <LivingSumiContactWashMaterial {...material} role={role} />
      </mesh>
    </group>
  )
}
