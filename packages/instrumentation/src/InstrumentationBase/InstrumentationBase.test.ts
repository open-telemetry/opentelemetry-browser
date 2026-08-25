/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Tracer, TracerProvider } from '@opentelemetry/api';
import type { Logger, LoggerProvider } from '@opentelemetry/api-logs';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { beforeEach, describe, expect, it } from 'vitest';
import { registerForTest, setupTestDiagLogger } from '#utils/test';
import { InstrumentationBase } from './InstrumentationBase.ts';

class EnableProbe extends InstrumentationBase {
  public initCount = 0;
  public enableCount = 0;
  public disableCount = 0;

  protected override _init(): void {
    this.initCount += 1;
  }

  protected override _onEnable(): void {
    this.enableCount += 1;
  }

  protected override _onDisable(): void {
    this.disableCount += 1;
  }
}

// Hooks read subclass fields, which only exist once the subclass constructor
// has finished. The Node base runs its first enable() before that point.
class FieldProbe extends InstrumentationBase {
  public readonly marker = 'initialized';
  public events: string[] = [];
  public markerSeenInHook: string | undefined;
  public tracerSeenInHook: Tracer | undefined;
  public isEnabledSeenInHook: boolean | undefined;

  protected override _init(): void {
    this.events.push('init');
  }

  protected override _onEnable(): void {
    this.events.push('enable');
    this.markerSeenInHook = this.marker;
    this.tracerSeenInHook = this.tracer;
    this.isEnabledSeenInHook = this.isEnabled();
  }
}

class FailingProbe extends InstrumentationBase {
  protected override _init(): void {
    throw new Error('cannot patch');
  }
}

class ThrowingProbe extends InstrumentationBase {
  // `unknown` so tests can throw non-Error values; `undefined` means succeed.
  public toThrow: unknown;
  public attempts = 0;

  protected override _init(): void {
    this.attempts += 1;
    if (this.toThrow !== undefined) {
      throw this.toThrow;
    }
  }
}

// Adds a listener, then throws, like an _onEnable that emits the initial state
// through a user hook that fails.
class HalfEnableProbe extends InstrumentationBase {
  public readonly target = new EventTarget();
  public received = 0;
  public failNextEnable = true;
  public initCount = 0;
  private _listener: (() => void) | undefined;

  protected override _init(): void {
    this.initCount += 1;
  }

  protected override _onEnable(): void {
    this._listener = () => {
      this.received += 1;
    };
    this.target.addEventListener('ping', this._listener);
    if (this.failNextEnable) {
      this.failNextEnable = false;
      throw new Error('enable broke');
    }
  }

  protected override _onDisable(): void {
    if (this._listener) {
      this.target.removeEventListener('ping', this._listener);
      this._listener = undefined;
    }
  }
}

// Calls enable() from _init(), as a port of a Node instrumentation might.
class ReentrantInitProbe extends EnableProbe {
  protected override _init(): void {
    super._init();
    this.enable();
  }
}

// Runs `duringNextEnable` before _onEnable() adds its listener, like a user
// hook called by an emit that _onEnable() makes.
class ReentrantEnableProbe extends InstrumentationBase {
  public readonly target = new EventTarget();
  public received = 0;
  public duringNextEnable: (() => void) | undefined;
  private _listener: (() => void) | undefined;

  protected override _onEnable(): void {
    const callback = this.duringNextEnable;
    this.duringNextEnable = undefined;
    callback?.();
    this._listener = () => {
      this.received += 1;
    };
    this.target.addEventListener('ping', this._listener);
  }

  protected override _onDisable(): void {
    if (this._listener) {
      this.target.removeEventListener('ping', this._listener);
      this._listener = undefined;
    }
  }
}

// An `async` override type-checks, because a method that returns
// Promise<void> can override one that returns void.
class AsyncInitProbe extends EnableProbe {
  public readonly rejection = new Error('async init broke');

  protected override async _init(): Promise<void> {
    super._init();
    await Promise.resolve();
    throw this.rejection;
  }
}

class AsyncEnableProbe extends EnableProbe {
  protected override async _onEnable(): Promise<void> {
    super._onEnable();
  }
}

class AsyncDisableProbe extends EnableProbe {
  protected override async _onDisable(): Promise<void> {
    super._onDisable();
  }
}

class ThrowingDisableProbe extends InstrumentationBase {
  public readonly thrown = new Error('cleanup broke');

  protected override _onDisable(): void {
    throw this.thrown;
  }
}

class WrapProbe extends InstrumentationBase {
  public wrap<Nodule extends object, FieldName extends keyof Nodule>(
    nodule: Nodule,
    name: FieldName,
    wrapper: (original: Nodule[FieldName]) => Nodule[FieldName],
  ): void {
    this._wrap(nodule, name, wrapper);
  }

  public runHook<T>(errorMessage: string, fn: () => T): T | undefined {
    return this._runHook(errorMessage, fn);
  }

  public exposedTracer(): Tracer {
    return this.tracer;
  }

  public exposedLogger(): Logger {
    return this.logger;
  }
}

describe('InstrumentationBase', () => {
  let diagLogger: ReturnType<typeof setupTestDiagLogger>;
  const warnedError = (): unknown => diagLogger.warn.mock.calls[0]?.[2];

  beforeEach(() => {
    diagLogger = setupTestDiagLogger();
  });

  describe('activation', () => {
    it('does no work in the constructor', () => {
      const probe = new EnableProbe('test', '1.0.0', {});

      expect(probe.initCount).toBe(0);
      expect(probe.enableCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
    });

    it('runs hooks after subclass fields exist', () => {
      const probe = new FieldProbe('test', '1.0.0', {});

      registerForTest(probe);

      expect(probe.events).toEqual(['init', 'enable']);
      expect(probe.markerSeenInHook).toBe('initialized');
    });

    it('reports isEnabled() as true inside _onEnable()', () => {
      const probe = new FieldProbe('test', '1.0.0', {});

      registerForTest(probe);

      // Emits that _onEnable() makes go through patches that check isEnabled().
      expect(probe.isEnabledSeenInHook).toBe(true);
    });

    it('runs init once when _init() calls enable()', () => {
      const probe = new ReentrantInitProbe('test', '1.0.0', {});

      registerForTest(probe);

      expect(probe.initCount).toBe(1);
      expect(probe.enableCount).toBe(1);
      expect(probe.isEnabled()).toBe(true);
    });

    it('treats an explicit `enabled: undefined` as the default', () => {
      // Spreading caller options often produces this key. It must not count
      // as `enabled: false`.
      const probe = new EnableProbe('test', '1.0.0', { enabled: undefined });

      registerForTest(probe);

      expect(probe.isEnabled()).toBe(true);
    });

    it('does no work for an enable() made before registration', () => {
      const probe = new EnableProbe('test', '1.0.0', {});

      probe.enable();

      expect(probe.isEnabled()).toBe(false);
      expect(probe.initCount).toBe(0);
      expect(probe.enableCount).toBe(0);
    });

    it('with `enabled: false`, does no work for an enable() made before registration', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });

      probe.enable();

      expect(probe.isEnabled()).toBe(false);
      expect(probe.initCount).toBe(0);
      expect(probe.enableCount).toBe(0);
    });

    it('does not run init again after disable() and enable()', () => {
      const probe = new EnableProbe('test', '1.0.0', {});

      registerForTest(probe);
      probe.disable();
      probe.enable();

      expect(probe.isEnabled()).toBe(true);
      expect(probe.enableCount).toBe(2);
      expect(probe.disableCount).toBe(1);
      // disable() leaves patches in place, so running init again would stack them.
      expect(probe.initCount).toBe(1);
    });

    it('disable() is a no-op when already off', () => {
      const probe = new EnableProbe('test', '1.0.0', {});

      probe.disable();

      expect(probe.disableCount).toBe(0);
    });
  });

  describe('getConfig().enabled', () => {
    it('reports whether registration has handled the instance', () => {
      const probe = new EnableProbe('test', '1.0.0', {});
      expect(probe.getConfig().enabled).toBe(false);

      registerForTest(probe);
      expect(probe.getConfig().enabled).toBe(true);

      probe.disable();
      expect(probe.getConfig().enabled).toBe(false);
    });

    it('is true for a silent `enabled: false` instance after init', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.getConfig().enabled).toBe(true);
      expect(probe.isEnabled()).toBe(false);
      unload();
    });
  });

  describe('with registerInstrumentations', () => {
    it('enables a default instance', () => {
      const probe = new EnableProbe('test', '1.0.0', {});

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(true);
      expect(probe.enableCount).toBe(1);
      unload();
    });

    it('runs init for an `enabled: false` instance but does not emit', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.initCount).toBe(1);
      expect(probe.enableCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
      unload();
    });

    it('lets a later enable() emit from an `enabled: false` instance', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });
      const unload = registerInstrumentations({ instrumentations: [probe] });

      probe.enable();

      expect(probe.isEnabled()).toBe(true);
      expect(probe.enableCount).toBe(1);
      unload();
    });

    it('runs init and emits at registration for an `enabled: false` instance enabled before it', () => {
      const sentinelTracer = {} as Tracer;
      const tracerProvider: TracerProvider = {
        getTracer: () => sentinelTracer,
      };
      const probe = new FieldProbe('test', '1.0.0', { enabled: false });
      // For example, a consent tool that reports a stored choice right away.
      probe.enable();

      const unload = registerInstrumentations({
        instrumentations: [probe],
        tracerProvider,
      });

      expect(probe.isEnabled()).toBe(true);
      expect(probe.events).toEqual(['init', 'enable']);
      expect(probe.tracerSeenInHook).toBe(sentinelTracer);
      unload();
    });

    it('lets a disable() cancel an enable() made before registration', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });
      probe.enable();
      probe.disable();

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(false);
      expect(probe.initCount).toBe(1);
      unload();
    });

    it('emits once at registration for a default instance enabled before it', () => {
      const probe = new EnableProbe('test', '1.0.0', {});
      probe.enable();

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(true);
      expect(probe.initCount).toBe(1);
      expect(probe.enableCount).toBe(1);
      unload();
    });

    it('treats a default instance disabled before registration like `enabled: false`', () => {
      const probe = new EnableProbe('test', '1.0.0', {});
      // For example, a consent tool that reports a stored refusal right away.
      probe.disable();

      const unloadFirst = registerInstrumentations({
        instrumentations: [probe],
      });
      expect(probe.initCount).toBe(1);
      expect(probe.enableCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
      expect(probe.getConfig().enabled).toBe(true);

      probe.enable();
      expect(probe.isEnabled()).toBe(true);

      unloadFirst();
      const unload = registerInstrumentations({ instrumentations: [probe] });
      expect(probe.isEnabled()).toBe(false);
      expect(probe.enableCount).toBe(1);

      probe.enable();
      expect(probe.isEnabled()).toBe(true);
      unload();
    });

    it('emits at registration after an early disable() and then enable()', () => {
      const probe = new EnableProbe('test', '1.0.0', {});
      probe.disable();
      probe.enable();

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(true);
      expect(probe.enableCount).toBe(1);
      unload();
    });

    it('does not emit at registration after an early enable() and then disable()', () => {
      const probe = new EnableProbe('test', '1.0.0', {});
      probe.enable();
      probe.disable();

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(false);
      expect(probe.initCount).toBe(1);
      expect(probe.enableCount).toBe(0);
      unload();
    });

    it('enables a default instance disabled after registration on a new registration', () => {
      const probe = new EnableProbe('test', '1.0.0', {});
      const unloadFirst = registerInstrumentations({
        instrumentations: [probe],
      });
      probe.disable();

      unloadFirst();
      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(true);
      expect(probe.enableCount).toBe(2);
      unload();
    });

    it('keeps a silent instance silent through a second registration', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });

      registerInstrumentations({ instrumentations: [probe] })();
      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(false);
      expect(probe.enableCount).toBe(0);
      unload();
    });

    it('keeps an `enabled: false` instance silent through unload and a new registration, until enable()', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });
      const unloadFirst = registerInstrumentations({
        instrumentations: [probe],
      });
      probe.enable();

      // For example consent revoked, then an SDK restart.
      unloadFirst();
      const unload = registerInstrumentations({ instrumentations: [probe] });
      expect(probe.isEnabled()).toBe(false);

      probe.enable();
      expect(probe.isEnabled()).toBe(true);
      unload();
    });

    it('does not let a registration retry a failed enable() of an `enabled: false` instance', () => {
      const probe = new HalfEnableProbe('test', '1.0.0', { enabled: false });
      const unloadFirst = registerInstrumentations({
        instrumentations: [probe],
      });
      probe.enable();

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(false);
      unload();
      unloadFirst();
    });

    it('retries a failed enable() of a default instance on the next registration', () => {
      const probe = new HalfEnableProbe('test', '1.0.0', {});
      const unloadFirst = registerInstrumentations({
        instrumentations: [probe],
      });

      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(true);
      unload();
      unloadFirst();
    });

    it('sets providers before init and enable', () => {
      const sentinelTracer = {} as Tracer;
      const tracerProvider: TracerProvider = {
        getTracer: () => sentinelTracer,
      };
      const probe = new FieldProbe('test', '1.0.0', {});

      const unload = registerInstrumentations({
        instrumentations: [probe],
        tracerProvider,
      });

      expect(probe.tracerSeenInHook).toBe(sentinelTracer);
      unload();
    });

    it('enables again after unload and a second registration', () => {
      const probe = new EnableProbe('test', '1.0.0', {});

      registerInstrumentations({ instrumentations: [probe] })();
      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(true);
      expect(probe.enableCount).toBe(2);
      expect(probe.initCount).toBe(1);
      unload();
    });

    it('does not enable an instance twice when registered twice', () => {
      const probe = new EnableProbe('test', '1.0.0', {});

      const unloadFirst = registerInstrumentations({
        instrumentations: [probe],
      });
      const unloadSecond = registerInstrumentations({
        instrumentations: [probe],
      });

      expect(probe.enableCount).toBe(1);
      unloadSecond();
      unloadFirst();
    });

    it('enables the other instances when one fails init', () => {
      const failing = new FailingProbe('failing', '1.0.0', {});
      const healthy = new EnableProbe('healthy', '1.0.0', {});

      let unload: (() => void) | undefined;
      expect(() => {
        unload = registerInstrumentations({
          instrumentations: [failing, healthy],
        });
      }).not.toThrow();

      expect(failing.isEnabled()).toBe(false);
      expect(healthy.isEnabled()).toBe(true);
      unload?.();
    });

    it('unload disables the other instances when one fails to disable', () => {
      const throwing = new ThrowingDisableProbe('throwing', '1.0.0', {});
      const healthy = new EnableProbe('healthy', '1.0.0', {});
      const unload = registerInstrumentations({
        instrumentations: [throwing, healthy],
      });

      expect(() => unload()).not.toThrow();

      expect(throwing.isEnabled()).toBe(false);
      expect(healthy.isEnabled()).toBe(false);
    });
  });

  describe('setConfig', () => {
    it('keeps the `enabled: false` wait', () => {
      const probe = new EnableProbe('test', '1.0.0', { enabled: false });

      probe.setConfig({});
      const unload = registerInstrumentations({ instrumentations: [probe] });

      expect(probe.isEnabled()).toBe(false);
      unload();
    });

    it('never enables or disables, and warns when asked to', () => {
      const running = new EnableProbe('running', '1.0.0', {});
      registerForTest(running);
      running.setConfig({ enabled: false });
      expect(running.isEnabled()).toBe(true);
      expect(running.disableCount).toBe(0);

      const stopped = new EnableProbe('stopped', '1.0.0', {});
      stopped.setConfig({ enabled: true });
      expect(stopped.isEnabled()).toBe(false);
      expect(stopped.enableCount).toBe(0);

      expect(diagLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('does not warn when `enabled` matches the running state', () => {
      const probe = new EnableProbe('test', '1.0.0', {});
      registerForTest(probe);

      // The usual pattern for changing one option.
      probe.setConfig({ ...probe.getConfig() });

      expect(probe.isEnabled()).toBe(true);
      expect(diagLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('init failure', () => {
    it('stays off and warns with the cause', () => {
      const probe = new FailingProbe('test', '1.0.0', {});

      expect(() => registerForTest(probe)).not.toThrow();

      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.warn).toHaveBeenCalledWith(
        'test',
        expect.stringContaining('cannot patch'),
        warnedError(),
      );
      expect((warnedError() as Error).message).toBe('cannot patch');
    });

    it('warns with the descriptive error, not its cause', () => {
      const inner = new TypeError('Cannot redefine property: greet');
      const outer = new Error('Failed to patch greet', { cause: inner });
      const probe = new ThrowingProbe('test', '1.0.0', {});
      probe.toThrow = outer;

      registerForTest(probe);

      expect(warnedError()).toBe(outer);
    });

    it('warns with an Error for a non-Error throw', () => {
      const probe = new ThrowingProbe('test', '1.0.0', {});
      probe.toThrow = 'boom';

      registerForTest(probe);

      const error = warnedError();
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('boom');
      expect((error as Error).cause).toBe('boom');
    });

    it('does not throw for a value String() cannot convert', () => {
      const unprintable = Object.create(null);
      const probe = new ThrowingProbe('test', '1.0.0', {});
      probe.toThrow = unprintable;

      expect(() => registerForTest(probe)).not.toThrow();
      expect((warnedError() as Error).cause).toBe(unprintable);
    });

    it('never retries', () => {
      const probe = new ThrowingProbe('test', '1.0.0', {});
      probe.toThrow = new Error('locked');
      registerForTest(probe);

      // A retry could stack wraps on the APIs that did get patched.
      probe.toThrow = undefined;
      probe.enable();
      probe.enable();

      expect(probe.attempts).toBe(1);
      expect(probe.isEnabled()).toBe(false);
    });
  });

  describe('_onEnable failure', () => {
    it('does not throw, stays off, and removes what it added', () => {
      const probe = new HalfEnableProbe('test', '1.0.0', {});

      expect(() => registerForTest(probe)).not.toThrow();
      probe.target.dispatchEvent(new Event('ping'));

      expect(probe.isEnabled()).toBe(false);
      expect(probe.received).toBe(0);
      expect(diagLogger.warn).toHaveBeenCalledWith(
        'test',
        expect.stringContaining('enable broke'),
        expect.any(Error),
      );
    });

    it('can succeed on a later enable() without running init again', () => {
      const probe = new HalfEnableProbe('test', '1.0.0', {});
      registerForTest(probe);

      probe.enable();
      probe.target.dispatchEvent(new Event('ping'));

      expect(probe.isEnabled()).toBe(true);
      expect(probe.initCount).toBe(1);
      expect(probe.received).toBe(1);
    });
  });

  describe('disable() inside _onEnable()', () => {
    it('removes the listeners that _onEnable() adds after it', () => {
      const probe = new ReentrantEnableProbe('test', '1.0.0', {});
      probe.duringNextEnable = () => probe.disable();

      registerForTest(probe);
      probe.target.dispatchEvent(new Event('ping'));

      expect(probe.isEnabled()).toBe(false);
      expect(probe.received).toBe(0);
    });

    it('leaves exactly one listener after a later enable()', () => {
      const probe = new ReentrantEnableProbe('test', '1.0.0', {});
      probe.duringNextEnable = () => probe.disable();
      registerForTest(probe);

      probe.enable();
      probe.target.dispatchEvent(new Event('ping'));

      expect(probe.isEnabled()).toBe(true);
      expect(probe.received).toBe(1);
    });

    it('followed by enable(), stays enabled with one listener', () => {
      const probe = new ReentrantEnableProbe('test', '1.0.0', {});
      probe.duringNextEnable = () => {
        probe.disable();
        probe.enable();
      };

      registerForTest(probe);
      probe.target.dispatchEvent(new Event('ping'));

      expect(probe.isEnabled()).toBe(true);
      expect(probe.received).toBe(1);
    });
  });

  describe('async hooks', () => {
    it('treats an async _init() as a failed init', () => {
      const probe = new AsyncInitProbe('test', '1.0.0', {});

      registerForTest(probe);
      probe.enable();

      expect(probe.isEnabled()).toBe(false);
      expect(probe.initCount).toBe(1);
      expect(diagLogger.warn).toHaveBeenCalledWith(
        'test',
        expect.stringContaining('synchronous'),
        expect.any(Error),
      );
    });

    it('logs the rejection of an async _init()', async () => {
      const probe = new AsyncInitProbe('test', '1.0.0', {});

      registerForTest(probe);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.any(String),
        probe.rejection,
      );
    });

    it('rolls back an async _onEnable()', () => {
      const probe = new AsyncEnableProbe('test', '1.0.0', {});

      registerForTest(probe);

      expect(probe.isEnabled()).toBe(false);
      expect(probe.disableCount).toBe(1);
      expect(diagLogger.warn).toHaveBeenCalledWith(
        'test',
        expect.stringContaining('synchronous'),
        expect.any(Error),
      );
    });

    it('logs an async _onDisable() as a failed disable', () => {
      const probe = new AsyncDisableProbe('test', '1.0.0', {});
      registerForTest(probe);

      probe.disable();

      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining('synchronous'),
        }),
      );
    });
  });

  describe('disable()', () => {
    it('logs a throwing _onDisable instead of throwing, and stays off', () => {
      const probe = new ThrowingDisableProbe('test', '1.0.0', {});
      registerForTest(probe);

      expect(() => probe.disable()).not.toThrow();

      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.any(String),
        probe.thrown,
      );
    });
  });

  describe('_wrap', () => {
    it('replaces the slot with the wrapper and keeps the original', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const target: { greet: () => string } = {
        greet: () => 'original',
      };

      probe.wrap(target, 'greet', (original) => () => `wrapped:${original()}`);

      expect(target.greet()).toBe('wrapped:original');
      const original = (target.greet as { __original?: () => string })
        .__original;
      expect(original?.()).toBe('original');
    });

    it('keeps an enumerable own slot enumerable', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const target: { greet: () => string } = { greet: () => 'original' };

      probe.wrap(target, 'greet', (original) => () => `wrapped:${original()}`);

      expect(Object.keys(target)).toEqual(['greet']);
    });

    it('replaces a non-writable slot', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const target = {} as { greet: () => string };
      // The shape a third-party patch leaves behind: defined, not assigned, so
      // `writable` defaults to false. Assignment would throw here.
      Object.defineProperty(target, 'greet', {
        value: () => 'original',
        configurable: true,
      });

      probe.wrap(target, 'greet', (original) => () => `wrapped:${original()}`);

      expect(target.greet()).toBe('wrapped:original');
    });

    it('replaces an accessor whose setter ignores writes', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const original = () => 'original';
      const target = {} as { greet: () => string };
      // Assignment against this setter succeeds and changes nothing, which would
      // leave the caller believing the patch landed.
      Object.defineProperty(target, 'greet', {
        get: () => original,
        set: () => {},
        configurable: true,
      });

      probe.wrap(target, 'greet', (o) => () => `wrapped:${o()}`);

      expect(target.greet()).toBe('wrapped:original');
    });

    it('throws when the slot is non-configurable', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const target = {} as { greet: () => string };
      Object.defineProperty(target, 'greet', {
        value: () => 'original',
        configurable: false,
      });

      expect(() =>
        probe.wrap(
          target,
          'greet',
          (original) => () => `wrapped:${original()}`,
        ),
      ).toThrow();
      expect(target.greet()).toBe('original');
    });

    it('throws and leaves the slot alone when it is not a function', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const target = {} as { greet?: () => string };

      expect(() => probe.wrap(target, 'greet', () => () => 'wrapped')).toThrow(
        /not a function/,
      );
      expect('greet' in target).toBe(false);
    });

    it('offers no way to unwrap', () => {
      const probe = new WrapProbe('test', '1.0.0', {});

      // Other code may have wrapped on top of ours, so restoring is not safe.
      expect(Reflect.has(probe, '_unwrap')).toBe(false);
      expect(Reflect.has(probe, '_massUnwrap')).toBe(false);
    });
  });

  describe('_runHook', () => {
    it('returns the result, or undefined and a diag error on throw', () => {
      const probe = new WrapProbe('test', '1.0.0', {});

      expect(probe.runHook('hook failed', () => 42)).toBe(42);

      const thrown = new Error('boom');
      expect(
        probe.runHook('hook failed', () => {
          throw thrown;
        }),
      ).toBeUndefined();
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        'hook failed',
        thrown,
      );
    });

    it('logs a rejected promise from an async hook', async () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const thrown = new Error('async boom');

      // Unhandled, this rejection would reach `unhandledrejection` and be
      // recorded as an application exception.
      probe.runHook('hook failed', () => Promise.reject(thrown));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        'hook failed',
        thrown,
      );
    });
  });

  describe('providers', () => {
    it('setTracerProvider swaps the tracer handle', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const sentinelTracer = {} as Tracer;
      const tracerProvider: TracerProvider = {
        getTracer: () => sentinelTracer,
      };

      probe.setTracerProvider(tracerProvider);

      expect(probe.exposedTracer()).toBe(sentinelTracer);
    });

    it('setLoggerProvider swaps the logger handle', () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const sentinelLogger = {} as Logger;
      const loggerProvider: LoggerProvider = {
        getLogger: () => sentinelLogger,
      };

      probe.setLoggerProvider(loggerProvider);

      expect(probe.exposedLogger()).toBe(sentinelLogger);
    });
  });
});

// Type-level check: a concrete subclass satisfies the public Instrumentation
// interface, so it drops straight into registerInstrumentations.
const _typeCheck: Instrumentation = new EnableProbe('type', '1.0.0', {});
void _typeCheck;
