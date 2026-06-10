export interface ProcessStepProps {
  step: number;
  title: string;
  description: string;
  image?: string;
}

export default function ProcessStep({ step, title, description, image }: ProcessStepProps) {
  return (
    <div className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-[var(--space-6)] sm:flex-row">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-full)] border border-[var(--color-accent)] font-[family-name:var(--font-mono)] text-[length:var(--text-sm)] text-[var(--color-accent-light)]">
        {step}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-[family-name:var(--font-heading)] text-[length:var(--text-lg)] font-bold">
          {title}
        </h4>
        <p className="mt-[var(--space-2)] text-[var(--color-text-secondary)]">{description}</p>
        {image && (
          <img
            src={image}
            alt={title}
            width={1200}
            height={630}
            loading="lazy"
            className="mt-[var(--space-4)] aspect-video w-full rounded-[var(--radius-md)] object-cover"
          />
        )}
      </div>
    </div>
  );
}
