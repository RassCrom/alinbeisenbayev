import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ContactForm from './ContactForm';

const EMAIL = 'owner@example.com';
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Renders the form. By default ten seconds have passed since it appeared, as for a person who typed. */
function setup(fetchImpl: ReturnType<typeof vi.fn> = vi.fn(async () => ok()), props = {}, secondsSpent = 10) {
  vi.stubGlobal('fetch', fetchImpl);
  let now = 1_700_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const view = render(<ContactForm directEmail={EMAIL} {...props} />);
  now += secondsSpent * 1000;
  const type = (label: string, value: string) =>
    fireEvent.change(view.getByLabelText(label), { target: { value } });
  const fill = () => {
    type('Name', 'Dana');
    type('Email', 'dana@example.com');
    type('Message', 'I need a map of my city.');
  };
  const submit = () => fireEvent.submit(view.container.querySelector('form')!);
  const chips = () => within(view.getByRole('group', { name: /What you need/ })).getAllByRole('button');
  return { view, fetchImpl, type, fill, submit, chips };
}

it('asks for four things and nothing else', () => {
  const { view, chips } = setup();
  for (const label of ['Name', 'Email', 'Message']) expect(view.getByLabelText(label)).not.toBeNull();
  expect(chips().map((chip) => chip.textContent)).toEqual([
    'Custom maps',
    'Spatial analysis',
    'Data visualization',
    'Data journalism',
    'Remote sensing',
  ]);
  expect(chips().every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
  expect(view.getByRole('button', { name: 'Send' })).not.toBeNull();
  // Visible inputs: name, email, message. The honeypot is the only other one.
  expect(view.container.querySelectorAll('input, textarea')).toHaveLength(4);
});

it('starts with the offer it was opened for', () => {
  const { chips } = setup(undefined, { initialOffer: 'remote-sensing' });
  expect(chips().filter((chip) => chip.getAttribute('aria-pressed') === 'true').map((chip) => chip.textContent)).toEqual([
    'Remote sensing',
  ]);
});

it('keeps the honeypot away from people', () => {
  const { view } = setup();
  const trap = view.container.querySelector<HTMLInputElement>('input[name="company"]')!;
  expect(trap.tabIndex).toBe(-1);
  expect(trap.getAttribute('autocomplete')).toBe('off');
  expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
});

it('says what is missing and sends nothing', () => {
  const { view, fetchImpl, submit } = setup();
  submit();
  expect(view.getByText('Please enter your name.')).not.toBeNull();
  expect(view.getByText('Please enter an email address I can reply to.')).not.toBeNull();
  expect(view.getByText('Please write a few words about what you need.')).not.toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
  const name = view.getByLabelText('Name');
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(name.getAttribute('aria-describedby')).toBe('contact-name-error');
  expect(document.activeElement).toBe(name);
});

it('clears a field’s error once it is fixed and resubmitted', () => {
  const { view, type, submit } = setup();
  submit();
  type('Name', 'Dana');
  submit();
  expect(view.queryByText('Please enter your name.')).toBeNull();
  expect(view.getByText('Please enter an email address I can reply to.')).not.toBeNull();
});

it('sends the inquiry once, shows it is sending, then confirms what was sent', async () => {
  let release!: (response: Response) => void;
  const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
  const { view, fill, submit, chips } = setup(fetchImpl);
  fill();
  fireEvent.click(chips()[4]);
  submit();
  submit(); // a second Enter or click while the first is in flight

  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/contact');
  expect(init.method).toBe('POST');
  const body = JSON.parse(String(init.body));
  expect(body).toMatchObject({
    name: 'Dana',
    email: 'dana@example.com',
    offers: ['remote-sensing'],
    message: 'I need a map of my city.',
    company: '',
  });
  expect(typeof body.elapsedMs).toBe('number');

  const button = view.getByRole('button', { name: 'Sending' });
  expect((button as HTMLButtonElement).disabled).toBe(true);

  await act(async () => release(ok()));
  expect(view.getByRole('heading', { level: 2 }).textContent).toBe('Sent');
  expect(view.getByText('Thanks, Dana. I will reply to dana@example.com.')).not.toBeNull();
  expect(view.getByText('I need a map of my city.')).not.toBeNull();
  expect(view.getByText('Remote sensing')).not.toBeNull();
  expect(view.container.querySelector('form')).toBeNull();
});

it('starts over with an empty form', async () => {
  const { view, fill, submit } = setup();
  fill();
  submit();
  await waitFor(() => expect(view.queryByText('Sent')).not.toBeNull());
  fireEvent.click(view.getByRole('button', { name: 'Send another' }));
  expect((view.getByLabelText('Name') as HTMLInputElement).value).toBe('');
  expect((view.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('');
});

it('never says sent when the server could not deliver', async () => {
  const down = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'not-configured' }), { status: 503 }));
  const { view, fill, submit } = setup(down);
  fill();
  submit();
  await waitFor(() => expect(view.queryByText(/This did not send/)).not.toBeNull());
  expect(view.queryByText('Sent')).toBeNull();
  // What was typed is still there.
  expect((view.getByLabelText('Name') as HTMLInputElement).value).toBe('Dana');
  expect((view.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('I need a map of my city.');
  // And there is a way through that does not depend on the form.
  const direct = view.getByRole('link', { name: EMAIL });
  expect(direct.getAttribute('href')).toContain(`mailto:${EMAIL}`);
  expect(decodeURIComponent(direct.getAttribute('href')!)).toContain('I need a map of my city.');
  expect(view.getByRole('button', { name: 'Send' })).not.toBeNull();
});

it('treats a dropped connection as not sent', async () => {
  const offline = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  const { view, fill, submit } = setup(offline);
  fill();
  submit();
  await waitFor(() => expect(view.queryByText(/This did not send/)).not.toBeNull());
});

it('shows what the server objects to', async () => {
  const picky = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: false, errors: { email: 'Please enter an email address I can reply to.' } }), {
        status: 400,
      }),
  );
  const { view, fill, submit } = setup(picky);
  fill();
  submit();
  await waitFor(() => expect(view.queryByText('Please enter an email address I can reply to.')).not.toBeNull());
  expect(view.queryByText(/This did not send/)).toBeNull();
});

it('holds back a submit made faster than a person types, so it is never mistaken for a bot', async () => {
  // The server answers a too-fast submit with a silent "ok" and sends
  // nothing. A real visitor who pastes and sends at once must not get that.
  vi.useFakeTimers();
  const fetchImpl = vi.fn(async () => ok());
  const { view, fill, submit } = setup(fetchImpl, {}, 0.4);
  fill();
  submit();
  expect(view.getByRole('button', { name: 'Sending' })).not.toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(fetchImpl).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(String(init.body)).elapsedMs).toBeGreaterThanOrEqual(2500);
});
