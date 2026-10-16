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
import type { Instrumentation } from '@opentelemetry/instrumentation';
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
   * URL to send the data. For signal specific exports you might need to
   * specify the signal path like `/v1/traces`. Default values depend on where
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
  /**
   * List of instrumentations to be registered when the SDK starts
   *
   * @defaultValue undefined
   */
  instrumentations?: Instrumentation[];
}

/**
 * Utility functions to extract the configurations from the factory
 * functions and remove the common properties (which will be already
 * available at the config root)
 */
export type RemoveCommonProps<T> = Omit<T, keyof CommonConfig>;

/**
 * Root configuration options when SDKs are combined into a single
 * one. This type is enhanced
 * by `startBrowserSdk` by adding a key for each
 * signal used (logs, traces). Do not add a "logs" or "traces" key
 * here to avoid type collision.
 */
export type RootConfig = CommonConfig & {
  /**
   * Configuration for processors. If defined it will be applied to
   * `BatchSpanProcessor` and `BatchLogRecordProcessor` unless the signal sets
   * its own `batchProcessorConfig`. It follows any batch processor the SDK
   * creates, including the one a signal gets from its own `exportConfig`.
   */
  batchProcessorConfig?: BatchProcessorConfig;
  /**
   * Configuration for exporters. If defined it will be applied to the
   * exporters of the `BatchSpanProcessor` and `BatchLogRecordProcessor`. A
   * signal `exportConfig` with no `url` inherits the root options it does not
   * set, such as `headers`, and uses the root URL with the signal path. A
   * signal `exportConfig` with its own `url` uses none of the root options, so
   * root credentials are not sent to another host. A signal that sets
   * `processors` and no `exportConfig` gets the root config only when you set
   * it, and adds no OTLP exporter otherwise.
   */
  exportConfig?: ExportConfig;
  // TODO: to be discussed in Browser SIG
  // Basic options that could translate to more complex ones
  // in specific signals like
  // 1. `sampleRate` becomes a TraceIdRatioBasedSampler for traces
  //    and maybe something else for other signals??? (sampling logs?)
  // sampleRate?: number;
};

export type LogsConfig = CommonConfig & {
  /**
   * Configuration for the `BatchLogRecordProcessor`, used whenever one is
   * created for this signal. Its exporter takes the default configuration or
   * the one set in the `exportConfig` option.
   */
  batchProcessorConfig?: BatchProcessorConfig;
  /**
   * Configuration for the LogRecord exporter. Setting this config creates a
   * `BatchLogRecordProcessor` even when `processors` is set; see `processors`
   * for the full matrix. The processor takes the defaults for batch and queue
   * size, export schedule and timeouts unless `batchProcessorConfig` is set.
   */
  exportConfig?: ExportConfig;
  /**
   * Limits for each LogRecord.
   */
  logRecordLimits?: LogRecordLimits;
  /**
   * List of LogRecordProcessor for the logger provider. When set, these are
   * used instead of the default OTLP `BatchLogRecordProcessor`. To also export
   * over OTLP alongside them, additionally set `exportConfig` — this appends a
   * `BatchLogRecordProcessor` (tuned by `batchProcessorConfig`). When
   * `exportConfig` is omitted, no OTLP exporter is added,
   * `batchProcessorConfig` has no effect, and the SDK logs a warning. In
   * `startBrowserSdk`, a root `exportConfig` you set counts as this
   * `exportConfig`.
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
   * `BatchSpanProcessor` even when `processors` is set; see `processors` for
   * the full matrix. The processor takes the defaults for batch and queue
   * size, export schedule and timeouts unless `batchProcessorConfig` is set.
   */
  exportConfig?: ExportConfig;
  /**
   * Limits for each Span.
   */
  spanLimits?: SpanLimits;
  /**
   * List of SpanProcessor for the tracer provider. When set, these are used
   * instead of the default OTLP `BatchSpanProcessor`. To also export over OTLP
   * alongside them, additionally set `exportConfig` — this appends a
   * `BatchSpanProcessor` (tuned by `batchProcessorConfig`). When `exportConfig`
   * is omitted, no OTLP exporter is added, `batchProcessorConfig` has no
   * effect, and the SDK logs a warning. In `startBrowserSdk`, a root
   * `exportConfig` you set counts as this `exportConfig`.
   *
   * @defaultValue undefined
   */
  processors?: SpanProcessor[];
};

export interface WebSdk {
  /**
   * `true` when the SDK refused to start because its configuration is invalid
   * — e.g. a malformed export URL or no usable processors. Left `undefined` on
   * a started SDK and on one intentionally turned off via `config.disabled`
   * (that is not an error). Callers can check this to surface a
   * misconfiguration, e.g. `if (sdk.invalidConfig) { throw ... }`.
   */
  invalidConfig?: boolean;
  shutdown(): Promise<void>;
}
