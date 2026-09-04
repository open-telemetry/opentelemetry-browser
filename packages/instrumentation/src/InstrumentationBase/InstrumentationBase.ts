/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DiagLogger,
  Meter,
  MeterProvider,
  Tracer,
  TracerProvider,
} from '@opentelemetry/api';
import { diag, metrics, trace } from '@opentelemetry/api';
import type { Logger, LoggerProvider } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import type {
  Instrumentation,
  InstrumentationConfig,
} from '@opentelemetry/instrumentation';

/**
 * Browser-native base class for OpenTelemetry instrumentations.
 *
 * Implements the public `Instrumentation` interface so instances drop straight
 * into `registerInstrumentations`, but depends only on `@opentelemetry/api` and
 * `@opentelemetry/api-logs` at runtime. Unlike `@opentelemetry/instrumentation`'s
 * base it carries none of the Node module-patching machinery
 * (`require-in-the-middle`, `init()` / module definitions), which has no meaning
 * in a browser.
 *
 * Patching is install-only: `_wrap` replaces a method in place, and there is
 * deliberately no `_unwrap`. Restoring a patched browser API is unsafe — other
 * code may have wrapped on top of ours, and there is no reliable teardown — so
 * it is disallowed as a rule, and omitting `_unwrap` enforces that by
 * construction. Consequently `enable()` installs once and `disable()` only
 * pauses emission; it is not a true inverse of `enable()`. Tearing down an
 * instrumentation's *own* subscriptions (event listeners, `PerformanceObserver`,
 * `AbortController`) is unrelated to unwrapping and remains fine.
 */
export abstract class InstrumentationBase<
  ConfigType extends InstrumentationConfig = InstrumentationConfig,
> implements Instrumentation<ConfigType>
{
  public readonly instrumentationName: string;
  public readonly instrumentationVersion: string;
  protected _config: ConfigType;
  protected _diag: DiagLogger;
  protected _tracer: Tracer;
  protected _meter: Meter;
  protected _logger: Logger;

  constructor(
    instrumentationName: string,
    instrumentationVersion: string,
    config: ConfigType = {} as ConfigType,
  ) {
    this.instrumentationName = instrumentationName;
    this.instrumentationVersion = instrumentationVersion;
    this._config = Object.assign({ enabled: true }, config);
    this._diag = diag.createComponentLogger({ namespace: instrumentationName });
    this._tracer = trace.getTracer(instrumentationName, instrumentationVersion);
    this._meter = metrics.getMeter(instrumentationName, instrumentationVersion);
    this._logger = logs.getLogger(instrumentationName, instrumentationVersion);

    if (this._config.enabled) {
      this.enable();
    }
  }

  protected get tracer(): Tracer {
    return this._tracer;
  }

  protected get meter(): Meter {
    return this._meter;
  }

  protected get logger(): Logger {
    return this._logger;
  }

  public getConfig(): ConfigType {
    return this._config;
  }

  public setConfig(config: ConfigType = {} as ConfigType): void {
    this._config = Object.assign({ enabled: true }, config);
  }

  public setTracerProvider(tracerProvider: TracerProvider): void {
    this._tracer = tracerProvider.getTracer(
      this.instrumentationName,
      this.instrumentationVersion,
    );
  }

  public setMeterProvider(meterProvider: MeterProvider): void {
    this._meter = meterProvider.getMeter(
      this.instrumentationName,
      this.instrumentationVersion,
    );
  }

  public setLoggerProvider(loggerProvider: LoggerProvider): void {
    this._logger = loggerProvider.getLogger(
      this.instrumentationName,
      this.instrumentationVersion,
    );
  }

  /**
   * Installs `wrapper` over `nodule[name]`, monkey-patching it in place. The
   * original is stashed on the wrapped value as a non-enumerable `__original`
   * for debugging only; there is intentionally no way to restore it (see the
   * class note on unwrapping).
   */
  protected _wrap<Nodule extends object, FieldName extends keyof Nodule>(
    nodule: Nodule,
    name: FieldName,
    wrapper: (
      original: Nodule[FieldName],
      name: FieldName,
    ) => Nodule[FieldName],
  ): Nodule[FieldName] {
    const original = nodule[name];
    const wrapped = wrapper(original, name);
    Object.defineProperty(wrapped as object, '__original', {
      value: original,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    nodule[name] = wrapped;
    return wrapped;
  }

  /** Install patches / subscribe. Called from the constructor when enabled. */
  public abstract enable(): void;

  /** Pause emission. Must not restore patched APIs (see the class note). */
  public abstract disable(): void;
}
