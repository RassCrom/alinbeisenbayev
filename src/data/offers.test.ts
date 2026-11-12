import { expect, it } from 'vitest';
import { OFFERS, offerHref } from './offers';

it('lists the five approved offers, in order', () => {
  expect(OFFERS.map((o) => o.slug)).toEqual([
    'custom-maps',
    'spatial-analysis',
    'data-visualization',
    'data-journalism',
    'remote-sensing',
  ]);
  expect(OFFERS.map((o) => o.label)).toEqual([
    'Custom maps',
    'Spatial analysis',
    'Data visualization',
    'Data journalism',
    'Remote sensing',
  ]);
});

it('links an offer to the filtered works index', () => {
  expect(offerHref('remote-sensing')).toBe('/works?offer=remote-sensing');
});
