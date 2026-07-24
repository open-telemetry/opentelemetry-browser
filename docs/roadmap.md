# OpenTelemetry Browser Roadmap

This document describes the areas where OpenTelemetry Browser development
should focus, organized by topic rather than by date. It is a living document
that will be revised incrementally as the project evolves. The unifying goal
across all of these areas is adoption: making OpenTelemetry the default
choice for browser observability.

Deliberately, there are no timelines or due dates here — the pace of progress
is determined primarily by contributor availability. The format follows the
[OpenTelemetry Android roadmap](https://github.com/open-telemetry/opentelemetry-android/blob/main/docs/ROADMAP.md),
so that client SIGs share a common way of communicating direction.

This document is intentionally broader than our
[current set of GitHub issues](https://github.com/open-telemetry/opentelemetry-browser/issues).
If an area you care about isn't well captured, please
[open a new issue](https://github.com/open-telemetry/opentelemetry-browser/issues/new)
to discuss and work on it.

## Table of Contents

* [Background: From Phase 1 to This Roadmap](#background-from-phase-1-to-this-roadmap)
* [Package Consolidation](#package-consolidation)
* [Event-Based Instrumentation](#event-based-instrumentation)
* [Semantic Convention Stability](#semantic-convention-stability)
* [Developer Experience: the Browser SDK](#developer-experience-the-browser-sdk)
* [Browser Compatibility and Support](#browser-compatibility-and-support)
* [Sessions and Page Context](#sessions-and-page-context)
* [Open Data Model Questions](#open-data-model-questions)
  * [Metrics Strategy](#metrics-strategy)
  * [Browser API Surface](#browser-api-surface)
* [Documentation](#documentation)
* [Cross-Platform Coordination](#cross-platform-coordination)
* [Growing Contributors](#growing-contributors)
* [Distant Destinations](#distant-destinations)
  * [Bundle Size](#bundle-size)
  * [Protocol and Payload Efficiency](#protocol-and-payload-efficiency)
  * [Sampling](#sampling)
* [Conclusion](#conclusion)

## Background: From Phase 1 to This Roadmap

This project was chartered by the
[Browser Instrumentation (Phase 1) proposal](https://github.com/open-telemetry/community/blob/main/projects/browser-phase-1.md),
which focused on browser fundamentals (API review, data modeling for sessions
and navigation) and a core set of event-based instrumentations. With that
charter largely delivered, this roadmap describes where the project goes
next, including items the Phase 1 proposal listed as future options: a
browser-specific SDK, additional instrumentation, and a more efficient
client protocol.

## Package Consolidation

We want this repository to be the single home for browser telemetry in
OpenTelemetry. Browser-related packages currently spread across
[opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) and
[opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)
will be migrated here or deprecated
([#209](https://github.com/open-telemetry/opentelemetry-browser/issues/209)).
This includes:

* fetch instrumentation
  ([#259](https://github.com/open-telemetry/opentelemetry-browser/issues/259),
  [#327](https://github.com/open-telemetry/opentelemetry-browser/issues/327))
* XHR instrumentation
  ([#258](https://github.com/open-telemetry/opentelemetry-browser/issues/258))
* `instrumentation-web-exception`
  ([#239](https://github.com/open-telemetry/opentelemetry-browser/issues/239))
* `instrumentation-browser-navigation`
  ([#238](https://github.com/open-telemetry/opentelemetry-browser/issues/238))
* `web-common`
  ([#313](https://github.com/open-telemetry/opentelemetry-browser/issues/313))

Deprecations of superseded packages will be batched into a coordinated sweep
to minimize churn for users. As part of this consolidation, we are committed
to a zoneless architecture
([#210](https://github.com/open-telemetry/opentelemetry-browser/issues/210)):
new packages will not depend on Zone.js, and the legacy span-based
user-interaction instrumentation will be deprecated in favor of event-based
user action telemetry.

## Event-Based Instrumentation

Browser telemetry in this repository is built on an event-based model,
described in the
[browser observability model](browser-observability-model.md). A coherent set
of instrumentations emits well-defined events: navigation timing, resource
timing, user actions, web vitals, exceptions, and network requests
(fetch/XHR), with more to come (e.g., soft navigation, console).

Near-term instrumentation goals:

* Land the remaining network instrumentations — fetch
  ([#281](https://github.com/open-telemetry/opentelemetry-browser/pull/281))
  and XHR
  ([#258](https://github.com/open-telemetry/opentelemetry-browser/issues/258)) —
  and align all instrumentations on a browser-native `InstrumentationBase`
  ([#278](https://github.com/open-telemetry/opentelemetry-browser/pull/278)).
* Correlate resource timing entries with the network requests that produced
  them via network context.
* Keep the instrumentation status table in the
  [browser observability model](browser-observability-model.md) current.

Beyond the core runtime set, instrumentation remains open-ended — the Phase 1
charter identified long tasks and popular frameworks and libraries (React,
Angular, Vue, and others) as candidates. We welcome pragmatic contributions
in these areas, built on the event-based model.

## Semantic Convention Stability

The data model remains the most important foundation for browser
observability — it is what ingest and analysis tools build upon. We will
drive the semantic conventions for browser events (navigation,
navigation timing, resource timing, web vitals, user action, exception,
console) from experimental review to stability.

Known open modeling questions we intend to resolve with written decisions:

* Cardinality of document/page URL attributes (e.g., query parameters in
  `browser.document.url.full`).
* Modeling sessions and documents/page views as entities (see
  [Sessions and Page Context](#sessions-and-page-context)).

Following the approach taken by OpenTelemetry Android, we intend to document
browser-specific semantic conventions in this repository as federated
conventions, following the standard stability lifecycle. Where conventions
are shared across client platforms (Android, iOS, Flutter, browser), we will
contribute to the common client semantic conventions repository that is being
bootstrapped, rather than defining browser-only variants (see
[Cross-Platform Coordination](#cross-platform-coordination)).

## Developer Experience: the Browser SDK

Getting started with OpenTelemetry in the browser should take a few lines of
code, not twenty. The new SDK package provides a single entry point
(`startBrowserSdk`) with opinionated, browser-appropriate defaults and full
escape hatches for advanced configuration — analogous to what `sdk-node`
provides for Node.js.

Roadmap goals:

* Iterate on the published SDK package and grow it toward a stable 1.0 API,
  informed by real-world usage of the initial releases.
* Make session tracking, resource detection, and exporter configuration work
  out of the box.
* Consolidate configuration so common needs (e.g., enriching log records)
  have a single SDK-level surface
  ([#359](https://github.com/open-telemetry/opentelemetry-browser/issues/359)).
* Keep examples, the sandbox, and the demo app on the SDK package so users
  always have a working reference.

## Browser Compatibility and Support

Users should know exactly where OpenTelemetry Browser works. We will publish
a written compatibility statement covering which browser features and APIs we
require, which browser versions we support as a result, and our position on
adjacent runtimes (e.g., Electron, WebAssembly). This was called for in the
Phase 1 charter and remains to be documented.

## Sessions and Page Context

Sessions and page context are central to browser observability and a key
differentiator from server-side telemetry. Goals:

* First-class session management in the SDK, including session start/end
  events.
* Modeling sessions and documents/page views as entities, with session and
  page context carried on telemetry via resource attributes
  ([#269](https://github.com/open-telemetry/opentelemetry-browser/pull/269),
  [semantic-conventions#3519](https://github.com/open-telemetry/semantic-conventions/pull/3519)).
* Alignment with other client platforms on session semantics, in
  coordination with the Client Instrumentation SIG, since entity support may
  require engagement with the broader OpenTelemetry specification.

## Open Data Model Questions

Some architectural questions are intentionally kept open on this roadmap.
They deserve dedicated discussion issues, working prototypes, and trade-off
analysis rather than premature commitment.

### Metrics Strategy

Should the browser emit metrics at all, or are events the primitive from
which backends derive metrics? Options under discussion:

* **Events-first:** no client-side metrics; backends aggregate. Simpler
  client, smaller bundles, less data on the wire.
* **Lightweight client-side metrics:** a small subset (e.g., error counters,
  key timing histograms) where client-side aggregation meaningfully reduces
  data volume.
* **Unaggregated measurements:** a metrics API that emits individual
  events/measurements without any client-side aggregation, leaving
  aggregation entirely to the backend while preserving the familiar metrics
  API shape for instrumentation authors.

Current leaning is events-first with room for carve-outs, but this needs a
written decision informed by real payload measurements.

### Browser API Surface

The question is not whether the browser needs its own API, but whether
browser developers need a thin ergonomic facade over the existing
OpenTelemetry API — e.g., convenience wrappers for emitting events over the
Logs API, and a small accessor API for session and page context. Related
design discussions include server-provided trace context via meta tags
([#129](https://github.com/open-telemetry/opentelemetry-browser/issues/129))
and breadcrumb context identifiers
([#84](https://github.com/open-telemetry/opentelemetry-browser/issues/84)).

## Documentation

As the SDK and instrumentations mature, documentation must mature with them:

* Developer-facing documentation on
  [opentelemetry.io](https://opentelemetry.io/) for browser instrumentation
  and the SDK package.
* A dedicated session management guide
  ([#114](https://github.com/open-telemetry/opentelemetry-browser/issues/114)).
* Task-oriented "How do I ..." recipes for common scenarios.
* An up-to-date sandbox and demo, serving as living examples.
* Representation in the
  [official OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo):
  its web frontend should showcase the new event-based instrumentations and
  the browser SDK, so users evaluating OpenTelemetry see browser telemetry
  as a first-class signal.

## Cross-Platform Coordination

Browser is one of several OpenTelemetry client platforms. We will:

* Participate in the federated client semantic conventions repository
  together with Android, iOS, and Flutter.
* Increase browser representation in Semantic Conventions and specification
  meetings, so client-side concerns are represented early.
* Coordinate on shared concepts — sessions in particular — through the
  Client Instrumentation SIG.

## Growing Contributors

The long-term success of OpenTelemetry Browser depends on a robust pipeline
of maintainers, approvers, contributors, and reviewers. We will continue to
welcome and support new contributors — through `good first issue` and
`help wanted` labels, responsive reviews, and contributor-friendly processes.

## Distant Destinations

Larger or longer-horizon efforts worth noting, open to reprioritization:

### Bundle Size

Bundle size is a first-order concern for browser developers. We plan to
measure and publish bundle size information (ideally automated in CI),
identify the biggest contributors, and pursue tree-shaking, code splitting,
and lazy loading of instrumentations.

### Protocol and Payload Efficiency

OTLP was not designed with browser constraints foremost in mind. Directions
to evaluate, starting with the simplest: compressed OTLP JSON (gzip/brotli),
batching strategies, and — only if measurement justifies it — more compact
encodings.

### Sampling

Browser-appropriate sampling strategies to control data volume while
preserving the sessions and events that matter.

## Conclusion

This roadmap captures the areas where OpenTelemetry Browser needs continued
investment to become easier to adopt, more consistent in its data model, and
more useful for web developers: consolidating packages into one home,
stabilizing event-based instrumentation and its semantic conventions, making
setup trivial through the SDK package, and resolving the bigger questions
around sessions, metrics, and API ergonomics in the open. Progress will
depend on focused, incremental contributions across these areas.
