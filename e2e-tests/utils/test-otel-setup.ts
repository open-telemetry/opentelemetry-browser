import { context, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { Instrumentation } from '@opentelemetry/browser-sdk';
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { COLLECTOR_URL, LOGS_COLLECTOR_URL } from './test-collector.ts';

export interface TestSdkHandle {
  shutdown: () => Promise<void>;
}

export function testSdkSetup(
  instrumentations: Instrumentation[],
): TestSdkHandle {
  const sdk = startBrowserSdk({
    instrumentations,
    logs: {
      processors: [
        new SimpleLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: LOGS_COLLECTOR_URL }),
        }),
      ],
    },
    traces: {
      processors: [
        new SimpleSpanProcessor({
          exporter: new OTLPTraceExporter({ url: COLLECTOR_URL }),
        }),
      ],
    },
  });

  return {
    shutdown: async () => {
      await sdk.shutdown();
      logs.disable();
      trace.disable();
      context.disable();
      propagation.disable();
    },
  };
}
