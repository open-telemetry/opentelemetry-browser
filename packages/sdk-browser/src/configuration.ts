/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  BatchSpanProcessor,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/web-common';
import type { BrowserSDKConfiguration } from './types.ts';

export function configureBrowserSDK(config: BrowserSDKConfiguration): {
  shutdown: () => Promise<void>;
} {
  const resource = resourceFromAttributes({
    'service.name': config.serviceName ?? 'unknown_service',
  });

  // --- Traces ---
  const spanProcessors = config.spanProcessors ?? [];
  if (spanProcessors.length === 0 && config.spanExporter) {
    spanProcessors.push(new BatchSpanProcessor(config.spanExporter));
  }

  // --- Logs ---
  const logRecordProcessors = config.logRecordProcessors ?? [];
  if (logRecordProcessors.length === 0 && config.logRecordExporter) {
    logRecordProcessors.push(
      new SimpleLogRecordProcessor(config.logRecordExporter),
    );
  }

  // --- Session tracking ---
  let sessionManager: ReturnType<typeof createSessionManager> | undefined;

  if (config.enableSessionTracking) {
    sessionManager = createSessionManager({
      sessionIdGenerator: createDefaultSessionIdGenerator(),
      sessionStore: createLocalStorageSessionStore(),
    });

    spanProcessors.push(createSessionSpanProcessor(sessionManager));
    logRecordProcessors.push(createSessionLogRecordProcessor(sessionManager));
  }

  // --- Providers ---
  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors,
  });
  trace.setGlobalTracerProvider(tracerProvider);

  const loggerProvider = new LoggerProvider({
    resource,
    processors: logRecordProcessors,
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  // --- Instrumentations ---
  let disableInstrumentations: (() => void) | undefined;
  if (config.instrumentations && config.instrumentations.length > 0) {
    disableInstrumentations = registerInstrumentations({
      instrumentations: config.instrumentations,
    });
  }

  // --- Shutdown ---
  return {
    shutdown: async () => {
      disableInstrumentations?.();
      sessionManager?.shutdown();
      await tracerProvider.shutdown();
      await loggerProvider.shutdown();
    },
  };
}
