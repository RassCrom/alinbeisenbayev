/** A quiet placeholder for content that has not arrived. Decorative: hidden from assistive tech. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} />;
}
