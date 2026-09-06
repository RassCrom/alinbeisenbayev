/*
 * Export chart (stage 7): the current view as a PNG, HUD and labels
 * included, with no library. The WebGL canvas is copied the moment after a
 * render; the DOM layers above it are cloned into an SVG foreignObject with
 * their computed styles written inline (the atlas stylesheet and its custom
 * properties do not reach an SVG image) and every image turned into a data
 * URL (an SVG image loads nothing from the network). The web fonts are not
 * embedded, so the chart falls back to Georgia; the moving parts a still
 * cannot carry (the slider track, the select) are simplified to text.
 */

interface ExportOptions {
  glCanvas: HTMLCanvasElement;
  container: HTMLElement;
  /** Draws the current frame into the WebGL canvas; called synchronously just before it is copied. */
  render: () => void;
  caption: string;
  fileName: string;
}

const STYLE_PROPS = [
  'display',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'width',
  'height',
  'min-width',
  'max-width',
  'margin',
  'padding',
  'border',
  'border-radius',
  'background',
  'box-shadow',
  'box-sizing',
  'color',
  'font',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'line-height',
  'text-transform',
  'text-align',
  'text-decoration',
  'white-space',
  'opacity',
  'visibility',
  'transform',
  'transform-origin',
  'flex',
  'flex-direction',
  'flex-wrap',
  'flex-shrink',
  'align-items',
  'align-self',
  'justify-content',
  'gap',
  'overflow',
  'z-index',
  'vertical-align',
  'object-fit',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'stroke-linecap',
  'text-anchor',
  'dominant-baseline',
];

const OVERLAY = '.atlas-lanes, .atlas-labels, .atlas-focus, .atlas-hud, .atlas-moon';
const DROP = '.atlas-chronicle__track, .atlas-status';

const imageCache = new Map<string, string>();

function toDataUrl(image: HTMLImageElement): string {
  const cached = imageCache.get(image.src);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || 1;
  canvas.height = image.naturalHeight || 1;
  const ctx = canvas.getContext('2d');
  let url = '';
  try {
    ctx?.drawImage(image, 0, 0);
    url = canvas.toDataURL('image/png');
  } catch {
    url = '';
  }
  imageCache.set(image.src, url);
  return url;
}

/** Copy the properties that shape the element from its live twin onto the clone. */
function inlineStyles(source: Element, clone: Element): void {
  const computed = getComputedStyle(source);
  const style = (clone as HTMLElement).style;
  for (const prop of STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value) style.setProperty(prop, value);
  }
  // A glass panel's blur cannot render in an SVG image; a solid ground stands in.
  if (source.classList.contains('atlas-hud')) style.setProperty('background', 'rgba(7, 13, 24, 0.9)');
  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    const twin = cloneChildren[index];
    if (twin) inlineStyles(child, twin);
  });
}

function cloneOverlay(container: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const rect = container.getBoundingClientRect();
  wrapper.style.cssText = `position:relative;width:${rect.width}px;height:${rect.height}px;overflow:hidden;font-family:Georgia,serif;`;
  for (const layer of container.querySelectorAll<HTMLElement>(OVERLAY)) {
    const clone = layer.cloneNode(true) as HTMLElement;
    inlineStyles(layer, clone);
    clone.querySelectorAll(DROP).forEach((node) => node.remove());
    // The weather picker becomes its chosen text.
    clone.querySelectorAll('select').forEach((select) => {
      const live = layer.querySelectorAll('select')[Array.from(clone.querySelectorAll('select')).indexOf(select)];
      const span = document.createElement('span');
      span.textContent = live?.selectedOptions[0]?.textContent ?? '';
      span.style.cssText = 'font: inherit; color: inherit;';
      select.replaceWith(span);
    });
    clone.querySelectorAll('input, button').forEach((node) => {
      if (node instanceof HTMLInputElement) node.remove();
    });
    // Images: live pixels as data URLs, since the SVG image cannot fetch.
    const liveImages = Array.from(layer.querySelectorAll('img'));
    clone.querySelectorAll('img').forEach((img, index) => {
      const live = liveImages[index];
      img.removeAttribute('srcset');
      img.setAttribute('src', live ? toDataUrl(live) : '');
    });
    const liveHrefs = Array.from(layer.querySelectorAll('image'));
    clone.querySelectorAll('image').forEach((node, index) => {
      const href = liveHrefs[index]?.getAttribute('href') ?? '';
      const live = document.createElement('img');
      live.src = href;
      node.setAttribute('href', live.complete && live.naturalWidth > 0 ? toDataUrl(live) : href);
    });
    wrapper.appendChild(clone);
  }
  return wrapper;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('the overlay could not be rasterised'));
    image.src = url;
  });
}

export async function exportChart({ glCanvas, container, render, caption, fileName }: ExportOptions): Promise<void> {
  const rect = container.getBoundingClientRect();
  const width = glCanvas.width;
  const height = glCanvas.height;
  const scale = width / Math.max(1, rect.width);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');

  // The WebGL buffer is only certain to hold pixels right after a draw.
  render();
  ctx.drawImage(glCanvas, 0, 0);

  const overlay = cloneOverlay(container);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(overlay)}</foreignObject></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    ctx.drawImage(image, 0, 0, rect.width * scale, rect.height * scale);
  } finally {
    URL.revokeObjectURL(url);
  }

  // Cartouche along the top edge.
  ctx.save();
  ctx.scale(scale, scale);
  ctx.font = '500 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const paddingX = 14;
  const textWidth = ctx.measureText(caption).width + paddingX * 2;
  const x = rect.width / 2;
  ctx.fillStyle = 'rgba(7, 13, 24, 0.82)';
  ctx.fillRect(x - textWidth / 2, 14, textWidth, 28);
  ctx.strokeStyle = 'rgba(214, 182, 110, 0.5)';
  ctx.strokeRect(x - textWidth / 2 + 0.5, 14.5, textWidth - 1, 27);
  ctx.fillStyle = '#ebe1c9';
  ctx.fillText(caption, x, 21);
  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('the chart could not be encoded');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
