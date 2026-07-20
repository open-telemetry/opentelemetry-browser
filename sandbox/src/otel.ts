// otel.ts — SDK initialisation via the official @opentelemetry/browser-sdk

import type { Tracer } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import type { Logger } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import type { TracesConfig } from '@opentelemetry/browser-sdk';
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import type { SessionManager } from '@opentelemetry/browser-sdk/session';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/browser-sdk/session';
import {
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace';
import { StackContextManager } from '@opentelemetry/sdk-trace-web';
import type { OtelConfig } from './app/types/OtelConfig.type.ts';
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
  sessionManager: SessionManager;
}

// Batch tuning for the OTLP exporters that startBrowserSdk appends when
// `exportConfig` is set. Shared by the traces and logs signals.
const BATCH_PROCESSOR_CONFIG: TracesConfig['batchProcessorConfig'] = {
  maxExportBatchSize: 10,
  scheduledDelayMillis: 1_000,
};

// ── initOtel ──────────────────────────────────────────────────────────────────
// onSpan/onLog callbacks push entries into the React app's log state.

export async function initOtel(
  config: OtelConfig,
  customAttrs: Record<string, string> = {},
  { onSpan, onLog }: InitOtelOptions = {},
): Promise<OtelHandle> {
  // ── Sessions ────────────────────────────────────────────────────────────────
  // The session processors must run BEFORE the export processors so the
  // session.id attribute is set on each span / log record before it is exported.
  const sessionManager = createSessionManager({
    sessionIdGenerator: createDefaultSessionIdGenerator(),
    sessionStore: createLocalStorageSessionStore(),
    // 4h ceiling, 30min of inactivity rotates the session.
    maxDuration: 4 * 60 * 60,
    inactivityTimeout: 30 * 60,
  });
  await sessionManager.start();

  // ── Span processors ───────────────────────────────────────────────────────
  // session (first, so session.id is set) → console → optional UI mirror.
  // The batching OTLP exporter is appended by startBrowserSdk (see below).
  const spanProcessors = [
    createSessionSpanProcessor(sessionManager),
    new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() }),
  ];
  if (onSpan) {
    spanProcessors.push(
      new SimpleSpanProcessor({ exporter: createUISpanExporter(onSpan) }),
    );
  }

  // ── Log record processors ─────────────────────────────────────────────────
  const logProcessors = [
    createSessionLogRecordProcessor(sessionManager),
    new SimpleLogRecordProcessor({ exporter: new ConsoleLogRecordExporter() }),
  ];
  if (onLog) {
    logProcessors.push(
      new SimpleLogRecordProcessor({ exporter: createUILogExporter(onLog) }),
    );
  }

  // ── SDK ─────────────────────────────────────────────────────────────────────
  // startBrowserSdk registers the tracer and logger providers. For each signal
  // it keeps the custom processors above and, because `exportConfig` is set,
  // appends a BatchSpanProcessor / BatchLogRecordProcessor exporting over OTLP.
  //
  // The traces `contextManager` and `propagators` reproduce what
  // `WebTracerProvider.register()` used to wire up by default, so context
  // propagation and W3C trace-context header injection keep working.
  startBrowserSdk({
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    resourceAttributes: { ...customAttrs },
    traces: {
      processors: spanProcessors,
      exportConfig: { url: config.tracesUrl, headers: {} },
      batchProcessorConfig: BATCH_PROCESSOR_CONFIG,
      contextManager: new StackContextManager().enable(),
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    },
    logs: {
      processors: logProcessors,
      exportConfig: { url: config.logsUrl, headers: {} },
      batchProcessorConfig: BATCH_PROCESSOR_CONFIG,
    },
  });

  // ── Auto-instrumentations ───────────────────────────────────────────────────
  registerInstrumentations({
    instrumentations: [
      new ErrorsInstrumentation(),
      new NavigationTimingInstrumentation(),
      new ResourceTimingInstrumentation({
        ignoreUrls: [config.tracesUrl, config.logsUrl],
      }),
      new UserActionInstrumentation(),
      new WebVitalsInstrumentation({ includeRawAttribution: true }),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
        ignoreUrls: [config.tracesUrl, config.logsUrl],
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        ignoreUrls: [config.tracesUrl, config.logsUrl],
      }),
    ],
  });

  return {
    tracer: trace.getTracer(config.serviceName, config.serviceVersion),
    logger: logs.getLogger(config.serviceName, config.serviceVersion),
    sessionManager,
  };
}
