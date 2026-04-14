// config.ts — SDK config defaults, QS parser, and form reader
//
// Query string parameters:
//   serviceName    → config.serviceName
//   serviceVersion → config.serviceVersion
//   tracesUrl      → config.tracesUrl   (full OTLP traces endpoint)
//   logsUrl        → config.logsUrl     (full OTLP logs endpoint)
//   attrs          → config.customAttributes  (URL-encoded JSON)

export interface OtelConfig {
  serviceName: string;
  serviceVersion: string;
  tracesUrl: string;
  logsUrl: string;
}

export interface ParsedConfig extends OtelConfig {
  customAttributes: Record<string, string>;
}

export const DEFAULTS: OtelConfig = {
  serviceName: 'browser-demo',
  serviceVersion: '1.0.0',
  tracesUrl: 'http://localhost:4318/v1/traces',
  logsUrl: 'http://localhost:4318/v1/logs',
};

function parseJson(
  raw: string | null,
  fallback: Record<string, string>,
): Record<string, string> {
  if (!raw) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Load config from the page URL query string. Falls back to defaults. */
export function parseConfigFromQueryString(): ParsedConfig {
  const qs = new URLSearchParams(location.search);
  return {
    serviceName: qs.get('serviceName') ?? DEFAULTS.serviceName,
    serviceVersion: qs.get('serviceVersion') ?? DEFAULTS.serviceVersion,
    tracesUrl: qs.get('tracesUrl') ?? DEFAULTS.tracesUrl,
    logsUrl: qs.get('logsUrl') ?? DEFAULTS.logsUrl,
    customAttributes: parseJson(qs.get('attrs'), {}),
  };
}

/** Read current config from the form fields (used at SDK init time). */
function field(id: string): string {
  return (
    (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? ''
  );
}

export function readConfigFromForm(): ParsedConfig {
  return {
    serviceName: field('ub-sn') || DEFAULTS.serviceName,
    serviceVersion: field('ub-sv') || DEFAULTS.serviceVersion,
    tracesUrl: field('ub-traces-url') || DEFAULTS.tracesUrl,
    logsUrl: field('ub-logs-url') || DEFAULTS.logsUrl,
    customAttributes: {}, // populated separately via readCustomAttributes()
  };
}
