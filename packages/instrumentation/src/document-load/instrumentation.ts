/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ROOT_CONTEXT } from '@opentelemetry/api';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import {
  ATTR_URL_FULL,
  ATTR_USER_AGENT_ORIGINAL,
} from '@opentelemetry/semantic-conventions';
import { version } from '../../package.json' with { type: 'json' };
import type { DocumentLoadInstrumentationConfig } from './types.ts';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 50;

export class DocumentLoadInstrumentation extends InstrumentationBase<DocumentLoadInstrumentationConfig> {
  // enable() is called by the base constructor, before field initializers run.
  declare private _isEnabled: boolean;
  declare private _collected: boolean;
  declare private _onLoad: (() => void) | undefined;
  declare private _timeout: number | undefined;
  declare private _retryCount: number;

  constructor(config: DocumentLoadInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/document-load',
      version,
      config,
    );
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (this._isEnabled) {
      return;
    }
    this._isEnabled = true;
    this._collected ??= false;
    this._retryCount = 0;
    this._onLoad = () => this._schedule();
    if (document.readyState === 'complete') {
      this._schedule();
    } else {
      window.addEventListener('load', this._onLoad, { once: true });
    }
  }

  override disable(): void {
    this._isEnabled = false;
    this._cleanup();
  }

  private _schedule(): void {
    if (!this._isEnabled || this._timeout !== undefined) {
      return;
    }
    // loadEventEnd is only populated after the load handlers return.
    this._timeout = window.setTimeout(() => {
      this._timeout = undefined;
      if (this._collect()) {
        return;
      }
      if (this._retryCount++ < MAX_RETRIES) {
        this._schedule();
      } else {
        this._diag.warn(
          'Document load: no complete navigation timing available',
        );
        this._cleanup();
      }
    }, this._retryCount * RETRY_DELAY_MS);
  }

  private _collect(): boolean {
    if (!this._isEnabled || this._collected) {
      return this._collected;
    }
    const entries = performance.getEntriesByType?.('navigation') as
      | PerformanceNavigationTiming[]
      | undefined;
    const entry = entries?.[entries.length - 1];
    if (
      !entry ||
      !Number.isFinite(entry.fetchStart) ||
      !Number.isFinite(entry.loadEventEnd) ||
      entry.fetchStart < 0 ||
      entry.loadEventEnd <= 0 ||
      entry.loadEventEnd < entry.fetchStart
    ) {
      return false;
    }

    const span = this.tracer.startSpan(
      'documentLoad',
      {
        startTime: performance.timeOrigin + entry.fetchStart,
        attributes: {
          [ATTR_URL_FULL]: entry.name,
          [ATTR_USER_AGENT_ORIGINAL]: navigator.userAgent,
        },
      },
      ROOT_CONTEXT,
    );
    this._collected = true;
    span.end(performance.timeOrigin + entry.loadEventEnd);
    this._cleanup();
    return true;
  }

  private _cleanup(): void {
    if (this._timeout !== undefined) {
      window.clearTimeout(this._timeout);
      this._timeout = undefined;
    }
    if (this._onLoad) {
      window.removeEventListener('load', this._onLoad);
      this._onLoad = undefined;
    }
  }
}
