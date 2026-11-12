import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import FilterChip from './FilterChip';

it('reports its pressed state', () => {
  const on = render(<FilterChip pressed onClick={() => {}}>All</FilterChip>);
  expect(on.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  on.unmount();
  const off = render(<FilterChip pressed={false} onClick={() => {}}>All</FilterChip>);
  expect(off.getByRole('button').getAttribute('aria-pressed')).toBe('false');
});

it('calls back on click', () => {
  const onClick = vi.fn();
  fireEvent.click(render(<FilterChip pressed={false} onClick={onClick}>Custom maps</FilterChip>).getByRole('button'));
  expect(onClick).toHaveBeenCalledTimes(1);
});
