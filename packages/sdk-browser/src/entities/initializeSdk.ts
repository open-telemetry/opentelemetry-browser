/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionManager,
} from '@opentelemetry/web-common';
import { createDocumentEntity } from './createDocumentEntity.ts';
import { createSessionEntity } from './createSessionEntity.ts';
import { DocumentTracker } from './DocumentTracker.ts';
import { EntityAwareLoggerProvider } from './EntityAwareLoggerProvider.ts';

const SESSION_STORAGE_KEY = 'opentelemetry-session';

type SessionManager = ReturnType<typeof createSessionManager>;

export interface InitializeSdkConfig {
  serviceName: string;
  serviceVersion?: string;
  logRecordProcessors: LogRecordProcessor[];
}

export interface BrowserSdk {
  /** The entity-aware logger provider; also installed as the global. */
  loggerProvider: EntityAwareLoggerProvider;
  /** The document tracker; consumers can register additional observers. */
  documentTracker: DocumentTracker;
  /** Current session id, or null if not yet started. */
  getSessionId(): string | null;
  /** Force a new session. Shuts down the current SessionManager, clears the
   *  persisted session, and starts a fresh one — which fires onSessionStarted
   *  and rebinds the session entity on the logger provider. */
  rotateSession(): void;
  /** Stop trackers and flush/shut down the logger provider. */
  shutdown(): Promise<void>;
}

/**
 * Initializes the prototype browser SDK in one call:
 *  - constructs an `EntityAwareLoggerProvider` with the given processors and
 *    a resource derived from `serviceName` / `serviceVersion`
 *  - sets it as the global logger provider
 *  - starts a `SessionManager` and binds `browser.session` to the provider
 *  - starts a `DocumentTracker` and binds `browser.document` to the provider
 */
export function initializeSdk(config: InitializeSdkConfig): BrowserSdk {
  const resource = resourceFromAttributes({
    'service.name': config.serviceName,
    ...(config.serviceVersion === undefined
      ? {}
      : { 'service.version': config.serviceVersion }),
  });

  const loggerProvider = new EntityAwareLoggerProvider({
    resource,
    processors: config.logRecordProcessors,
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  let sessionManager: SessionManager = createSessionManager({
    sessionIdGenerator: createDefaultSessionIdGenerator(),
    sessionStore: createLocalStorageSessionStore(),
    maxDuration: 7200,
    inactivityTimeout: 1800,
  });
  sessionManager.addObserver({
    onSessionStarted: (session) => {
      loggerProvider.setEntity(createSessionEntity(session.id));
    },
    onSessionEnded: () => {
      // No-op: onSessionStarted re-binds the entity on rotation.
    },
  });
  void sessionManager.start();

  const documentTracker = new DocumentTracker();
  documentTracker.addObserver((href) => {
    loggerProvider.setEntity(createDocumentEntity(href));
  });
  documentTracker.start();
  loggerProvider.setEntity(createDocumentEntity(documentTracker.getHref()));

  return {
    loggerProvider,
    documentTracker,
    getSessionId: () => sessionManager.getSessionId(),
    rotateSession: () => {
      sessionManager.shutdown();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      sessionManager = createSessionManager({
        sessionIdGenerator: createDefaultSessionIdGenerator(),
        sessionStore: createLocalStorageSessionStore(),
        maxDuration: 7200,
        inactivityTimeout: 1800,
      });
      sessionManager.addObserver({
        onSessionStarted: (session) => {
          loggerProvider.setEntity(createSessionEntity(session.id));
        },
        onSessionEnded: () => {
          // No-op: onSessionStarted re-binds the entity on rotation.
        },
      });
      void sessionManager.start();
    },
    shutdown: async () => {
      documentTracker.stop();
      sessionManager.shutdown();
      await loggerProvider.shutdown();
    },
  };
}
