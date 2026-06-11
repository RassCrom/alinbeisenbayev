import { useState } from 'react';

const VISIBLE_COUNT = 5;

export interface SearchFilterProps {
  keywords: string[];
  search: string;
  selected: string[];
  onSearch: (query: string) => void;
  onFilter: (keyword: string) => void;
}

export default function SearchFilter({
  keywords,
  search,
  selected,
  onSearch,
  onFilter,
}: SearchFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? keywords : keywords.slice(0, VISIBLE_COUNT);
  const overflow = keywords.length - VISIBLE_COUNT;

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search works…"
        aria-label="Search works"
        className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-[var(--space-4)] py-[var(--space-3)] font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((keyword) => (
          <button
            key={keyword}
            type="button"
            onClick={() => onFilter(keyword)}
            className={`pill pill-sm cursor-pointer hover:border-[var(--color-accent)] ${
              selected.includes(keyword) ? 'pill-active' : ''
            }`}
          >
            {keyword}
          </button>
        ))}
        {!expanded && overflow > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="font-[family-name:var(--font-mono)] text-[10px] tracking-wider text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            +{overflow} more
          </button>
        )}
        {expanded && overflow > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="font-[family-name:var(--font-mono)] text-[10px] tracking-wider text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            show less
          </button>
        )}
      </div>
    </div>
  );
}
