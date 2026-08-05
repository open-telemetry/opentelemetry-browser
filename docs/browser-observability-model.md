# Browser Events

This document defines browser events for observability and telemetry.

It focuses on the **purpose and description of each event**, rather than defining their individual attributes (which are specified in their respective semantic convention documents).

---

## Goals

The purpose of this document is to:

- Provide a **comprehensive list of browser events** for telemetry.
- Define **the purpose and behavior of each event**.
- Help instrumentation authors and data consumers **understand available browser observability signals**.
- Clarify the **purpose of events without defining their individual attributes**, which are specified in their respective semantic convention documents.

This structure ensures that browser-related events can be consistently interpreted across implementations.

---

## Current status

All events listed below are implemented in this repository's [`@opentelemetry/browser-instrumentation`](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation) package as experimental subpath exports (`./experimental/*`).

In the [semantic-conventions](https://github.com/open-telemetry/semantic-conventions) repository, only `browser.web_vital` (development stability) and `exception` (stable) are currently defined. The earlier PRs proposing conventions for the remaining browser events were closed as stale; the attributes emitted by the instrumentations in this repository serve as the working definitions in the meantime. Longer term, a federated semantic conventions repository for end-user client applications is being discussed ([community #3594](https://github.com/open-telemetry/community/issues/3594)). Conventions shared across client platforms may move to that repository, while browser-specific conventions might remain in this repository.

---

## Browser Events

| Event                       | Description                                                                                                                                                                         | Semantic Conventions Status                                                                    | Instrumentation Status                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`browser.navigation`](navigation-event.md)        | Captures a page navigation event (both hard navigations and soft SPA navigations).                                                                                             | Not created — earlier proposal [PR2806](https://github.com/open-telemetry/semantic-conventions/pull/2806) closed as stale           | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation#navigation)                                                                                                                                                             |
| `browser.navigation_timing` | Captures detailed technical milestones from the [PerformanceNavigationTiming](https://developer.mozilla.org/docs/Web/API/PerformanceNavigationTiming) API.                          | Not created — earlier proposal [PR1919](https://github.com/open-telemetry/semantic-conventions/pull/1919) closed as stale           | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation#navigation-timing)                                                                                                                                                             |
| `browser.resource_timing`   | Captures information about individual resources loaded by the page, from the [PerformanceResourceTiming](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming) API. | Not created — [PR3069](https://github.com/open-telemetry/semantic-conventions/pull/3069) closed; the conventions it proposed shipped in the instrumentation and may later be superseded by unified client network-timing semantics           | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation#resource-timing); similar span-based [instrumentation-document-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) exists in contrib |
| `browser.web_vital`         | Captures Web Vitals metrics such as CLS, INP, and LCP.                                                                                                                         | Merged [WebVitals](https://opentelemetry.io/docs/specs/semconv/browser/browser-events/#webvital-event) (development stability) | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation#web-vitals)                                                                                                                                                             |
| `exception`                 | Captures unhandled JavaScript exceptions and promise rejections.                                                                                                                                           | [Merged](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/) — the `exception` event is stable, but the guidance to use it for exceptions from global unhandled exception handlers is in development                                                                                    | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation#errors); prior art: [instrumentation-web-exception](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-web-exception) in contrib                                                   |
| `browser.console`           | Captures browser console messages such as warnings and logs.                                                                                                                        | Not created  | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation#console)                                                                                                                                                             |
| `browser.user_action.click`       | Captures user click events.                                                                                                                           | Not created — earlier proposal [PR2992](https://github.com/open-telemetry/semantic-conventions/pull/2992) closed as stale           | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation#user-action)                                                        |
