/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionIdGenerator } from './types/SessionIdGenerator.ts';

export class DefaultIdGenerator implements SessionIdGenerator {
  generateSessionId(): string {
    return crypto.randomUUID();
  }
}
