export interface StackRowProps {
  stack: string[];
}

export default function StackRow({ stack }: StackRowProps) {
  return (
    <div className="flex gap-[var(--space-2)] overflow-x-auto pb-[var(--space-2)]">
      {stack.map((item) => (
        <span key={item} className="pill">
          {item}
        </span>
      ))}
    </div>
  );
}
