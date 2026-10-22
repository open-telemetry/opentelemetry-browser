/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

export type SanitizeUrlFunction = (url: string) => string;

export type NavigationType = 'push' | 'replace' | 'reload' | 'traverse';

/**
 * NavigationInstrumentation Configuration
 */
export interface NavigationInstrumentationConfig extends InstrumentationConfig {
  /** Use the Navigation API `currententrychange` event if available (experimental). Defaults to false. */
  useNavigationApiIfAvailable?: boolean;
  /** Custom function to sanitize URLs before adding to log records. */
  sanitizeUrl?: SanitizeUrlFunction;
}
