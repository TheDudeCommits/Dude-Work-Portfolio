import { RoundedBox, useCursor, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { projects, type Project } from '../projects'
import { InkWaterMaterial, SumiMaterial } from './InkMaterial'
import type { ProgressRef } from './types'

const portalVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const portalFragment = /* glsl */ `
  uniform sampler2D uImage;
  uniform float uTime;
  uniform float uHover;
  varying vec2 vUv;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  void main() {
    vec2 uv = vUv;
    float silk = sin(uv.y * 42.0 + uTime * 0.58) * 0.0018;
    uv.x += silk + sin(uv.y * 7.0 - uTime * 0.22) * 0.0012;
    vec3 image = texture2D(uImage, clamp(uv, 0.002, 0.998)).rgb;
    float paper = hash(floor(vUv * vec2(320.0, 410.0)));
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float vignette = smoothstep(0.0, 0.13, edge);
    float luma = dot(image, vec3(0.299, 0.587, 0.114));
    image = mix(vec3(luma) * vec3(0.94, 0.91, 0.83), image, 0.82 + uHover * 0.12);
    image += (paper - 0.5) * 0.022;
    image += vec3(0.38, 0.24, 0.08) * uHover * (1.0 - vignette) * 1.8;
    gl_FragColor = vec4(image * (0.82 + vignette * 0.24 + uHover * 0.09), 1.0);
  }
`

function PortalSurface({ hovered, texture }: { hovered: boolean; texture: THREE.Texture }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const hover = useRef(0)
  const uniforms = useMemo(() => ({
    uHover: { value: 0 },
    uImage: { value: texture },
    uTime: { value: 0 },
  }), [texture])

  useFrame(({ clock }, delta) => {
    if (!material.current) return
    hover.current = THREE.MathUtils.damp(hover.current, hovered ? 1 : 0, 6, delta)
    material.current.uniforms.uHover.value = hover.current
    material.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <shaderMaterial
      fragmentShader={portalFragment}
      ref={material}
      toneMapped={false}
      uniforms={uniforms}
      vertexShader={portalVertex}
    />
  )
}

interface PortalPlacement {
  position: [number, number, number]
  rotation: number
  scale: number
}

function ProjectPavilion({
  index,
  placement,
  progressRef,
  project,
}: {
  index: number
  placement: PortalPlacement
  progressRef: ProgressRef
  project: Project
}) {
  const texture = useTexture(project.image)
  const group = useRef<THREE.Group>(null)
  const curtain = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  useFrame(({ clock }, delta) => {
    if (!group.current || !curtain.current) return
    const revealStart = 0.82 + index * 0.012
    const reveal = THREE.MathUtils.smoothstep(progressRef.current, revealStart, revealStart + 0.09)
    const targetScale = reveal * placement.scale * (hovered ? 1.055 : 1)
    const current = group.current.scale.x
    group.current.scale.setScalar(THREE.MathUtils.damp(current, targetScale, 5.4, delta))
    curtain.current.position.z = THREE.MathUtils.damp(curtain.current.position.z, hovered ? 0.22 : 0, 5.8, delta)
    curtain.current.rotation.y = Math.sin(clock.elapsedTime * 0.42 + index) * 0.006
    group.current.position.y = placement.position[1] + Math.sin(clock.elapsedTime * 0.36 + index * 1.71) * 0.025
  })

  return (
    <group
      position={placement.position}
      ref={group}
      rotation={[0, placement.rotation, 0]}
      scale={0.001}
    >
      <mesh castShadow position={[0, -1.57, 0]} receiveShadow>
        <cylinderGeometry args={[0.78, 1.02, 0.32, 9]} />
        <SumiMaterial color="#252a25" inkStrength={0.46} paperScale={2} />
      </mesh>
      <mesh castShadow position={[0, -1.38, 0]}>
        <cylinderGeometry args={[0.54, 0.67, 0.18, 9]} />
        <SumiMaterial color="#77796b" inkStrength={0.4} paperScale={2} />
      </mesh>

      <group ref={curtain}>
        <RoundedBox args={[2.06, 2.64, 0.2]} castShadow position={[0, 0.02, -0.04]} radius={0.08} smoothness={3}>
          <SumiMaterial color="#171b18" inkStrength={0.52} paperScale={2.6} />
        </RoundedBox>
        <mesh
          onClick={(event) => {
            event.stopPropagation()
            window.open(project.href, '_blank', 'noopener,noreferrer')
          }}
          onPointerOut={() => setHovered(false)}
          onPointerOver={(event) => {
            event.stopPropagation()
            setHovered(true)
          }}
          position={[0, 0.05, 0.075]}
        >
          <planeGeometry args={[1.72, 2.26, 24, 32]} />
          <PortalSurface hovered={hovered} texture={texture} />
        </mesh>
        <RoundedBox args={[0.12, 2.9, 0.26]} castShadow position={[-1.06, 0, 0]} radius={0.035} smoothness={2}>
          <SumiMaterial color="#5e251e" inkStrength={0.44} paperScale={1.5} />
        </RoundedBox>
        <RoundedBox args={[0.12, 2.9, 0.26]} castShadow position={[1.06, 0, 0]} radius={0.035} smoothness={2}>
          <SumiMaterial color="#5e251e" inkStrength={0.44} paperScale={1.5} />
        </RoundedBox>
        <RoundedBox args={[2.42, 0.15, 0.29]} castShadow position={[0, 1.47, 0]} radius={0.04} smoothness={2}>
          <SumiMaterial color="#2a2018" inkStrength={0.48} paperScale={1.5} />
        </RoundedBox>
        <mesh castShadow position={[-0.92, -1.54, 0.03]} rotation={[0, 0, 0.09]}>
          <coneGeometry args={[0.09, 0.48, 6]} />
          <SumiMaterial color="#b68a42" emissive="#3c2109" emissiveIntensity={0.2} inkStrength={0.26} />
        </mesh>
        <mesh castShadow position={[0.92, -1.54, 0.03]} rotation={[0, 0, -0.09]}>
          <coneGeometry args={[0.09, 0.48, 6]} />
          <SumiMaterial color="#b68a42" emissive="#3c2109" emissiveIntensity={0.2} inkStrength={0.26} />
        </mesh>
      </group>
    </group>
  )
}

function EnsoSculpture() {
  const curve = useMemo(() => {
    const points: THREE.Vector3[] = []
    const count = 58
    for (let index = 0; index < count; index += 1) {
      const angle = THREE.MathUtils.lerp(-Math.PI * 0.42, Math.PI * 1.37, index / (count - 1))
      const irregular = 1 + Math.sin(index * 1.71) * 0.018 + Math.sin(index * 0.47) * 0.03
      points.push(new THREE.Vector3(Math.cos(angle) * 4.25 * irregular, Math.sin(angle) * 4.25 * irregular, 0))
    }
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3)
  }, [])
  const geometry = useMemo(() => {
    const value = new THREE.TubeGeometry(curve, 144, 0.25, 10, false)
    const positions = value.attributes.position as THREE.BufferAttribute
    const uvs = value.attributes.uv as THREE.BufferAttribute
    const center = new THREE.Vector3()
    const radial = new THREE.Vector3()
    for (let index = 0; index < positions.count; index += 1) {
      const u = uvs.getX(index)
      curve.getPointAt(u, center)
      radial.set(positions.getX(index), positions.getY(index), positions.getZ(index)).sub(center)
      const endTaper = THREE.MathUtils.smoothstep(u, 0, 0.11)
        * (1 - THREE.MathUtils.smoothstep(u, 0.86, 1))
      const bristle = 0.68 + Math.sin(u * 71) * 0.09 + Math.sin(u * 19 + 0.8) * 0.13
      radial.multiplyScalar(Math.max(0.08, endTaper) * bristle)
      center.add(radial)
      positions.setXYZ(index, center.x, center.y, center.z)
    }
    value.computeVertexNormals()
    return value
  }, [curve])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group position={[0, 6.15, -78.2]}>
      <mesh geometry={geometry}>
        <SumiMaterial
          color="#010201"
          emissive="#000000"
          emissiveIntensity={0}
          inkStrength={0.5}
          metalness={0.22}
          paperScale={4}
          roughness={0.58}
        />
      </mesh>
      <pointLight color="#d9ba70" decay={2} distance={20} intensity={18} position={[0, 0.4, 2]} />
    </group>
  )
}

const placements: PortalPlacement[] = [
  { position: [-6.05, 3.15, -70.7], rotation: 0.54, scale: 0.86 },
  { position: [-3.15, 3.02, -73.0], rotation: 0.29, scale: 0.9 },
  { position: [0, 2.94, -74.0], rotation: 0, scale: 0.92 },
  { position: [3.15, 3.02, -73.0], rotation: -0.29, scale: 0.9 },
  { position: [6.05, 3.15, -70.7], rotation: -0.54, scale: 0.86 },
  { position: [-4.45, 6.02, -74.7], rotation: 0.34, scale: 0.82 },
  { position: [-1.5, 6.1, -76.0], rotation: 0.11, scale: 0.84 },
  { position: [1.5, 6.1, -76.0], rotation: -0.11, scale: 0.84 },
  { position: [4.45, 6.02, -74.7], rotation: -0.34, scale: 0.82 },
]

function MirrorCourt({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group position={[0, 0, -73.6]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.87, 0]}>
        <circleGeometry args={[10.8, 96]} />
        <InkWaterMaterial reducedMotion={reducedMotion} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.58, 0]}>
        <cylinderGeometry args={[11.2, 11.65, 0.46, 64]} />
        <SumiMaterial color="#202722" inkStrength={0.48} paperScale={5.4} roughness={0.95} />
      </mesh>
      {[6.4, 9.05, 11.18].map((radius, index) => (
        <mesh key={radius} position={[0, 0.84 - index * 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.055 + index * 0.018, 8, 96]} />
          <SumiMaterial
            color={index === 1 ? '#9d7740' : '#3c443b'}
            emissive={index === 1 ? '#5a3410' : '#000000'}
            emissiveIntensity={index === 1 ? 0.42 : 0}
            inkStrength={0.34}
            metalness={index === 1 ? 0.22 : 0}
            paperScale={4}
            roughness={0.72}
          />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 9.3, 1.1, 1.8]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.32, 1.35, 8]} />
            <SumiMaterial color="#2d332d" inkStrength={0.44} />
          </mesh>
          <mesh castShadow position={[0, 0.88, 0]}>
            <octahedronGeometry args={[0.46, 0]} />
            <SumiMaterial color="#b58a45" emissive="#a15c21" emissiveIntensity={2.2} inkStrength={0.18} />
          </mesh>
          <pointLight color="#d7a75a" decay={2} distance={9} intensity={7} position={[0, 0.92, 0.25]} />
        </group>
      ))}
    </group>
  )
}

export function Sanctuary({
  progressRef,
  reducedMotion,
}: {
  progressRef: ProgressRef
  reducedMotion: boolean
}) {
  return (
    <group>
      <MirrorCourt reducedMotion={reducedMotion} />
      <EnsoSculpture />
      {projects.map((project, index) => (
        <ProjectPavilion
          index={index}
          key={project.slug}
          placement={placements[index]}
          progressRef={progressRef}
          project={project}
        />
      ))}
    </group>
  )
}
