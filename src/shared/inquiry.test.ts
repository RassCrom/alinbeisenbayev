import { expect, it } from 'vitest';
import { LIMITS, MIN_FILL_MS, validateInquiry } from './inquiry';

const good = { name: 'Dana', email: 'dana@example.com', offers: ['custom-maps'], message: 'I need a map of my city.' };

it('accepts a complete inquiry and reports no errors', () => {
  const { inquiry, errors } = validateInquiry(good);
  expect(errors).toEqual({});
  expect(inquiry).toEqual(good);
});

it('trims what was typed', () => {
  const { inquiry } = validateInquiry({ ...good, name: '  Dana  ', email: ' dana@example.com ', message: '  I need a map.  ' });
  expect(inquiry.name).toBe('Dana');
  expect(inquiry.email).toBe('dana@example.com');
  expect(inquiry.message).toBe('I need a map.');
});

it('says what is missing, in plain words', () => {
  expect(validateInquiry({}).errors).toEqual({
    name: 'Please enter your name.',
    email: 'Please enter an email address I can reply to.',
    message: 'Please write a few words about what you need.',
  });
});

it('rejects an email that is not shaped like one', () => {
  for (const email of ['dana', 'dana@', '@example.com', 'dana@example', 'da na@example.com']) {
    expect(validateInquiry({ ...good, email }).errors.email, email).toBeDefined();
  }
});

it('holds each field to its limits', () => {
  expect(validateInquiry({ ...good, name: 'D' }).errors.name).toBeDefined();
  expect(validateInquiry({ ...good, name: 'x'.repeat(LIMITS.name[1] + 1) }).errors.name).toBeDefined();
  expect(validateInquiry({ ...good, email: `${'x'.repeat(LIMITS.email)}@example.com` }).errors.email).toBeDefined();
  expect(validateInquiry({ ...good, message: 'too short' }).errors.message).toBeDefined();
  expect(validateInquiry({ ...good, message: 'x'.repeat(LIMITS.message[1] + 1) }).errors.message).toBeDefined();
});

it('keeps only real offers, and none is fine', () => {
  expect(validateInquiry({ ...good, offers: ['remote-sensing', 'nonsense', 42] }).inquiry.offers).toEqual(['remote-sensing']);
  expect(validateInquiry({ ...good, offers: undefined }).errors).toEqual({});
  expect(validateInquiry({ ...good, offers: 'custom-maps' }).inquiry.offers).toEqual([]);
});

it('survives input that is not an object at all', () => {
  for (const input of [null, undefined, 'hello', 7, []]) {
    expect(Object.keys(validateInquiry(input).errors).sort()).toEqual(['email', 'message', 'name']);
  }
});

it('waits two and a half seconds before a submit counts as human', () => {
  expect(MIN_FILL_MS).toBe(2500);
});
