/*
 * The weather passes, drawn over the composited map (stage 4):
 *
 *   snow    lying snow on the land, from the land mask and the snow-cover
 *           memory, drawn between the islands and the settlements;
 *   grade   a multiply pass: the day, twilight and night tint, and the
 *           shadows the clouds cast, offset along the sun;
 *   sky     a normal-blend pass: cloud puffs drifting with the wind, fog
 *           haze, rain streaks and snowflakes slanted by the wind, and
 *           lightning flashes.
 *
 * All three are procedural: no particle buffers, so nothing to cap but the
 * number of noise octaves and layers, which are fixed. Under reduced motion
 * the caller freezes u_time and the passes render one still frame.
 */

const NOISE = `
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
`;

/** Cloud density at a world point: coverage sets the threshold, the wind moves the field. */
const CLOUDS = `
float cloudAt(vec2 world, vec2 drift, float cover) {
  float shape = fbm(world * 3.2 + drift) * 0.65 + fbm(world * 9.0 + drift * 1.7 + vec2(4.0, 2.0)) * 0.35;
  float threshold = 0.74 - cover * 0.3;
  return smoothstep(threshold, threshold + 0.2, shape) * min(1.0, cover * 1.3);
}
`;

export const SNOW_FRAG = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform sampler2D u_land;
uniform float u_cover;
in vec2 v_uv;
out vec4 outColor;
${NOISE}
void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 world = (frag - u_resolution * 0.5) / u_camera.z + u_camera.xy;
  float land = texture(u_land, vec2(world.x, 1.0 - world.y)).r;
  if (land < 0.02 || u_cover < 0.005) discard;
  // Patches fill in as the cover grows; grain keeps the white from going flat.
  float patches = fbm(world * 26.0 + vec2(3.0, 9.0));
  float grain = fbm(world * 150.0);
  float cover = smoothstep(0.62 - 0.5 * u_cover, 0.74 - 0.36 * u_cover, patches);
  float alpha = land * cover * (0.5 + 0.5 * u_cover) * (0.82 + 0.18 * grain);
  vec3 snow = vec3(0.86, 0.90, 0.96);
  outColor = vec4(snow * alpha, alpha);
}`;

export const GRADE_FRAG = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform float u_time;
uniform float u_day;
uniform float u_dusk;
uniform float u_cloud;
uniform float u_storm;
uniform vec2 u_drift;
uniform vec3 u_sun;
in vec2 v_uv;
out vec4 outColor;
${NOISE}
${CLOUDS}
void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 world = (frag - u_resolution * 0.5) / u_camera.z + u_camera.xy;

  // Night is cool and dim, dawn and dusk warm, day as painted.
  vec3 night = vec3(0.50, 0.60, 0.88) * 0.78;
  vec3 warm = vec3(1.04, 0.90, 0.76);
  vec3 tint = mix(night, vec3(1.0), u_day);
  tint = mix(tint, tint * warm, u_dusk * 0.8);
  // Storm daylight is grey.
  tint *= 1.0 - u_storm * 0.22 * u_day;

  // Cloud shadows fall away from the sun, longer when it is low.
  float reach = 0.03 + 0.05 * (1.0 - u_sun.z);
  vec2 offset = -normalize(u_sun.xy + vec2(1e-4)) * reach;
  float shadow = cloudAt(world + offset, u_drift, u_cloud) * (0.35 + 0.25 * u_storm) * (0.25 + 0.75 * u_day);
  outColor = vec4(tint * (1.0 - shadow), 1.0);
}`;

export const SKY_FRAG = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform float u_time;
uniform float u_day;
uniform float u_cloud;
uniform float u_storm;
uniform float u_haze;
uniform float u_rain;
uniform float u_snow;
uniform float u_flash;
uniform float u_slant;
uniform vec2 u_drift;
in vec2 v_uv;
out vec4 outColor;
${NOISE}
${CLOUDS}

// Screen-space streaks in cells stretched along the fall direction.
float rainLayer(vec2 p, float t, float slant, float scale, float speed, float seed) {
  vec2 dir = normalize(vec2(slant, 1.0));
  vec2 across = vec2(dir.y, -dir.x);
  vec2 q = vec2(dot(p, across) * scale, dot(p, dir) * scale * 0.22);
  q.y -= t * speed;
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float h = hash(cell + seed);
  float on = step(0.7, h);
  float x = 0.15 + 0.7 * fract(h * 13.7);
  float streak = (1.0 - smoothstep(0.0, 0.05, abs(f.x - x))) * smoothstep(0.0, 0.12, f.y) * (1.0 - smoothstep(0.5, 0.9, f.y));
  return on * streak;
}

// Drifting flakes: one per lit cell, swaying as they fall.
float snowLayer(vec2 p, float t, float slant, float scale, float speed, float seed) {
  vec2 dir = normalize(vec2(slant * 0.7, 1.0));
  vec2 across = vec2(dir.y, -dir.x);
  vec2 q = vec2(dot(p, across), dot(p, dir)) * scale;
  q.y -= t * speed;
  q.x += sin(t * 1.1 + q.y * 1.7 + seed) * 0.18;
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(cell + seed);
  float on = step(0.62, h);
  vec2 offset = (vec2(fract(h * 7.1), fract(h * 3.3)) - 0.5) * 0.6;
  float d = length(f - offset);
  return on * (1.0 - smoothstep(0.06, 0.13, d));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 world = (frag - u_resolution * 0.5) / u_camera.z + u_camera.xy;
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // Clouds: white by day, slate at night, darker and denser in a storm.
  float cloud = cloudAt(world, u_drift, u_cloud);
  vec3 cloudDay = mix(vec3(0.93, 0.95, 0.98), vec3(0.42, 0.45, 0.52), u_storm);
  vec3 cloudNight = vec3(0.30, 0.34, 0.44);
  vec3 cloudColor = mix(cloudNight, cloudDay, u_day);
  float cloudAlpha = cloud * (0.42 + 0.14 * u_storm);
  color = cloudColor * cloudAlpha;
  alpha = cloudAlpha;

  // Fog haze: a soft, slowly moving veil over everything.
  float veil = 0.55 + 0.45 * fbm(world * 6.0 + u_drift * 0.5);
  float hazeAlpha = u_haze * 0.42 * veil;
  vec3 hazeColor = mix(vec3(0.42, 0.48, 0.58), vec3(0.80, 0.84, 0.90), u_day);
  color = color * (1.0 - hazeAlpha) + hazeColor * hazeAlpha;
  alpha = alpha * (1.0 - hazeAlpha) + hazeAlpha;

  // Precipitation in screen space so it reads the same at every zoom.
  vec2 px = frag / u_resolution.y * 900.0;
  if (u_rain > 0.01) {
    float drops = rainLayer(px, u_time, u_slant, 0.055, 22.0, 1.0) * 0.55
                + rainLayer(px, u_time, u_slant, 0.035, 15.0, 7.0) * 0.4
                + rainLayer(px, u_time, u_slant * 1.2, 0.09, 30.0, 3.0) * 0.35;
    float rainAlpha = clamp(drops, 0.0, 1.0) * u_rain * 0.6;
    vec3 rainColor = mix(vec3(0.55, 0.62, 0.75), vec3(0.85, 0.9, 0.98), u_day);
    color = color * (1.0 - rainAlpha) + rainColor * rainAlpha;
    alpha = alpha * (1.0 - rainAlpha) + rainAlpha;
  }
  if (u_snow > 0.01) {
    float flakes = snowLayer(px, u_time, u_slant, 0.07, 2.2, 2.0) * 0.9
                 + snowLayer(px, u_time, u_slant, 0.045, 1.4, 9.0) * 0.7
                 + snowLayer(px, u_time, u_slant * 1.3, 0.11, 3.2, 5.0) * 0.5;
    float snowAlpha = clamp(flakes, 0.0, 1.0) * u_snow * 0.9;
    color = color * (1.0 - snowAlpha) + vec3(0.95, 0.97, 1.0) * snowAlpha;
    alpha = alpha * (1.0 - snowAlpha) + snowAlpha;
  }

  // Lightning lights the cloud bellies and the whole scene for a moment.
  color += vec3(0.85, 0.9, 1.0) * u_flash * (0.28 + 0.5 * cloud);

  outColor = vec4(color, alpha);
}`;
