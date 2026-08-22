export const livingSumiVertexShader = /* glsl */ `
  attribute float aSumiDryness;
  attribute float aSumiPigment;
  attribute vec2 aSumiStroke;
  attribute float aSumiWetness;
  attribute float aSumiWind;

  uniform float uTime;
  uniform float uWaterFlow;
  uniform float uWindAmplitude;
  uniform float uWindResponse;

  varying float vSumiDryness;
  varying float vSumiPigment;
  varying vec2 vSumiStroke;
  varying float vSumiViewDepth;
  varying float vSumiWetness;
  varying vec3 vSumiWorldNormal;
  varying vec3 vSumiWorldPosition;

  void main() {
    vec4 localPosition = vec4(position, 1.0);
    vec3 localNormal = normal;

    // COLOR_0 alpha or _SUMI_WIND authors the flexible tips. Deformation is
    // applied in local space before instancing so repeated foliage remains
    // coherent, while the low frequencies keep it cinematic rather than noisy.
    float windLoad = clamp(aSumiWind, 0.0, 1.0) * max(0.0, uWindResponse);
    vec2 windOrigin = vec2(0.0);
    #ifdef USE_INSTANCING
      windOrigin = instanceMatrix[3].xz;
    #endif
    float windPhase = uTime * 0.74
      + position.y * 0.43
      + position.x * 0.09
      + position.z * 0.13
      + dot(windOrigin, vec2(0.17, 0.11));
    float windSweep = sin(windPhase) * 0.72 + sin(windPhase * 0.47 + 1.31) * 0.28;
    localPosition.x += windSweep * windLoad * uWindAmplitude;
    localPosition.z += cos(windPhase * 0.63) * windLoad * uWindAmplitude * 0.34;
    float waterWave = sin(position.x * 1.12 + uTime * 0.42)
      + sin(position.z * 1.67 - uTime * 0.28) * 0.55;
    localPosition.y += waterWave * 0.018 * uWaterFlow;

    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
      localNormal = mat3(instanceMatrix) * localNormal;
    #endif

    vec4 worldPosition = modelMatrix * localPosition;
    vec4 viewPosition = viewMatrix * worldPosition;
    vSumiWorldPosition = worldPosition.xyz;
    vSumiWorldNormal = normalize(mat3(modelMatrix) * localNormal);
    vSumiViewDepth = max(0.0, -viewPosition.z);
    vSumiPigment = clamp(aSumiPigment, 0.0, 1.0);
    vSumiWetness = clamp(aSumiWetness, 0.0, 1.0);
    vSumiDryness = clamp(aSumiDryness, 0.0, 1.0);
    vSumiStroke = length(aSumiStroke) > 0.0001 ? normalize(aSumiStroke) : vec2(1.0, 0.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`

export const livingSumiFragmentShader = /* glsl */ `
  #include <common>
  #include <dithering_pars_fragment>

  uniform sampler2D uBrushTexture;
  uniform sampler2D uPaperTexture;
  uniform float uAbsorbency;
  uniform float uAlphaCutoff;
  uniform float uAlphaFeather;
  uniform vec2 uBrushDirection;
  uniform float uBrushScale;
  uniform float uBrushScatter;
  uniform float uContourWidth;
  uniform float uDryGranulation;
  uniform float uDryLift;
  uniform vec3 uFogColor;
  uniform float uFogFar;
  uniform float uFogHeight;
  uniform float uFogHeightDensity;
  uniform float uFogNear;
  uniform float uFogOpacity;
  uniform float uFogStrength;
  uniform vec3 uKeyDirection;
  uniform vec3 uLightBand;
  uniform float uLightResponse;
  uniform vec3 uMidBand;
  uniform float uMotionStrength;
  uniform float uOpacity;
  uniform vec3 uPaperColor;
  uniform float uPaperResponse;
  uniform float uPaperScale;
  uniform float uPigmentDepth;
  uniform float uPigmentGain;
  uniform float uInkLoad;
  uniform vec3 uShadowBand;
  uniform float uSilhouetteStrength;
  uniform float uStrokeInfluence;
  uniform float uTime;
  uniform float uWetDarkening;
  uniform float uWetnessGain;
  uniform float uDrynessGain;
  uniform float uWaterFlow;
  uniform float uWeathering;

  varying float vSumiDryness;
  varying float vSumiPigment;
  varying vec2 vSumiStroke;
  varying float vSumiViewDepth;
  varying float vSumiWetness;
  varying vec3 vSumiWorldNormal;
  varying vec3 vSumiWorldPosition;

  vec3 sumiTriplanarWeights(vec3 normal) {
    vec3 weights = pow(abs(normal), vec3(5.0));
    return weights / max(weights.x + weights.y + weights.z, 0.0001);
  }

  float sumiTriplanarPaper(vec3 worldPosition, vec3 normal) {
    vec3 weights = sumiTriplanarWeights(normal);
    float x = texture2D(uPaperTexture, worldPosition.yz * uPaperScale).r;
    float y = texture2D(uPaperTexture, worldPosition.xz * uPaperScale).r;
    float z = texture2D(uPaperTexture, worldPosition.xy * uPaperScale).r;
    return x * weights.x + y * weights.y + z * weights.z;
  }

  vec2 sumiSafeDirection(vec2 direction) {
    return length(direction) > 0.0001 ? normalize(direction) : vec2(1.0, 0.0);
  }

  vec2 sumiBrushSamples(
    vec3 worldPosition,
    vec3 normal,
    vec2 vertexStroke,
    float paperWarp
  ) {
    vec2 flow = sumiSafeDirection(mix(
      sumiSafeDirection(uBrushDirection),
      sumiSafeDirection(vertexStroke),
      clamp(uStrokeInfluence, 0.0, 1.0)
    ));
    vec2 crossFlow = vec2(-flow.y, flow.x);
    vec2 groundUv = vec2(dot(worldPosition.xz, flow), dot(worldPosition.xz, crossFlow));
    vec2 verticalUv = vec2(
      dot(worldPosition.xz, flow) + worldPosition.y * 0.11,
      worldPosition.y + dot(worldPosition.xz, crossFlow) * 0.16
    );
    float upward = smoothstep(0.38, 0.82, abs(normal.y));
    vec2 brushUv = mix(verticalUv, groundUv, upward) * uBrushScale;
    brushUv += vec2(paperWarp - 0.5, 0.5 - paperWarp) * vec2(0.68, 0.42);
    brushUv += vec2(uTime * 0.014, -uTime * 0.006) * uWaterFlow;
    float longStroke = texture2D(uBrushTexture, brushUv * vec2(0.38, 1.0)).r;
    float crossStroke = texture2D(
      uBrushTexture,
      brushUv.yx * vec2(0.61, 1.72) + vec2(0.37, 0.19)
    ).g;
    return vec2(longStroke, crossStroke);
  }

  void main() {
    vec3 worldNormal = normalize(vSumiWorldNormal);
    if (!gl_FrontFacing) worldNormal = -worldNormal;
    vec3 viewDirection = normalize(cameraPosition - vSumiWorldPosition);
    vec3 keyDirection = normalize(uKeyDirection);
    float paper = sumiTriplanarPaper(vSumiWorldPosition, worldNormal);
    vec2 brushSamples = sumiBrushSamples(
      vSumiWorldPosition,
      worldNormal,
      vSumiStroke,
      paper
    );
    float brush = mix(brushSamples.x, brushSamples.y, clamp(uBrushScatter, 0.0, 1.0));
    float crossedBristle = abs(brushSamples.x - brushSamples.y);

    // Broad, continuous value masses. There is deliberately no floor/step
    // posterization here; each semantic role owns its pigment bands.
    float directionalValue = clamp(dot(worldNormal, keyDirection) * 0.5 + 0.5, 0.0, 1.0);
    float paintedHemisphere = clamp(
      0.5 + worldNormal.y * 0.18 * uLightResponse,
      0.0,
      1.0
    );
    float keyFacing = mix(
      paintedHemisphere,
      directionalValue,
      uLightResponse * uLightResponse
    );
    keyFacing += (brush - 0.5) * 0.08 + (paper - 0.5) * 0.035;
    float middleMass = smoothstep(0.2, 0.76, keyFacing);
    float lightMass = smoothstep(0.68, 0.96, keyFacing);
    vec3 pigmentColor = mix(uShadowBand, uMidBand, middleMass);
    pigmentColor = mix(pigmentColor, uLightBand, lightMass * 0.38);

    float pigment = clamp(vSumiPigment * uPigmentGain + (brush - 0.5) * 0.26, 0.0, 1.0);
    float wetness = clamp(vSumiWetness * uWetnessGain, 0.0, 1.0);
    float dryness = clamp(vSumiDryness * uDrynessGain, 0.0, 1.0);
    vec2 capillaryFlow = sumiSafeDirection(vSumiStroke);
    vec2 capillaryCross = vec2(-capillaryFlow.y, capillaryFlow.x);

    float capillaryPhase =
      dot(vSumiWorldPosition.xz, capillaryFlow) * 0.31
      + dot(vSumiWorldPosition.xz, capillaryCross) * 0.13
      + vSumiWorldPosition.y * 0.17;

    float capillaryTide = (
      sin(uTime * 0.19 + capillaryPhase + paper * 2.4) * 0.72
      + sin(uTime * 0.11 - capillaryPhase * 0.47 + 1.7) * 0.28
    ) * uMotionStrength;

    float capillaryField = clamp(
      brush * 0.68 + paper * 0.24 - crossedBristle * 0.10,
      0.0,
      1.0
    );

    float wetLoad = clamp(
      wetness
        * (1.35 + pigment * 0.65)
        * (1.0 - dryness * 0.65)
        * uAbsorbency,
      0.0,
      1.0
    );

    float capillaryFront = mix(0.58, 0.44, wetLoad) + capillaryTide;
    float capillaryWidth = mix(
      0.045,
      0.085,
      clamp(uAbsorbency, 0.0, 1.0)
    );

    float capillaryRim =
      smoothstep(
        capillaryFront - capillaryWidth,
        capillaryFront,
        capillaryField
      )
      * (
        1.0 - smoothstep(
          capillaryFront,
          capillaryFront + capillaryWidth,
          capillaryField
        )
      );

    float wetPool = smoothstep(
      capillaryFront + capillaryWidth * 0.25,
      capillaryFront + capillaryWidth * 2.5,
      capillaryField
    );
    pigmentColor = mix(
      pigmentColor,
      uShadowBand,
      pigment * uPigmentDepth * uInkLoad * (0.1 + (1.0 - middleMass) * 0.3)
    );
    float wetInk =
      wetness * uAbsorbency * uWetDarkening
        * (0.08 + wetPool * 0.12)
      + capillaryRim * wetLoad
        * (0.36 + uWetDarkening * 0.28);

    pigmentColor = mix(
      pigmentColor,
      uShadowBand,
      clamp(wetInk, 0.0, 0.58)
    );
    pigmentColor *= mix(0.76, 1.08, brush);
    float brokenBristle = smoothstep(0.34, 0.78, 1.0 - brush)
      * mix(0.45, 1.0, dryness)
      * pigment;
    pigmentColor = mix(
      pigmentColor,
      uShadowBand,
      brokenBristle * (0.12 + uWeathering * 0.2)
    );
    float paintedWaterBand = (sin(vSumiWorldPosition.x * 1.72 + uTime * 0.34)
      * 0.5 + 0.5) * smoothstep(0.46, 0.92, brush) * uWaterFlow;
    pigmentColor = mix(pigmentColor, uLightBand, paintedWaterBand * 0.16);

    float paperFibre = (paper - 0.5) * 2.0;
    pigmentColor += paperFibre * uPaperResponse * (0.04 + dryness * 0.055);
    float granulation = smoothstep(0.12, 0.68, abs(paper - brush))
      * dryness
      * uDryGranulation;
    pigmentColor = mix(pigmentColor, uPaperColor, granulation * (0.06 + (1.0 - pigment) * 0.14));

    // Dry pigment lifts to paper on bristle crossings, while deep brush wells
    // retain dark pooled ink. Both reuse the two existing brush fetches.
    float dryScumble = smoothstep(0.24, 0.74, crossedBristle + abs(paper - brush) * 0.54)
      * mix(0.42, 1.0, dryness)
      * uWeathering;
    float liftedPigment = dryScumble
      * smoothstep(0.42, 0.92, max(brush, paper))
      * (0.08 + (1.0 - wetness) * 0.2)
      * uDryLift;
    pigmentColor = mix(pigmentColor, uPaperColor, liftedPigment);
    float pooledStain = smoothstep(0.42, 0.9, 1.0 - brush)
      * smoothstep(0.18, 0.82, pigment + uInkLoad * 0.24)
      * uWeathering;
    pigmentColor = mix(
      pigmentColor,
      uShadowBand,
      pooledStain * (0.2 + uInkLoad * 0.1)
    );

    // Down-facing forms receive a broad calligraphic underpaint. This grounds
    // rocks, bridge rails and gate beams without a PBR ambient-occlusion pass.
    float undersideInk = (1.0 - smoothstep(-0.44, 0.24, worldNormal.y))
      * uInkLoad;
    float earthStain = (1.0 - smoothstep(0.08, 1.65, vSumiWorldPosition.y))
      * uWeathering;
    pigmentColor = mix(
      pigmentColor,
      uShadowBand,
      clamp(undersideInk * 0.32 + earthStain * (0.14 + (1.0 - brush) * 0.22), 0.0, 0.56)
    );

    // Silhouette ink is view-aware but breakup is sampled in world space, so
    // it does not shimmer or slide like a screen-space edge detector.
    float normalView = abs(dot(worldNormal, viewDirection));
    float contourReach = mix(0.18, 0.58, clamp(uContourWidth, 0.0, 1.0));
    float silhouette = (1.0 - smoothstep(0.055, contourReach, normalView))
      * uSilhouetteStrength;
    float edgeLoad = mix(0.68, 1.0, smoothstep(0.14, 0.84, brush));
    float dryEdgeBreak = silhouette
      * dryness
      * (1.0 - smoothstep(0.3, 0.72, paper));
    pigmentColor = mix(
      pigmentColor,
      uShadowBand,
      silhouette * edgeLoad * (0.58 + pigment * 0.34)
    );
    pigmentColor = mix(pigmentColor, uPaperColor, dryEdgeBreak * uWeathering * 0.11);

    float depthFog = smoothstep(uFogNear, max(uFogFar, uFogNear + 0.001), vSumiViewDepth);
    float belowFogHeight = max(0.0, uFogHeight - vSumiWorldPosition.y);
    float heightFog = 1.0 - exp(-belowFogHeight * max(uFogHeightDensity, 0.0));
    float fog = clamp(
      max(depthFog, heightFog * (1.0 - depthFog)) * uFogOpacity * uFogStrength,
      0.0,
      1.0
    );
    pigmentColor = mix(pigmentColor, uFogColor, fog);

    float alpha = uOpacity;
    float bristleLoss = (1.0 - smoothstep(0.12, 0.68, brush))
      * mix(0.34, 1.0, dryness);
    alpha *= 1.0 - uAlphaFeather
      * max(dryEdgeBreak * (1.0 - brush * 0.54), bristleLoss * 0.82);
    if (alpha < uAlphaCutoff) discard;
    gl_FragColor = vec4(max(pigmentColor, vec3(0.0)), clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <dithering_fragment>
  }
`

export const livingSumiContourVertexShader = /* glsl */ `
  uniform float uContourExpansion;
  varying vec3 vContourWorldPosition;

  void main() {
    vec4 localPosition = vec4(position + normalize(normal) * uContourExpansion, 1.0);

    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif

    vec4 worldPosition = modelMatrix * localPosition;
    vContourWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

export const livingSumiContourFragmentShader = /* glsl */ `
  uniform sampler2D uBrushTexture;
  uniform float uBrushScale;
  uniform vec3 uDryColor;
  uniform vec3 uInkColor;
  varying vec3 vContourWorldPosition;

  void main() {
    vec2 uv = vContourWorldPosition.xz * uBrushScale;
    float brush = texture2D(uBrushTexture, uv).r;
    float dryBreak = smoothstep(0.62, 0.94, brush);
    vec3 contourColor = mix(uInkColor, uDryColor, dryBreak * 0.12);
    gl_FragColor = vec4(contourColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
