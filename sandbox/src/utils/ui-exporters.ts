// ui-exporters.ts — Callback-based exporters that pipe OTel signals into the UI log.

import { ExportResultCode } from '@opentelemetry/core';
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace';

type LogCallback = (type: string, msg: string) => void;

function shortSession(attrs: Record<string, unknown> | undefined): string {
  const id = attrs?.['session.id'];
  return typeof id === 'string' ? ` · session=${id.slice(0, 8)}…` : '';
}

export function createUISpanExporter(onSpan: LogCallback): SpanExporter {
  return {
    export(spans: ReadableSpan[], cb) {
      for (const span of spans) {
        const [secs, nanos] = span.duration;
        const ms = (secs * 1_000 + nanos / 1_000_000).toFixed(1);
        const err = span.status.code === 2;
        const traceId = `${span.spanContext().traceId.slice(0, 16)}…`;
        onSpan(
          err ? 'error' : 'span',
          `[span] ${span.name} · ${ms}ms · trace=${traceId}${shortSession(span.attributes)}`,
        );
      }
      cb({ code: ExportResultCode.SUCCESS });
    },
    shutdown() {
      return Promise.resolve();
    },
  };
}

// Log records emitted by event-based instrumentations carry their name in
// `eventName` and no body, so fall back to it instead of rendering "undefined".
function describeBody(record: ReadableLogRecord): string {
  if (typeof record.body === 'string') {
    return record.body;
  }
  if (record.body === undefined) {
    return record.eventName ?? '';
  }
  return JSON.stringify(record.body);
}

export function createUILogExporter(onLog: LogCallback): LogRecordExporter {
  return {
    export(
      records: ReadableLogRecord[],
      cb: (result: { code: ExportResultCode }) => void,
    ) {
      for (const r of records) {
        const sev = r.severityText ?? 'INFO';
        onLog(
          'muted',
          `[log] ${sev} · ${describeBody(r)}${shortSession(r.attributes)}`,
        );
      }
      cb({ code: ExportResultCode.SUCCESS });
    },
    shutdown() {
      return Promise.resolve();
    },
    forceFlush() {
      return Promise.resolve();
    },
  };
}
