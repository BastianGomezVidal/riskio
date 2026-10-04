// A reproducible proof that RUM instrumentation actually delivers data.
//
// Why this exists. The audit and RUM look alike in the dashboard and are not the
// same thing at all:
//
//   audit_*   lab. Lighthouse and axe measure a synthetic visit. Those numbers
//             go to pushgateway and say nothing about how the app feels to a
//             person using it.
//   web_vitals_*   field. Measured in a real browser session. This is the only
//             source that answers "is it fast for users".
//
// So "no data in the web vitals panels" is the expected state after running
// audit-web.sh, and it is indistinguishable at a glance from "the RUM pipeline
// is broken". This script tells the two apart by watching the real counter move
// across a real page visit:
//
//     LCP count before: 3
//     real page visit
//     LCP count after:  4
//
// A delta of 1 or more means the whole path works: the browser SDK recorded a
// vital, the OTLP POST arrived, the collector accepted it, the Prometheus
// exporter published it, and Prometheus scraped it.
//
// Deliberately does not authenticate. LCP is reported on the landing page, so
// this runs with no credentials and cannot rot when a test account changes.
//
// Deliberately does not inject a synthetic metric. An earlier attempt to prove
// the pipeline by POSTing a made-up datapoint worked and was also wrong: the
// collector's Prometheus exporter uses cumulative counters, so a fake datapoint
// on the real series shifts the histogram permanently and the p75 becomes
// fiction. If you ever need a connectivity probe, use a separate name like
// test_app_latency_seconds, never a production series.
//
//   node scripts/audit/rum-check.mjs [baseUrl] [prometheusUrl]

import puppeteer from "puppeteer-core";

const BASE = (process.argv[2] ?? "http://localhost/").replace(/\/?$/, "/");
const PROMETHEUS = (process.argv[3] ?? "http://localhost:9090").replace(/\/$/, "");

const LCP_COUNT = "sum(web_vitals_LCP_milliseconds_count)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** the current value of a Prometheus instant query, or null if it has no sample */
async function promValue(query) {
  const res = await fetch(`${PROMETHEUS}/api/v1/query?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Prometheus devolvio ${res.status}`);
  const body = await res.json();
  if (body.status !== "success") throw new Error(body.error ?? "query failed");
  const result = body.data?.result ?? [];
  return result.length ? Number(result[0].value[1]) : 0;
}

const otlpPosts = [];
let telemetryWarnings = 0;

console.log("  comprobando que la instrumentacion RUM entrega datos de verdad\n");

const before = await promValue(LCP_COUNT);
console.log(`  LCP count antes:      ${before}`);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on("request", (req) => {
    if (/\/v1\/(traces|metrics)$/.test(req.url()) && req.method() === "POST") {
      otlpPosts.push(req.url().replace(BASE, "/"));
    }
  });
  // The SDK warns loudly when it cannot record a vital. Surfacing it here turns
  // a silent pipeline into a legible one; the same warning used to hide in the
  // console of a session nobody was watching.
  page.on("console", (msg) => {
    if (msg.text().includes("[telemetry]")) telemetryWarnings += 1;
  });

  console.log("  visita real a la portada...");
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });

  // A real person moves the pointer and the page reports INP and CLS. Without
  // any interaction only LCP is guaranteed, and an INP of 0 would be a claim we
  // did not earn.
  await page.mouse.move(200, 300);
  await page.mouse.click(200, 300);
  await page.keyboard.press("Tab");
  await sleep(1500);
} finally {
  await browser.close();
}

console.log(`  POST OTLP desde el navegador: ${otlpPosts.length ? otlpPosts.join(", ") : "NINGUNO"}`);
if (telemetryWarnings) {
  console.log(`  avisos [telemetry] en la pagina: ${telemetryWarnings}`);
  console.log("    el navegador registro pero no pudo enviar; el contador no se movera");
}

// The scrape interval is 15s, so the sample is not visible immediately even
// though the collector had it seconds ago. Poll rather than sleep a fixed guess.
console.log("  esperando al scrape de Prometheus...");
let after = before;
for (let i = 0; i < 12; i += 1) {
  await sleep(5000);
  after = await promValue(LCP_COUNT);
  if (after > before) break;
}

const delta = after - before;
console.log(`  LCP count despues:     ${after}`);
console.log(`  delta:                 ${delta >= 0 ? "+" : ""}${delta}\n`);

if (delta > 0) {
  console.log("  OK: la instrumentacion RUM entrega datos de una sesion real.");
  console.log("     web_vitals_* es la unica fuente que describe como se siente la app.");
  process.exit(0);
}

console.log("  FALLO: el contador no se movio. Siguientes pasos, en este orden:");
console.log("    1. el navegador no mando nada (linea 'POST OTLP ... NINGUNO')");
console.log("       -> el SDK esta apagado: revisa VITE_OTEL_EXPORTER_OTLP_ENDPOINT en el build");
console.log("    2. el navegador mando y Prometheus no lo ve");
console.log("       -> mira el exporter del collector en :8889 y el target 'otel-collector'");
console.log("    3. hay que recordar que el histograma es ACUMULATIVO: reiniciar el collector");
console.log("       lo pone a cero, y por eso una prueba previa puede inflar un p75.");
console.log("");
console.log("    Ojo: que el contador no se mueva con un script headless no prueba que");
console.log("    el RUM este roto. LCP se finaliza al interactuar o al ocultar la pagina,");
console.log("    y por eso hace falta la visita real de este script y no un page.goto.");
process.exit(1);
