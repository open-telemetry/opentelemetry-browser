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
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { getElementCSSSelector } from '@opentelemetry/web-utils';
import {
  ATTR_CSS_SELECTOR,
  ATTR_MOUSE_EVENT_BUTTON,
  ATTR_PAGE_X,
  ATTR_PAGE_Y,
  ATTR_TAG_NAME,
  ATTR_TAGS,
  CLICK_EVENT_NAME,
} from './semconv';
import type {
  AutoCapturedUserAction,
  MouseButton,
  UserActionInstrumentationConfig,
} from './types';

const DEFAULT_AUTO_CAPTURED_ACTIONS: AutoCapturedUserAction[] = ['click'];
const OTEL_ELEMENT_ATTRIBUTE_PREFIX = 'data-otel-';

/**
 * This class automatically instruments different User Actions within the browser.
 */
export class UserActionInstrumentation extends InstrumentationBase<UserActionInstrumentationConfig> {
  constructor(config: UserActionInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-user-action', '0.1.0', config);
  }

  protected override init() {
    return [];
  }

  private _getMouseButtonFromMouseEvent(event: MouseEvent): MouseButton {
    switch (event.button) {
      case 0:
        return 'left';
      case 1:
        return 'middle';
      case 2:
        return 'right';
      default:
        return 'left';
    }
  }

  private _clickHandler = (event: MouseEvent) => {
    const element = event.target;

    if (!(element instanceof HTMLElement)) {
      return;
    }

    if (element.hasAttribute('disabled')) {
      return;
    }

    const cssSelector = getElementCSSSelector(element, {
      useIdForTargetElement: true,
      useIdForAncestors: true,
    });
    const otelPrefixedAttributes: Record<string, string> = {};

    // Grab all the attributes in the element that start with data-otel-*
    for (const attr of element.attributes) {
      if (attr.name.startsWith(OTEL_ELEMENT_ATTRIBUTE_PREFIX)) {
        otelPrefixedAttributes[
          attr.name.slice(OTEL_ELEMENT_ATTRIBUTE_PREFIX.length)
        ] = attr.value;
      }
    }

    this.logger.emit({
      severityNumber: SeverityNumber.INFO,
      eventName: CLICK_EVENT_NAME,
      attributes: {
        [ATTR_PAGE_X]: event.pageX,
        [ATTR_PAGE_Y]: event.pageY,
        [ATTR_TAG_NAME]: element.tagName,
        [ATTR_TAGS]: otelPrefixedAttributes,
        [ATTR_MOUSE_EVENT_BUTTON]: this._getMouseButtonFromMouseEvent(event),
        [ATTR_CSS_SELECTOR]: cssSelector,
      },
    });
  };

  override enable(): void {
    const autoCapturedActions =
      this._config.autoCapturedActions ?? DEFAULT_AUTO_CAPTURED_ACTIONS;

    if (autoCapturedActions.includes('click')) {
      document.addEventListener('click', this._clickHandler, true);
    }
  }

  override disable(): void {
    document.removeEventListener('click', this._clickHandler, true);
  }
}
