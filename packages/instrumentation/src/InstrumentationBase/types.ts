/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MeterProvider,
  TextMapPropagator,
  TracerProvider,
} from '@opentelemetry/api';
import type { LoggerProvider } from '@opentelemetry/api-logs';

/**
 * The dependencies an instrumentation emits through. A dependency that is not
 * passed falls back to the global API, so an `enable()` made before the SDK
 * sets its globals still sends data to the SDK's providers later. An
 * instrumentation can extend this type with its own dependencies.
 */
export interface InstrumentationDeps {
  /** Used for spans. The default is the global tracer provider. */
  tracerProvider?: TracerProvider;
  /** Used for metrics. The default is the global meter provider. */
  meterProvider?: MeterProvider;
  /** Used for log records. The default is the global logger provider. */
  loggerProvider?: LoggerProvider;
  /** Used to inject trace context. The default is the global propagation API. */
  propagator?: TextMapPropagator;
}

/**
 * The public contract for a browser instrumentation. The SDK accepts any
 * object that implements it. `InstrumentationBase` is one implementation, but
 * an instrumentation can also implement this interface directly.
 */
export interface Instrumentation {
  /** The instrumentation scope name, for example `@my-org/instrumentation-foo`. */
  readonly instrumentationName: string;

  /**
   * Starts emitting. The first call sets the dependencies for the life of the
   * instance. Later calls must not change them. Calling `enable()` when the
   * instrumentation is already enabled does nothing. It must not throw.
   */
  enable(deps?: InstrumentationDeps): void;

  /**
   * Stops emitting and removes listeners. A later `enable()` starts emitting
   * again. Calling it when the instrumentation is not enabled does nothing. It
   * must not throw.
   */
  disable(): void;

  /** Whether the instrumentation is emitting now. */
  isEnabled(): boolean;
}
