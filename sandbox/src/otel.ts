// otel.ts — SDK initialisation: traces + logs

import type { Tracer } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import type { Logger } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import type { OtelConfig } from './utils/config.ts';
import {
  createUILogExporter,
  createUISpanExporter,
} from './utils/ui-exporters.ts';

type LogCallback = (type: string, msg: string) => void;

interface InitOtelOptions {
  onSpan?: LogCallback;
  onLog?: LogCallback;
}

interface OtelHandle {
  tracer: Tracer;
  logger: Logger;
}

// ── initOtel ──────────────────────────────────────────────────────────────────
// onSpan/onLog callbacks push entries into the React app's log state.

export function initOtel(
  config: OtelConfig,
  customAttrs: Record<string, string> = {},
  { onSpan, onLog }: InitOtelOptions = {},
): OtelHandle {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    ...customAttrs,
  });

  // ── Traces ──────────────────────────────────────────────────────────────────
  const traceExporter = new OTLPTraceExporter({
    url: config.tracesUrl,
    headers: {},
  });
  const spanProcessors = [
    new BatchSpanProcessor(traceExporter, {
      maxExportBatchSize: 10,
      scheduledDelayMillis: 1_000,
    }),
    new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ];
  if (onSpan) {
    spanProcessors.push(new SimpleSpanProcessor(createUISpanExporter(onSpan)));
  }

  const traceProvider = new WebTracerProvider({ resource, spanProcessors });
  traceProvider.register();

  // ── Logs ────────────────────────────────────────────────────────────────────
  const logExporter = new OTLPLogExporter({ url: config.logsUrl, headers: {} });
  const logProcessors = [
    new BatchLogRecordProcessor(logExporter, {
      maxExportBatchSize: 10,
      scheduledDelayMillis: 1_000,
    }),
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ];
  if (onLog) {
    logProcessors.push(
      new SimpleLogRecordProcessor(createUILogExporter(onLog)),
    );
  }

  const logProvider = new LoggerProvider({
    resource,
    processors: logProcessors,
  });
  logs.setGlobalLoggerProvider(logProvider);

  // ── Auto-instrumentations ───────────────────────────────────────────────────
  registerInstrumentations({
    instrumentations: [
      new NavigationTimingInstrumentation(),
      new ResourceTimingInstrumentation(),
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
  });

  return {
    tracer: trace.getTracer(config.serviceName, config.serviceVersion),
    logger: logs.getLogger(config.serviceName, config.serviceVersion),
  };
}
