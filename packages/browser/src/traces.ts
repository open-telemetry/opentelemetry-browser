/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import type { TracesConfig, WebSdk } from './types.ts';

const DEFAULT_TRACES_OTLP_ENDOINT = 'http://localhost:4318/v1/metrics';

export function startTracesSdk(config?: TracesConfig): WebSdk {
  const tracesEndpoint =
    config?.otlpTracesEndpoint || DEFAULT_TRACES_OTLP_ENDOINT;

  const spanProcessor = new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: tracesEndpoint,
      headers: config?.otlpTracesHeaders,
    }),
  );

  const tracerProvider = new BasicTracerProvider({
    // sampler: new TraceIdRatioBasedSampler(
    //   typeof config?.sampleRate === "number" ? config?.sampleRate : 1,
    // ),
    resource: config?.resource,
    spanLimits: config?.spanLimits,
    spanProcessors: [spanProcessor],
  });

  return {
    shutdown() {
      return tracerProvider.shutdown();
    },
  };
}
