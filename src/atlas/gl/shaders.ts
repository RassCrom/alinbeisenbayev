/*
 * GLSL ES 3.00 sources for the atlas. Three programs:
 *
 *   sea     a fullscreen pass: a lit wave surface (three directional wave
 *           trains plus noise chop, normals by finite differences, key light
 *           from the upper right), depth colour with a sandy bottom in the
 *           shallows, wave-broken shore foam and sparse whitecaps, all read
 *           against a blurred land mask baked once at start-up;
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
uniform sampler2D u_shelf;
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
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

// Wave height in arbitrary units: three directional trains and a noise
// chop. Each train fades out once its wavelength drops under a few screen
// pixels, so the sea shimmers at the fitted view instead of aliasing, and
// gains detail as the camera comes closer.
float train(vec2 p, vec2 dir, float k, float speed, float t, float zoom) {
  float visible = smoothstep(2.5, 7.0, 6.2831853 / k * zoom);
  return visible * sin(dot(p, dir) * k + t * speed);
}
float waves(vec2 p, float t, float zoom) {
  // Bend the crests with a slow warp so no train reads as straight hatching.
  vec2 warp = (vec2(fbm(p * 45.0 + t * 0.015), fbm(p * 45.0 + vec2(5.2, 1.3) - t * 0.012)) - 0.5) * 0.012;
  vec2 q = p + warp;
  float h = 0.0;
  h += 0.42 * train(q, vec2(0.83, 0.55), 600.0, 1.1, t, zoom);
  h += 0.30 * train(q, vec2(-0.40, 0.92), 1000.0, -1.5, t, zoom);
  h += 0.18 * train(q, vec2(0.98, -0.20), 1700.0, 2.2, t, zoom);
  h += 0.80 * (fbm(q * 520.0 + vec2(t * 0.05, -t * 0.035)) - 0.5);
  return h;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float zoom = u_camera.z;
  vec2 world = (frag - u_resolution * 0.5) / zoom + u_camera.xy;
  vec2 maskUv = vec2(world.x, 1.0 - world.y);
  float coast = texture(u_coast, maskUv).r;
  float shelf = texture(u_shelf, maskUv).r;
  float land = texture(u_land, maskUv).r;
  float t = u_time;

  // Surface normal from the height field by finite differences, one and a
  // half pixels apart so the slope stays stable across zoom levels.
  float eps = 1.5 / zoom;
  float h0 = waves(world, t, zoom);
  float hx = waves(world + vec2(eps, 0.0), t, zoom);
  float hy = waves(world + vec2(0.0, eps), t, zoom);
  float steep = 0.0009 / eps;
  vec3 normal = normalize(vec3(-(hx - h0) * steep, -(hy - h0) * steep, 1.0));

  // Key light from the upper right, as in the paintings; the camera looks
  // straight down, so the half vector is nearly the light itself.
  vec3 lightDir = normalize(vec3(0.55, -0.45, 0.70));
  vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float lambert = clamp(dot(normal, lightDir), 0.0, 1.0);
  float glint = pow(max(dot(normal, halfDir), 0.0), 110.0);

  // Depth. The shelf field is a wide blur of the land mask: 0 in open
  // water, rising over the last stretch before the shore. The coast field is
  // the narrow one, for foam.
  // Sandbanks make the shelf uneven, so it never reads as a halo.
  float banks = fbm(world * 55.0 + vec2(11.0, 3.0));
  float shallow = clamp(smoothstep(0.02, 0.48, shelf) * (0.45 + 0.8 * banks), 0.0, 1.0) * (1.0 - land);
  vec3 deep = vec3(0.018, 0.050, 0.108);
  vec3 mid = vec3(0.040, 0.105, 0.200);
  vec3 teal = vec3(0.055, 0.270, 0.340);
  vec3 lagoon = vec3(0.17, 0.47, 0.50);
  vec3 sand = vec3(0.58, 0.53, 0.41);
  float swell = fbm(world * 7.0 + vec2(t * 0.010, -t * 0.007));
  vec3 color = mix(deep, mid, 0.25 + 0.55 * swell);
  color = mix(color, teal, shallow * 0.7);
  color = mix(color, lagoon, pow(shallow, 2.5) * 0.5);
  // The bottom shows through in the shallows: sand ripples and the light
  // net that moving water throws on it.
  float bottom = fbm(world * 240.0 + vec2(3.1, 7.7));
  float caustic = pow(fbm(world * 420.0 + vec2(t * 0.09, -t * 0.06)), 3.0);
  color = mix(color, sand, pow(shallow, 3.0) * 0.28 * bottom);
  color += vec3(0.22, 0.36, 0.36) * caustic * pow(shallow, 2.5);
  // Shading from the wave slopes, kept gentle so the sea stays dark.
  color *= 0.90 + 0.16 * lambert;

  // Foam. At the shore, a band whose inner edge is broken by the waves and
  // by drifting noise; in open water, sparse whitecaps on the highest crests
  // where the wind patches are.
  float band = smoothstep(0.14, 0.5, coast) * (1.0 - land);
  float edge = smoothstep(0.36, 0.5, coast) * (1.0 - land);
  float breakup = fbm(world * 380.0 + vec2(t * 0.22, t * 0.16));
  float shoreFoam = band * smoothstep(0.34, 0.80, breakup * 0.7 + band * 0.5 + h0 * 0.2);
  float wind = smoothstep(0.52, 0.72, fbm(world * 28.0 + vec2(t * 0.02, 0.0)));
  float cap = smoothstep(1.00, 1.30, h0) * wind * (1.0 - band);
  float foam = clamp(shoreFoam * 0.8 + edge * (0.55 + 0.35 * breakup) + cap * 0.9, 0.0, 1.0);
  vec3 foamColor = vec3(0.88, 0.93, 0.96);
  color = mix(color, foamColor, foam);

  // Specular glints, brighter over the shallows where the water is lively.
  color += vec3(0.85, 0.92, 1.0) * glint * (0.28 + 0.55 * shallow) * (1.0 - foam);

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
