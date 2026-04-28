# Changelog

## [0.3.0](https://github.com/open-telemetry/opentelemetry-browser/compare/browser-instrumentation-v0.2.0...browser-instrumentation-v0.3.0) (2026-04-24)


### Features

* resource timing instrumentation ([#162](https://github.com/open-telemetry/opentelemetry-browser/issues/162)) ([f7625ca](https://github.com/open-telemetry/opentelemetry-browser/commit/f7625ca3298058a49a4ded17059ea9abf9461b2f))
* update navigation timing semconv to browser.navigation_timing namespace ([#241](https://github.com/open-telemetry/opentelemetry-browser/issues/241)) ([b591510](https://github.com/open-telemetry/opentelemetry-browser/commit/b591510d17011483ad79a4f3cc3aff3776d40c63))
* update resource timing semconv to browser.resource_timing namespace ([#240](https://github.com/open-telemetry/opentelemetry-browser/issues/240)) ([fbb2b39](https://github.com/open-telemetry/opentelemetry-browser/commit/fbb2b39ddcf499c7cef5713d5979a89285c5f08e))


### Bug Fixes

* **deps:** update dependencies ([#220](https://github.com/open-telemetry/opentelemetry-browser/issues/220)) ([3901cce](https://github.com/open-telemetry/opentelemetry-browser/commit/3901ccee84074450409d0c9c3d87ff8f798f839b))
* **deps:** update opentelemetry to ^0.214.0 ([#222](https://github.com/open-telemetry/opentelemetry-browser/issues/222)) ([cf8e37e](https://github.com/open-telemetry/opentelemetry-browser/commit/cf8e37ee2a5431a01206014400b36c1fa3874f24))
* **deps:** update opentelemetry to ^0.215.0 ([#236](https://github.com/open-telemetry/opentelemetry-browser/issues/236)) ([d1ebff6](https://github.com/open-telemetry/opentelemetry-browser/commit/d1ebff6a1198741d3d007bc4a983813f7a9ebd4a))

## [0.2.0](https://github.com/open-telemetry/opentelemetry-browser/compare/browser-instrumentation-v0.1.0...browser-instrumentation-v0.2.0) (2026-03-19)


### Features

* **navigation-timing:** emit partial entry when retries exhaust instead of silently dropping ([#206](https://github.com/open-telemetry/opentelemetry-browser/issues/206)) ([ba644ce](https://github.com/open-telemetry/opentelemetry-browser/commit/ba644ce64524a57430738932fb1a4afefdd41b99))


### Bug Fixes

* **instrumentation/navigation-timing:** use declare with class fields to fix not emitting ([#205](https://github.com/open-telemetry/opentelemetry-browser/issues/205)) ([bcae36b](https://github.com/open-telemetry/opentelemetry-browser/commit/bcae36b7e644476b33678e78dd1d6a08b060167b))
* **instrumentation:** export config types from navigation-timing and user-action ([#199](https://github.com/open-telemetry/opentelemetry-browser/issues/199)) ([2aae5c2](https://github.com/open-telemetry/opentelemetry-browser/commit/2aae5c265eb720146fb4c0a7e8f69484b60a5c7d))
* use dynamic version from package.json in instrumentations ([#194](https://github.com/open-telemetry/opentelemetry-browser/issues/194)) ([4edcb62](https://github.com/open-telemetry/opentelemetry-browser/commit/4edcb62c876cb0c5940957da1e91bd5767631afb))
