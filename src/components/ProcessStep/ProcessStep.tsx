export interface ProcessStepProps {
  step: number;
  title: string;
  description: string;
  image?: string;
}

export default function ProcessStep({ step, title, description, image }: ProcessStepProps) {
  return (
    <div className="process-step">
      <div className="process-step-number" aria-hidden="true">
        {step}
      </div>
      <div className="process-step-body">
        <h4 className="process-step-title">{title}</h4>
        <p className="process-step-desc">{description}</p>
        {image && (
          <img
            src={image}
            alt={title}
            width={1200}
            height={630}
            loading="lazy"
            className="process-step-img"
          />
        )}
      </div>
    </div>
  );
}
