/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogLevel } from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';

export interface GlobalConfig {
  disabled?: boolean;
  logLevel?: DiagLogLevel;
  // Resource & ·Entities related
  serviceName?: string;
  resource?: Resource;
  // Export
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  // Limits
  attrLenghtLimit?: number;
  attrCountLimit?: number;
}

export interface SignalSdk<SignalConfig> {
  start(config: GlobalConfig & SignalConfig): void;
  shutdown(): Promise<void>;
}
