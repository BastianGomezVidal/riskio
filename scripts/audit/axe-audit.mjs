// Runs axe-core over the real, running SPA — the one nginx serves, not a build
// in isolation — and injects a session so the protected routes are reachable.
// Without a token, ProtectedRoute redirects to the sign-in screen and every
// protected page would silently be audited as the sign-in page instead.
//
// The token is optional: set AUDIT_TOKEN to audit the authenticated routes.
// With it, the run says so, because an audit that quietly covered two public
// pages out of eight is not the audit anyone thinks they ran.
//
//   node scripts/audit/axe-audit.mjs http://localhost/
//   AUDIT_TOKEN=ey... node scripts/audit/axe-audit.mjs http://localhost/

import puppeteer from "puppeteer-core";
import { AxePuppeteer } from "@axe-core/puppeteer";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost/";
const TOKEN = process.env.AUDIT_TOKEN ?? "";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";

const PUBLIC_ROUTES = ["/", "/signup", "/forgot"];
const PROTECTED_ROUTES = ["/dashboard", "/storms", "/settings"];

const consoleErrors = [];

const severityRank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const pad = (s, n) => String(s).padEnd(n);

function totalViolations(violations) {
  return violations.reduce((n, v) => n + v.nodes.length, 0);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const findings = [];
const routes = TOKEN ? [...PUBLIC_ROUTES, ...PROTECTED_ROUTES] : PUBLIC_ROUTES;

if (!TOKEN) {
  console.log(
    "  note: no AUDIT_TOKEN, so the protected routes are skipped.\n" +
      "        get one with: curl -s -X POST http://localhost:3000/auth/login \\\n" +
      "          -H 'Content-Type: application/json' \\\n" +
      "          -d '{\"email\":\"...\",\"password\":\"...\"}'",
  );
}

for (const route of routes) {
  const url = new URL(route, BASE).toString();
  const page = await browser.newPage();
  // Small desktop viewport. Lighthouse runs mobile by default; mixing the two
  // in one report is how you end up chasing a difference that is only the
  // viewport.
  await page.setViewport({ width: 1280, height: 900 });
  await page.setCacheEnabled(false);

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Favicon 404s are not a finding.
      if (!text.includes("favicon")) {
        consoleErrors.push(`${route}  ${text.slice(0, 160)}`);
      }
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`${route}  pageerror: ${String(err).slice(0, 160)}`);
  });

  // The token is read by frontend/src/auth/session.ts from this key, and the
  // SPA reads it on the first render, so it has to exist before navigation.
  if (TOKEN) {
    await page.evaluateOnNewDocument((token) => {
      window.localStorage.setItem("riskio.accessToken", token);
      window.localStorage.setItem("riskio.cookieConsent", "accepted");
    }, TOKEN);
  } else {
    await page.evaluateOnNewDocument(() => {
      window.localStorage.setItem("riskio.cookieConsent", "accepted");
    });
  }

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  } catch {
    // networkidle2 never settles on a page that polls; load is enough for axe,
    // which only needs the DOM.
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
  }
  // The SPA renders after hydration; axe on an empty body reports nothing and
  // looks like a pass.
  await new Promise((r) => setTimeout(r, 1200));

  const result = await new AxePuppeteer(page)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();

  const url_ = page.url();
  const redirected = !url_.endsWith(new URL(route, BASE).pathname);
  findings.push({ route, violations: result.violations, redirected, url: url_ });
  await page.close();
}

await browser.close();

mkdirSync("scripts/audit/out", { recursive: true });
writeFileSync(
  "scripts/audit/out/axe.json",
  JSON.stringify({ base: BASE, token: Boolean(TOKEN), findings }, null, 2),
);

console.log("");
let criticalOrSerious = 0;

for (const { route, violations, redirected, url: landed } of findings) {
  const serious = violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .reduce((n, v) => n + v.nodes.length, 0);
  criticalOrSerious += serious;

  const status = redirected ? `  (redirected to ${landed})` : "";
  console.log(`  ${pad(route, 12)} ${pad(totalViolations(violations) + " nodes", 12)} ${pad(serious + " critical/serious", 20)}${status}`);

  for (const v of [...violations].sort(
    (a, b) => severityRank[a.impact] - severityRank[b.impact],
  )) {
    const first = v.nodes[0];
    const where = first.target.join(" ");
    const help = `${v.help}  ->  ${v.id}${first.failureSummary ? `\n        ${first.failureSummary.split("\n").slice(0, 2).join("\n        ")}` : ""}`;
    console.log(`      [${v.impact}] ${v.nodes.length}x ${help}`);
    console.log(`        ${where.slice(0, 150)}`);
  }
}

console.log("");
if (consoleErrors.length) {
  console.log(`  console errors (not a11y, but they hide findings): ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 10)) console.log(`      ${e}`);
  console.log("");
}

console.log(
  criticalOrSerious > 0
    ? `  axe: ${criticalOrSerious} nodos critical/serious. Falla.`
    : "  axe: sin critical ni serious. Pasa, aunque moderate y minor siguen listados arriba.",
);

writeFileSync("scripts/audit/out/axe.exit", String(criticalOrSerious > 0 ? 1 : 0));
process.exit(criticalOrSerious > 0 ? 1 : 0);
