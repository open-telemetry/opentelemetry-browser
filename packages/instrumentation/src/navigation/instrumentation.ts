/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  InstrumentationBase,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import { version } from '../../package.json' with { type: 'json' };
import {
  ATTR_BROWSER_NAVIGATION_HASH_CHANGE,
  ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT,
  ATTR_BROWSER_NAVIGATION_TYPE,
  ATTR_URL_FULL,
  BROWSER_NAVIGATION_EVENT_NAME,
} from './semconv.ts';
import type {
  NavigationInstrumentationConfig,
  NavigationType,
} from './types.ts';
import { isHashChange } from './utils.ts';

type ChangeState =
  | 'pushState'
  | 'replaceState'
  | 'popstate'
  | 'currententrychange';

interface NavigationApiEntry {
  url?: string;
}

interface NavigationApiTarget {
  currentEntry?: NavigationApiEntry;
}

interface NavigationApiEvent extends Event {
  navigationType?: NavigationType;
  target: NavigationApiTarget & EventTarget;
}

interface NavigationApi {
  addEventListener(
    type: 'currententrychange',
    listener: (event: NavigationApiEvent) => void,
  ): void;
  removeEventListener(
    type: 'currententrychange',
    listener: (event: NavigationApiEvent) => void,
  ): void;
}

export class NavigationInstrumentation extends InstrumentationBase<NavigationInstrumentationConfig> {
  // Use `declare` to prevent JS class field initializers from running after
  // super(), which would reset values set by the enable() call that
  // InstrumentationBase makes during its constructor.
  private declare _isEnabled: boolean;
  private declare _isHistoryPatched: boolean;
  private declare _hasProcessedInitialLoad: boolean;
  private declare _lastUrl: string;
  private declare _onDOMContentLoaded?: () => void;
  private declare _onPopState?: (event: PopStateEvent) => void;
  private declare _onCurrentEntryChange?: (event: NavigationApiEvent) => void;

  constructor(config: NavigationInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/navigation', version, config);
    this._lastUrl = location.href;
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (this._isEnabled) {
      return;
    }
    this._isEnabled = true;

    const navigationApi = this._getNavigationApi();

    // Only patch history API if Navigation API is not being used.
    if (!navigationApi && !this._isHistoryPatched) {
      this._patchHistoryApi();
      this._isHistoryPatched = true;
    }

    this._waitForPageLoad();

    if (navigationApi) {
      this._onCurrentEntryChange = (event) => {
        this._onSoftNavigation('currententrychange', event);
      };
      navigationApi.addEventListener(
        'currententrychange',
        this._onCurrentEntryChange,
      );
    } else {
      this._onPopState = () => {
        this._onSoftNavigation('popstate');
      };
      window.addEventListener('popstate', this._onPopState);
    }
  }

  override disable(): void {
    if (!this._isEnabled) {
      return;
    }
    this._isEnabled = false;

    if (this._onDOMContentLoaded) {
      document.removeEventListener(
        'DOMContentLoaded',
        this._onDOMContentLoaded,
      );
      this._onDOMContentLoaded = undefined;
    }
    if (this._onPopState) {
      window.removeEventListener('popstate', this._onPopState);
      this._onPopState = undefined;
    }
    if (this._onCurrentEntryChange) {
      const navigationApi = this._getNavigationApi();
      navigationApi?.removeEventListener(
        'currententrychange',
        this._onCurrentEntryChange,
      );
      this._onCurrentEntryChange = undefined;
    }
    // Reset the initial-load flag so it can be processed again if re-enabled.
    this._hasProcessedInitialLoad = false;
  }

  private _getNavigationApi(): NavigationApi | undefined {
    const cfg = this.getConfig();
    if (!cfg.useNavigationApiIfAvailable) {
      return undefined;
    }
    return (window as unknown as { navigation?: NavigationApi }).navigation;
  }

  private _onHardNavigation(): void {
    const cfg = this.getConfig();
    const logRecord: LogRecord = {
      eventName: BROWSER_NAVIGATION_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      attributes: {
        [ATTR_URL_FULL]: cfg.sanitizeUrl
          ? cfg.sanitizeUrl(document.documentURI)
          : document.documentURI,
        [ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT]: false,
        [ATTR_BROWSER_NAVIGATION_HASH_CHANGE]: false,
      },
    };
    this._applyCustomLogRecordData(logRecord);
    this.logger.emit(logRecord);
  }

  private _onSoftNavigation(
    changeState: ChangeState,
    navigationEvent?: NavigationApiEvent,
  ): void {
    const referrerUrl = this._lastUrl;
    const currentUrl =
      changeState === 'currententrychange' &&
      navigationEvent?.target?.currentEntry?.url
        ? navigationEvent.target.currentEntry.url
        : location.href;

    if (referrerUrl === currentUrl) {
      return;
    }

    const navType = this._mapChangeStateToType(changeState, navigationEvent);
    const sameDocument = this._determineSameDocument(referrerUrl, currentUrl);
    const hashChange = isHashChange(referrerUrl, currentUrl);
    const cfg = this.getConfig();

    const logRecord: LogRecord = {
      eventName: BROWSER_NAVIGATION_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      attributes: {
        [ATTR_URL_FULL]: cfg.sanitizeUrl
          ? cfg.sanitizeUrl(currentUrl)
          : currentUrl,
        [ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT]: sameDocument,
        [ATTR_BROWSER_NAVIGATION_HASH_CHANGE]: hashChange,
        ...(navType ? { [ATTR_BROWSER_NAVIGATION_TYPE]: navType } : {}),
      },
    };
    this._applyCustomLogRecordData(logRecord);
    this.logger.emit(logRecord);

    this._lastUrl = currentUrl;
  }

  private _waitForPageLoad(): void {
    if (document.readyState === 'complete' && !this._hasProcessedInitialLoad) {
      this._hasProcessedInitialLoad = true;
      this._onHardNavigation();
      return;
    }

    this._onDOMContentLoaded = () => {
      if (!this._hasProcessedInitialLoad) {
        this._hasProcessedInitialLoad = true;
        this._onHardNavigation();
      }
    };
    document.addEventListener('DOMContentLoaded', this._onDOMContentLoaded);
  }

  private _patchHistoryApi(): void {
    this._wrap(
      history,
      'replaceState',
      this._patchHistoryMethod('replaceState'),
    );
    this._wrap(history, 'pushState', this._patchHistoryMethod('pushState'));
  }

  private _patchHistoryMethod(changeState: 'pushState' | 'replaceState') {
    const plugin = this;
    return (original: History['pushState' | 'replaceState']) => {
      return function patchedHistoryMethod(
        this: History,
        ...args: Parameters<History['pushState' | 'replaceState']>
      ) {
        if (!plugin._isEnabled) {
          return original.apply(this, args);
        }
        const result = original.apply(this, args);
        if (location.href !== plugin._lastUrl) {
          plugin._onSoftNavigation(changeState);
        }
        return result;
      };
    };
  }

  private _applyCustomLogRecordData(logRecord: LogRecord): void {
    const cfg = this.getConfig();
    const hook = cfg.applyCustomLogRecordData;
    if (!hook) {
      return;
    }
    safeExecuteInTheMiddle(
      () => hook(logRecord),
      (error) => {
        if (error) {
          this._diag.error('applyCustomLogRecordData hook failed', error);
        }
      },
      true,
    );
  }

  private _determineSameDocument(fromUrl: string, toUrl: string): boolean {
    try {
      const fromURL = new URL(fromUrl);
      const toURL = new URL(toUrl);
      return fromURL.origin === toURL.origin;
    } catch {
      // Fallback: assume same document for relative URLs or parsing errors.
      // In SPAs, route changes via pushState/replaceState are same-document.
      return true;
    }
  }

  private _mapChangeStateToType(
    changeState: ChangeState,
    navigationEvent?: NavigationApiEvent,
  ): NavigationType | undefined {
    if (changeState === 'currententrychange') {
      const navType = navigationEvent?.navigationType;
      switch (navType) {
        case 'traverse':
          return 'traverse';
        case 'replace':
          return 'replace';
        case 'reload':
          return 'reload';
        default:
          // Default to 'push' for programmatic navigations (history.pushState,
          // link clicks) when no explicit type info is available.
          return 'push';
      }
    }

    switch (changeState) {
      case 'pushState':
        return 'push';
      case 'replaceState':
        return 'replace';
      case 'popstate':
        return 'traverse';
      default:
        return undefined;
    }
  }
}
