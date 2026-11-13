import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import aboutData from '../data/about-story.json';
import { allProjects, projects } from '../data/projects';
import { audience, audienceDate, awards, parseCountDate } from '../data/proof';
import socialsData from '../data/socials.json';
import AboutPage from './AboutPage';

// The canvas globe is its own component; this page only places it.
vi.mock('../components/GlobeStory/GlobeStory', () => ({ default: () => <div data-testid="globe" /> }));

const view = () =>
  render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>,
  );
const listed = socialsData.socials.filter((social) => !('hidden' in social && social.hidden));

it('lists every award of every listed work, and none from hidden ones', () => {
  const expected = projects.flatMap((project) => project.awards.map((award) => `${project.slug}|${award}`));
  expect(awards.map((item) => `${item.slug}|${item.award}`).sort()).toEqual(expected.sort());
  const hidden = allProjects.filter((project) => project.hidden).map((project) => project.slug);
  for (const item of awards) expect(hidden).not.toContain(item.slug);
});

it('counts an audience only where a count was recorded', () => {
  const counted = listed.filter((social) => 'followers' in social && social.followers);
  expect(audience.map((item) => item.platform)).toEqual(counted.map((social) => social.platform));
  expect(audience.every((item) => item.count !== '')).toBe(true);
});

it('reads the date the counts were taken', () => {
  expect(parseCountDate('(09.19.26)')).toBe('19 September 2026');
  expect(parseCountDate('09.19.26')).toBe('19 September 2026');
  expect(parseCountDate('sometime')).toBeNull();
  expect(parseCountDate(undefined)).toBeNull();
  expect(audienceDate).toBe('13 November 2026');
});

it('introduces him by name', () => {
  const page = view();
  expect(page.getByRole('heading', { level: 1 }).textContent).toBe(aboutData.profile.name);
  expect(page.getByText(aboutData.profile.bio.split('\n')[0])).not.toBeNull();
});

it('offers the CV only while the data lists it', () => {
  // The CV entry is marked hidden in socials.json, so it is not offered.
  const cv = socialsData.socials.find((social) => social.platform === 'CV')!;
  const shown = !('hidden' in cv && cv.hidden);
  expect(view().queryByRole('link', { name: 'Download CV' }) !== null).toBe(shown);
});

it('runs head, proof, profiles, then the route', () => {
  const headings = view()
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
  expect(headings).toEqual(['Recognition', 'Audience', 'Find me elsewhere', 'The route so far']);
});

it('links each award to the work that earned it', () => {
  const page = view();
  for (const item of awards) {
    expect(page.getByText(item.award)).not.toBeNull();
    const links = page.getAllByRole('link', { name: item.work });
    expect(links.some((link) => link.getAttribute('href') === `/works/${item.slug}`), item.slug).toBe(true);
  }
});

it('links every profile but the CV, outside ones in a new tab', () => {
  const page = view();
  for (const social of listed.filter((item) => item.platform !== 'CV')) {
    const link = page.container.querySelector(`.profiles a[href="${social.url}"]`);
    expect(link, social.platform).not.toBeNull();
    expect(link!.getAttribute('target'), social.platform).toBe(social.url.startsWith('http') ? '_blank' : null);
  }
  expect(page.container.querySelectorAll('.profiles a')).toHaveLength(
    listed.filter((item) => item.platform !== 'CV').length,
  );
});

it('tells the route one stop at a time, without coordinates', async () => {
  const page = view();
  expect(await page.findByTestId('globe')).not.toBeNull();
  const stops = page.container.querySelectorAll('.route__panel');
  expect(stops).toHaveLength(aboutData.story.length);
  expect(stops[0].textContent).toContain(aboutData.story[0].title);
  expect(stops[0].textContent).toContain(aboutData.story[0].location.name);
  expect(page.container.textContent).not.toMatch(/\d+\.\d+°\s?[NSEW]/);
});
