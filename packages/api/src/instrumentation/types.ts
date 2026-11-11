/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TextMapPropagator, TracerProvider } from '@opentelemetry/api';
import type { LoggerProvider } from '@opentelemetry/api-logs';

/**
 * The dependencies the SDK injects into every instrumentation. A dependency
 * that is not passed falls back to the global API. The fallback follows the
 * global that is set at emit time, so an `enable()` made before the SDK sets
 * its globals still sends data to the SDK's providers later. The first
 * `enable()` locks the dependencies for the life of the instance.
 *
 * A new field must be optional, have a fallback when it is missing, and apply
 * to every instrumentation. An instrumentation's own dependencies belong in its
 * constructor.
 */
export interface InstrumentationDeps {
  /** Used for spans. The default is the global tracer provider. */
  readonly tracerProvider?: TracerProvider;
  /** Used for log records. The default is the global logger provider. */
  readonly loggerProvider?: LoggerProvider;
  /** Used to inject trace context. The default is the global propagation API. */
  readonly propagator?: TextMapPropagator;
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
   * instance. A later call ignores them. Calling `enable()` when the
   * instrumentation is already enabled does nothing. If the instrumentation
   * cannot run, it stays off and `isEnabled()` returns false. It must not
   * throw, but the SDK catches a throw in case an implementation does.
   */
  enable(deps?: InstrumentationDeps): void;

  /**
   * Stops emitting and removes listeners. A later `enable()` starts emitting
   * again, unless `disable()` failed. Calling it when the instrumentation is
   * not enabled does nothing. It must not throw.
   */
  disable(): void;

  /** Whether the instrumentation is emitting now. */
  isEnabled(): boolean;
}
