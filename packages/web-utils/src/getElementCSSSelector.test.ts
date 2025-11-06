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

import { beforeEach, describe, expect, it } from 'vitest';

import { getElementCSSSelector } from './getElementCSSSelector';

// Polyfill for CSS.escape in jsdom environment
// @ts-expect-error
globalThis.CSS = {
  escape(string: string): string {
    return string.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  },
};

describe('getElementCSSSelector', () => {
  const expectSelector = (selector: string, element: Element) => {
    const result = document.querySelector(selector);
    expect(result).toBe(element);
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return correct selector for element with ID when useIdForTargetElement is true', () => {
    const div = document.createElement('div');
    div.id = 'test-id';
    document.body.appendChild(div);

    const selector = getElementCSSSelector(div, {
      useIdForTargetElement: true,
    });

    expect(selector).toBe('#test-id');
    expectSelector(selector, div);
  });

  it('should not use ID for element with duplicated ID when useIdForTargetElement is true', () => {
    const div1 = document.createElement('div');
    div1.id = 'test-id';
    document.body.appendChild(div1);

    const div2 = document.createElement('div');
    div2.id = 'test-id';
    document.body.appendChild(div2);

    const selector = getElementCSSSelector(div1, {
      useIdForTargetElement: true,
    });

    expect(selector).not.toBe('#test-id');
    expectSelector(selector, div1);
  });

  it('should return correct selector for nested elements', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const selector = getElementCSSSelector(child);

    expect(selector).toBe('html > body > div > span');
    expectSelector(selector, child);
  });

  it('should return correct selector using ID for ancestor elements', () => {
    const parent = document.createElement('div');
    parent.id = 'parent-id';
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const selector = getElementCSSSelector(child, {
      useIdForAncestors: true,
    });

    expect(selector).toBe('#parent-id > span');
    expectSelector(selector, child);
  });

  it('should return correct selector with nth-child for sibling elements', () => {
    const parent = document.createElement('div');
    const child1 = document.createElement('span');
    const child2 = document.createElement('span');
    parent.appendChild(child1);
    parent.appendChild(child2);
    document.body.appendChild(parent);

    const selector = getElementCSSSelector(child2);

    expect(selector).toBe('html > body > div > span:nth-child(2)');
    expectSelector(selector, child2);
  });

  it('should include class names in selector', () => {
    const button = document.createElement('button');
    button.classList.add('submit', 'primary');
    document.body.appendChild(button);

    const selector = getElementCSSSelector(button);

    expect(selector).toBe('html > body > button.submit.primary');
    expectSelector(selector, button);
  });

  it('should use nth-child when siblings have same classes', () => {
    const parent = document.createElement('div');
    const button1 = document.createElement('button');
    button1.classList.add('btn');
    const button2 = document.createElement('button');
    button2.classList.add('btn');
    parent.appendChild(button1);
    parent.appendChild(button2);
    document.body.appendChild(parent);

    const selector = getElementCSSSelector(button2);

    expect(selector).toBe('html > body > div > button.btn:nth-child(2)');
    expectSelector(selector, button2);
  });

  it('should handle complex nested structure', () => {
    const main = document.createElement('main');
    main.id = 'main';
    const div = document.createElement('div');
    const button = document.createElement('button');
    button.classList.add('submit');

    div.appendChild(button);
    main.appendChild(div);
    document.body.appendChild(main);

    const selector = getElementCSSSelector(button, {
      useIdForAncestors: true,
    });

    expect(selector).toBe('#main > div > button.submit');
    expectSelector(selector, button);
  });

  it('should not add nth-child when element is unique among siblings', () => {
    const parent = document.createElement('div');
    const span = document.createElement('span');
    const button = document.createElement('button');
    parent.appendChild(span);
    parent.appendChild(button);
    document.body.appendChild(parent);

    const selector = getElementCSSSelector(button);

    expect(selector).toBe('html > body > div > button');
    expectSelector(selector, button);
  });

  it('should escape special characters in ID', () => {
    const div = document.createElement('div');
    div.id = 'test:id.special';
    document.body.appendChild(div);

    const selector = getElementCSSSelector(div, {
      useIdForTargetElement: true,
    });

    expect(selector).toContain('#test');
    expectSelector(selector, div);
  });

  it('should escape special characters in class names', () => {
    const div = document.createElement('div');
    div.classList.add('test:class');
    document.body.appendChild(div);

    const selector = getElementCSSSelector(div);

    expectSelector(selector, div);
  });
});
