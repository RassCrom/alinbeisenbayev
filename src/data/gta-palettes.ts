/*
 * The colours of the three GTA map styles, as the QGIS .qml files use them.
 *
 * Generated from the poster renderers' palettes (poster_render.py DAY/NIGHT,
 * gta5_render.py P) in the gta-style-qgis tutorial, which 05_qgis_styles.py
 * also reads. Change a colour there, not here.
 */

export interface Swatch {
  name: string;
  hex: string;
}

/** A colour stop of the sea ramp: distance from the coast in px at the 1080 px poster. */
export interface RampStop {
  at: number;
  hex: string;
}

export interface MapPalette {
  name: string;
  colours: Swatch[];
  sea: RampStop[];
}

export const gtaViDay: MapPalette = {
  name: 'GTA VI day',
  colours: [
    { name: 'Land', hex: '#C6D682' },
    { name: 'Forest', hex: '#86B662' },
    { name: 'Park', hex: '#A0CE74' },
    { name: 'Urban', hex: '#E4E5E5' },
    { name: 'Buildings', hex: '#C8CBD1' },
    { name: 'Beach', hex: '#F0E296' },
    { name: 'Rivers and lakes', hex: '#2A82D6' },
    { name: 'Coastline', hex: '#F2E69C' },
    { name: 'Highways', hex: '#F7EFA8' },
    { name: 'Roads', hex: '#FFFFFF' },
    { name: 'Road casing', hex: '#9C9EA6' },
    { name: 'Railway', hex: '#8C8C92' },
    { name: 'Sightseeing blip', hex: '#F2701E' },
    { name: 'Police blip', hex: '#266CD4' },
    { name: 'Harbour blip', hex: '#14926C' },
  ],
  sea: [
    { at: 0, hex: '#7ED2EE' },
    { at: 5, hex: '#48ACE4' },
    { at: 34, hex: '#2E84D0' },
    { at: 150, hex: '#2064B4' },
    { at: 520, hex: '#164694' },
  ],
};

export const gtaViNight: MapPalette = {
  name: 'GTA VI night',
  colours: [
    { name: 'Land', hex: '#1E232A' },
    { name: 'Forest', hex: '#1B342B' },
    { name: 'Park', hex: '#1F4033' },
    { name: 'Urban', hex: '#282C34' },
    { name: 'Buildings', hex: '#3C424E' },
    { name: 'Beach', hex: '#504C3C' },
    { name: 'Rivers and lakes', hex: '#146A8E' },
    { name: 'Coastline', hex: '#3E7880' },
    { name: 'Highways', hex: '#E8DA96' },
    { name: 'Main roads', hex: '#B0B6C0' },
    { name: 'Minor roads', hex: '#5C626E' },
    { name: 'Railway', hex: '#606470' },
    { name: 'Sightseeing blip', hex: '#F2701E' },
    { name: 'Police blip', hex: '#266CD4' },
    { name: 'Harbour blip', hex: '#14926C' },
  ],
  sea: [
    { at: 0, hex: '#206880' },
    { at: 5, hex: '#16526E' },
    { at: 34, hex: '#0E3856' },
    { at: 150, hex: '#0A2640' },
    { at: 520, hex: '#07182C' },
  ],
};

export const gtaV: MapPalette = {
  name: 'GTA V',
  colours: [
    { name: 'Land', hex: '#404640' },
    { name: 'Forest', hex: '#324634' },
    { name: 'Park', hex: '#3C583E' },
    { name: 'Urban', hex: '#4E5156' },
    { name: 'Buildings', hex: '#5E6268' },
    { name: 'Beach', hex: '#968C6E' },
    { name: 'Rivers and lakes', hex: '#2E5070' },
    { name: 'Coastline', hex: '#706E62' },
    { name: 'Highways', hex: '#D8DADE' },
    { name: 'Main roads', hex: '#BCBFC4' },
    { name: 'Minor roads', hex: '#7E8186' },
    { name: 'Railway', hex: '#707074' },
  ],
  sea: [
    { at: 0, hex: '#48708E' },
    { at: 5, hex: '#3A6082' },
    { at: 34, hex: '#2E5070' },
    { at: 150, hex: '#264260' },
    { at: 520, hex: '#1C304A' },
  ],
};

