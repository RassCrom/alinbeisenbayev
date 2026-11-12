import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import PageFallback from './PageFallback';

it('is a labelled skeleton with no text', () => {
  const { getByRole } = render(<PageFallback />);
  expect(getByRole('status').getAttribute('aria-label')).toBe('Loading page');
  expect(getByRole('status').textContent).toBe('');
});
