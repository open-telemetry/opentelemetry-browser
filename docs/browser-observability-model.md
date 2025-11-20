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

## Browser Events

| Event                       | Description                                                                                                                                                                         | Semantic Conventions Status                                                                    | Instrumentation Status                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`browser.navigation`](navigation-event.md)        | Captures a page page navigation event (both hard navigations and soft SPA navigations).                                                                                             | In review [PR2806](https://github.com/open-telemetry/semantic-conventions/pull/2806)           | Not created                                                                                                                                                             |
| `browser.navigation_timing` | Captures detailed technical milestones from the [PerformanceNavigationTiming](https://developer.mozilla.org/docs/Web/API/PerformanceNavigationTiming) API.                          | In review [PR1919](https://github.com/open-telemetry/semantic-conventions/pull/1919)           | Not created                                                                                                                                                             |
| `browser.resource_timing`   | Captures information about individual resources loaded by the page, from the [PerformanceResourceTiming](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming) API. | In review [PR3069](https://github.com/open-telemetry/semantic-conventions/pull/3069)           | Merged (similar, as spans) [instrumentation-document-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) |
| `browser.web_vital`         | Captures Web Vitals metrics such as CLS, INP, LCP, and FID.                                                                                                                         | Merged [WebVitals](https://opentelemetry.io/docs/specs/semconv/browser/events/#webvital-event) | Not created                                                                                                                                                             |
| `exception`                 | Captures unhandled JavaScript exceptions.                                                                                                                                           | Not created                                                                                    | [Merged](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-web-exception)                                                   |
| `browser.console`           | Captures browser console messages such as warnings and logs.                                                                                                                        | Issue Created [I1560](https://github.com/open-telemetry/opentelemetry-js-contrib/issues/1560)  | Not created                                                                                                                                                             |
| `browser.user_action`       | Captures user input events (clicks, scrolls, keypresses).                                                                                                                           | In review [PR2992](https://github.com/open-telemetry/semantic-conventions/pull/2992)           | [Merged](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/instrumentation-user-action)                                                        |
