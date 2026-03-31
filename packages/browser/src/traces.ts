/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

import type { GlobalConfig, SignalSdk } from './types.ts';
import { getExportUrl } from './utils.ts';

export interface TracesSdkConfig {
  // Processor
  // TODO: impklement handling these
  bspScheduleDelay?: number;
  bspExportTimeout?: number;
  bspMaxQueueSize?: number;
  bspMaxExportBatchSize?: number;
  // Export
  otlpTracesEndpoint?: string;
  otlpTracesHeaders?: Record<string, string>;
  // Limits
  spanAttrLengthLimit?: number;
  spanAttrCountLimit?: number;
}

export class TracesSdk implements SignalSdk<TracesSdkConfig> {
  private _tracerProvider: WebTracerProvider | undefined;

  start(config: GlobalConfig & TracesSdkConfig) {
    const tracesEndpoint = getExportUrl(
      config.otlpTracesEndpoint,
      config.otlpEndpoint,
      '/v1/traces',
    );

    const spanProcessor = new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: tracesEndpoint,
        headers: config.otlpTracesHeaders ?? config.otlpHeaders,
      }),
    );

    this._tracerProvider = new WebTracerProvider({
      // resource: config.resource,
      // sampler: new TraceIdRatioBasedSampler(
      //   typeof config.sampleRate === "number" ? config.sampleRate : 1,
      // ),
      spanLimits: {
        attributeCountLimit: config.spanAttrCountLimit || config.attrCountLimit,
        attributeValueLengthLimit:
          config.spanAttrLengthLimit || config.attrLenghtLimit,
      },
      spanProcessors: [spanProcessor],
    });
    // TODO: allow context manager and propagatros???
    this._tracerProvider.register();
  }
  shutdown() {
    if (this._tracerProvider) {
      return this._tracerProvider.shutdown();
    }
    return Promise.resolve();
  }
}
