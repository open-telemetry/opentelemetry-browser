/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, diag, propagation, trace } from '@opentelemetry/api';
import { CompositePropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { getDefaultContextManager } from '../core/context.ts';
import { setSdkLogger } from '../core/diag.ts';
import { getDefaultPropagators } from '../core/propagation.ts';
import type { TracesConfig, WebSdk } from '../core/types.ts';

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
    resource,
    spanLimits: config?.spanLimits,
    spanProcessors,
    sampler: config?.sampler,
  });
  trace.setGlobalTracerProvider(tracerProvider);

  const propagators = config?.propagators ?? getDefaultPropagators();
  propagation.setGlobalPropagator(new CompositePropagator({ propagators }));

  const contextManager = config?.contextManager ?? getDefaultContextManager();
  contextManager.enable();
  context.setGlobalContextManager(contextManager);

  // Register instrumentations now that the tracer provider is set. They are
  // disabled on shutdown.
  let deregisterInstrumentations: (() => void) | undefined;
  if (config?.instrumentations?.length) {
    deregisterInstrumentations = registerInstrumentations({
      instrumentations: config.instrumentations,
    });
  }

  return {
    shutdown() {
      // Disable instrumentations first so they stop capturing telemetry
      // before the provider is shut down and flushed.
      deregisterInstrumentations?.();
      return tracerProvider.shutdown();
    },
  };
}
