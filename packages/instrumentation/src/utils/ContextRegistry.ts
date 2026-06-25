/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, Span } from '@opentelemetry/api';
import { ROOT_CONTEXT, trace } from '@opentelemetry/api';

type StoredRecord<TData> = TData & { ctx: Context };

export abstract class ContextRegistry<TData extends { key: string }, TLookup> {
  protected _records = new Map<string, StoredRecord<TData>[]>();

  register(span: Span, data: TData): void {
    const ctx = trace.setSpan(ROOT_CONTEXT, span);
    const list = this._records.get(data.key) ?? [];
    list.push({ ...data, ctx });
    this._records.set(data.key, list);
  }

  abstract getContext(lookup: TLookup): Context | undefined;
}
