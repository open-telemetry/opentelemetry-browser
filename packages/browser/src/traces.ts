/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, propagation, trace } from '@opentelemetry/api';
import { CompositePropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { setSdkLogger } from './diag.ts';
import type { TracesConfig, WebSdk } from './types.ts';

const DEFAULT_TRACES_OTLP_ENDOINT = 'http://localhost:4318/v1/traces';

export function startTracesSdk(config?: TracesConfig): WebSdk {
  // Set the logger
  setSdkLogger(config?.logLevel);

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
  // - otherwise create a `BatchSpanProcessor`
  const spanProcessors: SpanProcessor[] = [];

  if (config?.processors) {
    spanProcessors.push(...config.processors);
  } else {
    const tracesEndpoint =
      config?.exportConfig?.url || DEFAULT_TRACES_OTLP_ENDOINT;

    spanProcessors.push(
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: tracesEndpoint,
          headers: config?.exportConfig?.headers,
        }),
        config?.processorConfig,
      ),
    );
  }

  const tracerProvider = new BasicTracerProvider({
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
