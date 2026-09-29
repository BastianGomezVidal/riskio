// Pushes what audit-web.sh just measured into Pushgateway, in Prometheus text
// format, so the lab numbers and the accessibility findings can be read on the
// same dashboard as the RUM, and survive until the next run.
//
// This went to the collector as OTLP first, which is the project's usual
// ingestion path, and that was wrong for this data. Prometheus scrapes the
// collector every 15s but the audit runs only when someone runs it, so the
// sample went stale five minutes later and every audit_* series vanished;
// measured, not assumed: right after a run, all of them were already expired and
// the panels were empty. Keeping the collector copy alongside Pushgateway was
// tried and dropped, because a bare metric name then matched two series and every
// panel query had to remember to disambiguate. One path, one truth.
//
// Pushgateway holds the last value rather than a time series, so this answers
// "how bad was the last audit", not "how did the audits trend". Turning the
// second group on means a group per run, and then owning the cleanup.
//
//   node .audit/report-metrics.mjs [pushgateway]

import { readFileSync } from "node:fs";

const PUSHGATEWAY = process.argv[2] ?? "http://localhost:9091";

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const metrics = [];
const gauge = (name, unit, value, labels = {}) => {
  metrics.push({ name, unit, value, labels });
};

// --- Lighthouse -------------------------------------------------------------
const lh = readJson(".audit/out/lighthouse.json");

if (lh) {
  const a = lh.audits;
  const score = (c) => lh.categories?.[c]?.score;
  const host = (() => {
    try {
      return new URL(lh.finalDisplayedUrl ?? lh.finalUrl).host;
    } catch {
      return "unknown";
    }
  })();

  if (a["largest-contentful-paint"]) {
    gauge("audit.lcp", "ms", a["largest-contentful-paint"].numericValue, { host, kind: "lab" });
  }
  if (a["cumulative-layout-shift"]) {
    gauge("audit.cls", "1", a["cumulative-layout-shift"].numericValue, { host, kind: "lab" });
  }
  if (a["total-blocking-time"]) {
    gauge("audit.tbt", "ms", a["total-blocking-time"].numericValue, { host, kind: "lab" });
  }
  if (a["first-contentful-paint"]) {
    gauge("audit.fcp", "ms", a["first-contentful-paint"].numericValue, { host, kind: "lab" });
  }
  if (score("performance") != null) {
    gauge("audit.performance.score", "1", score("performance") * 100, { host });
  }
  if (score("accessibility") != null) {
    gauge("audit.accessibility.score", "1", score("accessibility") * 100, { host });
  }
} else {
  console.log("  sin lighthouse.json: no se mandan metricas de lab");
}

// --- axe --------------------------------------------------------------------
const axe = readJson(".audit/out/axe.json");

if (axe) {
  for (const f of axe.findings) {
    for (const v of f.violations) {
      // One series per rule, not per node: the dashboard wants to know "is
      // color-contrast still broken", and a count of nodes answers it without
      // needing a label per element.
      gauge("audit.axe.violations", "1", v.nodes.length, {
        rule: v.id,
        impact: v.impact ?? "unknown",
        route: f.route,
      });
    }
  }
  const critical = axe.findings
    .flatMap((f) => f.violations)
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .reduce((n, v) => n + v.nodes.length, 0);
  gauge("audit.axe.critical", "1", critical, { scope: "critical_or_serious" });
}

if (metrics.length === 0) {
  console.log("  nada que enviar");
  process.exit(0);
}

// --- Pushgateway -------------------------------------------------------------
// Prometheus scrapes the collector every 15s, and the audit runs only when
// someone runs it, so a sample pushed through there went stale five minutes later
// and every audit_* series disappeared. Verified rather than assumed: right
// after a run, all of them were already expired and the panels were empty.
// Pushgateway holds the last value until it is replaced.
//
// Names have to match what the dashboard queries, which are the names the
// collector's Prometheus exporter used to produce: it turns dots into
// underscores and appends the unit, so `audit.lcp` in ms is
// `audit_lcp_milliseconds` and `audit.performance.score` in unitless is
// `audit_performance_score_ratio`. Those came from asking Prometheus what it
// actually held, not from assuming a convention.
const UNIT_SUFFIX = { ms: "milliseconds", 1: "ratio", s: "seconds", "": "" };

const exportName = (name, unit) => {
  const base = name.replace(/\./g, "_");
  const suffix = UNIT_SUFFIX[unit] ?? "";
  return base.endsWith(`_${suffix}`) ? base : `${base}_${suffix}`;
};

const escapeLabel = (v) =>
  String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

const exposition =
  metrics
    .map((m) => {
      const name = exportName(m.name, m.unit);
      const labels = Object.entries(m.labels)
        .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
        .join(",");
      // A trailing newline per block keeps the format parseable; without it
      // Pushgateway rejects the whole body with a parsing error at EOF.
      return `# TYPE ${name} gauge\n${name}${labels ? `{${labels}}` : ""} ${m.value}\n`;
    })
    .join("") + "\n";

try {
  // PUT replaces the whole job group, so a rule that stopped violating drops out
  // of the last result instead of lingering at its old count.
  const res = await fetch(`${PUSHGATEWAY.replace(/\/$/, "")}/metrics/job/riskio_audit`, {
    method: "PUT",
    headers: { "Content-Type": "text/plain; version=0.0.4" },
    body: exposition,
  });
  if (res.ok) {
    console.log(`  ultimo resultado retenido en pushgateway (${PUSHGATEWAY})`);
    console.log(
      "    " + [...new Set(metrics.map((m) => exportName(m.name, m.unit)))].join(", "),
    );
  } else {
    console.log(
      `  pushgateway respondio ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
    console.log("  las metricas no se han enviado; el informe local sigue siendo valido");
  }
} catch (err) {
  console.log(`  pushgateway no disponible en ${PUSHGATEWAY}: ${err.message}`);
  console.log("  las metricas no se han enviado; el informe local sigue siendo valido");
}
