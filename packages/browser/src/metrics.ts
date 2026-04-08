/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

import type { MetricsConfig, WebSdk } from './types.ts';

const DEFAULT_METRICS_OTLP_ENDOINT = 'http://localhost:4318/v1/metrics';

export function startMetricsSdk(config?: MetricsConfig): WebSdk {
  const metricsEndpoint =
    config?.otlpMetricsEndpoint || DEFAULT_METRICS_OTLP_ENDOINT;
  const metricsReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: metricsEndpoint,
      headers: config?.otlpMetricsHeaders,
    }),
  });
  const meterProvider = new MeterProvider({
    resource: config?.resource,
    readers: [metricsReader],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  return {
    shutdown() {
      return meterProvider.shutdown();
    },
  };
}
