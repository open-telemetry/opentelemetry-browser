// sdk-config-parser.ts — SDK config defaults and QS parser
//
// Query string parameters:
//   serviceName    → config.serviceName
//   serviceVersion → config.serviceVersion
//   tracesUrl      → config.tracesUrl   (full OTLP traces endpoint)
//   logsUrl        → config.logsUrl     (full OTLP logs endpoint)
//   attrs          → config.customAttributes  (URL-encoded JSON)

import type { OtelConfig } from '../app/types/OtelConfig.type.ts';

export interface OtelConfigWithAttrs extends OtelConfig {
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
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, string>;
    }
  } catch (e) {
    console.error(e);
  }
  return fallback;
}

/** Load config from the page URL query string. Falls back to defaults. */
export function parseSDKConfigFromQueryString(): OtelConfigWithAttrs {
  const qs = new URLSearchParams(location.search);
  return {
    serviceName: qs.get('serviceName') ?? DEFAULTS.serviceName,
    serviceVersion: qs.get('serviceVersion') ?? DEFAULTS.serviceVersion,
    tracesUrl: qs.get('tracesUrl') ?? DEFAULTS.tracesUrl,
    logsUrl: qs.get('logsUrl') ?? DEFAULTS.logsUrl,
    customAttributes: parseJson(qs.get('attrs'), {}),
  };
}
