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
import { toError } from '../utils/toError.ts';

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

// `waiting`: init is done, but only an explicit enable() makes it emit.
type Phase =
  | 'new'
  | 'initializing'
  | 'initFailed'
  | 'waiting'
  | 'enabled'
  | 'disabled';

/**
 * Browser-native base class for OpenTelemetry instrumentations. It implements
 * the `Instrumentation` interface, so instances work with
 * `registerInstrumentations`, without the Node module-patching runtime of
 * `@opentelemetry/instrumentation`.
 *
 * Nothing runs until the providers are set, so the constructor and an early
 * `enable()` do not patch or add listeners. Hooks must be synchronous, and
 * patches are never removed. The package README describes the full lifecycle
 * in "Enabling and disabling" and "Writing an instrumentation".
 */
export abstract class InstrumentationBase<
  ConfigType extends InstrumentationConfig = InstrumentationConfig,
> implements Instrumentation<ConfigType>
{
  public readonly instrumentationName: string;
  public readonly instrumentationVersion: string;
  protected _config: ConfigType;
  protected readonly _diag: DiagLogger;
  private _tracer: Tracer;
  private _meter: Meter;
  private _logger: Logger;
  // From `enabled: false` or a disable() before registration: only an explicit
  // enable() makes it emit.
  private _waitsForEnable: boolean;
  private _phase: Phase = 'new';
  // Set while _onEnable() runs, so a disable() inside it can defer cleanup.
  private _isEnabling = false;
  // Stands in for "registered": registerInstrumentations always sets the
  // providers before it calls enable(). A manual set*Provider() counts too.
  private _hasProviders = false;
  // An enable() made before registration, kept for the registration to apply.
  private _isEnableRequested = false;

  constructor(
    instrumentationName: string,
    instrumentationVersion: string,
    config: ConfigType,
  ) {
    this.instrumentationName = instrumentationName;
    this.instrumentationVersion = instrumentationVersion;
    this._waitsForEnable = config.enabled === false;
    this._config = { ...config, enabled: false };
    this._diag = diag.createComponentLogger({ namespace: instrumentationName });
    this._tracer = trace.getTracer(instrumentationName, instrumentationVersion);
    this._meter = metrics.getMeter(instrumentationName, instrumentationVersion);
    this._logger = logs.getLogger(instrumentationName, instrumentationVersion);
  }

  /** Whether the instrumentation is emitting now. */
  public isEnabled(): boolean {
    return this._phase === 'enabled';
  }

  /**
   * Runs init once, then emits. Before registration, the call is only kept,
   * and registration then emits. With `enabled: false` or an early
   * `disable()`, registration only runs init, unless a call was kept. After a
   * failed init, calls do nothing.
   */
  public enable(): void {
    // `initializing`: an enable() from _init() would run init a second time.
    if (this._phase === 'enabled' || this._phase === 'initializing') {
      return;
    }
    if (this._phase === 'initFailed') {
      this._diag.debug(
        'not enabling because init failed earlier; see the earlier warning',
      );
      return;
    }
    if (this._phase === 'new') {
      // Before registration, events and init warnings could be dropped.
      if (!this._hasProviders) {
        this._isEnableRequested = true;
        this._diag.debug('enable() kept until registration sets the providers');
        return;
      }
      this._setPhase('initializing');
      try {
        this._assertSync(this._init());
      } catch (err) {
        // Swallowed: one locked API must not stop the other instrumentations.
        this._setPhase('initFailed');
        const error = toError(err);
        this._diag.warn(
          `init failed, so this instrumentation stays off: ${error.message}`,
          error,
        );
        return;
      }
      if (this._waitsForEnable && !this._isEnableRequested) {
        this._setPhase('waiting');
        this._diag.debug(
          'initialized but not emitting, because of `enabled: false` or an early disable(). Call enable() to emit.',
        );
        return;
      }
    }
    // Set first, so emits made by the hook pass `isEnabled()` checks and a
    // re-entrant enable() does not run the hook twice.
    this._setPhase('enabled');
    if (this._isEnabling) {
      return;
    }
    let failure: Error | undefined;
    this._isEnabling = true;
    try {
      this._assertSync(this._onEnable());
    } catch (err) {
      // No failure phase: init is done, so a retry cannot wrap twice.
      failure = toError(err);
      this._setPhase(this._idlePhase);
    } finally {
      this._isEnabling = false;
    }
    // Also cleans up after a disable() made inside _onEnable().
    if (!this.isEnabled()) {
      this._runOnDisable();
    }
    if (failure) {
      this._diag.warn(
        `enable failed; a later enable() can retry: ${failure.message}`,
        failure,
      );
    }
  }

  /**
   * Stops emission and removes listeners. Patches stay. Before registration,
   * it cancels a kept `enable()` and makes the instance wait for `enable()`,
   * as if it was built with `enabled: false`.
   */
  public disable(): void {
    this._isEnableRequested = false;
    if (this._phase === 'new') {
      this._waitsForEnable = true;
      return;
    }
    if (this._phase !== 'enabled') {
      return;
    }
    this._setPhase(this._idlePhase);
    // _onEnable() is still adding listeners. enable() removes them once it returns.
    if (this._isEnabling) {
      return;
    }
    this._runOnDisable();
  }

  private _runOnDisable(): void {
    try {
      this._assertSync(this._onDisable());
    } catch (err) {
      // Caught so the unload loop of registerInstrumentations reaches the rest.
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

  private get _idlePhase(): Phase {
    return this._waitsForEnable ? 'waiting' : 'disabled';
  }

  private get _isHandled(): boolean {
    return this._phase === 'enabled' || this._phase === 'waiting';
  }

  // registerInstrumentations calls enable() only when `enabled` is false.
  private _setPhase(phase: Phase): void {
    this._phase = phase;
    this._config.enabled = this._isHandled;
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

  /** The live object, not a copy, because hot paths read it per request. */
  public getConfig(): Readonly<ConfigType> {
    return this._config;
  }

  /**
   * Replaces the whole config. Keys not in `config` become undefined. It never
   * enables or disables the instrumentation. A different `enabled` value is
   * ignored with a warning, so use `enable()` and `disable()` instead.
   */
  public setConfig(config: ConfigType): void {
    if (config.enabled !== undefined && config.enabled !== this._isHandled) {
      this._diag.warn(
        'setConfig() ignores `enabled`; call enable() or disable() to change whether this instrumentation emits',
      );
    }
    this._config = { ...config, enabled: this._isHandled };
  }

  public setTracerProvider(tracerProvider: TracerProvider): void {
    this._hasProviders = true;
    this._tracer = tracerProvider.getTracer(
      this.instrumentationName,
      this.instrumentationVersion,
    );
  }

  public setMeterProvider(meterProvider: MeterProvider): void {
    this._hasProviders = true;
    this._meter = meterProvider.getMeter(
      this.instrumentationName,
      this.instrumentationVersion,
    );
  }

  public setLoggerProvider(loggerProvider: LoggerProvider): void {
    this._hasProviders = true;
    this._logger = loggerProvider.getLogger(
      this.instrumentationName,
      this.instrumentationVersion,
    );
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
  protected _runHook<T>(errorMessage: string, fn: () => T): T | undefined {
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
   * One-time setup, run at registration: patch browser APIs, check that
   * the browser supports what this instrumentation needs, and make one-time
   * choices. Throw if the instrumentation cannot run. Listeners belong in
   * `_onEnable()`: a patch passes calls through while nothing is emitted, but a
   * listener added here would drop what it hears, including buffered entries.
   */
  protected _init(): void {}

  /**
   * Add this instrumentation's listeners and observers, including buffered ones,
   * so a late `enable()` still receives earlier entries. If this throws,
   * `_onDisable()` must be able to remove whatever was added before the throw.
   */
  protected _onEnable(): void {}

  /**
   * Remove what `_onEnable()` added. `isEnabled()` is already false here, which
   * is what stops the patches from emitting.
   */
  protected _onDisable(): void {}
}
