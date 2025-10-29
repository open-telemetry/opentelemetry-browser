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
import { getElementXPath } from '@opentelemetry/web-utils';
import {
  ATTR_PAGE_X,
  ATTR_PAGE_Y,
  ATTR_TAG_NAME,
  ATTR_TAGS,
  ATTR_TYPE,
  ATTR_XPATH,
  EVENT_NAME,
} from './semconv';
import type {
  AutoCapturedUserAction,
  UserActionEvent,
  UserActionInstrumentationConfig,
} from './types';

const DEFAULT_AUTO_CAPTURED_ACTIONS: AutoCapturedUserAction[] = ['mousedown'];
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

  private _getUserActionFromMouseEvent(event: MouseEvent): UserActionEvent {
    switch (event.button) {
      case 0:
        return 'mousedown.left';
      case 1:
        return 'mousedown.middle';
      case 2:
        return 'mousedown.right';
      default:
        return 'mousedown.left';
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

    const xPath = getElementXPath(element, true);
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
      eventName: EVENT_NAME,
      attributes: {
        [ATTR_PAGE_X]: event.pageX,
        [ATTR_PAGE_Y]: event.pageY,
        [ATTR_TAG_NAME]: element.tagName,
        [ATTR_TAGS]: otelPrefixedAttributes,
        [ATTR_TYPE]: this._getUserActionFromMouseEvent(event),
        [ATTR_XPATH]: xPath,
      },
    });
  };

  override enable(): void {
    const autoCapturedActions =
      this._config.autoCapturedActions ?? DEFAULT_AUTO_CAPTURED_ACTIONS;

    if (autoCapturedActions.includes('mousedown')) {
      document.addEventListener('mousedown', this._clickHandler, true);
    }
  }

  override disable(): void {
    document.removeEventListener('mousedown', this._clickHandler, true);
  }
}
