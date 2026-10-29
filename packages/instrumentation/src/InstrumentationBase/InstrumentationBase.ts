/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger, TextMapPropagator, Tracer } from '@opentelemetry/api';
import { diag, propagation, trace } from '@opentelemetry/api';
import type { Logger } from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';
import { toError } from '../utils/toError.ts';
import type { Instrumentation, InstrumentationDeps } from './types.ts';

type State = 'new' | 'enabled' | 'disabled' | 'failed';

interface Resolved {
  deps: InstrumentationDeps | undefined;
  tracer: Tracer;
  logger: Logger;
  propagator: TextMapPropagator;
}

/**
 * Browser-native base class for OpenTelemetry instrumentations.
 *
 * The constructor only stores the config. The first `enable(deps)` locks the
 * dependencies, runs `_init()` once and then `_onEnable()`. After that,
 * `disable()` and `enable()` only run `_onDisable()` and `_onEnable()`. If
 * setup, `_init()` or `_onDisable()` throws, the instrumentation stays off for good.
 * Hooks must be synchronous, and patches are never removed.
 */
export abstract class InstrumentationBase<ConfigType extends object = object>
  implements Instrumentation
{
  public readonly instrumentationName: string;
  public readonly instrumentationVersion: string;
  protected readonly _config: ConfigType;
  protected readonly _diag: DiagLogger;
  private _state: State = 'new';
  private _resolved: Resolved | undefined;

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
   * Starts emitting. The first call locks `deps` and runs init once. Later
   * calls ignore `deps` and warn if a passed dependency differs from the locked
   * one. After any failure that leaves the instrumentation off for good, a call
   * only logs at debug level.
   */
  public enable(deps?: InstrumentationDeps): void {
    if (this._state === 'new') {
      try {
        this._resolve(deps);
      } catch (err) {
        this._markFailed({
          reason: 'could not set up the tracer and logger',
          cause: err,
        });
        return;
      }
      try {
        this._init();
      } catch (err) {
        // Never retried: a second _init() could wrap an API twice.
        this._markFailed({ reason: 'init failed', cause: err });
        return;
      }
      this._runOnEnable();
      return;
    }
    if (this._state === 'failed') {
      // Not warn: the failure was logged once, and callers may call enable()
      // often.
      this._diag.debug('enable() ignored: this instrumentation failed earlier');
      return;
    }
    if (deps) {
      this._reportIgnoredDeps(deps);
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

  private _markFailed({
    reason,
    cause,
  }: {
    reason: string;
    cause: unknown;
  }): void {
    this._state = 'failed';
    const error = toError(cause);
    this._diag.error(
      `${reason}, so this instrumentation stays off: ${error.message}`,
      error,
    );
  }

  private _resolve(deps: InstrumentationDeps | undefined): void {
    const name = this.instrumentationName;
    const version = this.instrumentationVersion;
    // The trace and logs APIs return proxies, so a provider set as global after
    // this call still receives the data.
    const tracerProvider = deps?.tracerProvider ?? trace.getTracerProvider();
    const loggerProvider = deps?.loggerProvider ?? logs.getLoggerProvider();
    this._resolved = {
      deps: deps && { ...deps },
      tracer: tracerProvider.getTracer(name, version),
      logger: loggerProvider.getLogger(name, version),
      propagator: deps?.propagator ?? propagation,
    };
  }

  // Debug when nothing differs: the SDK passes the same deps on every enable().
  // A difference means the instance was enabled outside the SDK, so its data
  // goes to other providers than the caller expects.
  private _reportIgnoredDeps(deps: InstrumentationDeps): void {
    const resolvedDeps = this._resolved?.deps ?? {};
    const ignored = Object.entries(deps)
      .filter(([key, value]) => value !== Reflect.get(resolvedDeps, key))
      .map(([key]) => key);
    if (ignored.length > 0) {
      this._diag.warn(
        `enable() ignores deps after the first call; ignored: ${ignored.join(', ')}`,
      );
    } else {
      this._diag.debug('enable() ignores deps after the first call');
    }
  }

  private _runOnEnable(): void {
    // Set first, so emits made by the hook pass `isEnabled()` checks.
    this._state = 'enabled';
    try {
      this._onEnable();
    } catch (err) {
      const error = toError(err);
      // Rolls back to `disabled`, not `failed`, unless `_onDisable()` also
      // throws: init is done, so a retry cannot wrap twice.
      this._diag.error(`enable failed: ${error.message}`, error);
      this.disable();
    }
  }

  private _runOnDisable(): void {
    try {
      this._onDisable();
    } catch (err) {
      // Caught so a caller that disables many instances reaches the rest. State
      // is `failed`, not `disabled`: a retry would add a second set of listeners.
      this._state = 'failed';
      const error = toError(err);
      this._diag.error(
        `disable failed, so this instrumentation stays off; some listeners may still be attached: ${error.message}`,
        error,
      );
    }
  }

  private _requireResolved(name: string): Resolved {
    if (!this._resolved) {
      throw new Error(
        `${this.instrumentationName}: ${name} is not available until enable() succeeds`,
      );
    }
    return this._resolved;
  }

  /** Throws until the first `enable()` succeeds. */
  protected get tracer(): Tracer {
    return this._requireResolved('tracer').tracer;
  }

  /** Throws until the first `enable()` succeeds. */
  protected get logger(): Logger {
    return this._requireResolved('logger').logger;
  }

  /**
   * Throws until the first `enable()` succeeds. Use it instead of
   * `propagation`, so a second SDK on the page can inject its own context.
   */
  protected get propagator(): TextMapPropagator {
    return this._requireResolved('propagator').propagator;
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
   * If `fn` throws, or returns a thenable that rejects, logs `errorMessage`
   * with `diag.error`, so a broken hook or emit path cannot break the host
   * call. The returned value is passed through unchanged and never awaited.
   */
  protected _safeExecute<T>(errorMessage: string, fn: () => T): T | undefined {
    const onError = (err: unknown): undefined => {
      this._diag.error(errorMessage, toError(err));
      return undefined;
    };
    try {
      const result = fn();
      const then = (result as { then?: unknown } | null)?.then;
      if (typeof then === 'function') {
        then.call(result, undefined, onError);
      }
      return result;
    } catch (err) {
      return onError(err);
    }
  }

  /**
   * One-time setup, run at the first `enable()`. It only patches browser APIs
   * and checks that the browser supports what this instrumentation needs.
   * Throw if the instrumentation cannot run. Listeners belong in
   * `_onEnable()`. Must be synchronous and must not call `enable()` or
   * `disable()`.
   */
  protected _init(): void {}

  /**
   * Add this instrumentation's listeners and observers, including buffered ones,
   * so a late `enable()` still receives earlier entries. If this throws,
   * `_onDisable()` must be able to remove whatever was added before the throw.
   * Must be synchronous and must not call `enable()` or `disable()`.
   */
  protected _onEnable(): void {}

  /**
   * Remove what `_onEnable()` added. `isEnabled()` is already false here, which
   * is what stops the patches from emitting. If this throws, the
   * instrumentation stays off for good and `enable()` does nothing.
   * Must be synchronous and must not call `enable()` or `disable()`.
   */
  protected _onDisable(): void {}
}
