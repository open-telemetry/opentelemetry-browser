/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import type { Session } from './types/Session.ts';
import type { SessionStore } from './types/SessionStore.ts';

const SESSION_STORAGE_KEY = 'opentelemetry-session';
const NO_LOCAL_STORAGE =
  'localStorage is not available, the session stays in memory only';

// JSON.parse returns whatever was stored, so the shape is checked before it is used as a session.
function isSession(value: unknown): value is Session {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Session).id === 'string' &&
    typeof (value as Session).startTimestamp === 'number'
  );
}

// localStorage throws where storage is blocked or full, so every access is guarded.
export class LocalStorageSessionStore implements SessionStore {
  save(session: Session): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        diag.debug(NO_LOCAL_STORAGE);
      } else {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
    } catch (error) {
      diag.debug(
        'Session not saved to localStorage, it stays in memory only',
        error,
      );
    }

    return Promise.resolve();
  }

  get(): Promise<Session | null> {
    try {
      if (typeof localStorage === 'undefined') {
        diag.debug(NO_LOCAL_STORAGE);
        return Promise.resolve(null);
      }

      const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        const parsed: unknown = JSON.parse(sessionData);
        if (isSession(parsed)) {
          return Promise.resolve(parsed);
        }
        diag.debug(
          'Ignoring a stored session without a string id and a number startTimestamp',
        );
      }
    } catch (error) {
      // blocked storage or invalid JSON
      diag.debug('Could not read the session from localStorage', error);
    }
    return Promise.resolve(null);
  }
}
