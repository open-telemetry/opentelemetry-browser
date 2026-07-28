/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import { DefaultIdGenerator } from './DefaultIdGenerator.ts';
import { LocalStorageSessionStore } from './LocalStorageSessionStore.ts';
import { SessionLogRecordProcessor } from './SessionLogRecordProcessor.ts';
import type { SessionManagerConfig } from './SessionManager.ts';
import { SessionManager } from './SessionManager.ts';
import { SessionSpanProcessor } from './SessionSpanProcessor.ts';
import type { SessionIdGenerator } from './types/SessionIdGenerator.ts';
import type { SessionProvider } from './types/SessionProvider.ts';
import type { SessionStore } from './types/SessionStore.ts';

export function createSessionSpanProcessor(
  sessionProvider: SessionProvider,
): SpanProcessor {
  return new SessionSpanProcessor(sessionProvider);
}

export function createSessionLogRecordProcessor(
  sessionProvider: SessionProvider,
): LogRecordProcessor {
  return new SessionLogRecordProcessor(sessionProvider);
}

export function createSessionManager(
  config: SessionManagerConfig,
): SessionManager {
  const manager = new SessionManager(config);
  return manager;
}

export function createDefaultSessionIdGenerator(): SessionIdGenerator {
  return new DefaultIdGenerator();
}

export function createLocalStorageSessionStore(): SessionStore {
  return new LocalStorageSessionStore();
}
