import { useMemo, useRef, type Ref } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { useArtDirector } from '../ArtDirectorProvider'
import { ART_WATER } from '../artTokens'
import { useLivingInkField } from '../ink/LivingInkFieldProvider'
import { useWindField } from '../wind/WindFieldProvider'

const waterVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uArtTime;
  uniform vec4 uInkBounds;
  uniform sampler2D uInkField;
  uniform vec2 uWindDirection;
  uniform float uWindGust;
  uniform float uWindStrength;
  uniform float uWaveStrength;

  varying float vInkDisturbance;
  varying float vWaterHeight;
  varying vec2 vWaterUv;
  varying vec3 vWaterNormal;
  varying vec3 vWaterWorldPosition;

  float waterInsideUnitSquare(vec2 uv) {
    vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    return inside.x * inside.y;
  }

  void main() {
    vec4 restingWorld = modelMatrix * vec4(position, 1.0);
    vec2 inkUv = (restingWorld.xz - uInkBounds.xy) * uInkBounds.zw;
    vec4 inkField = texture2D(uInkField, clamp(inkUv, 0.0, 1.0)) * waterInsideUnitSquare(inkUv);

    vec2 primaryDirection = normalize(uWindDirection + vec2(0.001));
    vec2 crossingDirection = vec2(-primaryDirection.y, primaryDirection.x);
    float movement = 0.28 + uWindStrength * 0.72 + uWindGust * 0.22;
    float phaseA = dot(position.xy, primaryDirection) * 1.42 + uArtTime * 0.72 * movement;
    float phaseB = dot(position.xy, crossingDirection) * 2.31 - uArtTime * 0.51 * movement;
    float phaseC = (position.x + position.y) * 3.67 + uArtTime * 0.29 * movement;
    float localDisturbance = inkField.b;

    float waveA = sin(phaseA) * 0.52;
    float waveB = sin(phaseB + sin(phaseA * 0.47)) * 0.3;
    float waveC = cos(phaseC) * 0.18;
    float disturbedWave = sin(phaseC * 1.43 - uArtTime * 1.7) * localDisturbance * 0.55;
    float waveHeight = (waveA + waveB + waveC + disturbedWave)
      * uWaveStrength
      * (0.72 + movement * 0.28);

    float derivativeX = (
      cos(phaseA) * primaryDirection.x * 1.42 * 0.52
      + cos(phaseB + sin(phaseA * 0.47))
        * (crossingDirection.x * 2.31 + cos(phaseA * 0.47) * primaryDirection.x * 0.6674)
        * 0.3
      - sin(phaseC) * 3.67 * 0.18
    ) * uWaveStrength;
    float derivativeY = (
      cos(phaseA) * primaryDirection.y * 1.42 * 0.52
      + cos(phaseB + sin(phaseA * 0.47))
        * (crossingDirection.y * 2.31 + cos(phaseA * 0.47) * primaryDirection.y * 0.6674)
        * 0.3
      - sin(phaseC) * 3.67 * 0.18
    ) * uWaveStrength;

    vec3 transformed = position;
    transformed.z += waveHeight;
    vec3 objectNormal = normalize(vec3(-derivativeX, -derivativeY, 1.0));
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;

    vInkDisturbance = localDisturbance;
    vWaterHeight = waveHeight;
    vWaterUv = uv;
    vWaterNormal = normalize(mat3(modelMatrix) * objectNormal);
    vWaterWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`

const waterFragmentShader = /* glsl */ `
  #include <common>
  #include <dithering_pars_fragment>
  #include <fog_pars_fragment>

  uniform float uAlpha;
  uniform float uAlphaAtGrazing;
  uniform float uArtTime;
  uniform float uBroadPaperScale;
  uniform vec3 uCausticColor;
  uniform float uCausticStrength;
  uniform vec3 uDeepColor;
  uniform float uDisturbanceResponse;
  uniform float uFineFiberScale;
  uniform float uFresnelStrength;
  uniform vec4 uInkBounds;
  uniform vec3 uInkColor;
  uniform sampler2D uInkField;
  uniform vec3 uLightColor;
  uniform vec3 uLightDirection;
  uniform float uPaperBreakup;
  uniform sampler2D uPaperTexture;
  uniform vec3 uRitualColor;
  uniform float uRitualIntensity;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyReflectionColor;
  uniform vec2 uWindDirection;
  uniform float uWindGust;
  uniform float uWindStrength;

  varying float vInkDisturbance;
  varying float vWaterHeight;
  varying vec2 vWaterUv;
  varying vec3 vWaterNormal;
  varying vec3 vWaterWorldPosition;

  float waterHash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float waterNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(waterHash(cell), waterHash(cell + vec2(1.0, 0.0)), local.x),
      mix(waterHash(cell + vec2(0.0, 1.0)), waterHash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  float waterInsideUnitSquare(vec2 uv) {
    vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    return inside.x * inside.y;
  }

  void main() {
    vec3 surfaceNormal = normalize(vWaterNormal);
    if (!gl_FrontFacing) surfaceNormal = -surfaceNormal;
    vec3 viewDirection = normalize(cameraPosition - vWaterWorldPosition);
    float fresnel = pow(1.0 - clamp(abs(dot(surfaceNormal, viewDirection)), 0.0, 1.0), 3.2);
    fresnel = clamp(fresnel * uFresnelStrength, 0.0, 1.0);

    vec2 inkUv = (vWaterWorldPosition.xz - uInkBounds.xy) * uInkBounds.zw;
    vec4 inkField = texture2D(uInkField, clamp(inkUv, 0.0, 1.0)) * waterInsideUnitSquare(inkUv);
    vec2 wind = normalize(uWindDirection + vec2(0.001));
    vec2 flow = vec2(-wind.y, wind.x);
    float movement = 0.22 + uWindStrength * 0.42 + uWindGust * 0.16;

    vec2 broadUv = vWaterWorldPosition.xz * 0.19;
    float broadWash = waterNoise(broadUv + wind * uArtTime * 0.025 * movement);
    float crossingWash = waterNoise(
      broadUv * 1.87 - flow * uArtTime * 0.017 * movement + broadWash * 0.38
    );
    float rippleA = sin(dot(vWaterWorldPosition.xz, wind) * 4.7 + uArtTime * 0.86 * movement);
    float rippleB = sin(dot(vWaterWorldPosition.xz, flow) * 7.3 - uArtTime * 0.64 * movement + broadWash * 2.4);
    float rippleC = sin((vWaterWorldPosition.x + vWaterWorldPosition.z) * 10.6 + uArtTime * 0.37);
    float causticField = rippleA * 0.48 + rippleB * 0.34 + rippleC * 0.18;
    causticField += (crossingWash - 0.5) * 0.72;
    float caustics = smoothstep(0.56, 0.9, causticField * 0.5 + 0.5);
    float brushRidges = smoothstep(0.76, 0.985, abs(rippleA * rippleB))
      * (0.42 + crossingWash * 0.58);

    float broadPaper = texture2D(
      uPaperTexture,
      vWaterUv * (3.2 + uBroadPaperScale * 2.4)
    ).r;
    float finePaper = texture2D(
      uPaperTexture,
      vWaterUv / max(uFineFiberScale, 0.001)
    ).g;
    float paperBreakup = (broadPaper - 0.5) * 0.72 + (finePaper - 0.5) * 0.28;

    float shallowMix = clamp(0.42 + broadWash * 0.21 - fresnel * 0.18 + vWaterHeight * 1.8, 0.0, 1.0);
    vec3 waterColor = mix(uDeepColor, uShallowColor, shallowMix);
    waterColor = mix(waterColor, uSkyReflectionColor, 0.08 + fresnel * 0.5);
    waterColor = mix(waterColor, uCausticColor, caustics * uCausticStrength * (0.56 + broadWash * 0.44));

    float facingLight = clamp(dot(surfaceNormal, normalize(uLightDirection)) * 0.5 + 0.5, 0.0, 1.0);
    waterColor += uLightColor * facingLight * caustics * 0.035;
    vec3 lightReflection = reflect(-normalize(uLightDirection), surfaceNormal);
    float sunGlint = pow(max(dot(lightReflection, viewDirection), 0.0), 82.0);
    waterColor += uLightColor * (sunGlint * 0.64 + brushRidges * 0.075);
    float pigment = clamp(inkField.r * uDisturbanceResponse, 0.0, 1.0);
    waterColor = mix(waterColor, uInkColor, pigment * (0.38 + inkField.g * 0.24));
    float livingDisturbance = max(vInkDisturbance, inkField.b);
    waterColor += uRitualColor
      * livingDisturbance
      * uRitualIntensity
      * uDisturbanceResponse
      * 0.18;
    waterColor += paperBreakup * uPaperBreakup;
    waterColor = max(waterColor, vec3(0.0));

    float alpha = mix(uAlpha, uAlphaAtGrazing, fresnel);
    alpha += pigment * 0.045 + livingDisturbance * 0.018;
    alpha -= max(paperBreakup, 0.0) * 0.025;
    gl_FragColor = vec4(waterColor, clamp(alpha, 0.62, 0.93));

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    #include <dithering_fragment>
  }
`

type ShaderMaterialProps = ThreeElements['shaderMaterial']

export interface LivingWaterSurfaceMaterialProps extends Omit<
  ShaderMaterialProps,
  | 'depthWrite'
  | 'fragmentShader'
  | 'opacity'
  | 'side'
  | 'transparent'
  | 'uniforms'
  | 'vertexShader'
> {
  alpha?: number
  causticStrength?: number
  disturbanceResponse?: number
  fresnelStrength?: number
  materialRef?: Ref<THREE.ShaderMaterial>
  paperBreakup?: number
  waveStrength?: number
}

export function LivingWaterSurfaceMaterial({
  alpha = ART_WATER.alpha,
  causticStrength = ART_WATER.causticStrength,
  disturbanceResponse = ART_WATER.disturbanceResponse,
  fresnelStrength = ART_WATER.fresnelStrength,
  materialRef,
  paperBreakup = ART_WATER.paperBreakup,
  waveStrength = ART_WATER.waveStrength,
  ...materialProps
}: LivingWaterSurfaceMaterialProps) {
  const internalRef = useRef<THREE.ShaderMaterial>(null)
  const { uniforms: artUniforms } = useArtDirector()
  const { uniforms: inkUniforms } = useLivingInkField()
  const { uniforms: windUniforms } = useWindField()
  const uniforms = useMemo(() => ({
    ...THREE.UniformsLib.fog,
    ...artUniforms,
    ...inkUniforms,
    ...windUniforms,
    uAlpha: new THREE.Uniform(THREE.MathUtils.clamp(alpha, 0.62, 0.9)),
    uAlphaAtGrazing: new THREE.Uniform(ART_WATER.alphaAtGrazing),
    uCausticColor: new THREE.Uniform(new THREE.Color(ART_WATER.caustic)),
    uCausticStrength: new THREE.Uniform(Math.max(0, causticStrength)),
    uDeepColor: new THREE.Uniform(new THREE.Color(ART_WATER.deep)),
    uDisturbanceResponse: new THREE.Uniform(Math.max(0, disturbanceResponse)),
    uFresnelStrength: new THREE.Uniform(Math.max(0, fresnelStrength)),
    uLightColor: new THREE.Uniform(new THREE.Color(ART_WATER.light)),
    uLightDirection: new THREE.Uniform(new THREE.Vector3(...ART_WATER.lightDirection).normalize()),
    uPaperBreakup: new THREE.Uniform(Math.max(0, paperBreakup)),
    uShallowColor: new THREE.Uniform(new THREE.Color(ART_WATER.shallow)),
    uSkyReflectionColor: new THREE.Uniform(new THREE.Color(ART_WATER.skyReflection)),
    uWaveStrength: new THREE.Uniform(Math.max(0, waveStrength)),
  }), [
    alpha,
    artUniforms,
    causticStrength,
    disturbanceResponse,
    fresnelStrength,
    inkUniforms,
    paperBreakup,
    waveStrength,
    windUniforms,
  ])

  const assignRef = (material: THREE.ShaderMaterial | null) => {
    internalRef.current = material
    if (typeof materialRef === 'function') materialRef(material)
    else if (materialRef && 'current' in materialRef) materialRef.current = material
  }

  return (
    <shaderMaterial
      {...materialProps}
      depthWrite={false}
      dithering
      fog
      fragmentShader={waterFragmentShader}
      ref={assignRef}
      side={THREE.DoubleSide}
      transparent
      uniforms={uniforms}
      vertexShader={waterVertexShader}
    />
  )
}
