/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  context,
  DiagLogLevel,
  diag,
  propagation,
  trace,
} from '@opentelemetry/api';
import { CompositePropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { INVALID_CONFIG_SDK } from '../core/constants.ts';
import { getDefaultContextManager } from '../core/context.ts';
import { setSdkLogger } from '../core/diag.ts';
import { parseExportUrl } from '../core/exportUrl.ts';
import { getDefaultPropagators } from '../core/propagation.ts';
import type { TracesConfig, TracesSdk } from '../core/types.ts';

const DEFAULT_TRACES_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';

export function startTracesSdk(config?: TracesConfig): TracesSdk {
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
  // For any level equal or louder than `DEBUG` add console exporters
  // to get traces print into the DevTools console.
  const logLevel = config?.logLevel && DiagLogLevel[config?.logLevel];

  if (logLevel !== undefined && logLevel >= DiagLogLevel.DEBUG) {
    spanProcessors.push(
      new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() }),
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
  const propagator = new CompositePropagator({
    propagators: config?.propagators ?? getDefaultPropagators(),
  });

  // Without globals, context comes from the global context API that another
  // SDK on the page has set up. One context manager per page is correct.
  if (config?.setGlobals !== false) {
    trace.setGlobalTracerProvider(tracerProvider);
    propagation.setGlobalPropagator(propagator);
    const contextManager = config?.contextManager ?? getDefaultContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);
  }

  return {
    tracerProvider,
    propagator,
    shutdown: () => tracerProvider.shutdown(),
  };
}
