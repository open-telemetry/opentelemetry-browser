// helpers.ts — shared utility functions for the sandbox UI

import type { OtelConfig } from '../utils/config.ts';
import { DEFAULTS } from '../utils/config.ts';

export interface Attr {
  id: number;
  key: string;
  val: string;
}

export function attrsObject(customAttrs: Attr[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const a of customAttrs) {
    if (a.key.trim()) {
      obj[a.key.trim()] = a.val.trim();
    }
  }
  return obj;
}

export function currentConfig({
  serviceName,
  serviceVersion,
  tracesUrl,
  logsUrl,
}: OtelConfig): OtelConfig {
  return {
    serviceName: serviceName || DEFAULTS.serviceName,
    serviceVersion: serviceVersion || DEFAULTS.serviceVersion,
    tracesUrl: tracesUrl || DEFAULTS.tracesUrl,
    logsUrl: logsUrl || DEFAULTS.logsUrl,
  };
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSnippet(
  config: OtelConfig,
  attrs: Record<string, string>,
): string {
  const entries = Object.entries(attrs);
  const attrsStr =
    entries.length === 0
      ? ''
      : `,\n  <span class="prop">attributes</span>: {\n${entries
          .map(
            ([k, v]) =>
              `    <span class="prop">${esc(k)}</span>: <span class="str">'${esc(v)}'</span>`,
          )
          .join(',\n')}\n  }`;

  return (
    `<span class="kw">import</span> { <span class="fn">BrowserSDK</span> } <span class="kw">from</span> <span class="str">'@opentelemetry/browser-instrumentation'</span>;\n\n` +
    `<span class="kw">const</span> sdk = <span class="kw">new</span> <span class="fn">BrowserSDK</span>({\n` +
    `  <span class="prop">serviceName</span>:    <span class="str">'${esc(config.serviceName)}'</span>,\n` +
    `  <span class="prop">serviceVersion</span>: <span class="str">'${esc(config.serviceVersion)}'</span>,\n` +
    `  <span class="prop">otlpExporterConfig</span>: {\n` +
    `    <span class="prop">tracesUrl</span>: <span class="str">'${esc(config.tracesUrl)}'</span>,\n` +
    `    <span class="prop">logsUrl</span>:   <span class="str">'${esc(config.logsUrl)}'</span>,\n` +
    `  }${attrsStr},\n` +
    `});\n\nsdk.<span class="fn">start</span>();`
  );
}

export const LOG_ICONS: Record<string, string> = {
  info: 'i',
  success: '✓',
  error: '✗',
  warn: '!',
  span: '◈',
  nav: '→',
  muted: '·',
};
