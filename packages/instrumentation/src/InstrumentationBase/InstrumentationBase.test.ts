/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Tracer, TracerProvider } from '@opentelemetry/api';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import { describe, expect, it } from 'vitest';
import { InstrumentationBase } from './InstrumentationBase.ts';

// `declare` (no initializer) is required on subclass state the constructor's
// auto-enable touches: a field initializer would run after super() and clobber
// whatever enable() set.
class EnableProbe extends InstrumentationBase {
  public declare enableCount: number;
  public declare disableCount: number;

  public override enable(): void {
    this.enableCount = (this.enableCount ?? 0) + 1;
  }

  public override disable(): void {
    this.disableCount = (this.disableCount ?? 0) + 1;
  }
}

class WrapProbe extends InstrumentationBase {
  public override enable(): void {}
  public override disable(): void {}

  public wrap<Nodule extends object, FieldName extends keyof Nodule>(
    nodule: Nodule,
    name: FieldName,
    wrapper: (
      original: Nodule[FieldName],
      name: FieldName,
    ) => Nodule[FieldName],
  ): void {
    this._wrap(nodule, name, wrapper);
  }

  public exposedTracer(): Tracer {
    return this.tracer;
  }
}

describe('InstrumentationBase', () => {
  it('enables from the constructor by default', () => {
    const probe = new EnableProbe('test', '1.0.0');

    expect(probe.enableCount).toBe(1);
    expect(probe.getConfig().enabled).toBe(true);
  });

  it('does not enable from the constructor when config.enabled is false', () => {
    const probe = new EnableProbe('test', '1.0.0', { enabled: false });

    expect(probe.enableCount).toBeUndefined();
    expect(probe.getConfig().enabled).toBe(false);
  });

  it('defaults enabled to true through setConfig', () => {
    const probe = new EnableProbe('test', '1.0.0', { enabled: false });

    probe.setConfig({});
    expect(probe.getConfig().enabled).toBe(true);

    probe.setConfig({ enabled: false });
    expect(probe.getConfig().enabled).toBe(false);
  });

  it('exposes no way to unwrap a patched API', () => {
    const probe = new WrapProbe('test', '1.0.0');

    // Unwrapping patched browser APIs is disallowed; the base must not provide
    // an `_unwrap` (or `_massUnwrap`) escape hatch.
    expect(Reflect.has(probe, '_unwrap')).toBe(false);
    expect(Reflect.has(probe, '_massUnwrap')).toBe(false);
  });

  it('_wrap installs the wrapper in place and preserves the original', () => {
    const probe = new WrapProbe('test', '1.0.0');
    const target: { greet: () => string } = {
      greet: () => 'original',
    };

    probe.wrap(target, 'greet', (original) => () => `wrapped:${original()}`);

    expect(target.greet()).toBe('wrapped:original');
    const original = (target.greet as { __original?: () => string }).__original;
    expect(original?.()).toBe('original');
  });

  it('setTracerProvider swaps the tracer handle', () => {
    const probe = new WrapProbe('test', '1.0.0');
    const sentinelTracer = {} as Tracer;
    const tracerProvider: TracerProvider = {
      getTracer: () => sentinelTracer,
    };

    probe.setTracerProvider(tracerProvider);

    expect(probe.exposedTracer()).toBe(sentinelTracer);
  });
});

// Type-level check: a concrete subclass satisfies the public Instrumentation
// interface, so it drops straight into registerInstrumentations.
const _typeCheck: (config?: InstrumentationConfig) => InstrumentationBase = (
  config,
) => new EnableProbe('type', '1.0.0', config);
void _typeCheck;
