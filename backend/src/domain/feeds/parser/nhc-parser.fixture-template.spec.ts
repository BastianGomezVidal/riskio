import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { parseRssFeed } from './nhc-parser.js';

const run = promisify(execFile);
const raiz = resolve(import.meta.dirname, '..', '..', '..', '..');
const fixtures = join(raiz, 'test', 'fixtures');
const templates = join(fixtures, 'templates');

/**
 * The dev fixture server only earns its place if the rendered feed is *new* to
 * the parser. Advisory identity is (storm, advisoryNumber), so a template that
 * failed to change the number would produce a run that inserts nothing, skips
 * the cache invalidation and reports success — the exact failure this exists
 * to prevent, and one that a unit test of the parser alone would never show.
 */
describe('plantilla del fixture de ingestión', () => {
  it('cambia el número de advisory y su fecha, que es lo que la ingesta lee', async () => {
    const original = parseRssFeed(
      await readFile(join(fixtures, 'tcm-ep4.xml'), 'utf8'),
    );
    const plantilla = await readFile(
      join(templates, 'tcm-ep4.xml.tmpl'),
      'utf8',
    );
    const renderizado = plantilla
      .replace(/\{\{ADVISORY_NUMBER\}\}/g, '7')
      .replace(/\{\{ISSUED_RFC822\}\}/g, 'Fri, 02 Jan 2032 11:22:33 +0000')
      .replace(/\{\{WMO_STAMP\}\}/g, '021122')
      .replace(/\{\{HEADER_UTC\}\}/g, '1122 UTC FRI JAN 2032');

    const antes = original.items[0].title.match(/Number\s+(\d+)/i)?.[1];
    const despues = parseRssFeed(renderizado).items[0];

    expect(antes).toBe('2');
    expect(despues.title).toMatch(/Number\s+7\b/);
    // The parser reads the number from the title, so the title is the assertion
    // that matters; the date is what makes the advisory look new.
    // pubDate arrives already parsed as a Date, which is what the ingestion
    // stores as issuedAt.
    expect(despues.pubDate).toEqual(new Date('2032-01-02T11:22:33Z'));
  });

  it('deja el XML válido tras el render', async () => {
    const plantilla = await readFile(
      join(templates, 'tcm-ep4.xml.tmpl'),
      'utf8',
    );
    const renderizado = plantilla
      .replace(/\{\{ADVISORY_NUMBER\}\}/g, '9')
      .replace(/\{\{ISSUED_RFC822\}\}/g, 'Sat, 03 Jan 2032 00:00:00 +0000')
      .replace(/\{\{WMO_STAMP\}\}/g, '030000')
      .replace(/\{\{HEADER_UTC\}\}/g, '0000 UTC SAT JAN 2032');

    // parseRssFeed goes through fast-xml-parser, which throws on malformed XML.
    expect(() => parseRssFeed(renderizado)).not.toThrow();
  });

  it('no deja ningún placeholder sin resolver', async () => {
    const archivos = (await readdir(templates)).filter((f) =>
      f.endsWith('.tmpl'),
    );
    expect(archivos.length).toBeGreaterThan(0);

    for (const archivo of archivos) {
      const texto = await readFile(join(templates, archivo), 'utf8');
      const usados = new Set(
        [...texto.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]),
      );

      // The renderer's variables, kept in sync by hand. If a placeholder is
      // added to a template and not here, the render throws at runtime instead
      // of writing a file with a literal {{TOKEN}} in it.
      const conocidas = new Set([
        'ADVISORY_NUMBER',
        'ISSUED_RFC822',
        'WMO_STAMP',
        'HEADER_UTC',
      ]);

      for (const usado of usados) {
        expect(
          conocidas.has(usado),
          `${archivo} usa {{${usado}}}, que el render no conoce`,
        ).toBe(true);
      }
    }
  });

  it('el script renderiza de verdad y avanza el contador', async () => {
    if (!existsSync(join(raiz, 'scripts', 'dev-fixtures.mjs'))) {
      throw new Error('falta scripts/dev-fixtures.mjs');
    }

    // A temp output directory, because rendering into the real one would bump
    // the advisory counter as a side effect of running the test suite. The
    // number a developer gets next would then depend on whether the tests had
    // been run.
    const temporal = await mkdtemp(join(tmpdir(), 'fixtures-test-'));
    try {
      const { stdout } = await run(
        process.execPath,
        [
          join(raiz, 'scripts', 'dev-fixtures.mjs'),
          '--render-only',
          '--advisory',
          '42',
          '--out',
          temporal,
        ],
        { cwd: raiz },
      );

      expect(stdout).toContain('42');
      const estado = JSON.parse(
        await readFile(join(temporal, 'state.json'), 'utf8'),
      );
      expect(estado.lastAdvisoryNumber).toBe(42);

      // The provider asks for these paths; the fixtures are stored under other
      // names, so getting this wrong yields a 404 that looks like empty basins.
      for (const ruta of [
        'index-at.xml',
        'index-ep.xml',
        'index-cp.xml',
        'xml/TCMEP4.xml',
      ]) {
        expect(existsSync(join(temporal, ruta)), `falta ${ruta}`).toBe(true);
      }
    } finally {
      await rm(temporal, { recursive: true, force: true });
    }
  });
});
