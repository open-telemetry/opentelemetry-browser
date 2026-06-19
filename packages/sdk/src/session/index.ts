/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export { DefaultIdGenerator } from './DefaultIdGenerator.ts';
export { LocalStorageSessionStore } from './LocalStorageSessionStore.ts';
export { SessionLogRecordProcessor } from './SessionLogRecordProcessor.ts';
export type { SessionManagerConfig } from './SessionManager.ts';
export { SessionManager } from './SessionManager.ts';
export { SessionSpanProcessor } from './SessionSpanProcessor.ts';
export type { Session } from './types/Session.ts';
export type { SessionIdGenerator } from './types/SessionIdGenerator.ts';
export type { SessionObserver } from './types/SessionObserver.ts';
export type { SessionProvider } from './types/SessionProvider.ts';
export type { SessionPublisher } from './types/SessionPublisher.ts';
export type { SessionStore } from './types/SessionStore.ts';
export {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from './utils.ts';
