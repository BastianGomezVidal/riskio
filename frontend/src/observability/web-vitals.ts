import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';
import { tracer, telemetryReady } from './telemetry';

/**
 * Core Web Vitals as spans, from real users rather than a lab.
 *
 * LCP, INP and CLS are the three that decide whether Google considers the app
 * fast, and the only way to know their real values is to measure them in the
 * field. A Lighthouse run is a lab number on a machine that is not the user's.
 */
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
  };

  onLCP(send);
  onINP(send);
  onCLS(send);
}
