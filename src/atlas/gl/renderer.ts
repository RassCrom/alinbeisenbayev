import { GLOW_SCALE, GLOW_SPRITE, SETTLEMENT_SPRITES, SETTLEMENT_SPRITE_SCALE, islandSprite } from '../assets.ts';
import type { Camera } from '../camera.ts';
import { paintingHalfWidth } from '../layout.ts';
import type { Atlas, Island, Settlement } from '../types.ts';
import { BLUR_FRAG, FULLSCREEN_VERT, SEA_FRAG, SPRITE_FRAG, SPRITE_VERT } from './shaders.ts';

/*
 * The WebGL2 layer: one canvas, drawn in order every frame.
 *
 *   1. sea        fullscreen shader, reads the baked coast field
 *   2. islands    paintings, back to front by y
 *   3. glow       additive amber under every lit settlement
 *   4. settlements sprites by tier, back to front by y
 *
 * Raw WebGL2 rather than a helper library: the needs are three small
 * programs and textured quads, and the whole thing is under 300 lines. The
 * stage prompt allowed one small helper; none was needed.
 *
 * Textures are uploaded premultiplied, so normal blending is
 * (ONE, ONE_MINUS_SRC_ALPHA) and the glow, an RGB image on black, adds with
 * (ONE, ONE). The land mask is baked at start-up into an offscreen texture
 * covering the unit world, blurred twice, and handed to the sea shader.
 */

const MASK_SIZE = 1024;
/** Blur step in mask texels; two passes give a coast field a few texels wide. */
const BLUR_STEP = 1.6;

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export class AtlasRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly sea: Program;
  private readonly sprite: Program;
  private readonly blur: Program;
  private readonly quad: WebGLVertexArrayObject;
  private readonly empty: WebGLVertexArrayObject;
  private readonly textures = new Map<string, WebGLTexture>();
  private readonly landTexture: WebGLTexture;
  private readonly coastTexture: WebGLTexture;
  private readonly islands: Island[];
  private readonly settlements: Settlement[];
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

    this.sea = createProgram(gl, FULLSCREEN_VERT, SEA_FRAG, ['u_resolution', 'u_camera', 'u_time', 'u_coast', 'u_land']);
    this.sprite = createProgram(gl, SPRITE_VERT, SPRITE_FRAG, [
      'u_resolution', 'u_camera', 'u_center', 'u_half', 'u_anchor', 'u_tex', 'u_alpha', 'u_tint', 'u_maskMode',
    ]);
    this.blur = createProgram(gl, FULLSCREEN_VERT, BLUR_FRAG, ['u_tex', 'u_step']);

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

    const baked = this.bakeCoast();
    this.landTexture = baked.land;
    this.coastTexture = baked.coast;
  }

  /** Size in CSS pixels and the device pixel ratio to draw at. */
  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, Math.round(width * dpr));
    this.height = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== this.width) this.canvas.width = this.width;
    if (this.canvas.height !== this.height) this.canvas.height = this.height;
  }

  /**
   * One frame. `night` scales the window glow, 1 for the dark grade;
   * stage 4 drives it from sunrise and sunset.
   */
  render(camera: Camera, dpr: number, timeSeconds: number, night = 1): void {
    if (this.disposed) return;
    const gl = this.gl;
    const cameraDevice: [number, number, number] = [camera.x, camera.y, camera.zoom * dpr];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    gl.disable(gl.BLEND);
    gl.useProgram(this.sea.program);
    gl.uniform2f(this.sea.uniforms.get('u_resolution')!, this.width, this.height);
    gl.uniform3f(this.sea.uniforms.get('u_camera')!, ...cameraDevice);
    gl.uniform1f(this.sea.uniforms.get('u_time')!, timeSeconds);
    this.bindTexture(this.coastTexture, 0, this.sea.uniforms.get('u_coast')!);
    this.bindTexture(this.landTexture, 1, this.sea.uniforms.get('u_land')!);
    gl.bindVertexArray(this.empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

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
      this.drawSprite(sprite.src, island.x, island.y, half, half, sprite.anchor.x, sprite.anchor.y, 1);
    }

    gl.blendFunc(gl.ONE, gl.ONE);
    for (const settlement of this.settlements) {
      if (settlement.tier === 'ruin') continue;
      const half = settlement.footprint * GLOW_SCALE;
      this.drawSprite(GLOW_SPRITE.src, settlement.x, settlement.y, half, half, 0.5, 0.5, 0.38 * night);
    }

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const settlement of this.settlements) {
      const sprite = SETTLEMENT_SPRITES[settlement.tier];
      const half = settlement.footprint * SETTLEMENT_SPRITE_SCALE;
      this.drawSprite(sprite.src, settlement.x, settlement.y, half, half, sprite.anchor.x, sprite.anchor.y, 1);
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const texture of this.textures.values()) gl.deleteTexture(texture);
    gl.deleteTexture(this.landTexture);
    gl.deleteTexture(this.coastTexture);
    gl.deleteProgram(this.sea.program);
    gl.deleteProgram(this.sprite.program);
    gl.deleteProgram(this.blur.program);
    gl.deleteVertexArray(this.quad);
    gl.deleteVertexArray(this.empty);
    // Deliberately no loseContext(): React remounts this view on hot updates
    // and under StrictMode, on the same canvas, and a lost context cannot
    // compile the next renderer's shaders. The GPU memory above is freed;
    // the context itself goes with the canvas.
  }

  /* ---- internals ------------------------------------------------------ */

  private drawSprite(
    src: string,
    x: number,
    y: number,
    halfWidth: number,
    halfHeight: number,
    anchorX: number,
    anchorY: number,
    alpha: number,
  ): void {
    const texture = this.textures.get(src);
    if (!texture) return;
    const gl = this.gl;
    const u = this.sprite.uniforms;
    gl.uniform2f(u.get('u_center')!, x, y);
    gl.uniform2f(u.get('u_half')!, halfWidth, halfHeight);
    gl.uniform2f(u.get('u_anchor')!, anchorX, anchorY);
    gl.uniform1f(u.get('u_alpha')!, alpha);
    gl.uniform3f(u.get('u_tint')!, 1, 1, 1);
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
   * then blur it twice into the coast field the sea shader reads. Islands
   * never move, so this runs once.
   */
  private bakeCoast(): { land: WebGLTexture; coast: WebGLTexture } {
    const gl = this.gl;
    const land = this.createTarget();
    const temp = this.createTarget();
    const coast = this.createTarget();

    gl.bindFramebuffer(gl.FRAMEBUFFER, land.framebuffer);
    gl.viewport(0, 0, MASK_SIZE, MASK_SIZE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
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
    const step = BLUR_STEP / MASK_SIZE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, temp.framebuffer);
    this.bindTexture(land.texture, 0, this.blur.uniforms.get('u_tex')!);
    gl.uniform2f(this.blur.uniforms.get('u_step')!, step, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, coast.framebuffer);
    this.bindTexture(temp.texture, 0, this.blur.uniforms.get('u_tex')!);
    gl.uniform2f(this.blur.uniforms.get('u_step')!, 0, step);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(land.framebuffer);
    gl.deleteFramebuffer(temp.framebuffer);
    gl.deleteFramebuffer(coast.framebuffer);
    gl.deleteTexture(temp.texture);
    return { land: land.texture, coast: coast.texture };
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
