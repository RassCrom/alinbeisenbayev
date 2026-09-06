import { GLOW_SCALE, GLOW_SPRITE, SETTLEMENT_SPRITES, SETTLEMENT_SPRITE_SCALE, islandSprite } from '../assets.ts';
import type { Camera } from '../camera.ts';
import { paintingHalfWidth } from '../layout.ts';
import type { Atlas, Island, Settlement } from '../types.ts';
import type { WeatherLook } from '../weather/sim.ts';
import {
  BLUR_FRAG,
  DIM_FRAG,
  FOG_FRAG,
  FULLSCREEN_VERT,
  MAX_REVEALS,
  SEA_FRAG,
  SPRITE_FRAG,
  SPRITE_VERT,
} from './shaders.ts';
import { GRADE_FRAG, SKY_FRAG, SNOW_FRAG } from './weatherShaders.ts';

/*
 * The WebGL2 layer: one canvas, drawn in order every frame.
 *
 *   1. sea          fullscreen shader: waves, shelf, foam, sea ice, sun glints
 *   2. islands      paintings, back to front by y, tinted for the season
 *   3. snow         lying snow on the land, from the snow-cover memory
 *   4. glow         additive amber under every lit settlement, strongest at night
 *   5. settlements  sprites by tier, back to front by y
 *   6. dim          while a settlement is hovered: darken everything, then
 *                   draw that settlement's glow and sprite again on top
 *   7. grade        multiply: day, twilight and night tint, cloud shadows
 *   8. sky          clouds, fog haze, rain or snow, lightning
 *   9. fog          fog of war, torn open around surveyed settlements
 *
 * Raw WebGL2 rather than a helper library: the needs are a handful of small
 * programs and textured quads. The stage prompt allowed one small helper;
 * none was needed.
 *
 * Textures are uploaded premultiplied, so normal blending is
 * (ONE, ONE_MINUS_SRC_ALPHA), the glow (an RGB image on black) adds with
 * (ONE, ONE), and the grade multiplies with (DST_COLOR, ZERO). The land
 * mask is baked at start-up into an offscreen texture covering the unit
 * world, blurred twice for the coast field and twice more, wider, for the
 * shelf, and handed to the sea, snow and fog shaders.
 */

const MASK_SIZE = 1024;
/** Blur step in mask texels; two passes give a coast field a few texels wide. */
const BLUR_STEP = 1.6;
/** The shelf blur is wider: the shallows reach a good way out from the shore. */
const SHELF_STEP = 7.0;
/** How much the rest of the map darkens under a hovered settlement. */
const DIM_ALPHA = 0.3;
const GLOW_ALPHA = 0.38;
/** The hovered settlement's glow, as a multiple of the resting glow. */
const HOVER_GLOW = 1.9;
/** Cloud drift in world units per second per km/h; exaggerated so it reads. */
const DRIFT_PER_KMH = 0.00035;

/** Everything that changes from frame to frame besides the camera. */
export interface FrameState {
  /** The settlement being dimmed around, and how far the effect has faded in. */
  hoverSlug: string | null;
  hoverStrength: number;
  /** x, y, radius triplets in world units; the first `revealCount` are drawn. */
  reveals: Float32Array;
  revealCount: number;
  /** Overall fog-of-war opacity, 0 to 1. */
  fog: number;
  /** The blended weather look; see weather/sim.ts. */
  weather: WeatherLook;
  /** Seconds the weather animates on; frozen under reduced motion. */
  weatherTime: number;
  /** Where the cloud field has drifted to, in world units, accumulated by the caller. */
  driftX: number;
  driftY: number;
}

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export class AtlasRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly sea: Program;
  private readonly sprite: Program;
  private readonly blur: Program;
  private readonly dim: Program;
  private readonly fog: Program;
  private readonly snow: Program;
  private readonly grade: Program;
  private readonly sky: Program;
  private readonly quad: WebGLVertexArrayObject;
  private readonly empty: WebGLVertexArrayObject;
  private readonly textures = new Map<string, WebGLTexture>();
  private readonly landTexture: WebGLTexture;
  private readonly coastTexture: WebGLTexture;
  private readonly shelfTexture: WebGLTexture;
  private readonly islands: Island[];
  private readonly settlements: Settlement[];
  private readonly bySlug: Map<string, Settlement>;
  private readonly revealBuffer = new Float32Array(MAX_REVEALS * 3);
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    atlas: Atlas,
    images: ReadonlyMap<string, HTMLImageElement>,
  ) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;

    this.sea = createProgram(gl, FULLSCREEN_VERT, SEA_FRAG, [
      'u_resolution', 'u_camera', 'u_time', 'u_coast', 'u_shelf', 'u_land', 'u_sun', 'u_sunlight', 'u_ice',
    ]);
    this.sprite = createProgram(gl, SPRITE_VERT, SPRITE_FRAG, [
      'u_resolution', 'u_camera', 'u_center', 'u_half', 'u_anchor', 'u_tex', 'u_alpha', 'u_tint', 'u_maskMode',
    ]);
    this.blur = createProgram(gl, FULLSCREEN_VERT, BLUR_FRAG, ['u_tex', 'u_step']);
    this.dim = createProgram(gl, FULLSCREEN_VERT, DIM_FRAG, ['u_alpha']);
    this.fog = createProgram(gl, FULLSCREEN_VERT, FOG_FRAG, [
      'u_resolution', 'u_camera', 'u_time', 'u_strength', 'u_shelf', 'u_reveals', 'u_revealCount',
    ]);
    this.snow = createProgram(gl, FULLSCREEN_VERT, SNOW_FRAG, ['u_resolution', 'u_camera', 'u_land', 'u_cover']);
    this.grade = createProgram(gl, FULLSCREEN_VERT, GRADE_FRAG, [
      'u_resolution', 'u_camera', 'u_time', 'u_day', 'u_dusk', 'u_cloud', 'u_storm', 'u_drift', 'u_sun',
    ]);
    this.sky = createProgram(gl, FULLSCREEN_VERT, SKY_FRAG, [
      'u_resolution', 'u_camera', 'u_time', 'u_day', 'u_cloud', 'u_storm', 'u_haze', 'u_rain', 'u_snow',
      'u_flash', 'u_slant', 'u_drift',
    ]);

    this.empty = must(gl.createVertexArray());
    this.quad = must(gl.createVertexArray());
    gl.bindVertexArray(this.quad);
    const buffer = must(gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.sprite.program, 'a_pos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    for (const [src, image] of images) this.textures.set(src, this.uploadTexture(image));

    this.islands = [...atlas.islands].sort((a, b) => a.y - b.y);
    this.settlements = [...atlas.settlements].sort((a, b) => a.y - b.y);
    this.bySlug = new Map(atlas.settlements.map((settlement) => [settlement.slug, settlement]));

    const baked = this.bakeCoast();
    this.landTexture = baked.land;
    this.coastTexture = baked.coast;
    this.shelfTexture = baked.shelf;
  }

  /** Size in CSS pixels and the device pixel ratio to draw at. */
  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, Math.round(width * dpr));
    this.height = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== this.width) this.canvas.width = this.width;
    if (this.canvas.height !== this.height) this.canvas.height = this.height;
  }

  render(camera: Camera, dpr: number, timeSeconds: number, frame: FrameState): void {
    if (this.disposed) return;
    const gl = this.gl;
    const w = frame.weather;
    const cameraDevice: [number, number, number] = [camera.x, camera.y, camera.zoom * dpr];
    const night = 1 - w.day;
    const glowStrength = 0.35 + 0.65 * night;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    // 1. sea
    gl.disable(gl.BLEND);
    gl.useProgram(this.sea.program);
    this.fullscreenUniforms(this.sea, cameraDevice, timeSeconds);
    this.bindTexture(this.coastTexture, 0, this.sea.uniforms.get('u_coast')!);
    this.bindTexture(this.landTexture, 1, this.sea.uniforms.get('u_land')!);
    this.bindTexture(this.shelfTexture, 2, this.sea.uniforms.get('u_shelf')!);
    gl.uniform3f(this.sea.uniforms.get('u_sun')!, w.sunX, w.sunY, w.sunZ);
    gl.uniform1f(this.sea.uniforms.get('u_sunlight')!, w.day * (1 - 0.75 * w.cloud));
    gl.uniform1f(this.sea.uniforms.get('u_ice')!, w.ice);
    gl.bindVertexArray(this.empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. islands
    gl.enable(gl.BLEND);
    gl.useProgram(this.sprite.program);
    gl.bindVertexArray(this.quad);
    gl.uniform2f(this.sprite.uniforms.get('u_resolution')!, this.width, this.height);
    gl.uniform3f(this.sprite.uniforms.get('u_camera')!, ...cameraDevice);
    gl.uniform1i(this.sprite.uniforms.get('u_maskMode')!, 0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const island of this.islands) {
      const half = paintingHalfWidth(island);
      const sprite = islandSprite(island.id);
      this.drawSprite(sprite.src, island.x, island.y, half, half, sprite.anchor.x, sprite.anchor.y, 1, [w.tintR, w.tintG, w.tintB]);
    }

    // 3. snow on the land
    if (w.snowCover > 0.005) {
      gl.useProgram(this.snow.program);
      gl.bindVertexArray(this.empty);
      gl.uniform2f(this.snow.uniforms.get('u_resolution')!, this.width, this.height);
      gl.uniform3f(this.snow.uniforms.get('u_camera')!, ...cameraDevice);
      gl.uniform1f(this.snow.uniforms.get('u_cover')!, w.snowCover);
      this.bindTexture(this.landTexture, 0, this.snow.uniforms.get('u_land')!);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(this.sprite.program);
      gl.bindVertexArray(this.quad);
    }

    // 4 and 5. glows, settlements
    gl.blendFunc(gl.ONE, gl.ONE);
    for (const settlement of this.settlements) this.drawGlow(settlement, GLOW_ALPHA * glowStrength);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const settlement of this.settlements) this.drawSettlement(settlement);

    // 6. dim, then the hovered settlement again on top, a little brighter
    const hovered = frame.hoverSlug ? this.bySlug.get(frame.hoverSlug) : undefined;
    if (hovered && frame.hoverStrength > 0.002) {
      gl.useProgram(this.dim.program);
      gl.bindVertexArray(this.empty);
      gl.uniform1f(this.dim.uniforms.get('u_alpha')!, DIM_ALPHA * frame.hoverStrength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(this.sprite.program);
      gl.bindVertexArray(this.quad);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.drawGlow(hovered, GLOW_ALPHA * glowStrength * (1 + (HOVER_GLOW - 1) * frame.hoverStrength));
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.drawSettlement(hovered);
    }

    // 7. grade (multiply)
    gl.useProgram(this.grade.program);
    gl.bindVertexArray(this.empty);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    this.fullscreenUniforms(this.grade, cameraDevice, frame.weatherTime);
    gl.uniform1f(this.grade.uniforms.get('u_day')!, w.day);
    gl.uniform1f(this.grade.uniforms.get('u_dusk')!, w.dusk);
    gl.uniform1f(this.grade.uniforms.get('u_cloud')!, w.cloud);
    gl.uniform1f(this.grade.uniforms.get('u_storm')!, w.storm);
    gl.uniform2f(this.grade.uniforms.get('u_drift')!, frame.driftX, frame.driftY);
    gl.uniform3f(this.grade.uniforms.get('u_sun')!, w.sunX, w.sunY, w.sunZ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 8. sky
    gl.useProgram(this.sky.program);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.fullscreenUniforms(this.sky, cameraDevice, frame.weatherTime);
    gl.uniform1f(this.sky.uniforms.get('u_day')!, w.day);
    gl.uniform1f(this.sky.uniforms.get('u_cloud')!, w.cloud);
    gl.uniform1f(this.sky.uniforms.get('u_storm')!, w.storm);
    gl.uniform1f(this.sky.uniforms.get('u_haze')!, w.haze);
    gl.uniform1f(this.sky.uniforms.get('u_rain')!, w.rain);
    gl.uniform1f(this.sky.uniforms.get('u_snow')!, w.snow);
    gl.uniform1f(this.sky.uniforms.get('u_flash')!, w.flash);
    // Precipitation leans with the wind's east-west push; strong wind lays it nearly flat.
    gl.uniform1f(this.sky.uniforms.get('u_slant')!, Math.max(-1.2, Math.min(1.2, (w.windX * w.windSpeed) / 35)));
    gl.uniform2f(this.sky.uniforms.get('u_drift')!, frame.driftX, frame.driftY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 9. fog of war
    if (frame.fog > 0.002) {
      gl.useProgram(this.fog.program);
      this.fullscreenUniforms(this.fog, cameraDevice, timeSeconds);
      gl.uniform1f(this.fog.uniforms.get('u_strength')!, frame.fog);
      this.bindTexture(this.shelfTexture, 0, this.fog.uniforms.get('u_shelf')!);
      const count = Math.min(frame.revealCount, MAX_REVEALS);
      this.revealBuffer.set(frame.reveals.subarray(0, count * 3));
      gl.uniform3fv(this.fog.uniforms.get('u_reveals')!, this.revealBuffer);
      gl.uniform1i(this.fog.uniforms.get('u_revealCount')!, count);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindVertexArray(null);
  }

  /** How far the cloud field moves in one frame, for the caller to accumulate. */
  static drift(weather: WeatherLook, dt: number): { x: number; y: number } {
    const speed = weather.windSpeed * DRIFT_PER_KMH * dt;
    return { x: weather.windX * speed, y: weather.windY * speed };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const texture of this.textures.values()) gl.deleteTexture(texture);
    gl.deleteTexture(this.landTexture);
    gl.deleteTexture(this.coastTexture);
    gl.deleteTexture(this.shelfTexture);
    for (const program of [this.sea, this.sprite, this.blur, this.dim, this.fog, this.snow, this.grade, this.sky]) {
      gl.deleteProgram(program.program);
    }
    gl.deleteVertexArray(this.quad);
    gl.deleteVertexArray(this.empty);
    // Deliberately no loseContext(): React remounts this view on hot updates
    // and under StrictMode, on the same canvas, and a lost context cannot
    // compile the next renderer's shaders. The GPU memory above is freed;
    // the context itself goes with the canvas.
  }

  /* ---- internals ------------------------------------------------------ */

  private fullscreenUniforms(program: Program, cameraDevice: [number, number, number], time: number): void {
    const gl = this.gl;
    gl.uniform2f(program.uniforms.get('u_resolution')!, this.width, this.height);
    gl.uniform3f(program.uniforms.get('u_camera')!, ...cameraDevice);
    const timeLocation = program.uniforms.get('u_time');
    if (timeLocation) gl.uniform1f(timeLocation, time);
  }

  private drawGlow(settlement: Settlement, alpha: number): void {
    if (settlement.tier === 'ruin') return;
    const half = settlement.footprint * GLOW_SCALE;
    this.drawSprite(GLOW_SPRITE.src, settlement.x, settlement.y, half, half, 0.5, 0.5, alpha);
  }

  private drawSettlement(settlement: Settlement): void {
    const sprite = SETTLEMENT_SPRITES[settlement.tier];
    const half = settlement.footprint * SETTLEMENT_SPRITE_SCALE;
    this.drawSprite(sprite.src, settlement.x, settlement.y, half, half, sprite.anchor.x, sprite.anchor.y, 1);
  }

  private drawSprite(
    src: string,
    x: number,
    y: number,
    halfWidth: number,
    halfHeight: number,
    anchorX: number,
    anchorY: number,
    alpha: number,
    tint: [number, number, number] = [1, 1, 1],
  ): void {
    const texture = this.textures.get(src);
    if (!texture) return;
    const gl = this.gl;
    const u = this.sprite.uniforms;
    gl.uniform2f(u.get('u_center')!, x, y);
    gl.uniform2f(u.get('u_half')!, halfWidth, halfHeight);
    gl.uniform2f(u.get('u_anchor')!, anchorX, anchorY);
    gl.uniform1f(u.get('u_alpha')!, alpha);
    gl.uniform3f(u.get('u_tint')!, tint[0], tint[1], tint[2]);
    this.bindTexture(texture, 0, u.get('u_tex')!);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private bindTexture(texture: WebGLTexture, unit: number, location: WebGLUniformLocation): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
  }

  private uploadTexture(image: HTMLImageElement): WebGLTexture {
    const gl = this.gl;
    const texture = must(gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropy) {
      const max = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, max));
    }
    return texture;
  }

  private createTarget(): { texture: WebGLTexture; framebuffer: WebGLFramebuffer } {
    const gl = this.gl;
    const texture = must(gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MASK_SIZE, MASK_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = must(gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, framebuffer };
  }

  /**
   * Draw every island's alpha into a unit-world texture (the land mask),
   * blur it twice into the narrow coast field that shapes the foam, then
   * blur that much wider into the shelf field that colours the shallows and
   * carries the fog. Islands never move, so this runs once.
   */
  private bakeCoast(): { land: WebGLTexture; coast: WebGLTexture; shelf: WebGLTexture } {
    const gl = this.gl;
    const land = this.createTarget();
    const temp = this.createTarget();
    const coast = this.createTarget();
    const shelf = this.createTarget();

    gl.bindFramebuffer(gl.FRAMEBUFFER, land.framebuffer);
    gl.viewport(0, 0, MASK_SIZE, MASK_SIZE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.sprite.program);
    gl.bindVertexArray(this.quad);
    gl.uniform2f(this.sprite.uniforms.get('u_resolution')!, MASK_SIZE, MASK_SIZE);
    gl.uniform3f(this.sprite.uniforms.get('u_camera')!, 0.5, 0.5, MASK_SIZE);
    gl.uniform1i(this.sprite.uniforms.get('u_maskMode')!, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (const island of this.islands) {
      const half = paintingHalfWidth(island);
      this.drawSprite(islandSprite(island.id).src, island.x, island.y, half, half, 0.5, 0.5, 1);
    }
    gl.disable(gl.BLEND);
    gl.uniform1i(this.sprite.uniforms.get('u_maskMode')!, 0);

    gl.useProgram(this.blur.program);
    gl.bindVertexArray(this.empty);
    const pass = (from: WebGLTexture, to: WebGLFramebuffer, stepX: number, stepY: number): void => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, to);
      this.bindTexture(from, 0, this.blur.uniforms.get('u_tex')!);
      gl.uniform2f(this.blur.uniforms.get('u_step')!, stepX, stepY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const step = BLUR_STEP / MASK_SIZE;
    pass(land.texture, temp.framebuffer, step, 0);
    pass(temp.texture, coast.framebuffer, 0, step);
    const wide = SHELF_STEP / MASK_SIZE;
    pass(coast.texture, temp.framebuffer, wide, 0);
    pass(temp.texture, shelf.framebuffer, 0, wide);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const target of [land, temp, coast, shelf]) gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(temp.texture);
    return { land: land.texture, coast: coast.texture, shelf: shelf.texture };
  }
}

function must<T>(value: T | null): T {
  if (value === null) throw new Error('WebGL resource allocation failed');
  return value;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  uniformNames: readonly string[],
): Program {
  const compile = (type: number, source: string): WebGLShader => {
    const shader = must(gl.createShader(type));
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
      gl.deleteShader(shader);
      throw new Error(`shader failed to compile: ${log}`);
    }
    return shader;
  };
  const program = must(gl.createProgram());
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown error';
    gl.deleteProgram(program);
    throw new Error(`program failed to link: ${log}`);
  }
  const uniforms = new Map(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)]));
  return { program, uniforms };
}
