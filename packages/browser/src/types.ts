/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ContextManager,
  DiagLogLevel,
  TextMapPropagator,
} from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';
import type { LogRecordLimits } from '@opentelemetry/sdk-logs';
import type {
  GeneralLimits,
  Sampler,
  SpanLimits,
} from '@opentelemetry/sdk-trace-base';

/**
 * Export configuration. Can be used globally or per signal
 */
export interface ExportConfig {
  url?: string;
  headers?: Record<string, string>;
}

/**
 * Batch processor configuration. Can be used globally or per signal
 */
export interface ProcessorConfig {
  scheduledDelayMillis?: number;
  exportTimeoutMillis?: number;
  maxQueueSize?: number;
  maxExportBatchSize?: number;
}


/**
 * TODO: each independent SDK should be able to be started independently
 * and IMHO this means it's able to resolve things like the resource by itself.
 * this menand global configurations leak to the sginal specific one
 * if and only if it's used independently. 
 * 
 * So this should be possible
 * 
 * startLogsSdk({
 *  serviceName: 'foo'
 * })
 * 
 * But having the option globaly and
 * specifically it leads to odd situiations like
 * 
 * startBrowserSdk({
 *   serviceName: 'foo',
 *   logs: {
 *     serviceName: 'bar'
 *   },
 *   traces: {
 *     serviceName: 'baz'
 *   }
 * })
 * 
 * the internal logic can handle this making one of them win over the others
 * but the fact that is possible to call it this way makes the user wonder
 * which one is the actual service name in the resource
 * 
 * Should/Could we remove some options when the SDKs are combined???
 */

/**
 * The global configuration of the SDK. This type is enhanced
 * by the `combineSdks` function by adding a key for each
 * signal used (logs, traces). Do not add a "logs" or "traces" key
 * here to avoid type collision.
 */
export interface GlobalConfig {
  disabled?: boolean;
  logLevel?: keyof typeof DiagLogLevel;
  // Resource & Entities related
  serviceName?: string;
  serviceVersion?: string;
  resource?: Resource;
  // Export
  exportConfig?: ExportConfig;
  // General Limits
  generalLimits?: GeneralLimits;

  // Basic options that could translate to more complex ones
  // in specific signals like
  // 1. `sampleRate` becomes a TraceIdRatioBasedSampler for traces
  //    and maybe somethign else for other signals??? (sampling logs?)
  // sampleRate?: number;
}
export interface LogsConfig {
  logLevel?: keyof typeof DiagLogLevel;
  // Resource & Entities related
  resource?: Resource;
  // Processor
  processorConfig?: ProcessorConfig;
  // Export
  exportConfig?: ExportConfig;
  // Limits
  logRecordLimits?: LogRecordLimits;
}

export interface TracesConfig {
  logLevel?: keyof typeof DiagLogLevel;
  // Context and Propagation
  contextManager?: ContextManager;
  propagators?: TextMapPropagator[];
  // Resource & Entities related
  resource?: Resource;
  // Sampler
  sampler?: Sampler;
  // Processor
  processorConfig?: ProcessorConfig;
  // Export
  exportConfig?: ExportConfig;
  // Limits
  spanLimits?: SpanLimits;
}

export interface WebSdk {
  shutdown(): Promise<void>;
}
export type WebSdkFactory<T> = (config?: T) => WebSdk;
