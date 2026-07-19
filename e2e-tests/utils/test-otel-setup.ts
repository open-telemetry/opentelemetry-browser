import { trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { COLLECTOR_URL, LOGS_COLLECTOR_URL } from './test-collector.ts';

export function testSdkSetup(instrumentations: Instrumentation[]) {
  const sdk = startBrowserSdk({
    logs: {
      processors: [
        new SimpleLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: LOGS_COLLECTOR_URL }),
        }),
      ],
    },
    traces: {
      processors: [
        new SimpleSpanProcessor(new OTLPTraceExporter({ url: COLLECTOR_URL })),
      ],
    },
  });

  const deregister = registerInstrumentations({ instrumentations });

  return {
    shutdown: async () => {
      await sdk.shutdown();
      deregister();
      logs.disable();
      trace.disable();
    },
  };
}
