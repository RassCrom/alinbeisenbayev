import { useState, type CSSProperties } from 'react';

export interface CompareProps {
  /** Shown on the left of the handle. */
  left: { src: string; label: string };
  /** Shown on the right of the handle. Must have the same size and framing as `left`. */
  right: { src: string; label: string };
  alt: string;
}

/**
 * Two renders of the same frame with a handle between them. The range input
 * covers the whole picture, so it drags anywhere and steps with the arrow keys.
 */
export default function Compare({ left, right, alt }: CompareProps) {
  const [position, setPosition] = useState(50);

  return (
    <figure className="compare" style={{ '--pos': `${position}%` } as CSSProperties}>
      <img src={right.src} alt={alt} loading="lazy" decoding="async" />
      <img className="compare__left" src={left.src} alt="" loading="lazy" decoding="async" />
      <span className="compare__line" aria-hidden="true" />
      <span className="compare__tag compare__tag--left" aria-hidden="true">
        {left.label}
      </span>
      <span className="compare__tag compare__tag--right" aria-hidden="true">
        {right.label}
      </span>
      <input
        className="compare__input"
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label={`${left.label} and ${right.label}: how much of ${left.label} to show`}
      />
    </figure>
  );
}
