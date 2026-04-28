// ui-exporters.ts — Callback-based exporters that pipe OTel signals into the UI log.

import { ExportResultCode } from '@opentelemetry/core';
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

type LogCallback = (type: string, msg: string) => void;

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
          `[span] ${span.name} · ${ms}ms · trace=${traceId}`,
        );
      }
      cb({ code: ExportResultCode.SUCCESS });
    },
    shutdown() {
      return Promise.resolve();
    },
  };
}

export function createUILogExporter(onLog: LogCallback): LogRecordExporter {
  return {
    export(
      records: ReadableLogRecord[],
      cb: (result: { code: ExportResultCode }) => void,
    ) {
      for (const r of records) {
        const sev = r.severityText ?? 'INFO';
        const body =
          typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
        onLog('muted', `[log] ${sev} · ${body}`);
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
