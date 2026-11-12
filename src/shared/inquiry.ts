import { OFFERS, type OfferSlug } from '../data/offers';

/*
 * What a visitor sends through the "Work with me" form, and the rules it must
 * meet. One module, used by the form in the browser and by the handler on the
 * server, so the two can never disagree about what is acceptable.
 */

export interface Inquiry {
  name: string;
  email: string;
  /** Optional; several allowed. */
  offers: OfferSlug[];
  message: string;
}

export type InquiryErrors = Partial<Record<'name' | 'email' | 'message', string>>;

/** Character limits. A pair is [shortest, longest]. */
export const LIMITS = {
  name: [2, 80],
  email: 120,
  message: [10, 4000],
} as const;

/**
 * A form submitted faster than this was not filled in by a person. The same
 * limits are enforced by the database (supabase/inquiries.sql).
 */
export const MIN_FILL_MS = 2500;

/** Something before an @, something after it, a dot in the domain, no spaces. Not a full RFC check. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SLUGS = new Set<string>(OFFERS.map((offer) => offer.slug));

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Tidy what was sent and say what is wrong with it.
 *
 * Takes anything: the server calls this on whatever arrived. `errors` is
 * empty when the inquiry is good to send.
 */
export function validateInquiry(input: unknown): { inquiry: Inquiry; errors: InquiryErrors } {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

  const inquiry: Inquiry = {
    name: text(source.name),
    email: text(source.email),
    offers: Array.isArray(source.offers)
      ? source.offers.filter((offer): offer is OfferSlug => typeof offer === 'string' && SLUGS.has(offer))
      : [],
    message: text(source.message),
  };

  const errors: InquiryErrors = {};
  if (inquiry.name.length < LIMITS.name[0] || inquiry.name.length > LIMITS.name[1]) {
    errors.name = 'Please enter your name.';
  }
  if (inquiry.email.length > LIMITS.email || !EMAIL_SHAPE.test(inquiry.email)) {
    errors.email = 'Please enter an email address I can reply to.';
  }
  if (inquiry.message.length < LIMITS.message[0] || inquiry.message.length > LIMITS.message[1]) {
    errors.message = 'Please write a few words about what you need.';
  }
  return { inquiry, errors };
}
