// Pushes what audit-web.sh just measured into the collector, as OTLP metrics, so
// the lab numbers and the accessibility findings land in the same Prometheus as
// the RUM and can be read on one dashboard.
//
// Without this, the audit answers "is it broken right now" and throws the answer
// away. With it, a colour-contrast regression that nobody noticed for six weeks
// shows up as a step in a graph.
//
// OTLP/HTTP with a JSON body, hand-built, because the alternative is a metrics
// SDK in the .audit dependencies to emit three gauges. The wire format for a
// gauge is small and stable, and this keeps the audit free of another package.
//
//   node .audit/report-metrics.mjs [collector]

import { readFileSync } from "node:fs";

const COLLECTOR = process.argv[2] ?? "http://localhost:4318";

const str = (v) => ({ stringValue: String(v) });
const attrs = (obj) =>
  Object.entries(obj).map(([key, value]) => ({ key, value: str(value) }));

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const metrics = [];
const gauge = (name, unit, value, attributes = {}) => {
  metrics.push({
    name,
    unit,
    gauge: { dataPoints: [{ asDouble: value, attributes: attrs(attributes) }] },
  });
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

const payload = {
  resourceMetrics: [
    {
      resource: {
        attributes: [
          { key: "service.name", value: str("riskio-audit") },
          { key: "service.version", value: str("audit-web") },
        ],
      },
      scopeMetrics: [
        {
          scope: { name: "riskio-audit", version: "1" },
          metrics,
        },
      ],
    },
  ],
};

const url = `${COLLECTOR.replace(/\/$/, "")}/v1/metrics`;

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    console.log(`  ${metrics.length} metricas enviadas a ${url}`);
    console.log(
      "    " +
        metrics
          .map((m) => m.name)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(", "),
    );
  } else {
    console.log(`  el collector respondio ${res.status}: ${(await res.text()).slice(0, 200)}`);
    console.log("  las metricas no se han enviado; el resultado local sigue siendo valido");
  }
} catch (err) {
  console.log(`  no se pudo contactar con ${url}: ${err.message}`);
  console.log("  el collector esta caido o el puerto no es el 4318; el informe local sigue siendo valido");
}
