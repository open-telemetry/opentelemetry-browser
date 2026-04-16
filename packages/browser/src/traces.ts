/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, propagation, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import type { TracesConfig, WebSdk } from './types.ts';

const DEFAULT_TRACES_OTLP_ENDOINT = 'http://localhost:4318/v1/traces';

export function startTracesSdk(config?: TracesConfig): WebSdk {
  const tracesEndpoint =
    config?.otlpTracesEndpoint || DEFAULT_TRACES_OTLP_ENDOINT;

  const spanProcessor = new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: tracesEndpoint,
      headers: config?.otlpTracesHeaders,
    }),
    {
      scheduledDelayMillis: config?.bspScheduleDelay,
      exportTimeoutMillis: config?.bspExportTimeout,
      maxExportBatchSize: config?.bspMaxExportBatchSize,
      maxQueueSize: config?.bspMaxQueueSize,
    },
  );

  const tracerProvider = new BasicTracerProvider({
    // sampler: new TraceIdRatioBasedSampler(
    //   typeof config?.sampleRate === "number" ? config?.sampleRate : 1,
    // ),
    resource: config?.resource,
    spanLimits: config?.spanLimits,
    spanProcessors: [spanProcessor],
  });
  trace.setGlobalTracerProvider(tracerProvider);

  if (config?.textMapPropagator) {
    propagation.setGlobalPropagator(config.textMapPropagator);
  }

  if (config?.contextManager) {
    context.setGlobalContextManager(config.contextManager);
  }

  return {
    shutdown() {
      return tracerProvider.shutdown();
    },
  };
}
