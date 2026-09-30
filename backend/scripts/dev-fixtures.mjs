#!/usr/bin/env node
/**
 * Development fixture server for the NOAA feeds.
 *
 * Exists because a manual ingestion run against the real feed proves nothing.
 * NHC republishes the same advisories, so `advisoriesInserted` comes back 0,
 * the cache is not invalidated because nothing was written, and the run looks
 * like it worked while exercising none of the write path.
 *
 * So the advisory number and its issue date move on every render. The advisory
 * is unique on (storm, advisoryNumber), so a new number is a genuinely new
 * row: the insert happens, the cache gets invalidated, and the run can be
 * repeated as often as you like without touching the database first.
 *
 * Only two things are templated, and that is not an oversight. The parser takes
 * the advisory number from the TCM item's *title* and nothing else, so the
 * `Number 2` occurrences buried in links and WMO headers are decoration as far
 * as the ingestion is concerned. Templating all fourteen would have been more
 * thorough and more fragile, for no change in what gets written.
 *
 * What is deliberately left alone: the track and forecast times inside the
 * CDATA block. They are real timestamps from the original fixture, so a
 * rendered advisory is issued "now" with a track from its original day. That
 * reads oddly and is harmless — nothing cross-checks the two, and moving them
 * would mean handling five different date formats by string replacement, which
 * is exactly the kind of substitution that silently half-works.
 *
 * Usage:
 *   node scripts/dev-fixtures.mjs              # next advisory, serve on 8099
 *   node scripts/dev-fixtures.mjs --advisory 7
 *   node scripts/dev-fixtures.mjs --render-only
 *   node scripts/dev-fixtures.mjs --out /tmp/otro-servidor
 *   node scripts/dev-fixtures.mjs --port 9000
 */
import { createServer } from 'node:http';
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const fixturesDir = join(root, 'test', 'fixtures');
const templatesDir = join(fixturesDir, 'templates');
const outDirDefault = join(root, '.dev-fixtures');

const MIME = { '.xml': 'application/xml; charset=utf-8' };

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

/**
 * Highest advisory number the database already holds for a storm, or null.
 *
 * `null` covers three different situations and the caller has to treat them
 * differently, so the reason is returned rather than flattened:
 *   - { max: null }  reachable, but the storm has no advisories yet
 *   - { max: 43 }    reachable, and 43 is taken
 *   - { unavailable: '...' }  not reachable, or not asked
 *
 * `query` is injected so this can be tested without a database. Passing a real
 * connection means importing pg, which is a dependency of the image but not
 * something a unit test should open.
 */
export async function maxAdvisoryInDatabase(stormAtcfId, options = {}) {
  const { url = process.env.DATABASE_URL, query } = options;

  if (!url && !query) return { unavailable: 'no DATABASE_URL' };

  try {
    const rows = query
      ? await query(stormAtcfId)
      : await queryViaPg(url, stormAtcfId);
    const value = rows?.[0]?.n;
    return { max: value == null ? null : Number(value) };
  } catch (error) {
    return {
      unavailable: error instanceof Error ? error.message : String(error),
    };
  }
}

async function queryViaPg(url, stormAtcfId) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT max("advisoryNumber") AS n FROM advisories WHERE storm_atcf_id = $1',
      [stormAtcfId],
    );
    return rows;
  } finally {
    // A pool left open keeps the process alive, and a dev server that never
    // exits after Ctrl+C is a bad first impression of the tool.
    await client.end().catch(() => undefined);
  }
}

/**
 * The next advisory number to render.
 *
 * Starts above whatever the database already holds, because an advisory is
 * unique on (storm, advisoryNumber) and a collision is not a failed run — it is
 * a silent skip. The first version counted from 3 in a file, and every number
 * after the first already existed in the database from earlier real data, so
 * consecutive runs reported zero inserts and looked like a working system while
 * proving nothing.
 *
 * Falls back to the counter file when the database cannot answer, which is the
 * case on the host, where the port is not published. That is a lesser tool, not
 * a broken one: it may collide, and the run will say so.
 */
export async function nextAdvisory({
  explicit,
  outDir,
  stormAtcfId,
  query,
} = {}) {
  if (explicit !== undefined) {
    const pedido = Number(explicit);
    if (!Number.isInteger(pedido) || pedido < 1) {
      throw new Error(
        `--advisory debe ser un entero >= 1, recibido "${explicit}"`,
      );
    }
    return pedido;
  }

  const enFichero = await lastAdvisoryFromFile(outDir);
  const base = await maxAdvisoryInDatabase(stormAtcfId, { query });

  if ('unavailable' in base) {
    console.log(
      `  avisando: no se pudo leer ${stormAtcfId} de la base (${base.unavailable}); ` +
        'usando el contador local, que puede chocar con datos existentes',
    );
    return enFichero;
  }

  // An empty database is the normal first run, not a problem: the file counter
  // alone is the whole answer.
  if (base.max === null) return enFichero;

  const siguiente = Math.max(enFichero, base.max + 1);
  if (siguiente !== enFichero) {
    console.log(
      `  la base ya tiene el advisory ${base.max} para ${stormAtcfId}; arrancando en ${siguiente}`,
    );
  }
  return siguiente;
}

/**
 * The counter file, defended against the things a half-written file does.
 *
 * A truncated or hand-edited state.json used to take the whole script down with
 * a JSON parse error, which is a poor way to learn that someone interrupted it.
 */
async function lastAdvisoryFromFile(outDir) {
  const statePath = join(outDir, 'state.json');
  if (!existsSync(statePath)) return 3;

  let last;
  try {
    last = JSON.parse(await readFile(statePath, 'utf8')).lastAdvisoryNumber;
  } catch (error) {
    console.log(
      `  state.json ilegible (${error instanceof Error ? error.message : error}); empezando en 2`,
    );
    return 3;
  }

  return Number.isInteger(last) && last >= 1 ? last + 1 : 3;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function variables(advisoryNumber, issuedAt) {
  return {
    ADVISORY_NUMBER: String(advisoryNumber),
    // "Thu, 10 Sep 2026 02:33:27 +0000", the RSS pubDate format.
    ISSUED_RFC822:
      `${DAYS[issuedAt.getUTCDay()]}, ${pad(issuedAt.getUTCDate())} ` +
      `${MONTHS[issuedAt.getUTCMonth()]} ${issuedAt.getUTCFullYear()} ` +
      `${pad(issuedAt.getUTCHours())}:${pad(issuedAt.getUTCMinutes())}:` +
      `${pad(issuedAt.getUTCSeconds())} +0000`,
    // The WMO header stamp is DDHHMM, which is why the original read 100233
    // for day 10 at 02:33.
    WMO_STAMP:
      `${pad(issuedAt.getUTCDate())}${pad(issuedAt.getUTCHours())}` +
      `${pad(issuedAt.getUTCMinutes())}`,
    HEADER_UTC:
      `${pad(issuedAt.getUTCHours())}${pad(issuedAt.getUTCMinutes())} UTC ` +
      `${DAYS[issuedAt.getUTCDay()].toUpperCase()} ${MONTHS[issuedAt.getUTCMonth()]} ` +
      `${issuedAt.getUTCFullYear()}`,
  };
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key) => {
    if (!(key in vars)) {
      throw new Error(
        `plantilla usa {{${key}}} y no hay valor para ella; Known: ${Object.keys(vars).join(', ')}`,
      );
    }
    return vars[key];
  });
}

/**
 * Render every fixture for one advisory number.
 *
 * Split out of main() so the server can do it again on demand: advancing to the
 * next advisory is then one HTTP call instead of a container restart, which
 * matters because restarting used to reset the counter and hand back the same
 * advisory the ingestion had already inserted.
 */
async function renderAll(outDir, advisoryNumber) {
  const issuedAt = new Date();
  const vars = variables(advisoryNumber, issuedAt);

  await mkdir(join(outDir, 'xml'), { recursive: true });

  // Static fixtures, placed at the paths the NHC provider actually requests.
  // The provider asks for index-{basin}.xml and xml/TCM{WALLET}.xml, which are
  // not the names the fixtures are stored under.
  const estaticos = [
    ['nhc-at-empty.xml', 'index-at.xml'],
    ['nhc-ep-active.xml', 'index-ep.xml'],
    ['nhc-cp-active.xml', 'index-cp.xml'],
  ];
  for (const [origen, destino] of estaticos) {
    await copyFile(join(fixturesDir, origen), join(outDir, destino));
  }

  const plantillas = existsSync(templatesDir)
    ? (await readdir(templatesDir)).filter((f) => f.endsWith('.tmpl'))
    : [];
  for (const plantilla of plantillas) {
    // templates/tcm-ep4.xml.tmpl -> xml/TCMEP4.xml
    const nombre = plantilla.replace(/\.xml\.tmpl$/, '');
    const wallet = nombre.split('-').pop().toUpperCase();
    const xml = render(
      await readFile(join(templatesDir, plantilla), 'utf8'),
      vars,
    );
    await writeFile(join(outDir, 'xml', `TCM${wallet}.xml`), xml);
  }

  await writeFile(
    join(outDir, 'state.json'),
    JSON.stringify(
      {
        lastAdvisoryNumber: advisoryNumber,
        renderedAt: issuedAt.toISOString(),
      },
      null,
      2,
    ),
  );

  return { advisoryNumber, issuedAt, outDir };
}

async function main() {
  const port = Number(arg('port', 8099));
  const outDir = arg('out') ? resolve(arg('out')) : outDirDefault;
  // The storm the bundled template belongs to. Its advisory numbers are the
  // ones that have to avoid collision.
  const inicial = await nextAdvisory({
    explicit: arg('advisory'),
    outDir,
    stormAtcfId: arg('storm', 'EP142026'),
  });

  const { advisoryNumber, issuedAt } = await renderAll(outDir, inicial);
  let current = advisoryNumber;

  console.log(`fixtures renderizadas en ${outDir}`);
  console.log(
    `  advisory number: ${advisoryNumber}  (issued ${issuedAt.toISOString()})`,
  );

  if (hasFlag('render-only')) return;

  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);

    /**
     * Advance to the next advisory and re-render. The whole point of the tool:
     * a second ingestion run with the same advisory number inserts nothing and
     * proves nothing, because advisories are unique on (storm, number).
     */
    if (path === '/__next' && req.method === 'POST') {
      current += 1;
      const siguiente = await renderAll(outDir, current);
      console.log(`  -> advisory ${siguiente.advisoryNumber} (POST /__next)`);
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ advisoryNumber: siguiente.advisoryNumber }));
      return;
    }

    const file = join(
      outDir,
      path === '/' ? 'index-ep.xml' : path.replace(/^\/+/, ''),
    );
    if (!file.startsWith(outDir)) {
      res.writeHead(403).end('fuera del directorio de fixtures');
      return;
    }
    try {
      const body = await readFile(file);
      const ext = file.slice(file.lastIndexOf('.'));
      res
        .writeHead(200, { 'Content-Type': MIME[ext] ?? 'text/plain' })
        .end(body);
    } catch {
      res.writeHead(404).end('no existe en los fixtures');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`\n  sirviendo en http://0.0.0.0:${port}`);
    console.log('\n  Point the API at it and run a manual ingest:');
    console.log(`    NHC_BASE_URL=http://host.containers.internal:${port} \\`);
    console.log('      podman-compose up -d --force-recreate backend-api');
    console.log('    curl -X POST http://localhost:3000/admin/ingest/run \\');
    console.log(
      '      -H "Authorization: Bearer $TOKEN" -H "x-api-key: $API_KEY"',
    );
    console.log(
      '\n  Advance to a new advisory (so the next run actually inserts):',
    );
    console.log(`    curl -X POST http://localhost:${port}/__next`);
    console.log('\n  Remember to point it back at NOAA afterwards:');
    console.log('    podman-compose up -d --force-recreate backend-api');
  });
}

// Only when run as a program. Imported by its spec, which needs the functions
// above without a server starting.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
