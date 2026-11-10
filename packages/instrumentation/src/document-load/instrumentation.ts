/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Span } from '@opentelemetry/api';
import { ROOT_CONTEXT } from '@opentelemetry/api';
import { InstrumentationBase } from '@opentelemetry/browser-api';
import { ATTR_URL_FULL } from '@opentelemetry/semantic-conventions';
import { defaultSanitizeUrl, getNetworkContextRegistry } from '#utils';
import { version } from '../../package.json' with { type: 'json' };
import type { DocumentLoadInstrumentationConfig } from './types.ts';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 50;

export class DocumentLoadInstrumentation extends InstrumentationBase<DocumentLoadInstrumentationConfig> {
  private _collected = false;
  private _span: Span | undefined;
  private _onLoad: (() => void) | undefined;
  private _timeout: number | undefined;
  private _retryCount = 0;

  constructor(config: DocumentLoadInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/document-load',
      version,
      config,
    );
  }

  protected override _onEnable(): void {
    // Not reset by disable(): one page load gets one span.
    if (this._collected) {
      return;
    }
    this._retryCount = 0;
    this._onLoad = () => this._begin();
    if (document.readyState === 'complete') {
      this._begin();
    } else {
      window.addEventListener('load', this._onLoad, { once: true });
    }
  }

  protected override _onDisable(): void {
    this._cleanup();
    // A disabled instance shares no context. Re-enabling stores it again.
    if (!this._collected) {
      getNetworkContextRegistry().clearDocumentLoad();
    }
  }

  // Runs in the load handler, or at enable() after load. Both come before
  // navigation-timing and resource-timing emit for the load, so they find the
  // span context in the registry.
  private _begin(): void {
    const started = this._safeExecute('failed to start document load', () => {
      this._start();
      return true;
    });
    if (started) {
      this._schedule();
    }
  }

  private _schedule(): void {
    if (!this.isEnabled() || this._timeout !== undefined) {
      return;
    }
    // loadEventEnd is only populated after the load handlers return.
    this._timeout = window.setTimeout(() => {
      this._timeout = undefined;
      const collected = this._safeExecute(
        'failed to record document load',
        () => this._collect(),
      );
      if (collected) {
        return;
      }
      if (collected === false && this._retryCount++ < MAX_RETRIES) {
        this._schedule();
        return;
      }
      if (collected === false) {
        this._diag.warn(
          'Document load: no complete navigation timing available',
        );
      }
      // The span never ends, so nothing should point to it.
      getNetworkContextRegistry().clearDocumentLoad();
      this._span = undefined;
      this._cleanup();
    }, this._retryCount * RETRY_DELAY_MS);
  }

  private _getEntry(): PerformanceNavigationTiming | undefined {
    const entries = performance.getEntriesByType?.('navigation') as
      | PerformanceNavigationTiming[]
      | undefined;
    const entry = entries?.[entries.length - 1];
    if (!entry || !Number.isFinite(entry.fetchStart) || entry.fetchStart < 0) {
      return undefined;
    }
    return entry;
  }

  /**
   * Starts the span and stores it in the network context registry. Until
   * loadEventEnd is known, the stored interval ends at loadEventStart, so a
   * resource that may have finished after the load event gets no context.
   */
  private _start(): PerformanceNavigationTiming | undefined {
    const entry = this._getEntry();
    if (!entry) {
      return undefined;
    }
    if (!this._span) {
      this._span = this.tracer.startSpan(
        'documentLoad',
        {
          startTime: performance.timeOrigin + entry.fetchStart,
          attributes: {
            [ATTR_URL_FULL]: defaultSanitizeUrl(entry.name),
          },
        },
        ROOT_CONTEXT,
      );
    }
    const end = isValidEnd(entry, entry.loadEventEnd)
      ? entry.loadEventEnd
      : entry.loadEventStart;
    if (isValidEnd(entry, end)) {
      getNetworkContextRegistry().setDocumentLoad(this._span, {
        startPerfNow: entry.fetchStart,
        endPerfNow: end,
      });
    }
    return entry;
  }

  private _collect(): boolean {
    if (!this.isEnabled() || this._collected) {
      return this._collected;
    }
    const entry = this._start();
    const span = this._span;
    if (!entry || !span || !isValidEnd(entry, entry.loadEventEnd)) {
      return false;
    }

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

function isValidEnd(entry: PerformanceNavigationTiming, end: number): boolean {
  return Number.isFinite(end) && end > 0 && end >= entry.fetchStart;
}
