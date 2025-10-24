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

import { describe, expect, it } from 'vitest';

import { getElementXPath } from './getElementXPath';

describe(getElementXPath, () => {
  const expectXPath = (xpath: string, node: Node) => {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );

    expect(result.singleNodeValue).toBe(node);
  };

  it('should return "/" for document node', () => {
    const xpath = getElementXPath(document);

    expect(xpath).toBe('/');
    expectXPath(xpath, document);
  });

  it('should return correct XPath for element with ID when optimized', () => {
    const div = document.createElement('div');
    div.id = 'test-id';
    document.body.appendChild(div);

    const xpath = getElementXPath(div, true);

    expect(xpath).toBe('//*[@id="test-id"]');
    expectXPath(xpath, div);

    document.body.removeChild(div);
  });

  it('should return correct XPath for nested elements', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const xpath = getElementXPath(child);

    expect(xpath).toBe('//html/body/div/span');
    expectXPath(xpath, child);

    document.body.removeChild(parent);
  });

  it('should return correct XPath with index for sibling elements', () => {
    const parent = document.createElement('div');
    const child1 = document.createElement('span');
    const child2 = document.createElement('span');
    parent.appendChild(child1);
    parent.appendChild(child2);
    document.body.appendChild(parent);

    const xpath = getElementXPath(child2);

    expect(xpath).toBe('//html/body/div/span[2]');
    expectXPath(xpath, child2);

    document.body.removeChild(parent);
  });
});
