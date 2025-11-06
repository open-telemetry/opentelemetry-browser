/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { setupTestLogExporter } from '@opentelemetry/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserActionInstrumentation } from './instrumentation';

describe('UserActionInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: UserActionInstrumentation;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    instrumentation = new UserActionInstrumentation();

    instrumentation.enable();
  });

  afterEach(() => {
    instrumentation.disable();
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

  it('should not emit click logs when disabled', () => {
    // Disable previous instrumentation and create a new one with click disabled
    instrumentation.disable();
    const disabledInstrumentation = new UserActionInstrumentation({
      autoCapturedActions: [],
    });
    disabledInstrumentation.enable();

    const element = createTestElement();
    dispatchMouseDownEvent(element, 0); // Left click

    const logs = inMemoryExporter.getFinishedLogRecords();
    expect(logs.length).toBe(0);
  });
});
