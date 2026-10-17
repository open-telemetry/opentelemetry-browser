/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DiagLogger,
  Meter,
  TextMapPropagator,
  Tracer,
} from '@opentelemetry/api';
import { diag, metrics, propagation, trace } from '@opentelemetry/api';
import type { Logger } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { toError } from '../utils/toError.ts';
import type { Instrumentation, InstrumentationDeps } from './types.ts';

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

type State = 'new' | 'enabled' | 'disabled' | 'failed';

interface Locked<Deps> {
  deps: Readonly<Deps> | undefined;
  tracer: Tracer;
  // Undefined when no meterProvider was passed: `metrics.getMeterProvider()` is
  // not a proxy, so the global is read on each access instead.
  meter: Meter | undefined;
  logger: Logger;
  propagator: TextMapPropagator;
}

/**
 * Browser-native base class for OpenTelemetry instrumentations.
 *
 * The constructor only stores the config. The first `enable(deps)` locks the
 * dependencies, runs `_init()` once and then `_onEnable()`. After that,
 * `disable()` and `enable()` only run `_onDisable()` and `_onEnable()`.
 * Hooks must be synchronous, and patches are never removed.
 */
export abstract class InstrumentationBase<
  ConfigType extends object = object,
  Deps extends InstrumentationDeps = InstrumentationDeps,
> implements Instrumentation
{
  public readonly instrumentationName: string;
  public readonly instrumentationVersion: string;
  protected readonly _config: ConfigType;
  protected readonly _diag: DiagLogger;
  private _state: State = 'new';
  private _locked: Locked<Deps> | undefined;

  constructor(
    instrumentationName: string,
    instrumentationVersion: string,
    config: ConfigType,
  ) {
    this.instrumentationName = instrumentationName;
    this.instrumentationVersion = instrumentationVersion;
    this._config = config;
    this._diag = diag.createComponentLogger({ namespace: instrumentationName });
  }

  /** Whether the instrumentation is emitting now. */
  public isEnabled(): boolean {
    return this._state === 'enabled';
  }

  /**
   * Starts emitting. The first call locks `deps` (a dependency that is not
   * passed uses the global API) and runs init once. Later calls ignore `deps`
   * and warn if a passed dependency differs from the locked one. After a
   * failed init, calls do nothing.
   */
  public enable(deps?: Deps): void {
    if (this._state === 'new') {
      this._lock(deps);
      try {
        this._assertSync(this._init());
      } catch (err) {
        // Never retried: a second _init() could wrap an API twice.
        this._state = 'failed';
        const error = toError(err);
        this._diag.warn(
          `init failed, so this instrumentation stays off: ${error.message}`,
          error,
        );
        return;
      }
      this._runOnEnable();
      return;
    }
    if (deps) {
      this._warnIgnoredDeps(deps);
    }
    if (this._state === 'disabled') {
      this._runOnEnable();
    }
  }

  /** Stops emitting and removes listeners. Patches stay. */
  public disable(): void {
    if (this._state !== 'enabled') {
      return;
    }
    this._state = 'disabled';
    this._runOnDisable();
  }

  private _lock(deps: Deps | undefined): void {
    const name = this.instrumentationName;
    const version = this.instrumentationVersion;
    // The trace and logs APIs return proxies, so a provider set as global after
    // this call still receives the data. The metrics API does not; see `meter`.
    this._locked = {
      deps: deps && { ...deps },
      tracer: (deps?.tracerProvider ?? trace.getTracerProvider()).getTracer(
        name,
        version,
      ),
      meter: deps?.meterProvider?.getMeter(name, version),
      logger: (deps?.loggerProvider ?? logs.getLoggerProvider()).getLogger(
        name,
        version,
      ),
      propagator: deps?.propagator ?? propagation,
    };
  }

  // Compares by key, so passing the same deps on every enable() logs nothing.
  private _warnIgnoredDeps(deps: Deps): void {
    const locked = this._locked?.deps ?? {};
    const ignored = Object.entries(deps)
      .filter(([key, value]) => value !== Reflect.get(locked, key))
      .map(([key]) => key);
    if (ignored.length > 0) {
      this._diag.warn(
        `enable() ignores deps after the first call; ignored: ${ignored.join(', ')}`,
      );
    }
  }

  private _runOnEnable(): void {
    // Set first, so emits made by the hook pass `isEnabled()` checks.
    this._state = 'enabled';
    try {
      this._assertSync(this._onEnable());
    } catch (err) {
      // Not `failed`: init is done, so a retry cannot wrap twice.
      this._state = 'disabled';
      this._runOnDisable();
      const error = toError(err);
      this._diag.warn(
        `enable failed; a later enable() can retry: ${error.message}`,
        error,
      );
    }
  }

  private _runOnDisable(): void {
    try {
      this._assertSync(this._onDisable());
    } catch (err) {
      // Caught so a caller that disables many instances reaches the rest.
      this._diag.error(
        'disable failed; some listeners may still be attached',
        toError(err),
      );
    }
  }

  // `async` hooks type-check, but the lifecycle cannot wait for their promise.
  private _assertSync(hookResult: unknown): void {
    if (isPromiseLike(hookResult)) {
      hookResult.then(undefined, (err: unknown) => {
        this._diag.error('an async lifecycle hook rejected', toError(err));
      });
      throw new Error(
        'the hook returned a promise, but hooks must be synchronous',
      );
    }
  }

  private _requireLocked(name: string): Locked<Deps> {
    if (!this._locked) {
      throw new Error(
        `${this.instrumentationName}: ${name} is not available before the first enable()`,
      );
    }
    return this._locked;
  }

  /** The tracer from the locked provider. Available from the first `enable()`. */
  protected get tracer(): Tracer {
    return this._requireLocked('tracer').tracer;
  }

  /**
   * The meter from the locked provider, or else from the current global meter
   * provider. Available from the first `enable()`.
   */
  protected get meter(): Meter {
    return (
      this._requireLocked('meter').meter ??
      metrics.getMeter(this.instrumentationName, this.instrumentationVersion)
    );
  }

  /** The logger from the locked provider. Available from the first `enable()`. */
  protected get logger(): Logger {
    return this._requireLocked('logger').logger;
  }

  /**
   * The locked propagator, or the global propagation API. Use it instead of
   * `propagation`, so a second SDK on the page can inject its own context.
   */
  protected get propagator(): TextMapPropagator {
    return this._requireLocked('propagator').propagator;
  }

  /**
   * The deps as passed to the first `enable()`, for subclass-specific deps.
   * Undefined if that call passed none.
   */
  protected get deps(): Readonly<Deps> | undefined {
    return this._requireLocked('deps').deps;
  }

  /**
   * Replaces `nodule[name]` with `wrapper(original)` and keeps the original on
   * it as `__original`. Throws if the slot is not a function or cannot be
   * redefined, so `_init()` fails instead of skipping silently.
   */
  protected _wrap<Nodule extends object, FieldName extends keyof Nodule>(
    nodule: Nodule,
    name: FieldName,
    wrapper: (original: Nodule[FieldName]) => Nodule[FieldName],
  ): void {
    const original = nodule[name];
    // A wrapper over a missing API would make feature checks such as
    // `if (window.fetch)` pass and then fail on every call.
    if (typeof original !== 'function') {
      throw new Error(
        `_wrap: "${String(name)}" is not a function; nothing to wrap`,
      );
    }
    const wrapped = wrapper(original);
    Object.defineProperty(wrapped, '__original', {
      value: original,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    // Redefined, not assigned: another script may have left the slot
    // non-writable, or made it an accessor whose setter ignores writes.
    Object.defineProperty(nodule, name, {
      value: wrapped,
      enumerable: Object.prototype.propertyIsEnumerable.call(nodule, name),
      writable: true,
      configurable: true,
    });
  }

  /**
   * If `fn` throws or returns a promise that rejects, logs `errorMessage` with
   * `diag.error`, so a broken hook or emit path cannot break the host call.
   */
  protected _safeExecute<T>(errorMessage: string, fn: () => T): T | undefined {
    try {
      const result = fn();
      if (isPromiseLike(result)) {
        result.then(undefined, (err: unknown) => {
          this._diag.error(errorMessage, toError(err));
        });
      }
      return result;
    } catch (err) {
      this._diag.error(errorMessage, toError(err));
      return undefined;
    }
  }

  /**
   * One-time setup, run at the first `enable()`. It only patches browser APIs
   * and checks that the browser supports what this instrumentation needs.
   * Throw if the instrumentation cannot run. Listeners belong in
   * `_onEnable()`. Must not call `enable()` or `disable()`.
   */
  protected _init(): void {}

  /**
   * Add this instrumentation's listeners and observers, including buffered ones,
   * so a late `enable()` still receives earlier entries. If this throws,
   * `_onDisable()` must be able to remove whatever was added before the throw.
   * Must not call `enable()` or `disable()`.
   */
  protected _onEnable(): void {}

  /**
   * Remove what `_onEnable()` added. `isEnabled()` is already false here, which
   * is what stops the patches from emitting. Must not call `enable()` or
   * `disable()`.
   */
  protected _onDisable(): void {}
}
