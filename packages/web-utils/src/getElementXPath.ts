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

/**
 * Generates the XPath of a given element in the DOM tree.
 *
 * @example //html/body/div[2]/span
 * @example //*[@id="unique-id"]
 */
export const getElementXPath = (element: Node, optimized = false): string => {
  if (element.nodeType === Node.DOCUMENT_NODE) {
    return '/';
  }

  const nodeValue = getNodeValue(element as HTMLElement, optimized);

  // if optimized and found an ID selector, stop recursion early
  if (optimized && nodeValue.startsWith('//*[@id=')) {
    return nodeValue;
  }

  const parent = element.parentNode;
  const parentXPath = parent ? getElementXPath(parent, false) : '';

  return parentXPath + nodeValue;
};

const getNodeIndex = (element: HTMLElement): number => {
  if (!element.parentNode) {
    return 0;
  }

  const siblings = Array.from(element.parentNode.childNodes).filter((n) => {
    const sameType = n.nodeType === element.nodeType;
    const sameName = (n as HTMLElement).localName === element.localName;
    return sameType && sameName;
  });

  return siblings.length > 1 ? siblings.indexOf(element) + 1 : 0;
};

const getNodeValue = (element: HTMLElement, optimized = false): string => {
  const type = element.nodeType;
  if (type === Node.ELEMENT_NODE) {
    const id = element.getAttribute('id');
    if (optimized && id) {
      return `//*[@id="${id}"]`;
    }

    const index = getNodeIndex(element);
    const name = element.localName;

    return index > 1 ? `/${name}[${index}]` : `/${name}`;
  }

  if (type === Node.TEXT_NODE || type === Node.CDATA_SECTION_NODE) {
    return '/text()';
  }

  if (type === Node.COMMENT_NODE) {
    return '/comment()';
  }

  return '';
};
