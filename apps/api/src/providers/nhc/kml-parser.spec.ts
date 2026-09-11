import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import {
  parseKmz,
  parseTrackKml,
  parseConeKml,
  parseWatchWarningsKml,
} from './kml-parser.js';

const GEOMETRY_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'geometry',
);

function fixture(name: string): Buffer {
  return readFileSync(join(GEOMETRY_DIR, name));
}

describe('parseKmz', () => {
  it('decompresses a KMZ into its KML document', () => {
    const kml = parseKmz(fixture('ep142026_005adv_TRACK.kmz'));
    expect(kml).toContain('<kml');
    expect(kml).toContain('EP142026');
  });

  it('throws when the archive cannot be read as a zip', () => {
    const zip = Buffer.from('PK\x03\x04');
    expect(() => parseKmz(zip)).toThrow(/zip|archive/i);
  });

  it('throws when the archive contains no KML entry', () => {
    const zip = new AdmZip();
    zip.addFile('doc.txt', Buffer.from('not kml', 'utf8'));

    expect(() => parseKmz(zip.toBuffer())).toThrow(/no KML entry/i);
  });
});

describe('parseTrackKml', () => {
  it('parses the live NHC track KMZ into the 120-hour LineString', () => {
    const track = parseTrackKml(parseKmz(fixture('ep142026_005adv_TRACK.kmz')));

    expect(track).not.toBeNull();
    expect(track?.atcfId).toBe('EP142026');
    expect(track?.advisoryNumber).toBe(5);
    expect(track?.lineString.type).toBe('LineString');
    // The longest line (120-hour forecast) carries all 7 initial + 2 extended points
    expect(track?.lineString.coordinates).toHaveLength(9);
    expect(track?.lineString.coordinates[0]).toEqual([-120.5, 16.5]);
  });

  it('returns null when no LineString exists', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark><Point><coordinates>-120.5,16.5,0</coordinates></Point></Placemark>
        </Document>
      </kml>`;
    expect(parseTrackKml(kml)).toBeNull();
  });

  it('skips placemarks with malformed coordinates and picks the longest valid line', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <LineString><coordinates>-120.5,16.5,0 -121.5,17.0,0</coordinates></LineString>
            <ExtendedData>
              <Data name="atcfid"><value>EP142026</value></Data>
              <Data name="advisoryNum"><value>5</value></Data>
            </ExtendedData>
          </Placemark>
          <Placemark>
            <LineString><coordinates>not-a-coord -120.5,16.5,0 -121.5,17.0,0 -122.5,17.5,0</coordinates></LineString>
          </Placemark>
          <Placemark>
            <LineString><coordinates>lon-only</coordinates></LineString>
          </Placemark>
          <Placemark>
            <LineString><coordinates>-120.5,16.5,0</coordinates></LineString>
          </Placemark>
        </Document>
      </kml>`;
    const track = parseTrackKml(kml);

    expect(track).not.toBeNull();
    expect(track?.lineString.coordinates).toHaveLength(3);
    expect(track?.lineString.coordinates[0]).toEqual([-120.5, 16.5]);
    expect(track?.atcfId).toBe('EP142026');
    expect(track?.advisoryNumber).toBe(5);
  });

  it('returns null metadata when ExtendedData is missing or malformed', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <LineString><coordinates>-120.5,16.5,0 -121.5,17.0,0</coordinates></LineString>
            <ExtendedData>
              <Data name="atcfid"><value></value></Data>
              <Data name="advisoryNum"><value>not-a-number</value></Data>
              <Data><value>nameless</value></Data>
              <Data name="empty"></Data>
            </ExtendedData>
          </Placemark>
        </Document>
      </kml>`;
    const track = parseTrackKml(kml);

    expect(track?.atcfId).toBeNull();
    expect(track?.advisoryNumber).toBeNull();
  });
});

describe('parseConeKml', () => {
  it('parses the live NHC cone KMZ into a single Polygon', () => {
    const cone = parseConeKml(parseKmz(fixture('ep142026_005adv_CONE.kmz')));

    expect(cone).not.toBeNull();
    expect(cone?.atcfId).toBe('EP142026');
    expect(cone?.advisoryNumber).toBe(5);
    expect(cone?.polygon.type).toBe('Polygon');
    expect(cone?.polygon.coordinates).toHaveLength(1);
    expect(cone?.polygon.coordinates[0].length).toBeGreaterThanOrEqual(4);
  });

  it('returns null when no Polygon exists', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark><LineString><coordinates>-120.5,16.5,0 -122.5,16.5,0</coordinates></LineString></Placemark>
        </Document>
      </kml>`;
    expect(parseConeKml(kml)).toBeNull();
  });

  it('skips rings without enough positions and placemarks without polygons', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark><Point><coordinates>-120.5,16.5,0</coordinates></Point></Placemark>
          <Placemark>
            <Polygon><outerBoundaryIs><LinearRing><coordinates>-120.5,16.5,0 -121.5,17.0,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
          </Placemark>
          <Placemark>
            <Polygon><outerBoundaryIs><LinearRing><coordinates>-120.5,16.5,0 -121.5,17.0,0 -122.5,17.5,0 -120.5,16.5,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
            <ExtendedData>
              <Data name="atcfid"><value>EP142026</value></Data>
              <Data name="advisoryNum"><value>5</value></Data>
            </ExtendedData>
          </Placemark>
        </Document>
      </kml>`;
    const cone = parseConeKml(kml);

    expect(cone).not.toBeNull();
    expect(cone?.polygon.coordinates[0]).toHaveLength(4);
    expect(cone?.atcfId).toBe('EP142026');
    expect(cone?.advisoryNumber).toBe(5);
  });
});

describe('parseWatchWarningsKml', () => {
  it('parses the NHC Watch/Warning KMZ into typed coastal segments', () => {
    const segments = parseWatchWarningsKml(
      parseKmz(fixture('al112017_020adv_WW.kmz')),
    );

    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[0].type).toBe('Hurricane Watch');
    expect(segments.every((s) => s.lineString.coordinates.length >= 2)).toBe(
      true,
    );
  });

  it('returns an empty list when no placemarks carry a line', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark><name>Just a point</name><Point><coordinates>-80.5,25.9,0</coordinates></Point></Placemark>
        </Document>
      </kml>`;
    expect(parseWatchWarningsKml(kml)).toEqual([]);
  });

  it('skips placemarks with a blank name or without a valid line', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark><name>   </name><LineString><coordinates>-80.5,25.9,0 -80.4,26.1,0</coordinates></LineString></Placemark>
          <Placemark><LineString><coordinates>-80.5,25.9,0 -80.4,26.1,0</coordinates></LineString></Placemark>
          <Placemark><name>Too short</name><LineString><coordinates>-80.5,25.9,0</coordinates></LineString></Placemark>
          <Placemark><name>  Hurricane Warning  </name><LineString><coordinates>-80.5,25.9,0 -80.4,26.1,0</coordinates></LineString></Placemark>
        </Document>
      </kml>`;
    const segments = parseWatchWarningsKml(kml);

    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('Hurricane Warning');
    expect(segments[0].lineString.coordinates).toHaveLength(2);
  });

  it('returns an empty list when the document has no placemarks', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document><name>No placemarks here</name></Document>
      </kml>`;
    expect(parseWatchWarningsKml(kml)).toEqual([]);
  });
});
