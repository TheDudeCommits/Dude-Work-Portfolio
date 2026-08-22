import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useArtDirector, type ArtDirectorUniforms } from '../ArtDirectorProvider'
import { ART_CINEMA } from '../artTokens'

export interface SumiCinemaPassProps {
  desaturation?: number
  edgeStrength?: number
  enabled?: boolean
  resolutionScale?: number
}

const fullscreenVertexShader = /* glsl */ `
  varying vec2 vCinemaUv;

  void main() {
    vCinemaUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const cinemaFragmentShader = /* glsl */ `
  uniform float uCameraFar;
  uniform float uCameraNear;
  uniform float uDesaturation;
  uniform float uEdgeStrength;
  uniform float uLetterbox;
  uniform float uPaperGrain;
  uniform float uRitualIntensity;
  uniform float uTime;
  uniform sampler2D uSceneColor;
  uniform sampler2D uSceneDepth;
  uniform vec2 uResolution;
  uniform vec3 uAccentGold;
  uniform vec3 uAccentVermilion;
  uniform vec3 uInk;
  uniform vec3 uMist;
  uniform vec3 uPaper;
  varying vec2 vCinemaUv;

  float cinemaLuma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  float cinemaHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float perspectiveDepthToDistance(float depth) {
    float viewZ = (uCameraNear * uCameraFar)
      / ((uCameraFar - uCameraNear) * depth - uCameraFar);
    return -viewZ;
  }

  void main() {
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    vec3 center = texture2D(uSceneColor, vCinemaUv).rgb;
    vec3 north = texture2D(uSceneColor, vCinemaUv + vec2(0.0, texel.y)).rgb;
    vec3 south = texture2D(uSceneColor, vCinemaUv - vec2(0.0, texel.y)).rgb;
    vec3 east = texture2D(uSceneColor, vCinemaUv + vec2(texel.x, 0.0)).rgb;
    vec3 west = texture2D(uSceneColor, vCinemaUv - vec2(texel.x, 0.0)).rgb;
    float centerLuma = cinemaLuma(center);
    float edgeDelta = abs(cinemaLuma(north) - cinemaLuma(south))
      + abs(cinemaLuma(east) - cinemaLuma(west));
    edgeDelta += length(center * 4.0 - north - south - east - west) * 0.22;
    float inkEdge = smoothstep(0.045, 0.31, edgeDelta) * uEdgeStrength;

    vec3 paperMonochrome = mix(uInk, uPaper, smoothstep(0.025, 0.96, pow(centerLuma, 0.92)));
    vec3 graded = mix(center, paperMonochrome, uDesaturation);
    float vermilionMask = 1.0 - smoothstep(0.1, 0.46, distance(center, uAccentVermilion));
    float goldMask = 1.0 - smoothstep(0.1, 0.48, distance(center, uAccentGold));
    float pigmentMask = max(vermilionMask, goldMask * 0.78);
    graded = mix(graded, center, pigmentMask * (0.78 + uRitualIntensity * 0.14));
    graded = mix(graded, uInk, inkEdge * (0.68 + (1.0 - centerLuma) * 0.22));

    float rawDepth = texture2D(uSceneDepth, vCinemaUv).x;
    float viewDistance = perspectiveDepthToDistance(rawDepth);
    float depthMist = smoothstep(uCameraFar * 0.22, uCameraFar * 0.84, viewDistance)
      * (1.0 - step(0.9995, rawDepth));
    graded = mix(graded, uMist, depthMist * 0.105);

    float paperFibre = sin(gl_FragCoord.y * 0.91 + sin(gl_FragCoord.x * 0.071) * 2.3);
    float paperNoise = cinemaHash(floor(gl_FragCoord.xy * vec2(0.5, 0.25)));
    float paperMark = (paperNoise - 0.5) * 0.76 + paperFibre * 0.12;
    graded += paperMark * uPaperGrain * (0.42 + centerLuma * 0.58);

    vec2 framePoint = (vCinemaUv - 0.5) * vec2(0.86, 1.0);
    float edgeDistance = min(vCinemaUv.y, 1.0 - vCinemaUv.y);
    float ragged = (cinemaHash(vec2(floor(vCinemaUv.x * 190.0), floor(uTime * 0.08))) - 0.5) * 0.009;
    ragged += sin(vCinemaUv.x * 91.0 + 1.8) * 0.0018;
    float letterbox = 1.0 - smoothstep(
      uLetterbox - 0.006 + ragged,
      uLetterbox + 0.009 + ragged,
      edgeDistance
    );
    float edgeWash = smoothstep(0.31, 0.72, length(framePoint));
    graded = mix(graded, uInk, letterbox * 0.91 + edgeWash * 0.075);
    graded += uAccentGold * uRitualIntensity * 0.018;

    gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
    #include <colorspace_fragment>
  }
`

function createCinemaResources(
  artUniforms: ArtDirectorUniforms,
  desaturation: number,
  edgeStrength: number,
) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
  })
  target.texture.colorSpace = THREE.LinearSRGBColorSpace
  target.texture.generateMipmaps = false
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
  target.depthTexture.format = THREE.DepthFormat
  target.depthTexture.magFilter = THREE.NearestFilter
  target.depthTexture.minFilter = THREE.NearestFilter

  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: cinemaFragmentShader,
    toneMapped: false,
    uniforms: {
      uAccentGold: new THREE.Uniform(new THREE.Color(ART_CINEMA.accentGold)),
      uAccentVermilion: new THREE.Uniform(new THREE.Color(ART_CINEMA.accentVermilion)),
      uCameraFar: new THREE.Uniform(100),
      uCameraNear: new THREE.Uniform(0.1),
      uDesaturation: new THREE.Uniform(THREE.MathUtils.clamp(desaturation, 0, 1)),
      uEdgeStrength: new THREE.Uniform(Math.max(0, edgeStrength)),
      uInk: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmosphereInk)),
      uLetterbox: new THREE.Uniform(ART_CINEMA.letterboxWash),
      uMist: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmosphereMist)),
      uPaper: new THREE.Uniform(new THREE.Color(ART_CINEMA.atmospherePaper)),
      uPaperGrain: new THREE.Uniform(ART_CINEMA.paperGrainStrength),
      uResolution: new THREE.Uniform(new THREE.Vector2(1, 1)),
      uRitualIntensity: artUniforms.uRitualIntensity,
      uSceneColor: new THREE.Uniform(target.texture),
      uSceneDepth: new THREE.Uniform(target.depthTexture),
      uTime: artUniforms.uArtTime,
    },
    vertexShader: fullscreenVertexShader,
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  return { camera, geometry, material, scene, target }
}

function ActiveSumiCinemaPass({
  desaturation = ART_CINEMA.filmDesaturation,
  edgeStrength = ART_CINEMA.edgeInkStrength,
  resolutionScale,
}: Omit<SumiCinemaPassProps, 'enabled'>) {
  const { uniforms: artUniforms } = useArtDirector()
  const size = useThree((state) => state.size)
  const resources = useMemo(
    () => createCinemaResources(artUniforms, desaturation, edgeStrength),
    [artUniforms, desaturation, edgeStrength],
  )
  const drawingBufferSize = useMemo(() => new THREE.Vector2(), [])

  useEffect(() => () => {
    resources.geometry.dispose()
    resources.material.dispose()
    resources.target.dispose()
  }, [resources])

  useFrame(({ camera, gl, scene }) => {
    const autoScale = size.width < 780 ? 0.76 : 0.9
    const scale = THREE.MathUtils.clamp(resolutionScale ?? autoScale, 0.55, 1)
    gl.getDrawingBufferSize(drawingBufferSize)
    const width = Math.max(1, Math.round(drawingBufferSize.x * scale))
    const height = Math.max(1, Math.round(drawingBufferSize.y * scale))
    if (resources.target.width !== width || resources.target.height !== height) {
      resources.target.setSize(width, height)
      resources.material.uniforms.uResolution.value.set(width, height)
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      resources.material.uniforms.uCameraNear.value = camera.near
      resources.material.uniforms.uCameraFar.value = camera.far
    }

    const previousTarget = gl.getRenderTarget()
    const previousAutoClear = gl.autoClear
    const previousInfoAutoReset = gl.info.autoReset
    const previousXrEnabled = gl.xr.enabled
    gl.autoClear = false
    gl.info.autoReset = false
    gl.info.reset()
    gl.xr.enabled = false
    gl.setRenderTarget(resources.target)
    gl.clear(true, true, false)
    gl.render(scene, camera)
    gl.setRenderTarget(previousTarget)
    gl.clear(true, true, false)
    gl.render(resources.scene, resources.camera)
    gl.xr.enabled = previousXrEnabled
    gl.info.autoReset = previousInfoAutoReset
    gl.autoClear = previousAutoClear
  }, 100)

  return null
}

/**
 * A small, bespoke final render pass for ink-edge extraction, restrained
 * pigment preservation, depth haze and ragged film-frame washes.
 */
export function SumiCinemaPass({ enabled = true, ...props }: SumiCinemaPassProps) {
  return enabled ? <ActiveSumiCinemaPass {...props} /> : null
}
