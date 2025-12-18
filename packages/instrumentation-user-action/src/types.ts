/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

export type AutoCapturedUserAction = 'click';

export type MouseButton = 'left' | 'middle' | 'right';

/**
 * UserActionInstrumentation Configuration
 */
export interface UserActionInstrumentationConfig extends InstrumentationConfig {
  autoCapturedActions?: AutoCapturedUserAction[];
}
