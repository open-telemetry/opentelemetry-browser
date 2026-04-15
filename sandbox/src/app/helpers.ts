// helpers.ts — shared utility functions for the sandbox UI

import { DEFAULTS } from '../utils/sdkConfigParser.ts';
import type { OtelConfig } from './types/OtelConfig.type.ts';

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

export const LOG_ICONS: Record<string, string> = {
  info: 'i',
  success: '✓',
  error: '✗',
  warn: '!',
  span: '◈',
  nav: '→',
  muted: '·',
};
