import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  nextAdvisory,
  maxAdvisoryInDatabase,
} from './dev-fixtures.mjs';

/**
 * The whole point of this tool is to make an ingestion run insert something. An
 * advisory is unique on (storm, advisoryNumber), so getting the number wrong
 * does not fail — it skips silently, and the run looks healthy while proving
 * nothing. These cases are all ways that happens quietly.
 */
describe('contador de advisory', () => {
  let dir: string;
  const silenciar = () => vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fixtures-contador-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  describe('maxAdvisoryInDatabase', () => {
    it('devuelve el maximo cuando la consulta responde', async () => {
      const r = await maxAdvisoryInDatabase('EP142026', {
        query: async () => [{ n: '43' }],
      });
      expect(r).toEqual({ max: 43 });
    });

    it('distingue una base vacia de una base inaccesible', async () => {
      // The case worth separating: a storm with no advisories is a normal
      // first run and needs no warning, while an unreachable database means the
      // number is a guess that may collide.
      const vacia = await maxAdvisoryInDatabase('EP999999', {
        query: async () => [{ n: null }],
      });
      expect(vacia).toEqual({ max: null });

      const caida = await maxAdvisoryInDatabase('EP142026', {
        query: async () => {
          throw new Error('ECONNREFUSED');
        },
      });
      expect(caida).toEqual({ unavailable: 'ECONNREFUSED' });
    });

    it('marca como no disponible cuando no hay ni url ni consulta', async () => {
      const r = await maxAdvisoryInDatabase('EP142026', { url: '' });
      expect(r).toEqual({ unavailable: 'no DATABASE_URL' });
    });
  });

  describe('nextAdvisory', () => {
    it('empieza por encima de lo que ya hay en la base', async () => {
      silenciar();
      const n = await nextAdvisory({
        outDir: dir,
        stormAtcfId: 'EP142026',
        query: async () => [{ n: '43' }],
      });
      expect(n).toBe(44);
    });

    it('usa el contador local cuando la base esta vacia', async () => {
      silenciar();
      await writeFile(
        join(dir, 'state.json'),
        JSON.stringify({ lastAdvisoryNumber: 7 }),
      );

      const n = await nextAdvisory({
        outDir: dir,
        stormAtcfId: 'EP999999',
        query: async () => [{ n: null }],
      });
      expect(n).toBe(8);
    });

    it('arranca en 3 con la base vacia y sin contador previo', async () => {
      silenciar();
      const n = await nextAdvisory({
        outDir: dir,
        stormAtcfId: 'EP999999',
        query: async () => [{ n: null }],
      });
      expect(n).toBe(3);
    });

    it('avisa y sigue con el contador local si la base no responde', async () => {
      const log = silenciar();
      await writeFile(
        join(dir, 'state.json'),
        JSON.stringify({ lastAdvisoryNumber: 10 }),
      );

      const n = await nextAdvisory({
        outDir: dir,
        stormAtcfId: 'EP142026',
        query: async () => {
          throw new Error('ECONNREFUSED');
        },
      });

      expect(n).toBe(11);
      // A silent fallback here is how you end up back at the skipped advisory.
      expect(log.mock.calls.flat().join(' ')).toMatch(/no se pudo leer/);
    });

    it('no toma el maximo de la base si el contador local va mas alto', async () => {
      silenciar();
      await writeFile(
        join(dir, 'state.json'),
        JSON.stringify({ lastAdvisoryNumber: 90 }),
      );

      const n = await nextAdvisory({
        outDir: dir,
        stormAtcfId: 'EP142026',
        query: async () => [{ n: '43' }],
      });
      expect(n).toBe(91);
    });

    it('sobrevive a un state.json a medias', async () => {
      const log = silenciar();
      await writeFile(join(dir, 'state.json'), '{"lastAdvisoryNumber": 4');

      const n = await nextAdvisory({
        outDir: dir,
        stormAtcfId: 'EP142026',
        query: async () => [{ n: '43' }],
      });

      // Unparseable, so the file is ignored and the database decides. The old
      // behaviour was an unhandled JSON parse error.
      expect(n).toBe(44);
      expect(log.mock.calls.flat().join(' ')).toMatch(/state.json ilegible/);
    });

    it('descarta un state.json con un numero que no es un entero', async () => {
      silenciar();
      await writeFile(
        join(dir, 'state.json'),
        JSON.stringify({ lastAdvisoryNumber: 'NaN' }),
      );

      const n = await nextAdvisory({
        outDir: dir,
        stormAtcfId: 'EP142026',
        query: async () => [{ n: '43' }],
      });
      expect(n).toBe(44);
    });

    it('rechaza un --advisory que no sea un entero >= 1, en vez de renderizar NaN', async () => {
      for (const malo of ['abc', '0', '-3', '1.5']) {
        await expect(
          nextAdvisory({ explicit: malo, outDir: dir, stormAtcfId: 'EP142026' }),
        ).rejects.toThrow(/entero >= 1/);
      }
    });

    it('respeta un --advisory explicito por encima de todo', async () => {
      const n = await nextAdvisory({
        explicit: '999',
        outDir: dir,
        stormAtcfId: 'EP142026',
        query: async () => [{ n: '43' }],
      });
      expect(n).toBe(999);
    });
  });
});
