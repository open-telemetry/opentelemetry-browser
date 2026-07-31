/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';
import { ContextRegistry } from './ContextRegistry.ts';

export interface NetworkSpanData {
  key: string;
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

  getContext(entry: PerformanceResourceTiming): Context | undefined {
    const key = this.getLookupKey(entry);
    const list = this._recordsByKey.get(key);
    return list?.find(
      (r) =>
        entry.fetchStart >= r.startPerfNow && entry.responseEnd <= r.endPerfNow,
    )?.ctx;
  }
}

let _instance: NetworkContextRegistry | undefined;

export function getNetworkContextRegistry(): NetworkContextRegistry {
  if (!_instance) {
    _instance = new NetworkContextRegistry();
  }

  return _instance;
}
