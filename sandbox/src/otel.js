// otel.js — SDK initialisation: traces + logs

import { trace } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  LoggerProvider,
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing'
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action'
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'

import { UISpanExporter, UILogExporter } from './app/ui-exporters.js'

// ── initOtel ──────────────────────────────────────────────────────────────────
// tracesUrl and logsUrl are used as-is — no path is appended.
// customAttrs are merged into the Resource so they appear in resource.attributes
// on every span and log record.

export function initOtel(config, customAttrs = {}) {
  // Custom attributes become resource attributes shared by all signals.
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]:    config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    ...customAttrs,
  })

  // ── Traces ──────────────────────────────────────────────────────────────────
  const traceExporter = new OTLPTraceExporter({ url: config.tracesUrl, headers: {} })
  const traceProvider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(traceExporter, {
        maxExportBatchSize:    10,
        scheduledDelayMillis: 1_000,
      }),
      new SimpleSpanProcessor(new UISpanExporter()),
      new SimpleSpanProcessor(new ConsoleSpanExporter()),
    ],
  })
  traceProvider.register()

  // ── Logs ────────────────────────────────────────────────────────────────────
  const logExporter = new OTLPLogExporter({ url: config.logsUrl, headers: {} })
  const logProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(logExporter, {
        maxExportBatchSize:    10,
        scheduledDelayMillis: 1_000,
      }),
      new SimpleLogRecordProcessor(new UILogExporter()),
      new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
    ],
  })
  logs.setGlobalLoggerProvider(logProvider)

  // ── Auto-instrumentations ───────────────────────────────────────────────────
  registerInstrumentations({
    instrumentations: [
      new NavigationTimingInstrumentation(),
      new UserActionInstrumentation(),
      new WebVitalsInstrumentation({ includeRawAttribution: true }),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
      }),
    ],
  })

  return {
    tracer: trace.getTracer(config.serviceName, config.serviceVersion),
    logger: logs.getLogger(config.serviceName, config.serviceVersion),
  }
}
