/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/**
 * ResourceTimingInstrumentation Configuration
 */
export interface ResourceTimingInstrumentationConfig
  extends InstrumentationConfig {
  /**
   * Number of resources to process per batch.
   * Lower values reduce memory pressure but increase overhead.
   * Default: 50
   */
  batchSize?: number;

  /**
   * Maximum time in milliseconds to wait for an idle callback before forcing processing.
   * This ensures resources are eventually emitted even if the browser never idles.
   * Default: 1000
   */
  idleTimeout?: number;

  /**
   * Maximum time in milliseconds to spend processing resources per idle callback.
   * This prevents blocking the main thread for too long.
   * Default: 50
   */
  maxProcessingTime?: number;

  /**
   * Maximum number of resources to queue before forcing immediate flush.
   * Prevents memory issues during extreme bursts. When limit is reached,
   * the queue is flushed immediately and a warning is emitted.
   * Default: 1000
   */
  maxQueueSize?: number;
}
