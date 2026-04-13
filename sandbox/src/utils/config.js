// config.js — SDK config defaults, QS parser, and form reader
//
// Query string parameters:
//   serviceName    → config.serviceName
//   serviceVersion → config.serviceVersion
//   tracesUrl      → config.tracesUrl   (full OTLP traces endpoint)
//   logsUrl        → config.logsUrl     (full OTLP logs endpoint)
//   attrs          → config.customAttributes  (URL-encoded JSON)

export const DEFAULTS = {
  serviceName: 'browser-demo',
  serviceVersion: '1.0.0',
  tracesUrl: 'http://localhost:4318/v1/traces',
  logsUrl: 'http://localhost:4318/v1/logs',
};

function parseJson(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Load config from the page URL query string. Falls back to defaults. */
export function parseConfigFromQueryString() {
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
function field(id) {
  return document.getElementById(id)?.value.trim() ?? '';
}

export function readConfigFromForm() {
  return {
    serviceName: field('ub-sn') || DEFAULTS.serviceName,
    serviceVersion: field('ub-sv') || DEFAULTS.serviceVersion,
    tracesUrl: field('ub-traces-url') || DEFAULTS.tracesUrl,
    logsUrl: field('ub-logs-url') || DEFAULTS.logsUrl,
    customAttributes: {}, // populated separately via readCustomAttributes()
  };
}
