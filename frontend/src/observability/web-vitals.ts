import { onCLS, onINP, onLCP, type Metric } from "web-vitals";
import { tracer, telemetryReady, getMeter, flushMetrics } from "./telemetry";

/**
 * Core Web Vitals, from real users rather than a lab.
 *
 * LCP, INP and CLS are the three that decide whether Google considers the app
 * fast, and the only way to know their real values is to measure them in the
 * field. A Lighthouse run is a lab number on a machine that is not the user's.
 *
 * Each value is reported twice, and the duplication is deliberate:
 *
 * - As a span, so a single slow load can be opened in Jaeger next to the HTTP
 *   calls and React renders that explain it. This is the diagnostic view.
 * - As a histogram, so Prometheus can keep the distribution and Grafana can draw
 *   the 75th percentile per route. This is the number that goes in a report,
 *   because the p75 over real sessions is what Google scores, and no amount of
 *   span browsing produces a percentile.
 *
 * Attributes are low cardinality on purpose. `route` is the pathname with ids
 * removed, so /storms/EP142026 and /storms/EP152026 are one series rather than
 * one per storm — a storm directory with thousands of entries would otherwise
 * create thousands of time series and make Prometheus expensive for no gain.
 */
function anonymiseRoute(pathname: string): string {
  return pathname
    .replace(/\/storms\/[A-Z]{2}\d{6,}/gi, "/storms/:id")
    .replace(
      /\/storms\/[A-Z]{2}\d{6,}\/advisories\/\d+/gi,
      "/storms/:id/advisories/:n",
    );
}

export function reportWebVitals(): void {
  if (!telemetryReady) return;

  const send = (metric: Metric) => {
    const span = tracer.startSpan(`web-vital ${metric.name}`, {
      attributes: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        navigation_type: metric.navigationType,
      },
    });
    span.end();

    // The span above is fire and forget. The histogram needs the meter, which
    // is a dynamic import, and a metric can be reported before it resolves —
    // web-vitals fires LCP as soon as the page is interactive. So the value is
    // recorded once the meter arrives, and a failure here is swallowed: losing
    // a data point is better than an unhandled rejection in the console of
    // someone's session.
    const route = anonymiseRoute(window.location.pathname);
    const attributes = {
      metric: metric.name,
      route,
      rating: metric.rating,
      navigation: metric.navigationType,
      viewport: window.innerWidth < 768 ? "mobile" : "desktop",
    };

    getMeter()
      .then((meter) => {
        // CLS is a unitless score, the other two are milliseconds. Reporting
        // CLS in a millisecond histogram would make the units a lie in the
        // dashboard.
        const histogram = meter.createHistogram(`web.vitals.${metric.name}`, {
          unit: metric.name === "CLS" ? "1" : "ms",
          description: `${metric.name} reported by real user sessions`,
        });
        histogram.record(metric.value, attributes);

        // The rating as its own counter, alongside the histogram.
        //
        // The histogram answers "how slow", and a p75 of 612 ms does not tell a
        // reader whether that is fine. The rating is the judgement already made:
        // good, needs-improvement or poor, against Google's thresholds. Counting
        // it separately gives a share that can be read at a glance, which is how
        // these numbers usually get reported.
        //
        //   100 * sum by (rating) (rate(web_vitals_rating_total{metric="LCP"}[30m]))
        //   / sum(rate(web_vitals_rating_total{metric="LCP"}[30m]))
        //
        // Three label values on top of the ones the histogram already carries, so
        // the cardinality is the same series with a `rating` dimension rather than
        // a new family.
        const ratingCounter = meter.createCounter("web.vitals.rating", {
          description: "Core Web Vitals ratings from real user sessions",
        });
        ratingCounter.add(1, { ...attributes, rating: metric.rating });

        // Send it now. Waiting on the reader's interval loses the measurement
        // whenever the page goes away first, which for a vital is most of the
        // time.
        return flushMetrics();
      })
      .catch((err) => {
        // Loud on purpose. This was a silent catch, and the silence is why a
        // metric pipeline that never once delivered a data point looked like a
        // traffic problem rather than a bug. The page still works; that is the
        // only reason this is a warning and not a throw.
        console.warn("[telemetry] web vitals not recorded as a metric:", err);
      });
  };

  onLCP(send);
  onINP(send);
  onCLS(send);
}
