import type { MapPalette } from '../../data/gta-palettes';
import { useCopy } from '../../hooks/useCopy';
import Icon from '../Icon/Icon';

/** The text "Copy all" puts on the clipboard: one colour per line. */
export function paletteText(palette: MapPalette): string {
  const sea = palette.sea.map((stop) => stop.hex).join(' > ');
  return [...palette.colours.map((c) => `${c.name} ${c.hex}`), `Sea ${sea}`].join('\n');
}

/**
 * A map style's colours for a blog post. Every swatch is a button that copies
 * its hex, so a reader can paste it straight into QGIS or a design tool.
 */
export default function Palette({ palette }: { palette: MapPalette }) {
  const { copied, copy } = useCopy();
  const last = palette.sea[palette.sea.length - 1].at;
  const ramp = palette.sea.map((stop) => `${stop.hex} ${(stop.at / last) * 100}%`).join(', ');

  return (
    <section className="palette" aria-label={`${palette.name} colours`}>
      <div className="palette__head">
        <p className="palette__title">{palette.name} colours</p>
        <button type="button" className="palette__all focus-ring" onClick={() => copy(paletteText(palette), 'all')}>
          {copied === 'all' ? 'Copied' : 'Copy all'}
          <Icon name={copied === 'all' ? 'check' : 'copy'} size={18} />
        </button>
      </div>

      <ul className="palette__grid">
        {palette.colours.map((colour) => (
          <li key={colour.name}>
            <button
              type="button"
              className="swatch focus-ring"
              onClick={() => copy(colour.hex, colour.name)}
              aria-label={`Copy ${colour.name} ${colour.hex}`}
            >
              <span className="swatch__chip" style={{ background: colour.hex }} />
              <span className="swatch__name">{colour.name}</span>
              <span className="swatch__hex">{copied === colour.name ? 'Copied' : colour.hex}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="palette__sea">
        <p className="palette__note">Sea, by distance from the coast (px at 1080 wide)</p>
        <div className="palette__ramp" style={{ background: `linear-gradient(90deg, ${ramp})` }} />
        <ul className="palette__stops">
          {palette.sea.map((stop) => {
            const key = `sea-${stop.at}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  className="swatch swatch--stop focus-ring"
                  onClick={() => copy(stop.hex, key)}
                  aria-label={`Copy sea at ${stop.at} px ${stop.hex}`}
                >
                  <span className="swatch__chip" style={{ background: stop.hex }} />
                  <span className="swatch__name">{stop.at} px</span>
                  <span className="swatch__hex">{copied === key ? 'Copied' : stop.hex}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="sr-only" aria-live="polite">
        {copied ? 'Copied to the clipboard' : ''}
      </p>
    </section>
  );
}
