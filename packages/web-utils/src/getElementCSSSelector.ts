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

type GetElementCSSSelectorOptions = {
  /**
   * If true, the function will attempt to use element ID to create condensed CSS selector.
   */
  useIdForTargetElement?: boolean;
  /**
   * If true, the function will attempt to use element ID for all ancestor elements to create condensed CSS selector.
   */
  useIdForAncestors?: boolean;
};

/**
 * Generates the CSS selector of a given element in the DOM tree.
 *
 * @example #main > div:nth-child(2) > button.submit
 * @example #unique-id
 */
export const getElementCSSSelector = (
  element: Node,
  {
    useIdForTargetElement = false,
    useIdForAncestors = false,
  }: GetElementCSSSelectorOptions = {},
): string => {
  // Handle document node
  if (element.nodeType === Node.DOCUMENT_NODE) {
    return '';
  }

  const htmlElement = element as HTMLElement;
  const nodeValue = getNodeSelector(
    htmlElement,
    useIdForTargetElement || useIdForAncestors,
  );

  // If optimized and found an ID selector, stop recursion early
  if (nodeValue.startsWith('#')) {
    return nodeValue;
  }

  const parent = htmlElement.parentElement;
  const parentSelector = parent
    ? getElementCSSSelector(parent, {
        useIdForAncestors,
        useIdForTargetElement: false,
      })
    : '';

  return parentSelector ? `${parentSelector} > ${nodeValue}` : nodeValue;
};

const getNodeSelector = (element: Node, useElementId = false): string => {
  if (element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const htmlElement = element as HTMLElement;
  const id = htmlElement.getAttribute('id');

  // Use ID if requested and it's unique
  if (useElementId && id) {
    // Check if ID is unique in the document
    const elementsWithSameId = htmlElement.ownerDocument.querySelectorAll(
      `#${CSS.escape(id)}`,
    );

    if (elementsWithSameId.length === 1) {
      return `#${CSS.escape(id)}`;
    }
  }

  let selector = getFullClassSelector(htmlElement);
  // Add nth-child if there are siblings with the same tag and classes
  const index = getNthChild(htmlElement);

  if (index > 0) {
    selector += `:nth-child(${index})`;
  }

  return selector;
};

const getNthChild = (element: HTMLElement): number => {
  // parentElement is needed to access children
  if (!element.parentElement) {
    return 0;
  }

  const selector = getFullClassSelector(element);

  // Get all siblings that match the same selector
  const siblings = Array.from(element.parentElement.children).filter(
    (sibling) => getFullClassSelector(sibling) === selector,
  );

  // Only add nth-child if there are multiple matching siblings
  if (siblings.length > 1) {
    return siblings.indexOf(element) + 1;
  }

  return 0;
};

const getFullClassSelector = (element: Element): string =>
  element.localName +
  (element.classList.length > 0
    ? Array.from(element.classList)
        .map((cls) => `.${CSS.escape(cls)}`)
        .join('')
    : '');
