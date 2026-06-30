/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { SessionLogRecordProcessor } from './SessionLogRecordProcessor.ts';
import { SessionSpanProcessor } from './SessionSpanProcessor.ts';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from './utils.ts';

describe('createSessionSpanProcessor', () => {
  it('returns an instance of a SessionSpanProcessor', () => {
    const processor = createSessionSpanProcessor({
      getSessionId: () => '1234',
    });
    expect(processor).toBeInstanceOf(SessionSpanProcessor);
  });
});

describe('createSessionLogRecordProcessor', () => {
  it('returns an instance of a SessionLogRecordProcessor', () => {
    const processor = createSessionLogRecordProcessor({
      getSessionId: () => '1234',
    });
    expect(processor).toBeInstanceOf(SessionLogRecordProcessor);
  });
});

describe('createDefaultSessionIdGenerator', () => {
  it('returns an instance of a SessionIdGenerator', () => {
    const generator = createDefaultSessionIdGenerator();
    const sessionId = generator.generateSessionId();
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
  });
});

describe('createLocalStorageSessionStore', () => {
  it('returns an instance of a SessionStore', () => {
    const store = createLocalStorageSessionStore();
    expect(typeof store.save).toBe('function');
    expect(typeof store.get).toBe('function');
  });
});

describe('createSessionManager', () => {
  it('returns a SessionManager that implements SessionProvider', () => {
    const manager = createSessionManager({
      sessionIdGenerator: createDefaultSessionIdGenerator(),
      sessionStore: createLocalStorageSessionStore(),
    });
    try {
      const sessionId = manager.getSessionId();
      expect(typeof sessionId).toBe('string');
      expect(sessionId?.length).toBeGreaterThan(0);
    } finally {
      manager.shutdown();
    }
  });
});
