# Browser Lifecycle Events

This document defines a set of browser events organized into three high-level lifecycle phases.

It focuses on the **purpose and relationships of events within the browser lifecycle**, rather than defining their individual attributes (which are specified in their respective semantic convention documents).

---

## Goals

The purpose of this document is to:

- Provide a **conceptual lifecycle model** for browser telemetry.
- Define **which events are expected in each phase** of a page lifecycle.
- Help instrumentation authors and data consumers **reason about browser behavior from load to unload**.
- Clarify the **purpose and relationships of events without defining their individual attributes**, which are specified in their respective semantic convention documents.

This structure ensures that browser-related events can be consistently interpreted across implementations.

---

## Lifecycle

The browser lifecycle is divided into the following phases:

1. **Load phase** – from navigation start to Largest Contentful Paint (LCP)
2. **User interaction phase** – from LCP until the page begins unloading
3. **Unload phase** – when the page begins unloading

---

## Lifecycle Phases

### Load Phase

**Starts at navigation start → Ends at Largest Contentful Paint (LCP)**  
Captures the loading behavior and performance of the page.

| Event | Description | Semantic Conventions Status | Instrumentation Status                                                                                                                               |
|---|---|---|------------------------------------------------------------------------------------------------------------------------------------------------------|
| `browser.page_view` | Signals the start of a **hard** page navigation. Occurs once per page load. | In review [PR1910](https://github.com/open-telemetry/semantic-conventions/pull/1910) | In review [PR2386](https://github.com/open-telemetry/opentelemetry-js-contrib/pull/2386)                                                             |
| `browser.navigation_timing` | Captures detailed technical milestones from the [PerformanceNavigationTiming](https://developer.mozilla.org/docs/Web/API/PerformanceNavigationTiming) API. Occurs once per page load. | In review [PR1919](https://github.com/open-telemetry/semantic-conventions/pull/1919) | Not created                                                                                                                                          |
| `browser.page_load` | Summarizes the user-visible page load experience from navigation start until LCP (includes total duration, paint timings, resource counts, transfer size). Occurs once per page load. | Not created | Not created                                                                                                                                          |
| `browser.performance_resource_timing` | Captures information about individual resources loaded during the initial page load, from the [PerformanceResourceTiming](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming) API. May occur multiple times per page load. | Not created | Merged (similar) [instrumentation-document-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) |

---

### User Interaction Phase

**Starts after LCP → Ends when the page begins unloading**  
Captures user-centric metrics, runtime behavior, and late resource loading.

**All events in this phase may occur multiple times.**

| Event                                 | Description                                                                       | Semantic Conventions Status                                                                    | Instrumentation Status                                                                                                                                        |
|---------------------------------------|-----------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `browser.page_view`                   | Represents a **soft navigation** (SPA virtual page change).                       | In review [PR1910](https://github.com/open-telemetry/semantic-conventions/pull/1910)           | In review [PR2386](https://github.com/open-telemetry/opentelemetry-js-contrib/pull/2386)                                                                      |
| `browser.web_vital`                   | Captures Web Vitals metrics such as CLS, INP, and FID that occur after page load. | Merged [WebVitals](https://opentelemetry.io/docs/specs/semconv/browser/events/#webvital-event) | Not created                                                                                                                                                   |
| `exception`                           | Captures unhandled JavaScript exception.                                          | Not created                                                                                    | In review [PR2715](https://github.com/open-telemetry/opentelemetry-js-contrib/pull/2751/files)                                                                |
| `browser.console`                     | Captures browser console messages such as warnings and logs.                      | Issue Created [I1560](https://github.com/open-telemetry/opentelemetry-js-contrib/issues/1560)  | Not created                                                                                                                                                   |
| `browser.user_action`                 | Captures user input events (clicks, scrolls, keypresses).                         | In review [PR1941](https://github.com/open-telemetry/semantic-conventions/pull/1941)           | Not created                                                                                                                                                   |
| `browser.performance_resource_timing` | Captures late-loaded assets (ads, analytics, lazy images, etc.).                  | In review [PR1943](https://github.com/open-telemetry/semantic-conventions/pull/1943)           | Merged (similar) [instrumentation-document-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) |

---

### Unload Phase

**Starts when the user initiates a navigation away, closes the tab, or reloads**  
Captures the start of the unload process.

| Event | Description | Semantic Conventions Status | Instrumentation Status |
|---|---|---|---|
| `browser.page_unload` | Signals the start of the page unload process. Occurs once per page unload. | Not created | Not created |