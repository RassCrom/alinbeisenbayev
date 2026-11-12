import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it } from 'vitest';
import LegacyRedirect from './LegacyRedirect';

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{pathname + search + hash}</p>;
}

const landing = (from: string) => {
  const view = render(
    <MemoryRouter initialEntries={[from]}>
      <Routes>
        <Route path="/stories" element={<LegacyRedirect to="/journal" />} />
        <Route path="/stories/:slug" element={<LegacyRedirect to="/journal" />} />
        <Route path="/blog" element={<LegacyRedirect to="/journal" />} />
        <Route path="/blog/:slug" element={<LegacyRedirect to="/journal" />} />
        <Route path="/journal/*" element={<Where />} />
        <Route path="/journal" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const where = view.getByTestId('where').textContent;
  view.unmount();
  return where;
};

it('sends an old index to the journal', () => {
  expect(landing('/stories')).toBe('/journal');
  expect(landing('/blog')).toBe('/journal');
});

it('keeps the slug', () => {
  expect(landing('/stories/saint-lucia')).toBe('/journal/saint-lucia');
  expect(landing('/blog/map-awards')).toBe('/journal/map-awards');
  expect(landing('/blog/stockholm-metro-guide')).toBe('/journal/stockholm-metro-guide');
});

it('keeps the query and the hash of a deep link', () => {
  expect(landing('/stories/saint-lucia?x=1#sources')).toBe('/journal/saint-lucia?x=1#sources');
});
