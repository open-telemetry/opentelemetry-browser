// intake-bus.ts — decode intercepted OTLP/HTTP JSON and fan it out to the UI.
//
// This module is intentionally free of any `msw` import so it can be pulled
// into the main app bundle (the MSW worker + handlers are code-split and only
// loaded when the mock intake is enabled — see mocks/browser.ts).

// OTLP/HTTP JSON shapes are shared with the e2e test collector (type-only
// import — nothing from that workspace ends up in the sandbox bundle).
import type {
  ExportLogsServiceRequest,
  ExportTraceServiceRequest,
  OtlpAnyValue,
  OtlpKeyValue,
  OtlpSpan,
} from '../../../e2e-tests/utils/otlp-types.ts';

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

function anyValue(v: OtlpAnyValue | undefined): unknown {
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

function keyValues(kvs: OtlpKeyValue[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const kv of kvs) {
    out[kv.key] = anyValue(kv.value);
  }
  return out;
}

function durationMs(span: OtlpSpan): string {
  // start/end are int64 nanoseconds serialized as strings in OTLP JSON.
  const ns = Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano);
  return `${(ns / 1_000_000).toFixed(1)}ms`;
}

function decodeTraces(
  body: ExportTraceServiceRequest,
): Pick<IntakeRequest, 'resource' | 'records'> {
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
          name: span.name ?? '',
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

function decodeLogs(
  body: ExportLogsServiceRequest,
): Pick<IntakeRequest, 'resource' | 'records'> {
  const records: IntakeRecord[] = [];
  let resource: Record<string, unknown> = {};
  for (const rl of body.resourceLogs ?? []) {
    resource = keyValues(rl.resource?.attributes);
    for (const sl of rl.scopeLogs ?? []) {
      const scope = sl.scope?.name || 'unknown';
      for (const log of sl.logRecords ?? []) {
        const attributes = keyValues(log.attributes);
        const logBody = anyValue(log.body);
        records.push({
          kind: 'log',
          scope,
          name: log.severityText || 'LOG',
          detail:
            typeof logBody === 'string' ? logBody : JSON.stringify(logBody),
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

// ── Collector debug-exporter formatting ───────────────────────────────────────
// Mimics the text the OpenTelemetry Collector's `debug` exporter prints
// (verbosity: detailed), so the panel can show "what the collector would log".
// This is a faithful format-only simulation — no real collector is involved.

const SPAN_KINDS = [
  'Unspecified',
  'Internal',
  'Server',
  'Client',
  'Producer',
  'Consumer',
];
const STATUS_CODES = ['Unset', 'Ok', 'Error'];

// Render an OTLP AnyValue with the collector's `Type(value)` notation.
function otlpValue(v: OtlpAnyValue | undefined): string {
  if (v == null) {
    return 'Empty()';
  }
  if ('stringValue' in v) {
    return `Str(${v.stringValue})`;
  }
  if ('boolValue' in v) {
    return `Bool(${v.boolValue})`;
  }
  if ('intValue' in v) {
    return `Int(${v.intValue})`;
  }
  if ('doubleValue' in v) {
    return `Double(${v.doubleValue})`;
  }
  if ('arrayValue' in v) {
    const items = (v.arrayValue?.values ?? []).map(otlpValue).join(', ');
    return `Slice([${items}])`;
  }
  if ('kvlistValue' in v) {
    const items = (v.kvlistValue?.values ?? [])
      .map((kv) => `${kv.key}:${otlpValue(kv.value)}`)
      .join(', ');
    return `Map(${items})`;
  }
  return 'Empty()';
}

function resourceLines(attrs: OtlpKeyValue[] = []): string {
  const lines = attrs.map((a) => `     -> ${a.key}: ${otlpValue(a.value)}`);
  return `Resource attributes:\n${lines.join('\n')}\n`;
}

function attrLines(attrs: OtlpKeyValue[] = [], indent: string): string {
  if (!attrs.length) {
    return '';
  }
  const lines = attrs.map(
    (a) => `${indent}     -> ${a.key}: ${otlpValue(a.value)}`,
  );
  return `${indent}Attributes:\n${lines.join('\n')}\n`;
}

function ts(nano?: string): string {
  if (!nano) {
    return '';
  }
  return new Date(Number(nano) / 1_000_000).toISOString();
}

function severityLabel(n?: number): string {
  if (!n) {
    return 'Unspecified(0)';
  }
  const names = ['', 'Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal'];
  return `${names[Math.min(6, Math.ceil(n / 4))] || 'Unspecified'}(${n})`;
}

function debugTraces(body: ExportTraceServiceRequest): string {
  const out: string[] = [];
  (body.resourceSpans ?? []).forEach((rs, i) => {
    out.push(`ResourceSpans #${i}`, resourceLines(rs.resource?.attributes));
    (rs.scopeSpans ?? []).forEach((ss, j) => {
      out.push(
        `ScopeSpans #${j}`,
        `InstrumentationScope ${ss.scope?.name ?? ''} ${ss.scope?.version ?? ''}`,
      );
      (ss.spans ?? []).forEach((span, k) => {
        out.push(
          `Span #${k}`,
          `    Trace ID       : ${span.traceId ?? ''}`,
          `    Parent ID      : ${span.parentSpanId ?? ''}`,
          `    ID             : ${span.spanId ?? ''}`,
          `    Name           : ${span.name ?? ''}`,
          `    Kind           : ${SPAN_KINDS[span.kind ?? 0] ?? 'Unspecified'}`,
          `    Start time     : ${ts(span.startTimeUnixNano)}`,
          `    End time       : ${ts(span.endTimeUnixNano)}`,
          `    Status code    : ${STATUS_CODES[span.status?.code ?? 0] ?? 'Unset'}`,
          attrLines(span.attributes, '    ').trimEnd(),
        );
      });
    });
  });
  return out.join('\n');
}

function debugLogs(body: ExportLogsServiceRequest): string {
  const out: string[] = [];
  (body.resourceLogs ?? []).forEach((rl, i) => {
    out.push(`ResourceLog #${i}`, resourceLines(rl.resource?.attributes));
    (rl.scopeLogs ?? []).forEach((sl, j) => {
      out.push(
        `ScopeLogs #${j}`,
        `InstrumentationScope ${sl.scope?.name ?? ''} ${sl.scope?.version ?? ''}`,
      );
      (sl.logRecords ?? []).forEach((log, k) => {
        out.push(
          `LogRecord #${k}`,
          `    ObservedTimestamp : ${ts(log.observedTimeUnixNano)}`,
          `    Timestamp         : ${ts(log.timeUnixNano)}`,
          `    SeverityText      : ${log.severityText ?? ''}`,
          `    SeverityNumber    : ${severityLabel(log.severityNumber)}`,
          `    Body              : ${otlpValue(log.body)}`,
          attrLines(log.attributes, '    ').trimEnd(),
          `    Trace ID          : ${log.traceId ?? ''}`,
          `    Span ID           : ${log.spanId ?? ''}`,
        );
      });
    });
  });
  return out.join('\n');
}

/** Format an intercepted request the way the collector's `debug` exporter would. */
export function toCollectorDebug(req: IntakeRequest): string {
  return req.signal === 'traces'
    ? debugTraces(req.raw as ExportTraceServiceRequest)
    : debugLogs(req.raw as ExportLogsServiceRequest);
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  const bytes = new TextEncoder().encode(text).length;
  const { resource, records } =
    signal === 'traces'
      ? decodeTraces(parsed as ExportTraceServiceRequest)
      : decodeLogs(parsed as ExportLogsServiceRequest);

  const req: IntakeRequest = {
    id: ++seq,
    signal,
    url,
    at: Date.now(),
    bytes,
    resource,
    records,
    raw: parsed,
  };

  if (import.meta.env.DEV) {
    console.debug(
      `[intake] ${signal} · ${records.length} record(s) · ${bytes}B`,
      parsed,
    );
  }
  bus.dispatchEvent(new CustomEvent('intake', { detail: req }));
}
