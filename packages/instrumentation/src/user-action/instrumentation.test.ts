/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { registerForTest, setupTestLogExporter } from '#utils/test';
import { UserActionInstrumentation } from './instrumentation.ts';

describe('UserActionInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let disableInstrumentations: () => void;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    disableInstrumentations = registerInstrumentations({
      instrumentations: [new UserActionInstrumentation()],
    });
  });

  afterEach(() => {
    disableInstrumentations();
    inMemoryExporter.reset();
    document.body.innerHTML = '';
  });

  const createTestElement = () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    return element;
  };

  const dispatchMouseDownEvent = (element: HTMLElement, button: number) => {
    const clickEvent = new MouseEvent('click', {
      button,
      bubbles: true,
      clientX: 100,
      clientY: 150,
    });
    element.dispatchEvent(clickEvent);
  };

  it('should emit a log when the element triggers a mousedown event with the left click', () => {
    const element = createTestElement();

    dispatchMouseDownEvent(element, 0); // Left click

    const logs = inMemoryExporter.getFinishedLogRecords();
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log?.severityNumber).toBe(SeverityNumber.INFO);
    expect(log?.eventName).toBe('browser.user_action.click');
    expect(log?.attributes['browser.mouse_event.button']).toBe('left');
    expect(log?.attributes['browser.page.x']).toBe(100);
    expect(log?.attributes['browser.page.y']).toBe(150);
    expect(log?.attributes['browser.tag_name']).toBe('DIV');
    expect(log?.attributes['browser.css_selector']).toBe('html > body > div');
  });

  it('should emit a log when the element triggers a mousedown event with the right and middle click', () => {
    const element = createTestElement();

    dispatchMouseDownEvent(element, 1); // Middle click
    dispatchMouseDownEvent(element, 2); // Right click

    const logs = inMemoryExporter.getFinishedLogRecords();
    expect(logs.length).toBe(2);

    const middleClickLog = logs[0];
    expect(middleClickLog?.attributes['browser.mouse_event.button']).toBe(
      'middle',
    );

    const rightClickLog = logs[1];
    expect(rightClickLog?.attributes['browser.mouse_event.button']).toBe(
      'right',
    );
  });

  it('should not emit a log when the event target is not an HTMLElement', () => {
    const textNode = document.createTextNode('Test Text Node');
    document.body.appendChild(textNode);

    const clickEvent = new MouseEvent('click', {
      button: 0,
      bubbles: true,
      clientX: 100,
      clientY: 150,
    });
    textNode.dispatchEvent(clickEvent);

    const logs = inMemoryExporter.getFinishedLogRecords();
    expect(logs.length).toBe(0);
  });

  it('should not emit a log when the element is disabled', () => {
    const element = createTestElement();
    element.setAttribute('disabled', 'true');

    dispatchMouseDownEvent(element, 0); // Left click

    const logs = inMemoryExporter.getFinishedLogRecords();
    expect(logs.length).toBe(0);
  });

  it('should capture OTEL prefixed attributes from the element', () => {
    const element = createTestElement();
    element.setAttribute('data-otel-user-id', '12345');
    element.setAttribute('data-otel-session-id', 'abcde');

    dispatchMouseDownEvent(element, 0); // Left click

    const logs = inMemoryExporter.getFinishedLogRecords();
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log?.attributes['browser.element.attributes']).toEqual({
      'user-id': '12345',
      'session-id': 'abcde',
    });
  });

  it('should not emit click logs when click is not an auto-captured action', () => {
    disableInstrumentations();
    const instrumentation = new UserActionInstrumentation({
      autoCapturedActions: [],
    });
    disableInstrumentations = registerInstrumentations({
      instrumentations: [instrumentation],
    });
    expect(instrumentation.isEnabled()).toBe(true);

    dispatchMouseDownEvent(createTestElement(), 0); // Left click

    expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(0);
  });

  it('should not let a failed emit reach the page as an uncaught error', () => {
    disableInstrumentations();
    const instrumentation = new UserActionInstrumentation();
    disableInstrumentations = registerInstrumentations({
      instrumentations: [instrumentation],
    });
    // Stands in for a log processor that throws from onEmit.
    const emitSpy = vi
      .spyOn((instrumentation as unknown as { logger: Logger }).logger, 'emit')
      .mockImplementation(() => {
        throw new Error('processor broke');
      });
    onTestFinished(() => emitSpy.mockRestore());
    const pageErrors: unknown[] = [];
    const onPageError = (event: ErrorEvent) => {
      pageErrors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onPageError);
    onTestFinished(() => window.removeEventListener('error', onPageError));

    dispatchMouseDownEvent(createTestElement(), 0);

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(pageErrors).toEqual([]);
  });

  describe('lifecycle', () => {
    it('should stop on disable() and resume once on enable()', () => {
      disableInstrumentations();
      const instrumentation = new UserActionInstrumentation();
      const element = createTestElement();
      registerForTest(instrumentation);
      dispatchMouseDownEvent(element, 0);
      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(1);

      instrumentation.disable();
      dispatchMouseDownEvent(element, 0);
      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(1);

      instrumentation.enable();
      instrumentation.enable();
      dispatchMouseDownEvent(element, 0);
      // One more log, not two: the listener is added once per enable cycle.
      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(2);

      instrumentation.disable();
    });

    it('should not emit through registerInstrumentations with `enabled: false` until enable()', () => {
      disableInstrumentations();
      const instrumentation = new UserActionInstrumentation({ enabled: false });
      disableInstrumentations = registerInstrumentations({
        instrumentations: [instrumentation],
      });
      const element = createTestElement();

      dispatchMouseDownEvent(element, 0);
      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(0);

      instrumentation.enable();
      dispatchMouseDownEvent(element, 0);
      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(1);
    });
  });

  describe('applyCustomLogRecordData hook', () => {
    it('should allow hook to add custom attributes', () => {
      disableInstrumentations();
      const customInstrumentation = new UserActionInstrumentation({
        applyCustomLogRecordData: (logRecord) => {
          logRecord.attributes = {
            ...logRecord.attributes,
            'custom.attribute': 'custom-value',
          };
        },
      });
      disableInstrumentations = registerInstrumentations({
        instrumentations: [customInstrumentation],
      });

      const element = createTestElement();
      dispatchMouseDownEvent(element, 0); // Left click

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);

      const log = logs[0];
      expect(log?.attributes['custom.attribute']).toBe('custom-value');
    });

    it('should catch errors thrown by the hook and still emit', () => {
      disableInstrumentations();
      const customInstrumentation = new UserActionInstrumentation({
        applyCustomLogRecordData: () => {
          throw new Error('hook boom');
        },
      });
      const diagErrorSpy = vi
        .spyOn(
          (
            customInstrumentation as unknown as {
              _diag: { error: (...a: unknown[]) => void };
            }
          )._diag,
          'error',
        )
        .mockImplementation(() => {});

      disableInstrumentations = registerInstrumentations({
        instrumentations: [customInstrumentation],
      });

      const element = createTestElement();

      dispatchMouseDownEvent(element, 0); // Left click

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(diagErrorSpy).toHaveBeenCalled();
    });
  });
});
