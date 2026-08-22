import { BlendFunction, Effect } from 'postprocessing'
import { useMemo } from 'react'
import { Uniform, type WebGLRenderer, type WebGLRenderTarget } from 'three'

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;

  float inkHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float inkNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(inkHash(i), inkHash(i + vec2(1.0, 0.0)), f.x),
      mix(inkHash(i + vec2(0.0, 1.0)), inkHash(i + vec2(1.0)), f.x),
      f.y
    );
  }

  float inkFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      value += inkNoise(p) * amplitude;
      p = p * 2.03 + vec2(13.7, 7.9);
      amplitude *= 0.5;
    }
    return value;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float slowTime = uTime * 0.018;
    vec2 flowUv = vec2(uv.x * 3.2 - slowTime, uv.y * 5.1 + slowTime * 0.62);
    float broadWash = inkFbm(flowUv + inkFbm(flowUv * 0.7 + 4.2));
    float paper = inkNoise(floor(uv * vec2(680.0, 430.0)) * 0.31);
    float luma = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
    float edge = length(vec2(dFdx(luma), dFdy(luma)));
    float wetPool = smoothstep(0.5, 0.9, broadWash + (1.0 - luma) * 0.24);

    vec3 color = inputColor.rgb;
    color *= 1.0 - min(edge * 2.4, 0.34) * uStrength;
    color = mix(color, color * vec3(0.76, 0.82, 0.78), wetPool * uStrength * 0.34);
    color += (broadWash - 0.5) * uStrength * 0.035;
    color += (paper - 0.5) * uStrength * 0.012;
    outputColor = vec4(color, inputColor.a);
  }
`

class LivingInkEffectImpl extends Effect {
  private elapsed = 0

  constructor() {
    super('LivingInkEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uStrength', new Uniform(0.38)],
        ['uTime', new Uniform(0)],
      ]),
    })
  }

  update(_renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, deltaTime = 0) {
    this.elapsed += deltaTime
    const time = this.uniforms.get('uTime')
    if (time) time.value = this.elapsed
  }
}

export function LivingInkEffect() {
  const effect = useMemo(() => new LivingInkEffectImpl(), [])
  return <primitive dispose={null} object={effect} />
}
