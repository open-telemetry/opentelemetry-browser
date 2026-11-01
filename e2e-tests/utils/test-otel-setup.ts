import { context, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import type { Instrumentation } from '@opentelemetry/browser-sdk';
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import { COLLECTOR_URL, LOGS_COLLECTOR_URL } from './test-collector.ts';

// Simple processors start one export per record, and the exporter drops any
// export past 30 in flight. A page with many resource entries hits that limit
// and loses records, so the tests batch with a short delay instead.
const BATCH_OPTIONS = { scheduledDelayMillis: 50 };

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
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: LOGS_COLLECTOR_URL }),
          ...BATCH_OPTIONS,
        }),
      ],
    },
    traces: {
      processors: [
        new BatchSpanProcessor({
          exporter: new OTLPTraceExporter({ url: COLLECTOR_URL }),
          ...BATCH_OPTIONS,
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
