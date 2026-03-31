// ui-exporters.js — demo-only exporters that pipe OTel signals into the UI log panel
// These are not part of the OTel setup; they just make spans and log records visible
// in the on-page event log without opening DevTools.

import { ExportResultCode } from '@opentelemetry/core'
import { log } from './ui.js'

// ── UISpanExporter ────────────────────────────────────────────────────────────

export class UISpanExporter {
  export(spans, resultCallback) {
    for (const span of spans) {
      const [secs, nanos] = span.duration
      const durationMs = (secs * 1_000 + nanos / 1_000_000).toFixed(1)
      const isError = span.status.code === 2
      const icon    = isError ? 'ERR' : 'OK'
      const traceId = span.spanContext().traceId.slice(0, 16) + '…'
      log('span', `[${icon}] [span] ${span.name} · ${durationMs}ms · trace=${traceId}`)
    }
    resultCallback({ code: ExportResultCode.SUCCESS })
  }
  shutdown() { return Promise.resolve() }
}

// ── UILogExporter ─────────────────────────────────────────────────────────────

export class UILogExporter {
  export(logRecords, resultCallback) {
    for (const record of logRecords) {
      const sev = record.severityText ?? 'INFO'
      const body = typeof record.body === 'string'
        ? record.body
        : JSON.stringify(record.body)
      log('muted', `[log] ${sev} · ${body}`)
    }
    resultCallback({ code: ExportResultCode.SUCCESS })
  }
  shutdown() { return Promise.resolve() }
}
