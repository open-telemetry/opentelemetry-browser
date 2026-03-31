/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SDK_INFO } from '@opentelemetry/core';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';

import type { GlobalConfig, SignalSdk } from './types.ts';

export class WebSdkBuilder<T = GlobalConfig> {
  private _signals: Array<SignalSdk<unknown>> = [];

  withSignal<S>(signal: SignalSdk<S>): WebSdkBuilder<T & S> {
    this._signals.push(signal);
    return this as WebSdkBuilder<T & S>;
  }
  build(config: T) {
    // TODO: adjust some configuration before passing it to signals like
    // - resource
    // - ???

    const signals = this._signals;
    const conf = config as GlobalConfig;

    // Set resource
    conf.resource = (conf.resource || defaultResource()).merge(
      resourceFromAttributes({ ...SDK_INFO }),
    );
    if (typeof conf.serviceName === 'string') {
      conf.resource = conf.resource.merge(
        resourceFromAttributes({ 'service.name': conf.serviceName }),
      );
    }

    return {
      start() {
        for (const s of signals) {
          s.start(conf);
        }
      },
      shutdown() {
        return Promise.all(signals.map((s) => s.shutdown()));
      },
    };
  }
}
