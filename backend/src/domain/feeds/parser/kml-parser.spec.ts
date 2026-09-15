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
  '..',
  'test',
  'fixtures',
  'geometry',
);

function fixture(name: string): Buffer {
  return readFileSync(join(GEOMETRY_DIR, name));
}

describe('parseKmz', () => {
  it('decompresses a valid KMZ and returns its KML document', () => {
    const kml = parseKmz(fixture('ep142026_005adv_TRACK.kmz'));

    expect(kml).toContain('<kml');
    expect(kml).toContain('EP142026');
  });

  it('accepts KML entries with an uppercase extension', () => {
    const zip = new AdmZip();

    zip.addFile('DOCUMENT.KML', Buffer.from('<kml><Document /></kml>', 'utf8'));

    expect(parseKmz(zip.toBuffer())).toContain('<kml>');
  });

  it('ignores directories when looking for a KML entry', () => {
    const zip = new AdmZip();

    zip.addFile('geometry/', Buffer.alloc(0));
    zip.addFile(
      'geometry/document.kml',
      Buffer.from('<kml><Document /></kml>', 'utf8'),
    );

    expect(parseKmz(zip.toBuffer())).toContain('<kml>');
  });

  it('ignores non-KML files and selects the KML entry', () => {
    const zip = new AdmZip();

    zip.addFile('doc.txt', Buffer.from('not kml', 'utf8'));
    zip.addFile('document.kml', Buffer.from('<kml><Document /></kml>', 'utf8'));

    expect(parseKmz(zip.toBuffer())).toContain('<kml>');
  });

  it('throws when the archive is empty', () => {
    expect(() => parseKmz(Buffer.alloc(0))).toThrow(/empty/i);
  });

  it('throws when the archive is not a valid ZIP', () => {
    expect(() => parseKmz(Buffer.from('not a zip archive'))).toThrow(
      /archive|zip/i,
    );
  });

  it('throws when the archive contains no KML entry', () => {
    const zip = new AdmZip();

    zip.addFile('doc.txt', Buffer.from('not kml', 'utf8'));

    expect(() => parseKmz(zip.toBuffer())).toThrow(/no KML entry/i);
  });

  it('throws when the KMZ input is not a Buffer', () => {
    expect(() => parseKmz('not-a-buffer' as unknown as Buffer)).toThrow(
      /Buffer/i,
    );
  });

  it('uses the first KML entry when an archive contains multiple KML files', () => {
    const zip = new AdmZip();

    zip.addFile(
      'first.kml',
      Buffer.from('<kml><Document><name>first</name></Document></kml>'),
    );
    zip.addFile(
      'second.kml',
      Buffer.from('<kml><Document><name>second</name></Document></kml>'),
    );

    const kml = parseKmz(zip.toBuffer());

    expect(kml).toContain('first');
  });
});

describe('parseTrackKml', () => {
  it('parses the NHC TRACK KMZ into the longest forecast LineString', () => {
    const track = parseTrackKml(parseKmz(fixture('ep142026_005adv_TRACK.kmz')));

    expect(track).not.toBeNull();
    expect(track?.atcfId).toBe('EP142026');
    expect(track?.advisoryNumber).toBe(5);
    expect(track?.lineString.type).toBe('LineString');
    expect(track?.lineString.coordinates).toHaveLength(9);
    expect(track?.lineString.coordinates[0]).toEqual([-120.5, 16.5]);
  });

  it('returns null for an empty KML string', () => {
    expect(parseTrackKml('')).toBeNull();
  });

  it('returns null for whitespace-only KML', () => {
    expect(parseTrackKml('   \n\t  ')).toBeNull();
  });

  it('returns null when there are no Placemarks', () => {
    const kml = `
      <?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>No placemarks</name>
        </Document>
      </kml>
    `;

    expect(parseTrackKml(kml)).toBeNull();
  });

  it('returns null when there are no LineStrings', () => {
    const kml = `
      <?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <Point>
              <coordinates>-120.5,16.5,0</coordinates>
            </Point>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseTrackKml(kml)).toBeNull();
  });

  it('returns null when a LineString has fewer than two valid positions', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>-120.5,16.5,0</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseTrackKml(kml)).toBeNull();
  });

  it('ignores malformed coordinate tokens', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>
                invalid
                -120.5,16.5,0
                bad,coordinate
                -121.5,17.0,0
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track).not.toBeNull();
    expect(track?.lineString.coordinates).toEqual([
      [-120.5, 16.5],
      [-121.5, 17.0],
    ]);
  });

  it('ignores non-finite longitude and latitude values', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>
                NaN,17
                Infinity,18
                -Infinity,19
                -120.5,16.5
                -121.5,17.0
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track).not.toBeNull();
    expect(track?.lineString.coordinates).toEqual([
      [-120.5, 16.5],
      [-121.5, 17.0],
    ]);
  });

  it('ignores coordinate tokens without latitude', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>
                -120.5
                -120.5,16.5
                -121.5,17.0
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.lineString.coordinates).toHaveLength(2);
  });

  it('ignores altitude and stores only longitude and latitude', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>
                -120.5,16.5,12345
                -121.5,17.0,-999
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.lineString.coordinates).toEqual([
      [-120.5, 16.5],
      [-121.5, 17.0],
    ]);
  });

  it('selects the longest valid LineString', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>
                -120,16
                -121,17
              </coordinates>
            </LineString>
          </Placemark>

          <Placemark>
            <LineString>
              <coordinates>
                -120,16
                -121,17
                -122,18
                -123,19
              </coordinates>
            </LineString>
          </Placemark>

          <Placemark>
            <LineString>
              <coordinates>
                -120,16
                -121,17
                -122,18
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.lineString.coordinates).toEqual([
      [-120, 16],
      [-121, 17],
      [-122, 18],
      [-123, 19],
    ]);
  });

  it('uses metadata from the Placemark containing the selected longest line', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>
                -120,16
                -121,17
              </coordinates>
            </LineString>
            <ExtendedData>
              <Data name="atcfid">
                <value>WRONG123</value>
              </Data>
              <Data name="advisoryNum">
                <value>1</value>
              </Data>
            </ExtendedData>
          </Placemark>

          <Placemark>
            <LineString>
              <coordinates>
                -120,16
                -121,17
                -122,18
              </coordinates>
            </LineString>
            <ExtendedData>
              <Data name="atcfid">
                <value>EP142026</value>
              </Data>
              <Data name="advisoryNum">
                <value>5</value>
              </Data>
            </ExtendedData>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.atcfId).toBe('EP142026');
    expect(track?.advisoryNumber).toBe(5);
  });

  it('returns null metadata when ExtendedData is missing', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>-120,16 -121,17</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.atcfId).toBeNull();
    expect(track?.advisoryNumber).toBeNull();
  });

  it('returns null metadata for invalid advisory numbers', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>-120,16 -121,17</coordinates>
            </LineString>
            <ExtendedData>
              <Data name="atcfid">
                <value>EP142026</value>
              </Data>
              <Data name="advisoryNum">
                <value>not-a-number</value>
              </Data>
            </ExtendedData>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.atcfId).toBe('EP142026');
    expect(track?.advisoryNumber).toBeNull();
  });

  it('trims metadata values', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>-120,16 -121,17</coordinates>
            </LineString>
            <ExtendedData>
              <Data name="atcfid">
                <value>  EP142026  </value>
              </Data>
              <Data name="advisoryNum">
                <value>  5  </value>
              </Data>
            </ExtendedData>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.atcfId).toBe('EP142026');
    expect(track?.advisoryNumber).toBe(5);
  });

  it('supports repeated ExtendedData entries', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>-120,16 -121,17</coordinates>
            </LineString>
            <ExtendedData>
              <Data name="atcfid"><value>EP142026</value></Data>
              <Data name="advisoryNum"><value>5</value></Data>
            </ExtendedData>
          </Placemark>
        </Document>
      </kml>
    `;

    const track = parseTrackKml(kml);

    expect(track?.atcfId).toBe('EP142026');
    expect(track?.advisoryNumber).toBe(5);
  });
});

describe('parseConeKml', () => {
  it('parses the NHC CONE KMZ into a Polygon', () => {
    const cone = parseConeKml(parseKmz(fixture('ep142026_005adv_CONE.kmz')));

    expect(cone).not.toBeNull();
    expect(cone?.atcfId).toBe('EP142026');
    expect(cone?.advisoryNumber).toBe(5);
    expect(cone?.polygon.type).toBe('Polygon');
    expect(cone?.polygon.coordinates).toHaveLength(1);
    expect(cone?.polygon.coordinates[0].length).toBeGreaterThanOrEqual(4);
  });

  it('returns null for empty KML', () => {
    expect(parseConeKml('')).toBeNull();
  });

  it('returns null when there are no Placemarks', () => {
    expect(parseConeKml('<kml><Document /></kml>')).toBeNull();
  });

  it('returns null when no Polygon exists', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>-120,16 -121,17</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseConeKml(kml)).toBeNull();
  });

  it('skips polygons with fewer than four positions', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    -120,16
                    -121,17
                    -120,16
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseConeKml(kml)).toBeNull();
  });

  it('skips polygons whose ring is not closed', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    -120,16
                    -121,17
                    -122,18
                    -120,17
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseConeKml(kml)).toBeNull();
  });

  it('accepts the minimum valid four-position closed ring', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    -120,16
                    -121,16
                    -121,17
                    -120,16
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const cone = parseConeKml(kml);

    expect(cone).not.toBeNull();
    expect(cone?.polygon.coordinates[0]).toHaveLength(4);
    expect(cone?.polygon.coordinates[0][0]).toEqual(
      cone?.polygon.coordinates[0][3],
    );
  });

  it('skips invalid coordinate tokens but accepts the remaining valid ring', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    invalid
                    -120,16
                    -121,16
                    -121,17
                    -120,16
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const cone = parseConeKml(kml);

    expect(cone).not.toBeNull();
    expect(cone?.polygon.coordinates[0]).toHaveLength(4);
  });

  it('skips malformed polygons and uses the next valid Placemark', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    -120,16
                    -121,17
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>

          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    -120,16
                    -121,16
                    -121,17
                    -120,16
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const cone = parseConeKml(kml);

    expect(cone).not.toBeNull();
    expect(cone?.polygon.coordinates[0]).toHaveLength(4);
  });

  it('returns null metadata when metadata is missing', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    -120,16
                    -121,16
                    -121,17
                    -120,16
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>
    `;

    const cone = parseConeKml(kml);

    expect(cone?.atcfId).toBeNull();
    expect(cone?.advisoryNumber).toBeNull();
  });
});

describe('parseWatchWarningsKml', () => {
  it('parses the NHC Watch/Warning KMZ into coastal segments', () => {
    const segments = parseWatchWarningsKml(
      parseKmz(fixture('al112017_020adv_WW.kmz')),
    );

    expect(segments.length).toBeGreaterThanOrEqual(1);

    expect(segments[0].type).toBe('Hurricane Watch');

    expect(
      segments.every(
        (segment) =>
          segment.lineString.type === 'LineString' &&
          segment.lineString.coordinates.length >= 2,
      ),
    ).toBe(true);
  });

  it('returns an empty list for empty KML', () => {
    expect(parseWatchWarningsKml('')).toEqual([]);
  });

  it('returns an empty list when there are no Placemarks', () => {
    expect(parseWatchWarningsKml('<kml><Document /></kml>')).toEqual([]);
  });

  it('ignores Placemarks without a name', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <LineString>
              <coordinates>-80,25 -81,26</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseWatchWarningsKml(kml)).toEqual([]);
  });

  it('ignores Placemarks with a blank name', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>   </name>
            <LineString>
              <coordinates>-80,25 -81,26</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseWatchWarningsKml(kml)).toEqual([]);
  });

  it('ignores Placemarks without a LineString', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>Hurricane Watch</name>
            <Point>
              <coordinates>-80,25</coordinates>
            </Point>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseWatchWarningsKml(kml)).toEqual([]);
  });

  it('ignores LineStrings with fewer than two valid positions', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>Hurricane Watch</name>
            <LineString>
              <coordinates>-80,25</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    expect(parseWatchWarningsKml(kml)).toEqual([]);
  });

  it('trims the warning type', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>
              Hurricane Warning
            </name>
            <LineString>
              <coordinates>-80,25 -81,26</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const segments = parseWatchWarningsKml(kml);

    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('Hurricane Warning');
  });

  it('parses multiple valid warning segments', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>Hurricane Watch</name>
            <LineString>
              <coordinates>-80,25 -81,26</coordinates>
            </LineString>
          </Placemark>

          <Placemark>
            <name>Hurricane Warning</name>
            <LineString>
              <coordinates>-82,27 -83,28 -84,29</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const segments = parseWatchWarningsKml(kml);

    expect(segments).toHaveLength(2);

    expect(segments[0].type).toBe('Hurricane Watch');
    expect(segments[0].lineString.coordinates).toEqual([
      [-80, 25],
      [-81, 26],
    ]);

    expect(segments[1].type).toBe('Hurricane Warning');
    expect(segments[1].lineString.coordinates).toEqual([
      [-82, 27],
      [-83, 28],
      [-84, 29],
    ]);
  });

  it('ignores malformed coordinates while retaining valid positions', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>Hurricane Watch</name>
            <LineString>
              <coordinates>
                invalid
                -80,25
                bad
                -81,26
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const segments = parseWatchWarningsKml(kml);

    expect(segments).toHaveLength(1);
    expect(segments[0].lineString.coordinates).toEqual([
      [-80, 25],
      [-81, 26],
    ]);
  });

  it('preserves zero-valued coordinates', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>Coastal Watch</name>
            <LineString>
              <coordinates>0,0 0,1 1,1</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const segments = parseWatchWarningsKml(kml);

    expect(segments).toHaveLength(1);
    expect(segments[0].lineString.coordinates).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
  });

  it('accepts negative longitude and latitude values', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>Coastal Watch</name>
            <LineString>
              <coordinates>-180,-90 -179,-89</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const segments = parseWatchWarningsKml(kml);

    expect(segments).toHaveLength(1);
    expect(segments[0].lineString.coordinates).toEqual([
      [-180, -90],
      [-179, -89],
    ]);
  });

  it('accepts coordinates at the positive longitude/latitude boundary', () => {
    const kml = `
      <kml>
        <Document>
          <Placemark>
            <name>Coastal Watch</name>
            <LineString>
              <coordinates>180,90 179,89</coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `;

    const segments = parseWatchWarningsKml(kml);

    expect(segments).toHaveLength(1);
    expect(segments[0].lineString.coordinates).toEqual([
      [180, 90],
      [179, 89],
    ]);
  });
});
