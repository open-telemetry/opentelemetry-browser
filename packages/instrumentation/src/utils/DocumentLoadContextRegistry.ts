/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';

export interface DocumentLoadData {
  context: Context;
  startPerfNow: number;
  endPerfNow: number;
}

/** Shares one document context with all timing entries in its original interval. */
export class DocumentLoadContextRegistry {
  private _resolve?: () => DocumentLoadData | undefined;

  register(resolve: () => DocumentLoadData | undefined): () => void {
    this._resolve = resolve;
    return () => {
      if (this._resolve === resolve) {
        this._resolve = undefined;
      }
    };
  }

  getContext(entry: PerformanceResourceTiming): Context | undefined {
    const data = this._resolve?.();
    if (
      data &&
      Number.isFinite(entry.fetchStart) &&
      Number.isFinite(entry.responseEnd) &&
      entry.fetchStart >= data.startPerfNow &&
      entry.responseEnd >= entry.fetchStart &&
      entry.responseEnd <= data.endPerfNow
    ) {
      return data.context;
    }
    return undefined;
  }
}

const registry = new DocumentLoadContextRegistry();

export function getDocumentLoadContextRegistry(): DocumentLoadContextRegistry {
  return registry;
}
