// ui-exporters.js — Callback-based exporters that pipe OTel signals into the UI log.

import { ExportResultCode } from '@opentelemetry/core'

export function createUISpanExporter(onSpan) {
  return {
    export(spans, cb) {
      for (const span of spans) {
        const [secs, nanos] = span.duration
        const ms = (secs * 1_000 + nanos / 1_000_000).toFixed(1)
        const err = span.status.code === 2
        const traceId = span.spanContext().traceId.slice(0, 16) + '…'
        onSpan(err ? 'error' : 'span', `[span] ${span.name} · ${ms}ms · trace=${traceId}`)
      }
      cb({ code: ExportResultCode.SUCCESS })
    },
    shutdown() { return Promise.resolve() },
  }
}

export function createUILogExporter(onLog) {
  return {
    export(records, cb) {
      for (const r of records) {
        const sev = r.severityText ?? 'INFO'
        const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
        onLog('muted', `[log] ${sev} · ${body}`)
      }
      cb({ code: ExportResultCode.SUCCESS })
    },
    shutdown() { return Promise.resolve() },
  }
}
