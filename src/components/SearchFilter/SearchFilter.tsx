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
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search works…"
        aria-label="Search works"
        className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-[var(--space-4)] py-[var(--space-3)] font-[family-name:var(--font-heading)] text-[length:var(--text-sm)] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
      />
      <div className="flex flex-wrap gap-[var(--space-2)]">
        {keywords.map((keyword) => (
          <button
            key={keyword}
            type="button"
            onClick={() => onFilter(keyword)}
            className={`pill cursor-pointer hover:border-[var(--color-accent)] ${
              selected.includes(keyword) ? 'pill-active' : ''
            }`}
          >
            {keyword}
          </button>
        ))}
      </div>
    </div>
  );
}
