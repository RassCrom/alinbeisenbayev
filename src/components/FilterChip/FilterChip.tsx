import type { ReactNode } from 'react';

/** One choice in a row of filters. Pressed is outlined in the accent; it is a state, not a call to action. */
export default function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="chip focus-ring" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}
