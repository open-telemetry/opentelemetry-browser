/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Attributes,
  ContextManager,
  DiagLogLevel,
  TextMapPropagator,
} from '@opentelemetry/api';
import type {
  LogRecordLimits,
  LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type {
  Sampler,
  SpanLimits,
  SpanProcessor,
} from '@opentelemetry/sdk-trace';

/**
 * Export configuration. Can be used globally or per signal
 */
export interface ExportConfig {
  /**
   * URL to send the data. A URL set in a signal config is used as is, so it
   * must include the signal path. When a signal config omits it the root URL
   * is used with the signal path set on it. Default values depend on where
   * this config is defined:
   * - globally: the default is http://localhost:4318
   * - logs: the default is http://localhost:4318/v1/logs
   * - traces: the default is http://localhost:4318/v1/traces
   */
  url?: string;
  /**
   * Headers to be sent in each export request.
   *
   * @defaultValue undefined
   */
  headers?: Record<string, string>;
}

/**
 * Batch processor configuration. Can be used globally or per signal
 */
export interface BatchProcessorConfig {
  /**
   * Delay interval (in milliseconds) between two consecutive exports.
   * Default values depend on where this config is defined:
   * - logs: 1000
   * - traces: 5000
   */
  scheduledDelayMillis?: number;
  /**
   * Maximum allowed time (in milliseconds) to export data.
   *
   * @defaultValue 30000
   */
  exportTimeoutMillis?: number;
  /**
   * Maximum queue size.
   *
   * @defaultValue 2048
   */
  maxQueueSize?: number;
  /**
   * Maximum batch size.
   *
   * @defaultValue 512
   */
  maxExportBatchSize?: number;
}

/**
 * The common configuration properties regardless of the SDK being
 * started. Any signal SDK should accept it and when SDKs are combined
 * these properties belong to the root configuration and not to
 * the signal specific config.
 */
export interface CommonConfig {
  /**
   * Set `disabled: true` to disable the SDK
   *
   * @defaultValue undefined
   */
  disabled?: boolean;
  /**
   * Log level for SDK's internal logger
   *
   * @defaultValue DiagLogLevel.INFO
   */
  logLevel?: keyof typeof DiagLogLevel;
  /**
   * Sets the value of the `service.name` resource attribute
   *
   * @defaultValue "unknown_service"
   */
  serviceName?: string;
  /**
   * Sets the value of the `service.version` resource attribute
   *
   * @defaultValue undefined
   */
  serviceVersion?: string;
  /**
   * The resource attributes related to the telemetry being exported
   *
   * @defaultValue undefined
   */
  resourceAttributes?: Attributes;
}

/**
 * Root configuration options when SDKs are combined into a single
 * one. This type is enhanced
 * by the `combineSdks` function by adding a key for each
 * signal used (logs, traces). Do not add a "logs" or "traces" key
 * here to avoid type collision.
 */
export type RootConfig = CommonConfig & {
  /**
   * Configuration for processors. If defined it will be applied to
   * `BatchSpanProcessor` and `BatchLogRecordProcessor` unless the signal sets
   * its own `batchProcessorConfig` or `processors`.
   */
  batchProcessorConfig?: BatchProcessorConfig;
  /**
   * Configuration for exporters. If defined it will be applied to the
   * exporters of the `BatchSpanProcessor` and `BatchLogRecordProcessor` unless
   * the signal sets its own `exportConfig` or `processors`. The signal path is
   * set on the URL for each signal.
   */
  exportConfig?: ExportConfig;
  // TODO: to be discussed in Browser SIG
  // Basic options that could translate to more complex ones
  // in specific signals like
  // 1. `sampleRate` becomes a TraceIdRatioBasedSampler for traces
  //    and maybe somethign else for other signals??? (sampling logs?)
  // sampleRate?: number;
};

export type LogsConfig = CommonConfig & {
  /**
   * Configuration for the `BatchLogRecordProcessor`, used whenever one is
   * created for this signal.
   */
  batchProcessorConfig?: BatchProcessorConfig;
  /**
   * Configuration for the LogRecord exporter. Setting this config creates a
   * `BatchLogRecordProcessor`, with the defaults for batch and queue size and
   * export schedule and timeouts unless `batchProcessorConfig` is set.
   */
  exportConfig?: ExportConfig;
  /**
   * Limits for each LogRecord.
   */
  logRecordLimits?: LogRecordLimits;
  /**
   * List of LogRecordProcessor for the logger provider. Setting this stops the root
   * `batchProcessorConfig` and `exportConfig` from being propagated to this signal
   * when SDKs are combined. Without a signal `exportConfig` no
   * `BatchLogRecordProcessor` is created, so nothing is exported over OTLP. With one,
   * a `BatchLogRecordProcessor` is created in addition to the processors listed.
   */
  processors?: LogRecordProcessor[];
};

export type TracesConfig = CommonConfig & {
  // Context and Propagation
  /**
   * Manager used to carry context across function boundaries
   *
   * @defaultValue undefined
   */
  contextManager?: ContextManager;
  /**
   * List of propagators to use when `propagation.inject` and `propagation.extract`
   * is called (by instrumentations or user code).
   *
   * @defaultValue undefined
   */
  propagators?: TextMapPropagator[];
  /**
   * Sampler to be used by tracer to decide if a Span is sampled or not.
   *
   * @defaultValue undefined
   */
  sampler?: Sampler;
  /**
   * Configuration for the `BatchSpanProcessor`, used whenever one is created for
   * this signal. Its exporter takes the default configuration or the one set in
   * the `exportConfig` option.
   */
  batchProcessorConfig?: BatchProcessorConfig;
  /**
   * Configuration for the Span exporter. Setting this config creates a
   * `BatchSpanProcessor`, with the defaults for batch and queue size and export
   * schedule and timeouts unless the `batchProcessorConfig` option is set.
   */
  exportConfig?: ExportConfig;
  /**
   * Limits for each Span.
   */
  spanLimits?: SpanLimits;
  /**
   * List of SpanProcessor for the tracer provider. Setting this stops the root
   * `batchProcessorConfig` and `exportConfig` from being propagated to this signal
   * when SDKs are combined. Without a signal `exportConfig` no `BatchSpanProcessor`
   * is created, so nothing is exported over OTLP. With one, a `BatchSpanProcessor`
   * is created in addition to the processors listed.
   *
   * @defaultValue undefined
   */
  processors?: SpanProcessor[];
};

export interface WebSdk {
  shutdown(): Promise<void>;
}
