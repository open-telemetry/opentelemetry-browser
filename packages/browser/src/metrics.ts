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

import type { GlobalConfig, SignalSdk } from './types.ts';
import { getExportUrl } from './utils.ts';

export interface MetricsSdkConfig {
  otlpMetricsEndpoint?: string;
  otlpMetricsHeaders?: Record<string, string>;
}

export class MetricsSdk implements SignalSdk<MetricsSdkConfig> {
  private _meterProvider: MeterProvider | undefined;

  start(config: GlobalConfig & MetricsSdkConfig) {
    const metricsEndpoint = getExportUrl(
      config.otlpMetricsEndpoint,
      config.otlpEndpoint,
      '/v1/metrics',
    );
    const metricsReader = new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: metricsEndpoint,
        headers: config.otlpMetricsHeaders ?? config.otlpHeaders,
      }),
    });
    this._meterProvider = new MeterProvider({
      resource: config.resource,
      readers: [metricsReader],
    });
    metrics.setGlobalMeterProvider(this._meterProvider);
  }
  shutdown() {
    if (this._meterProvider) {
      return this._meterProvider.shutdown();
    }
    return Promise.resolve();
  }
}
