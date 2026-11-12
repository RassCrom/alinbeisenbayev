import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Button from '../Button/Button';
import Field from '../Field/Field';
import FilterChip from '../FilterChip/FilterChip';
import Icon from '../Icon/Icon';
import { OFFERS, offerLabel, type OfferSlug } from '../../data/offers';
import { MIN_FILL_MS, validateInquiry, type Inquiry, type InquiryErrors } from '../../shared/inquiry';

export interface ContactFormProps {
  /** The offer the visitor came for, already chosen. */
  initialOffer?: OfferSlug | null;
  /** Offered as the way through when the form cannot deliver. */
  directEmail?: string;
}

type Status = 'idle' | 'sending' | 'sent' | 'failed';
type FieldName = 'name' | 'email' | 'message';

const ENDPOINT = '/api/contact';
const FIELD_ORDER: FieldName[] = ['name', 'email', 'message'];

const blank = (initialOffer?: OfferSlug | null) => ({
  name: '',
  email: '',
  message: '',
  offers: initialOffer ? [initialOffer] : ([] as OfferSlug[]),
});

/** A mail link that carries what was typed, for when the form itself fails. */
function mailto(address: string, inquiry: Inquiry): string {
  const needs = inquiry.offers.map(offerLabel).join(', ');
  const body = [needs && `Needs: ${needs}`, inquiry.message, inquiry.name].filter(Boolean).join('\n\n');
  return `mailto:${address}?subject=${encodeURIComponent('Working together')}&body=${encodeURIComponent(body)}`;
}

/**
 * The "Work with me" form: name, email, what you need, message.
 *
 * It has four states. `sent` replaces the form with what was sent, so the
 * visitor can see it went. `failed` keeps everything typed and points to the
 * direct email, because a form that swallows a message is worse than none.
 */
export default function ContactForm({ initialOffer, directEmail }: ContactFormProps) {
  const [values, setValues] = useState(() => blank(initialOffer));
  // The honeypot. People never see it; bots fill every field they find.
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [sent, setSent] = useState<Inquiry | null>(null);

  const startedAt = useRef(Date.now());
  // State updates land after the event; a second submit in the same tick
  // would still read 'idle'. This closes that gap.
  const inFlight = useRef(false);
  const refs: Record<FieldName, React.RefObject<HTMLInputElement & HTMLTextAreaElement>> = {
    name: useRef(null),
    email: useRef(null),
    message: useRef(null),
  };

  const set = (field: FieldName) => (value: string) => setValues((current) => ({ ...current, [field]: value }));
  const toggleOffer = (slug: OfferSlug) =>
    setValues((current) => ({
      ...current,
      offers: current.offers.includes(slug)
        ? current.offers.filter((offer) => offer !== slug)
        : [...current.offers, slug],
    }));

  const showErrors = (found: InquiryErrors) => {
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) refs[first].current?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;

    const { inquiry, errors: found } = validateInquiry(values);
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }

    inFlight.current = true;
    setErrors({});
    setStatus('sending');
    try {
      // The server treats a form sent within MIN_FILL_MS of appearing as a
      // bot and answers "ok" without sending anything. A person who pastes
      // and sends at once must never get that answer, so the request waits
      // out the remainder here, behind the "Sending" state.
      const elapsed = Date.now() - startedAt.current;
      if (elapsed < MIN_FILL_MS) await new Promise((resolve) => setTimeout(resolve, MIN_FILL_MS - elapsed));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...inquiry, company, elapsedMs: Math.max(elapsed, MIN_FILL_MS) }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; errors?: InquiryErrors };
      if (response.ok && result.ok) {
        setSent(inquiry);
        setStatus('sent');
      } else if (response.status === 400 && result.errors) {
        setStatus('idle');
        showErrors(result.errors);
      } else {
        setStatus('failed');
      }
    } catch {
      setStatus('failed');
    } finally {
      inFlight.current = false;
    }
  };

  const reset = () => {
    setValues(blank());
    setCompany('');
    setErrors({});
    setSent(null);
    setStatus('idle');
    startedAt.current = Date.now();
  };

  if (status === 'sent' && sent) {
    return (
      <div className="contact-sent" role="status">
        <span className="contact-sent__mark">
          <Icon name="check" size={24} />
        </span>
        <h2 className="t-h2">Sent</h2>
        <p>
          Thanks, {sent.name}. I will reply to {sent.email}.
        </p>
        <dl className="facts contact-sent__copy">
          {sent.offers.length > 0 && (
            <div>
              <dt>What you need</dt>
              <dd>{sent.offers.map(offerLabel).join(', ')}</dd>
            </div>
          )}
          <div>
            <dt>Message</dt>
            <dd>{sent.message}</dd>
          </div>
        </dl>
        <Button variant="quiet" icon="arrow-right" onClick={reset}>
          Send another
        </Button>
      </div>
    );
  }

  const sending = status === 'sending';

  return (
    <form className="contact-form" noValidate onSubmit={submit}>
      <Field
        id="contact-name"
        label="Name"
        value={values.name}
        onChange={set('name')}
        error={errors.name}
        autoComplete="name"
        inputRef={refs.name}
      />
      <Field
        id="contact-email"
        label="Email"
        type="email"
        value={values.email}
        onChange={set('email')}
        error={errors.email}
        autoComplete="email"
        inputRef={refs.email}
      />

      <div className="field" role="group" aria-labelledby="contact-offers-label">
        <p id="contact-offers-label" className="field__label">
          What you need <span className="field__hint">Optional</span>
        </p>
        <div className="contact-form__chips">
          {OFFERS.map((offer) => (
            <FilterChip
              key={offer.slug}
              pressed={values.offers.includes(offer.slug)}
              onClick={() => toggleOffer(offer.slug)}
            >
              {offer.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <Field
        id="contact-message"
        label="Message"
        multiline
        value={values.message}
        onChange={set('message')}
        error={errors.message}
        inputRef={refs.message}
      />

      <div className="contact-form__trap" aria-hidden="true">
        <label>
          Company
          <input
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </label>
      </div>

      {status === 'failed' && (
        <p className="contact-form__failed" role="alert">
          This did not send.{' '}
          {directEmail ? (
            <>
              Email me directly: <a href={mailto(directEmail, validateInquiry(values).inquiry)}>{directEmail}</a>
            </>
          ) : (
            'Please try again in a moment.'
          )}
        </p>
      )}

      <div>
        <Button type="submit" disabled={sending}>
          {sending ? 'Sending' : 'Send'}
        </Button>
      </div>
    </form>
  );
}
