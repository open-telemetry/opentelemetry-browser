/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ElementTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/element-timing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collector } from '../../../utils/test-collector.ts';
import type { TestSdkHandle } from '../../../utils/test-otel-setup.ts';
import { testSdkSetup } from '../../../utils/test-otel-setup.ts';

describe('ElementTimingInstrumentation', () => {
  let result: TestSdkHandle;

  afterEach(async () => {
    await result.shutdown();
    document.body.innerHTML = '';
  });

  it('emits a log record when a text element marked with elementtiming renders', async () => {
    result = testSdkSetup([new ElementTimingInstrumentation()]);

    // A block-level element with a directly-contained text node and the
    // `elementtiming` attribute qualifies for the Element Timing API, no
    // network resource (e.g. an <img>) needed to trigger an entry.
    const el = document.createElement('p');
    el.setAttribute('elementtiming', 'hero-text');
    el.textContent = 'Hello from the element timing e2e test';
    document.body.appendChild(el);

    await vi.waitFor(
      () => {
        const log = collector
          .getLogs()
          .find((l) => l.eventName === 'browser.element_timing');
        expect(log).toBeDefined();
        if (!log) {
          throw new Error('Log record is undefined');
        }

        const attr = (key: string) =>
          log.attributes.find((a) => a.key === key)?.value;

        expect(attr('browser.element_timing.identifier')).toEqual({
          stringValue: 'hero-text',
        });
        expect(attr('browser.element_timing.element')).toEqual({
          stringValue: 'p',
        });
        expect(attr('browser.element_timing.render_time')).toBeDefined();
        expect(attr('browser.element_timing.start_time')).toBeDefined();

        // Text entries carry no resource, so the image-only attributes must be
        // absent rather than reported as ""/0.
        expect(attr('url.full')).toBeUndefined();
        expect(attr('browser.element_timing.load_time')).toBeUndefined();
        expect(attr('browser.element_timing.natural_width')).toBeUndefined();
        expect(attr('browser.element_timing.natural_height')).toBeUndefined();
      },
      { timeout: 2000 },
    );
  });
});
