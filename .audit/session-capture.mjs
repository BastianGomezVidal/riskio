/**
 * Captures the HTTP calls a real signed-in session makes.
 *
 * Usage:
 *   AUDIT_EMAIL=... AUDIT_PASSWORD=... node .audit/session-capture.mjs [baseUrl]
 *
 * Credentials come from the environment and are never written to disk, echoed,
 * or committed. Nothing here reads .env, on purpose: the audit must be
 * runnable with a throwaway account.
 *
 * Why this exists and what it is careful about, because both cost real time to
 * learn:
 *
 * 1. Count the OPTIONS. The app calls the API at localhost:3000 while the page
 *    is served from localhost:80, so it is cross-origin and every single call
 *    is preceded by a CORS preflight. Ignoring those halves the picture. A
 *    preflight answers 204 and the real call answers 200, and if you match
 *    responses to requests by URL you will report the 204 for both and conclude
 *    the API returns No Content.
 *
 * 2. Navigate client-side. Using page.goto() between phases is a full reload,
 *    which throws away the React Query cache, so /users/me and
 *    /dashboard/summary each get fetched a second time. That measures the
 *    harness rather than the app: it reported 6 API calls where the real
 *    session makes 3. Clicking the nav links, as a person would, keeps the
 *    cache and the dashboard mount costs zero requests.
 *
 * 3. Report the phase, so a number can be attributed to a page.
 */

import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost/").replace(/\/?$/, "/");
const EMAIL = process.env.AUDIT_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error(
    "uso: AUDIT_EMAIL=... AUDIT_PASSWORD=... node .audit/session-capture.mjs [baseUrl]",
  );
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });

/** request -> record, so the response is paired with the request that made it */
const pending = new Map();
const calls = [];
let phase = "arranque";

const isOtel = (url) => /:4318\//.test(url) || /\/v1\/(traces|metrics)$/.test(url);
const isApi = (url) => /:\d{4,5}\/(auth|users|dashboard|storms)/.test(url);
const kindOf = (url) => (isOtel(url) ? "otlp" : isApi(url) ? "api" : "asset");
const rel = (url) => url.replace(BASE, "/").replace(/^https?:\/\/[^/]+/, (m) => m.replace(/:\d+$/, ""));

page.on("request", (req) => {
  const rec = {
    phase,
    method: req.method(),
    url: req.url(),
    type: req.resourceType(),
    kind: kindOf(req.url()),
    at: Date.now(),
    status: null,
    ms: null,
  };
  pending.set(req, rec);
  calls.push(rec);
});

page.on("response", (res) => {
  const rec = pending.get(res.request());
  if (!rec) return;
  rec.status = res.status();
  rec.ms = Date.now() - rec.at;
});

page.on("requestfailed", (req) => {
  const rec = pending.get(req);
  if (rec) {
    rec.status = "FALLO";
    rec.ms = Date.now() - rec.at;
    rec.error = req.failure()?.errorText;
  }
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function report(label) {
  const rows = calls.filter((c) => c.phase === label);
  const preflight = rows.filter((c) => c.method === "OPTIONS");
  const real = rows.filter((c) => c.method !== "OPTIONS");
  const api = real.filter((c) => c.kind === "api");
  const otlp = real.filter((c) => c.kind === "otlp");
  const assets = real.filter((c) => c.kind === "asset");

  console.log(`\n=== ${label} ===`);
  console.log(
    `    ${rows.length} HTTP: ${preflight.length} preflight + ${api.length} api + ${otlp.length} otlp + ${assets.length} assets`,
  );
  for (const c of rows) {
    const tag = c.method === "OPTIONS" ? "preflight" : c.kind;
    console.log(
      `      ${String(c.status ?? "---").padEnd(5)} ${String(c.ms ?? "").padStart(6)}ms  ${tag.padEnd(9)} ${c.method.padEnd(7)} ${rel(c.url).slice(0, 58)}`,
    );
  }
  return {
    label,
    http: rows.length,
    preflight: preflight.length,
    api: api.length,
    otlp: otlp.length,
    assets: assets.length,
  };
}

async function clickNav(text) {
  const ok = await page.evaluate((t) => {
    const a = [...document.querySelectorAll("a[href]")].find((x) =>
      x.textContent.trim().toLowerCase().includes(t),
    );
    if (!a) return false;
    a.click();
    return true;
  }, text);
  if (!ok) return false;
  await wait(4500);
  return true;
}

const phases = [];

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
await wait(1500);
phases.push(report("arranque"));

phase = "login";
await page.waitForSelector("#email", { timeout: 15000 });
await page.type("#email", EMAIL, { delay: 8 });
await page.type("#password", PASSWORD, { delay: 8 });
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await wait(3000);
phases.push(report("login"));

phase = "dashboard";
if (!(await clickNav("dashboard"))) {
  await page.goto(`${BASE}dashboard`, { waitUntil: "networkidle2" }).catch(() => {});
  await wait(4000);
}
phases.push(report("dashboard"));

phase = "storms";
if (!(await clickNav("storm"))) {
  await page.goto(`${BASE}storms`, { waitUntil: "networkidle2" }).catch(() => {});
  await wait(4500);
}
phases.push(report("storms"));

const totals = phases.reduce(
  (a, p) => ({
    http: a.http + p.http,
    preflight: a.preflight + p.preflight,
    api: a.api + p.api,
    otlp: a.otlp + p.otlp,
    assets: a.assets + p.assets,
  }),
  { http: 0, preflight: 0, api: 0, otlp: 0, assets: 0 },
);

console.log("\n=== TOTAL ===");
console.log(`    ${totals.http} peticiones HTTP en total`);
console.log(`    ${totals.preflight} preflight CORS`);
console.log(`    ${totals.api} llamadas a la API de negocio`);
console.log(`    ${totals.otlp} al collector (OTLP)`);
console.log(`    ${totals.assets} assets estaticos`);
console.log(
  `    de los cuales, por datos: ${totals.api} llamadas + ${totals.preflight} preflight = ${totals.api + totals.preflight}`,
);

const out = "/tmp/opencode/session-capture.json";
writeFileSync(out, JSON.stringify({ phases, totals, calls }, null, 2));
console.log(`\n  detalle: ${out}`);

await browser.close();
