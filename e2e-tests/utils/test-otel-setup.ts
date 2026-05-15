import { trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  SimpleSpanProcessor,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import type { OtlpLogRecord, OtlpSpan } from './test-collector.ts';
import {
  COLLECTOR_URL,
  LOGS_COLLECTOR_URL,
  setupCollector,
} from './test-collector.ts';

export interface TestOtelSetupResult {
  getSpans: () => OtlpSpan[];
  getLogs: () => OtlpLogRecord[];
  cleanup: () => Promise<void>;
}

export function testOtelSetup(
  instrumentations: Instrumentation[],
): TestOtelSetupResult {
  const collector = setupCollector();

  const traceExporter = new OTLPTraceExporter({
    url: COLLECTOR_URL,
    timeoutMillis: 1,
  });
  const provider = new WebTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(traceExporter)],
  });
  provider.register();

  const logExporter = new OTLPLogExporter({
    url: LOGS_COLLECTOR_URL,
    timeoutMillis: 1,
  });
  const logProvider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor(logExporter)],
  });
  logs.setGlobalLoggerProvider(logProvider);

  const deregister = registerInstrumentations({ instrumentations });

  return {
    getSpans: collector.getSpans,
    getLogs: collector.getLogs,
    cleanup: async () => {
      deregister();
      await provider.shutdown();
      await logProvider.shutdown();
      trace.disable();
      logs.disable();
      collector.cleanup();
    },
  };
}
