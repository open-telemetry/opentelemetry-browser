/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TextMapPropagator } from '@opentelemetry/api';
import { propagation, trace } from '@opentelemetry/api';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDiagLogger } from '#utils/test';
import { InstrumentationBase } from './InstrumentationBase.ts';

class Probe extends InstrumentationBase {
  public initCount = 0;
  public onEnableCount = 0;
  public onDisableCount = 0;
  public isEnabledInOnEnable: boolean | undefined;
  // `undefined` means the hook succeeds.
  public initError: unknown;
  public onEnableError: unknown;
  public onDisableError: unknown;

  constructor() {
    super('test', '1.0.0', {});
  }

  public emitSpan(name: string): void {
    this.tracer.startSpan(name).end();
  }

  public emitLog(body: string): void {
    this.logger.emit({ body });
  }

  public exposedPropagator(): TextMapPropagator {
    return this.propagator;
  }

  protected override _init(): void {
    this.initCount += 1;
    if (this.initError !== undefined) {
      throw this.initError;
    }
  }

  protected override _onEnable(): void {
    this.onEnableCount += 1;
    this.isEnabledInOnEnable = this.isEnabled();
    if (this.onEnableError !== undefined) {
      throw this.onEnableError;
    }
  }

  protected override _onDisable(): void {
    this.onDisableCount += 1;
    if (this.onDisableError !== undefined) {
      throw this.onDisableError;
    }
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

  public exposedSafeExecute<T>(
    errorMessage: string,
    fn: () => T,
  ): T | undefined {
    return this._safeExecute(errorMessage, fn);
  }
}

const createTracerProvider = () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });
  return { exporter, provider };
};

const spanNames = (exporter: InMemorySpanExporter): string[] =>
  exporter.getFinishedSpans().map((span) => span.name);

describe('InstrumentationBase', () => {
  let diagLogger: ReturnType<typeof setupTestDiagLogger>;

  beforeEach(() => {
    diagLogger = setupTestDiagLogger();
  });

  afterEach(() => {
    trace.disable();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('does not call any hook', () => {
      const probe = new Probe();

      expect(probe.initCount).toBe(0);
      expect(probe.onEnableCount).toBe(0);
      expect(probe.onDisableCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
    });

    it('does not read the global providers', () => {
      const getTracerProvider = vi.spyOn(trace, 'getTracerProvider');

      new Probe();

      expect(getTracerProvider).toHaveBeenCalledTimes(0);
    });
  });

  describe('enable', () => {
    it('first enable runs _init once then _onEnable', () => {
      const probe = new Probe();

      probe.enable();

      expect(probe.initCount).toBe(1);
      expect(probe.onEnableCount).toBe(1);
      expect(probe.isEnabled()).toBe(true);
    });

    it('a second enable does nothing', () => {
      const probe = new Probe();

      probe.enable();
      probe.enable();

      expect(probe.initCount).toBe(1);
      expect(probe.onEnableCount).toBe(1);
      expect(diagLogger.warn).not.toHaveBeenCalled();
    });

    it('enable after disable runs only _onEnable', () => {
      const probe = new Probe();

      probe.enable();
      probe.disable();
      probe.enable();

      expect(probe.initCount).toBe(1);
      expect(probe.onEnableCount).toBe(2);
      expect(probe.isEnabled()).toBe(true);
    });

    it('isEnabled() is true inside _onEnable', () => {
      const probe = new Probe();

      probe.enable();

      expect(probe.isEnabledInOnEnable).toBe(true);
    });
  });

  describe('deps', () => {
    it('uses passed providers', () => {
      const { exporter, provider } = createTracerProvider();
      const probe = new Probe();

      probe.enable({ tracerProvider: provider });
      probe.emitSpan('passed');

      expect(spanNames(exporter)).toEqual(['passed']);
    });

    it('uses a passed loggerProvider', () => {
      const exporter = new InMemoryLogRecordExporter();
      const loggerProvider = new LoggerProvider({
        processors: [new SimpleLogRecordProcessor({ exporter })],
      });
      const probe = new Probe();

      probe.enable({ loggerProvider });
      probe.emitLog('passed');

      expect(exporter.getFinishedLogRecords().map((r) => r.body)).toEqual([
        'passed',
      ]);
    });

    it('tracer before the first enable() throws', () => {
      const probe = new Probe();

      expect(() => probe.emitSpan('early')).toThrow(
        /not available until enable\(\) succeeds/,
      );
    });

    it('falls back to the global proxy', () => {
      const probe = new Probe();
      probe.enable();

      const { exporter, provider } = createTracerProvider();
      trace.setGlobalTracerProvider(provider);
      probe.emitSpan('late-global');

      expect(spanNames(exporter)).toEqual(['late-global']);
    });

    it('deps passed to a later enable are ignored and logged at debug', () => {
      const first = createTracerProvider();
      const second = createTracerProvider();
      const probe = new Probe();

      probe.enable({ tracerProvider: first.provider });
      probe.disable();
      probe.enable({ tracerProvider: second.provider });
      probe.emitSpan('after-second-enable');

      expect(probe.isEnabled()).toBe(true);
      expect(spanNames(first.exporter)).toEqual(['after-second-enable']);
      expect(spanNames(second.exporter)).toEqual([]);
      expect(diagLogger.warn).not.toHaveBeenCalled();
      // Filtered by namespace, because diag.setLogger() also logs a debug line.
      expect(
        vi
          .mocked(diagLogger.debug)
          .mock.calls.filter(([namespace]) => namespace === 'test'),
      ).toEqual([['test', expect.stringMatching(/enable\(\) ignores deps/)]]);
    });

    it('propagator defaults to the global propagation API', () => {
      const probe = new Probe();

      probe.enable();

      expect(probe.exposedPropagator()).toBe(propagation);
    });
  });

  describe('disable', () => {
    it('before enable does nothing', () => {
      const probe = new Probe();

      probe.disable();
      expect(probe.onDisableCount).toBe(0);

      probe.enable();
      expect(probe.initCount).toBe(1);
      expect(probe.isEnabled()).toBe(true);
    });

    it('after enable runs _onDisable and isEnabled() is false', () => {
      const probe = new Probe();

      probe.enable();
      probe.disable();

      expect(probe.onDisableCount).toBe(1);
      expect(probe.isEnabled()).toBe(false);
    });

    it('twice runs _onDisable once', () => {
      const probe = new Probe();

      probe.enable();
      probe.disable();
      probe.disable();

      expect(probe.onDisableCount).toBe(1);
    });
  });

  describe('failures', () => {
    it('_init throws: state failed, one error with cause, later enable does nothing', () => {
      const probe = new Probe();
      probe.initError = new Error('cannot patch');

      probe.enable();
      probe.enable();

      expect(probe.initCount).toBe(1);
      expect(probe.onEnableCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledTimes(1);
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.stringContaining('cannot patch'),
        probe.initError,
      );
      // The ignored second call is traceable at debug level only. Filtered by
      // namespace, because diag.setLogger() also logs a debug line.
      expect(
        vi
          .mocked(diagLogger.debug)
          .mock.calls.filter(([namespace]) => namespace === 'test'),
      ).toEqual([
        ['test', expect.stringMatching(/enable\(\) ignored.*failed earlier/)],
      ]);
    });

    it('a provider that throws from getTracer leaves the instance failed, logs an error, and enable() does not throw', () => {
      const probe = new Probe();
      const tracerProvider = {
        getTracer: vi.fn(() => {
          throw new Error('no tracer');
        }),
      };

      expect(() => probe.enable({ tracerProvider })).not.toThrow();

      expect(probe.initCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledTimes(1);
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.stringMatching(/tracer and logger.*stays off.*no tracer/),
        expect.objectContaining({ message: 'no tracer' }),
      );
      expect(() => probe.emitSpan('late')).toThrow(
        /not available until enable\(\) succeeds/,
      );

      probe.enable({ tracerProvider });

      expect(tracerProvider.getTracer).toHaveBeenCalledTimes(1);
      expect(probe.initCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledTimes(1);
    });

    it('_onEnable throws: rolled back through _onDisable, error, a later enable retries', () => {
      const probe = new Probe();
      probe.onEnableError = new Error('enable broke');

      probe.enable();

      expect(probe.isEnabled()).toBe(false);
      expect(probe.onDisableCount).toBe(1);
      expect(diagLogger.error).toHaveBeenCalledTimes(1);
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.stringContaining('enable broke'),
        probe.onEnableError,
      );

      probe.onEnableError = undefined;
      probe.enable();

      expect(probe.isEnabled()).toBe(true);
      expect(probe.initCount).toBe(1);
      expect(probe.onEnableCount).toBe(2);
    });

    it('_onEnable and the rollback _onDisable both throw: enable error is logged first', () => {
      const probe = new Probe();
      probe.onEnableError = new Error('enable broke');
      probe.onDisableError = new Error('cleanup broke');

      expect(() => probe.enable()).not.toThrow();

      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledTimes(2);
      expect(diagLogger.error).toHaveBeenNthCalledWith(
        1,
        'test',
        expect.stringContaining('enable broke'),
        probe.onEnableError,
      );
      expect(diagLogger.error).toHaveBeenNthCalledWith(
        2,
        'test',
        expect.stringMatching(/disable failed.*cleanup broke/),
        probe.onDisableError,
      );

      probe.onEnableError = undefined;
      probe.onDisableError = undefined;
      probe.enable();

      expect(probe.isEnabled()).toBe(false);
      expect(probe.onEnableCount).toBe(1);
    });

    it('_onDisable throws: logged with its message, state failed, a later enable does nothing', () => {
      const probe = new Probe();
      probe.onDisableError = new Error('cleanup broke');
      probe.enable();

      expect(() => probe.disable()).not.toThrow();

      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.stringMatching(/disable failed.*stays off.*cleanup broke/),
        probe.onDisableError,
      );

      probe.onDisableError = undefined;
      probe.enable();
      probe.disable();

      expect(probe.isEnabled()).toBe(false);
      expect(probe.onEnableCount).toBe(1);
      expect(probe.onDisableCount).toBe(1);
    });

    it('a provider that throws from getLogger leaves the instance failed before _init runs', () => {
      const probe = new Probe();
      const loggerProvider = {
        getLogger: vi.fn(() => {
          throw new Error('no logger');
        }),
      };

      expect(() => probe.enable({ loggerProvider })).not.toThrow();

      expect(probe.initCount).toBe(0);
      expect(probe.isEnabled()).toBe(false);
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        expect.stringMatching(/stays off.*no logger/),
        expect.objectContaining({ message: 'no logger' }),
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

  describe('_safeExecute', () => {
    it('returns the result, or undefined and a diag error on throw', () => {
      const probe = new WrapProbe('test', '1.0.0', {});

      expect(probe.exposedSafeExecute('hook failed', () => 42)).toBe(42);

      const thrown = new Error('boom');
      expect(
        probe.exposedSafeExecute('hook failed', () => {
          throw thrown;
        }),
      ).toBeUndefined();
      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        'hook failed',
        thrown,
      );
    });

    it('logs a rejected Promise returned by fn without leaving it unhandled', async () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const rejected = new Error('late boom');

      probe.exposedSafeExecute('hook failed', () => Promise.reject(rejected));
      await Promise.resolve();

      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        'hook failed',
        rejected,
      );
    });

    it('logs a throw from an async fn', async () => {
      const probe = new WrapProbe('test', '1.0.0', {});
      const thrown = new Error('async boom');

      probe.exposedSafeExecute('hook failed', async () => {
        throw thrown;
      });
      await Promise.resolve();

      expect(diagLogger.error).toHaveBeenCalledWith(
        'test',
        'hook failed',
        thrown,
      );
    });
  });
});
