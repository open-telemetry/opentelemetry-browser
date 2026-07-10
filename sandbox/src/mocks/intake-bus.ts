// intake-bus.ts — decode intercepted OTLP/HTTP JSON and fan it out to the UI.
//
// This module is intentionally free of any `msw` import so it can be pulled
// into the main app bundle (the MSW worker + handlers are code-split and only
// loaded when the mock intake is enabled — see mocks/browser.ts).

export type Signal = 'traces' | 'logs';

export interface IntakeRecord {
  kind: 'span' | 'log';
  /** Instrumentation scope that produced the record, e.g. "…/instrumentation-fetch". */
  scope: string;
  /** Span name, or the log severity for log records. */
  name: string;
  /** Short human detail: span duration ("156.0ms") or the log body. */
  detail: string;
  traceId?: string;
  spanId?: string;
  sessionId?: string;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, unknown>;
}

export interface IntakeRequest {
  id: number;
  signal: Signal;
  /** Full URL the SDK POSTed to (e.g. http://localhost:4318/v1/traces). */
  url: string;
  /** Epoch millis the request was intercepted. */
  at: number;
  /** Byte size of the JSON payload on the wire. */
  bytes: number;
  /** Resource attributes shared by every record in the request. */
  resource: Record<string, unknown>;
  records: IntakeRecord[];
  /** The raw OTLP JSON, kept for the "raw" toggle. */
  raw: unknown;
}

// ── OTLP AnyValue / KeyValue decoding ─────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: OTLP JSON is dynamically shaped.
type Json = any;

function anyValue(v: Json): unknown {
  if (v == null) {
    return undefined;
  }
  if ('stringValue' in v) {
    return v.stringValue;
  }
  if ('boolValue' in v) {
    return v.boolValue;
  }
  if ('intValue' in v) {
    return Number(v.intValue);
  }
  if ('doubleValue' in v) {
    return v.doubleValue;
  }
  if ('arrayValue' in v) {
    return (v.arrayValue?.values ?? []).map(anyValue);
  }
  if ('kvlistValue' in v) {
    return keyValues(v.kvlistValue?.values);
  }
  return undefined;
}

function keyValues(kvs: Json[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const kv of kvs) {
    out[kv.key] = anyValue(kv.value);
  }
  return out;
}

function durationMs(span: Json): string {
  // start/end are int64 nanoseconds serialized as strings in OTLP JSON.
  const ns = Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano);
  return `${(ns / 1_000_000).toFixed(1)}ms`;
}

function decodeTraces(body: Json): Pick<IntakeRequest, 'resource' | 'records'> {
  const records: IntakeRecord[] = [];
  let resource: Record<string, unknown> = {};
  for (const rs of body.resourceSpans ?? []) {
    resource = keyValues(rs.resource?.attributes);
    for (const ss of rs.scopeSpans ?? []) {
      const scope = ss.scope?.name || 'unknown';
      for (const span of ss.spans ?? []) {
        const attributes = keyValues(span.attributes);
        const code = span.status?.code;
        records.push({
          kind: 'span',
          scope,
          name: span.name,
          detail: durationMs(span),
          traceId: span.traceId,
          spanId: span.spanId,
          sessionId: attributes['session.id'] as string | undefined,
          status: code === 2 ? 'error' : code === 1 ? 'ok' : 'unset',
          attributes,
        });
      }
    }
  }
  return { resource, records };
}

function decodeLogs(body: Json): Pick<IntakeRequest, 'resource' | 'records'> {
  const records: IntakeRecord[] = [];
  let resource: Record<string, unknown> = {};
  for (const rl of body.resourceLogs ?? []) {
    resource = keyValues(rl.resource?.attributes);
    for (const sl of rl.scopeLogs ?? []) {
      const scope = sl.scope?.name || 'unknown';
      for (const log of sl.logRecords ?? []) {
        const attributes = keyValues(log.attributes);
        const body = anyValue(log.body);
        records.push({
          kind: 'log',
          scope,
          name: log.severityText || 'LOG',
          detail: typeof body === 'string' ? body : JSON.stringify(body),
          traceId: log.traceId,
          spanId: log.spanId,
          sessionId: attributes['session.id'] as string | undefined,
          status: 'unset',
          attributes,
        });
      }
    }
  }
  return { resource, records };
}

// ── Pub/sub ───────────────────────────────────────────────────────────────────

const bus = new EventTarget();
let seq = 0;

export function onIntake(cb: (req: IntakeRequest) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<IntakeRequest>).detail);
  bus.addEventListener('intake', handler);
  return () => bus.removeEventListener('intake', handler);
}

/**
 * Parse an intercepted OTLP/HTTP JSON body and publish it to subscribers.
 * Called by the MSW request handlers.
 */
export function ingest(signal: Signal, url: string, text: string): void {
  let body: Json;
  try {
    body = JSON.parse(text);
  } catch {
    return;
  }
  const bytes = new TextEncoder().encode(text).length;
  const { resource, records } =
    signal === 'traces' ? decodeTraces(body) : decodeLogs(body);

  const req: IntakeRequest = {
    id: ++seq,
    signal,
    url,
    at: Date.now(),
    bytes,
    resource,
    records,
    raw: body,
  };

  if (import.meta.env.DEV) {
    console.debug(
      `[intake] ${signal} · ${records.length} record(s) · ${bytes}B`,
      body,
    );
  }
  bus.dispatchEvent(new CustomEvent('intake', { detail: req }));
}
