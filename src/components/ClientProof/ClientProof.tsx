import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { clientLogos, clientShowcase } from '../../data/proof';

/**
 * "Trusted by": the logos of the outlets and companies the maps were made for,
 * then a few of the pieces themselves. Logos are drawn as masks in the text
 * colour, so every brand sits at the same weight and follows the theme.
 */
export default function ClientProof() {
  if (!clientLogos.length) return null;
  return (
    <section className="client-proof" aria-labelledby="client-proof-title">
      <h2 id="client-proof-title" className="client-proof__label">
        Trusted by
      </h2>
      <ul className="client-logos">
        {clientLogos.map((client) => (
          <li key={client.id} className="client-logos__item">
            <span
              role="img"
              aria-label={client.name}
              className={`client-logo client-logo--${client.id}`}
              style={{ '--logo': `url("${client.logo}")` } as CSSProperties}
            />
            {client.logoText && (
              <span className="client-logo__text" aria-hidden="true">
                {client.logoText}
              </span>
            )}
          </li>
        ))}
      </ul>

      {clientShowcase.length > 0 && (
        <ul className="client-showcase">
          {clientShowcase.map(({ client, piece }) => {
            const inner = (
              <>
                <span className="client-showcase__frame">
                  <img src={piece.image} alt="" loading="lazy" decoding="async" width={piece.width} height={piece.height} />
                </span>
                <span className="client-showcase__copy">
                  <span className="client-showcase__client">For {client.name}</span>
                  <span className="client-showcase__title">{piece.title}</span>
                  <span className="client-showcase__detail">{client.detail}</span>
                </span>
              </>
            );
            return (
              <li key={client.id}>
                {piece.workSlug ? (
                  <Link to={`/works/${piece.workSlug}`} className="client-showcase__card focus-ring">
                    {inner}
                  </Link>
                ) : (
                  <div className="client-showcase__card">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
