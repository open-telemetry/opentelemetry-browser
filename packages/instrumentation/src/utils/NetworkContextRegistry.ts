/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, Span } from '@opentelemetry/api';
import { ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { ContextRegistry } from './ContextRegistry.ts';

export interface NetworkSpanData {
  key: string;
  startPerfNow: number;
  endPerfNow: number;
}

/** The document load interval, in `performance.now()` time. */
export interface DocumentLoadData {
  startPerfNow: number;
  endPerfNow: number;
}

export class NetworkContextRegistry extends ContextRegistry<
  NetworkSpanData,
  PerformanceResourceTiming
> {
  getDataKey(data: NetworkSpanData): string {
    return data.key;
  }

  getLookupKey(entry: PerformanceResourceTiming): string {
    return entry.name;
  }

  private _documentLoad: (DocumentLoadData & { ctx: Context }) | undefined;

  /**
   * Returns the context of the fetch/XHR span for this entry. If there is
   * none, falls back to the document load span when the entry ran inside the
   * document load interval.
   */
  getContext(entry: PerformanceResourceTiming): Context | undefined {
    const key = this.getLookupKey(entry);
    const list = this._recordsByKey.get(key);
    const ctx = list?.find(
      (r) =>
        entry.fetchStart >= r.startPerfNow && entry.responseEnd <= r.endPerfNow,
    )?.ctx;
    if (ctx) {
      return ctx;
    }

    const load = this._documentLoad;
    if (
      load &&
      entry.fetchStart >= load.startPerfNow &&
      entry.responseEnd <= load.endPerfNow
    ) {
      return load.ctx;
    }
    return undefined;
  }

  /**
   * Store the document load span and its interval. Calling it again replaces
   * the previous one. unregister() never removes it, it is shared by every
   * resource that loaded with the document.
   */
  setDocumentLoad(span: Span, data: DocumentLoadData): void {
    this._documentLoad = {
      ...data,
      ctx: trace.setSpan(ROOT_CONTEXT, span),
    };
  }

  clearDocumentLoad(): void {
    this._documentLoad = undefined;
  }

  /** Returns the document load span context, if one is stored. */
  getDocumentLoadContext(): Context | undefined {
    return this._documentLoad?.ctx;
  }
}

let _instance: NetworkContextRegistry | undefined;

export function getNetworkContextRegistry(): NetworkContextRegistry {
  if (!_instance) {
    _instance = new NetworkContextRegistry();
  }

  return _instance;
}
