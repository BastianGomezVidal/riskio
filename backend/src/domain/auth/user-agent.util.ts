/**
 * Minimal User-Agent parser. Extracts browser and OS names.
 *
 * Good enough for display: we do not need versions or devices, only a
 * human-readable label like "Chrome · Linux".
 */
export function parseUserAgent(ua: string | undefined): {
  browser: string | null;
  os: string | null;
} {
  if (!ua) return { browser: null, os: null };

  let browser: string | null = null;
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  let os: string | null = null;
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, os };
}
