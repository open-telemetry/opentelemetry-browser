// otel.ts — SDK initialisation: traces + logs

import type { Tracer } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';
import type { Logger } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import type { SessionManager } from '@opentelemetry/browser-sdk/session';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/browser-sdk/session';
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

// ── initOtel ──────────────────────────────────────────────────────────────────
// onSpan/onLog callbacks push entries into the React app's log state.

export async function initOtel(
  config: OtelConfig,
  customAttrs: Record<string, string> = {},
  { onSpan, onLog }: InitOtelOptions = {},
): Promise<OtelHandle> {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    ...customAttrs,
  });

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

  // ── Traces ──────────────────────────────────────────────────────────────────
  const traceExporter = new OTLPTraceExporter({
    url: config.tracesUrl,
    headers: {},
  });
  const spanProcessors = [
    createSessionSpanProcessor(sessionManager),
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
    createSessionLogRecordProcessor(sessionManager),
    new BatchLogRecordProcessor({
      exporter: logExporter,
      maxExportBatchSize: 10,
      scheduledDelayMillis: 1_000,
    }),
    new SimpleLogRecordProcessor({ exporter: new ConsoleLogRecordExporter() }),
  ];
  if (onLog) {
    logProcessors.push(
      new SimpleLogRecordProcessor({ exporter: createUILogExporter(onLog) }),
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
