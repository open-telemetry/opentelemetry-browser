/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Instrumentation } from '@opentelemetry/instrumentation';
import type {
  LogRecordExporter,
  LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { SpanExporter, SpanProcessor } from '@opentelemetry/sdk-trace-web';

export interface BrowserSDKConfiguration {
  /** Service name for the resource. */
  serviceName?: string;

  /** Custom span exporter. If provided and no spanProcessors are given, a BatchSpanProcessor is created. */
  spanExporter?: SpanExporter;

  /** Custom span processors. Takes precedence over spanExporter. */
  spanProcessors?: SpanProcessor[];

  /** Custom log record exporter. If provided and no logRecordProcessors are given, a SimpleLogRecordProcessor is created. */
  logRecordExporter?: LogRecordExporter;

  /** Custom log record processors. Takes precedence over logRecordExporter. */
  logRecordProcessors?: LogRecordProcessor[];

  /** Instrumentations to register. */
  instrumentations?: Instrumentation[];

  /** Enable session tracking via @opentelemetry/web-common. Default: false. */
  enableSessionTracking?: boolean;
}
