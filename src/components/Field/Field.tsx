import type { RefObject } from 'react';

export interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown under the field and tied to it for assistive tech. */
  error?: string;
  type?: 'text' | 'email';
  /** A textarea, for the message. */
  multiline?: boolean;
  autoComplete?: string;
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement>;
}

/** A labelled input or textarea with its error. The label is always visible; placeholders are not labels. */
export default function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  multiline = false,
  autoComplete,
  inputRef,
}: FieldProps) {
  const shared = {
    id,
    name: id,
    value,
    autoComplete,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    className: 'field__input focus-ring',
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          {...shared}
          rows={6}
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...shared}
          type={type}
          ref={inputRef as RefObject<HTMLInputElement>}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
