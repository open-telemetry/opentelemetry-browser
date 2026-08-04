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
import { setSdkLogger } from '../core/diag.ts';
import { parseExportUrl } from '../core/exportUrl.ts';
import type { TracesConfig, WebSdk } from '../core/types.ts';

const DEFAULT_TRACES_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
// Returned when the signal is intentionally turned off via `config.disabled`.
const NOOP_SDK: WebSdk = { shutdown: () => Promise.resolve() };
// Returned when the signal refuses to start because of an invalid configuration
// (e.g. a bad export URL or no usable processors).
const INVALID_CONFIG_SDK: WebSdk = {
  invalidConfig: true,
  shutdown: () => Promise.resolve(),
};

export function startTracesSdk(config?: TracesConfig): WebSdk {
  // Set the logger
  setSdkLogger(config?.logLevel);

  if (config?.disabled) {
    diag.debug('Traces SDK disabled by configuration.');
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

    // Bail out on an invalid URL instead of silently skipping the exporter,
    // which would leave the SDK running without exporting the telemetry.
    if (!parseExportUrl(tracesEndpoint, 'Traces SDK')) {
      return INVALID_CONFIG_SDK;
    }
    spanProcessors.push(
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: tracesEndpoint,
          headers: config?.exportConfig?.headers,
        }),
        ...config?.batchProcessorConfig,
      }),
    );
  }

  if (spanProcessors.length === 0) {
    diag.error("No Span processors configured. Traces SDK won't start");
    return INVALID_CONFIG_SDK;
  }
  const tracerProvider = new TracerProvider({
    resource,
    spanLimits: config?.spanLimits,
    spanProcessors,
    sampler: config?.sampler,
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
