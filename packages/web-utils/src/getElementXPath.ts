/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

type GetElementXPathOptions = {
  /**
    If true, the function will attempt to use element ID to create condensed XPath.
   */
  useIdForTargetElement?: boolean;
  /**
    If true, the function will attempt to use element ID for all ancestor elements to create condensed XPath.
   */
  useIdForAncestors?: boolean;
};

/**
 * Generates the XPath of a given element in the DOM tree.
 *
 * @example //html/body/div[2]/span
 * @example //*[@id="unique-id"]
 */
export const getElementXPath = (
  element: Node,
  {
    useIdForTargetElement = false,
    useIdForAncestors = false,
  }: GetElementXPathOptions = {},
): string => {
  if (element.nodeType === Node.DOCUMENT_NODE) {
    return '/';
  }

  const nodeValue = getNodeValue(
    element,
    useIdForTargetElement || useIdForAncestors,
  );

  // if optimized and found an ID selector, stop recursion early
  if (useIdForTargetElement && nodeValue.startsWith('//*[@id=')) {
    return nodeValue;
  }

  const parent = element.parentNode;
  const parentXPath = parent
    ? getElementXPath(parent, {
        useIdForAncestors,
        useIdForTargetElement,
      })
    : '';

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

const getNodeValue = (element: Node, useElementId = false): string => {
  const type = element.nodeType;
  if (type === Node.ELEMENT_NODE) {
    const htmlElement = element as HTMLElement;

    const id = htmlElement.getAttribute('id');
    if (useElementId && id) {
      // Check if ID is duplicated for any siblings
      const foundSameIdSibling = htmlElement.parentNode
        ? Array.from(htmlElement.parentNode.childNodes).some((n) => {
            if (n.nodeType !== Node.ELEMENT_NODE) {
              return false;
            }

            const siblingElement = n as HTMLElement;

            return (
              siblingElement !== htmlElement &&
              siblingElement.getAttribute('id') === id
            );
          })
        : false;

      if (!foundSameIdSibling) {
        return `//*[@id="${id}"]`;
      }
    }

    const index = getNodeIndex(htmlElement);
    const name = htmlElement.localName;

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
