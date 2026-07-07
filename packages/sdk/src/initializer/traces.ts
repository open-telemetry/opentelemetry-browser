/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, diag, propagation, trace } from '@opentelemetry/api';
import { CompositePropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { setSdkLogger } from './diag.ts';
import type { TracesConfig, WebSdk } from './types.ts';

const DEFAULT_TRACES_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
const NOOP_SDK = { shutdown: () => Promise.resolve() };

export function startTracesSdk(config?: TracesConfig): WebSdk {
  // Set the logger
  setSdkLogger(config?.logLevel);

  if (config?.disabled) {
    diag.debug('Traces SDK disabled by configuration.');
    // TODO: need to discuss with the SIG if it's better to return `undefined`
    return NOOP_SDK;
  }

  // Resolve resource
  const resourceAttributes = config?.resourceAttributes ?? {};
  if (config?.serviceName) {
    resourceAttributes['service.name'] = config.serviceName;
  }
  if (config?.serviceVersion) {
    resourceAttributes['service.version'] = config.serviceVersion;
  }
  const resource = defaultResource().merge(
    resourceFromAttributes(resourceAttributes),
  );

  // Resolve the list of span processors.
  // - if provided by the user use them
  // - if not provided or exportConfig is set push a `BatchSpanProcessor`
  const spanProcessors: SpanProcessor[] = [];

  if (config?.processors) {
    spanProcessors.push(...config.processors);
  }
  if (!config?.processors || config?.exportConfig) {
    const tracesEndpoint =
      config?.exportConfig?.url || DEFAULT_TRACES_OTLP_ENDPOINT;

    if (URL.parse(tracesEndpoint)) {
      spanProcessors.push(
        new BatchSpanProcessor({
          exporter: new OTLPTraceExporter({
            url: tracesEndpoint,
            headers: config?.exportConfig?.headers,
          }),
          ...config?.batchProcessorConfig,
        }),
      );
    } else {
      diag.error(
        `BatchSpanProcessor configuration error. Invalid export URL "${tracesEndpoint}".`,
      );
    }
  }

  if (spanProcessors.length === 0) {
    diag.error("No Span processors configured. Traces SDK won't start");
    // TODO: need to discuss with the SIG if it's better to return `undefined`
    return NOOP_SDK;
  }
  const tracerProvider = new TracerProvider({
    // sampler: new TraceIdRatioBasedSampler(
    //   typeof config?.sampleRate === "number" ? config?.sampleRate : 1,
    // ),
    resource,
    spanLimits: config?.spanLimits,
    spanProcessors,
  });
  trace.setGlobalTracerProvider(tracerProvider);

  if (config?.propagators) {
    const { propagators } = config;
    propagation.setGlobalPropagator(new CompositePropagator({ propagators }));
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
