/*
 * GLSL ES 3.00 sources for the atlas. Three programs:
 *
 *   sea     a fullscreen pass: deep navy water with slow noise, thin wave
 *           highlights, a lighter shelf and animated foam next to land, read
 *           from a blurred land mask baked once at start-up;
 *   sprite  a textured quad in world units: island paintings, settlements
 *           and the additive glow. In mask mode it writes the alpha as grey,
 *           which is how the land mask is baked;
 *   blur    a separable Gaussian over a texture, run twice on the land mask
 *           to get a soft "distance to coast" field.
 *
 * Screen space is device pixels, y down; u_camera is (x, y, zoom) with zoom
 * in device pixels per world unit. The mask textures cover the unit world
 * with row 0 at the bottom, so they are sampled at (x, 1 - y).
 */

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  // One triangle covering the screen: vertices (-1,-1), (3,-1), (-1,3).
  vec2 pos = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  v_uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

export const SEA_FRAG = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform float u_time;
uniform sampler2D u_coast;
uniform sampler2D u_land;
in vec2 v_uv;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 world = (frag - u_resolution * 0.5) / u_camera.z + u_camera.xy;
  vec2 maskUv = vec2(world.x, 1.0 - world.y);
  float coast = texture(u_coast, maskUv).r;
  float land = texture(u_land, maskUv).r;

  vec3 deep = vec3(0.024, 0.062, 0.125);
  vec3 mid = vec3(0.052, 0.125, 0.235);
  vec3 shelf = vec3(0.10, 0.34, 0.42);
  vec3 foamColor = vec3(0.86, 0.92, 0.96);

  // Broad, slow swell at low contrast, so the sea reads as one dark body
  // rather than blotches; finer ripples add a faint moving sheen.
  float swell = fbm(world * 9.0 + vec2(u_time * 0.012, -u_time * 0.008));
  vec3 color = mix(deep, mid, 0.35 + 0.5 * swell);
  float ripple = fbm(world * 160.0 + vec2(u_time * 0.05, u_time * 0.035));
  color += vec3(0.035, 0.06, 0.09) * smoothstep(0.55, 0.78, ripple);

  // Lighter, greener water over the shelf next to land.
  float shelfMix = smoothstep(0.0, 0.5, coast) * (1.0 - land);
  color = mix(color, shelf, shelfMix * 0.55);

  // Foam: a band hugging the coast, broken up by drifting noise.
  float band = smoothstep(0.16, 0.5, coast) * (1.0 - land);
  float breakup = fbm(world * 420.0 + vec2(u_time * 0.25, u_time * 0.17));
  float foam = band * smoothstep(0.42, 0.72, breakup + band * 0.3);
  color = mix(color, foamColor, foam * 0.75);

  // Cinematic vignette.
  vec2 q = v_uv - 0.5;
  color *= 1.0 - dot(q, q) * 0.85;
  outColor = vec4(color, 1.0);
}`;

export const SPRITE_VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform vec2 u_center;
uniform vec2 u_half;
uniform vec2 u_anchor;
out vec2 v_uv;
void main() {
  vec2 world = u_center + (a_pos - u_anchor) * u_half * 2.0;
  vec2 screen = (world - u_camera.xy) * u_camera.z + u_resolution * 0.5;
  vec2 clip = vec2(screen.x / u_resolution.x * 2.0 - 1.0, 1.0 - screen.y / u_resolution.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_pos;
}`;

export const SPRITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform vec3 u_tint;
uniform int u_maskMode;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 texel = texture(u_tex, v_uv);
  if (u_maskMode == 1) {
    outColor = vec4(vec3(texel.a), 1.0);
  } else {
    outColor = vec4(texel.rgb * u_tint, texel.a) * u_alpha;
  }
}`;

export const BLUR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_step;
in vec2 v_uv;
out vec4 outColor;
void main() {
  // 13 taps, sigma about 3 steps.
  float weights[7] = float[7](0.1974, 0.1747, 0.1210, 0.0656, 0.0278, 0.0092, 0.0024);
  vec3 sum = texture(u_tex, v_uv).rgb * weights[0];
  for (int i = 1; i < 7; i++) {
    vec2 offset = u_step * float(i);
    sum += texture(u_tex, v_uv + offset).rgb * weights[i];
    sum += texture(u_tex, v_uv - offset).rgb * weights[i];
  }
  outColor = vec4(sum, 1.0);
}`;
