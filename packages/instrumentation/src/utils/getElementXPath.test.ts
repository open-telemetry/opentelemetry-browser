/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { getElementXPath } from './getElementXPath.ts';

describe('getElementXPath', () => {
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

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return "/" for document node', () => {
    const xpath = getElementXPath(document);

    expect(xpath).toBe('/');
    expectXPath(xpath, document);
  });

  it('should return correct XPath for element with ID when useIdForTargetElement is true', () => {
    const div = document.createElement('div');
    div.id = 'test-id';
    document.body.appendChild(div);

    const xpath = getElementXPath(div, {
      useIdForTargetElement: true,
    });

    expect(xpath).toBe('//*[@id="test-id"]');
    expectXPath(xpath, div);
  });

  it('should not use ID for element with ID when useIdForTargetElement is true but there are duplicated IDs', () => {
    const div = document.createElement('div');
    div.id = 'test-id';
    document.body.appendChild(div);

    const duplicateDiv = document.createElement('div');
    duplicateDiv.id = 'test-id';
    document.body.appendChild(duplicateDiv);

    const xpath = getElementXPath(div, {
      useIdForTargetElement: true,
    });

    expect(xpath).toBe('//html/body/div');
    expectXPath(xpath, div);
  });

  it('should return correct XPath for nested elements', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const xpath = getElementXPath(child);

    expect(xpath).toBe('//html/body/div/span');
    expectXPath(xpath, child);
  });

  it('should return correct XPath using ID for nested elements', () => {
    const parent = document.createElement('div');
    parent.id = 'parent-id';
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const xpath = getElementXPath(child, {
      useIdForAncestors: true,
    });

    expect(xpath).toBe('//html/body//*[@id="parent-id"]/span');
    expectXPath(xpath, child);
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
  });
});
