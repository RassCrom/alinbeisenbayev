import type { Tier } from './types.ts';

/*
 * What the renderer draws for each thing in the atlas, and where the image
 * touches the ground. Files live under public/atlas/ and are regenerated
 * from public/atlas/PROMPTS.md via scripts/prepare-atlas-assets.py.
 */

export interface SpriteSpec {
  /** URL under public/. */
  src: string;
  /**
   * The point of the image, as fractions of its width and height, that sits
   * on the world position. Islands are centred; three-quarter-view
   * settlements touch the ground about four fifths of the way down.
   */
  anchor: { x: number; y: number };
}

export const islandSprite = (islandId: string): SpriteSpec => ({
  src: `/atlas/island-${islandId}.webp`,
  anchor: { x: 0.5, y: 0.5 },
});

export const SETTLEMENT_SPRITES: Record<Tier, SpriteSpec> = {
  fortress: { src: '/atlas/settlement-fortress.webp', anchor: { x: 0.5, y: 0.8 } },
  'walled-town': { src: '/atlas/settlement-walled-town.webp', anchor: { x: 0.5, y: 0.78 } },
  'market-town': { src: '/atlas/settlement-market-town.webp', anchor: { x: 0.5, y: 0.78 } },
  hamlet: { src: '/atlas/settlement-hamlet.webp', anchor: { x: 0.5, y: 0.76 } },
  ruin: { src: '/atlas/settlement-ruin.webp', anchor: { x: 0.5, y: 0.78 } },
};

/** RGB on black, drawn additively; no alpha channel. */
export const GLOW_SPRITE: SpriteSpec = { src: '/atlas/glow.webp', anchor: { x: 0.5, y: 0.5 } };
/** DOM sprites for the label layer. */
export const CROWN_SRC = '/atlas/crown.webp';
export const PENNANT_SRC = '/atlas/pennant.webp';

/** A settlement sprite is drawn this many footprints wide (half-width), a little past the ground it claims. */
export const SETTLEMENT_SPRITE_SCALE = 1.25;
/** The amber glow under a settlement, in footprints (half-width). */
export const GLOW_SCALE = 2.1;

/** Every texture the WebGL layer needs, by URL. */
export function textureSources(islandIds: readonly string[]): string[] {
  return [
    ...islandIds.map((id) => islandSprite(id).src),
    ...Object.values(SETTLEMENT_SPRITES).map((sprite) => sprite.src),
    GLOW_SPRITE.src,
  ];
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

export async function loadImages(sources: readonly string[]): Promise<Map<string, HTMLImageElement>> {
  const images = await Promise.all(sources.map(loadImage));
  return new Map(sources.map((src, index) => [src, images[index]]));
}
