# Changelog

## [0.6.0](https://github.com/open-telemetry/opentelemetry-browser/compare/browser-instrumentation-v0.5.2...browser-instrumentation-v0.6.0) (2026-07-09)


### Features

* add NetworkContextManager proposal for cross-instrumentation OTel context sharing ([#329](https://github.com/open-telemetry/opentelemetry-browser/issues/329)) ([4adcc9a](https://github.com/open-telemetry/opentelemetry-browser/commit/4adcc9ab2e6b3a164c04f70b702ef574004908ac))


### Bug Fixes

* **deps:** update dependencies ([#294](https://github.com/open-telemetry/opentelemetry-browser/issues/294)) ([f5c9711](https://github.com/open-telemetry/opentelemetry-browser/commit/f5c97112f3ff76b1c2790ec679e793ece805caee))
* **deps:** update opentelemetry ([#318](https://github.com/open-telemetry/opentelemetry-browser/issues/318)) ([89b8e27](https://github.com/open-telemetry/opentelemetry-browser/commit/89b8e271bf00669cc3d94ed2895a870516034b78))
* **deps:** update opentelemetry ([#338](https://github.com/open-telemetry/opentelemetry-browser/issues/338)) ([bc54414](https://github.com/open-telemetry/opentelemetry-browser/commit/bc54414f6278e41c32d68bd72109643f75ff2878))
* **errors:** contain throwing LogRecordProcessor to prevent error-event loop ([#303](https://github.com/open-telemetry/opentelemetry-browser/issues/303)) ([06275ee](https://github.com/open-telemetry/opentelemetry-browser/commit/06275ee58b7fa4a4367b964b9ef9fa443f4d2d51))
* **errors:** emit ErrorEvent.message when the error object is null ([#301](https://github.com/open-telemetry/opentelemetry-browser/issues/301)) ([771b77d](https://github.com/open-telemetry/opentelemetry-browser/commit/771b77d30181022aa21b203001e7292efff7abe9))


### Performance Improvements

* **instrumentation:** declare package side-effect free for tree-shaking ([#316](https://github.com/open-telemetry/opentelemetry-browser/issues/316)) ([942bce1](https://github.com/open-telemetry/opentelemetry-browser/commit/942bce19f038b3f996a070a7eb03cf2b328299bf))

## [0.5.2](https://github.com/open-telemetry/opentelemetry-browser/compare/browser-instrumentation-v0.5.1...browser-instrumentation-v0.5.2) (2026-05-18)


### Bug Fixes

* **deps:** update opentelemetry ([#279](https://github.com/open-telemetry/opentelemetry-browser/issues/279)) ([e17a715](https://github.com/open-telemetry/opentelemetry-browser/commit/e17a715e5048f65476ec6dd839b95818519233cf))

## [0.5.1](https://github.com/open-telemetry/opentelemetry-browser/compare/browser-instrumentation-v0.5.0...browser-instrumentation-v0.5.1) (2026-05-12)


### Bug Fixes

* **deps:** update dependency @opentelemetry/core to ^2.7.1 ([#276](https://github.com/open-telemetry/opentelemetry-browser/issues/276)) ([0cd11cc](https://github.com/open-telemetry/opentelemetry-browser/commit/0cd11ccad08b39b11368e5be2f84145ad4d95313))
* **resource-timing:** prevent feedback loop by adding ignoreUrls ([#248](https://github.com/open-telemetry/opentelemetry-browser/issues/248)) ([3265cd9](https://github.com/open-telemetry/opentelemetry-browser/commit/3265cd906fe27cc99afaf58fab55404ac6ec844e))

## [0.5.0](https://github.com/open-telemetry/opentelemetry-browser/compare/browser-instrumentation-v0.4.0...browser-instrumentation-v0.5.0) (2026-05-07)


### Features

* **instrumentation:** port instrumentation-web-exception into consolidated package ([#267](https://github.com/open-telemetry/opentelemetry-browser/issues/267)) ([c1ceee5](https://github.com/open-telemetry/opentelemetry-browser/commit/c1ceee5b44c77197d499ee7d4569e2d3e13a7551))


### Bug Fixes

* **deps:** update opentelemetry to ^0.217.0 ([#271](https://github.com/open-telemetry/opentelemetry-browser/issues/271)) ([0297b51](https://github.com/open-telemetry/opentelemetry-browser/commit/0297b51f2bdebc11aac9cbe1c34f9006a32985cf))

## [0.4.0](https://github.com/open-telemetry/opentelemetry-browser/compare/browser-instrumentation-v0.3.0...browser-instrumentation-v0.4.0) (2026-04-30)


### Features

* add `@opentelemetry/instrumentation-console` package for capturing console calls as OpenTelemetry logs ([#98](https://github.com/open-telemetry/opentelemetry-browser/issues/98)) ([aa4e658](https://github.com/open-telemetry/opentelemetry-browser/commit/aa4e658f3674ad71bae639b1d07785434e96a1dc))
* **instrumentation:** port browser-navigation into consolidated package ([#242](https://github.com/open-telemetry/opentelemetry-browser/issues/242)) ([778faa3](https://github.com/open-telemetry/opentelemetry-browser/commit/778faa3f5a71790e3c3efda7f0dfe28043d47ed6))


### Bug Fixes

* **deps:** update opentelemetry ([#256](https://github.com/open-telemetry/opentelemetry-browser/issues/256)) ([3fe3cb0](https://github.com/open-telemetry/opentelemetry-browser/commit/3fe3cb01136deb5f4ddda1f0a3119b7c8e409e73))
* **deps:** update opentelemetry ([#257](https://github.com/open-telemetry/opentelemetry-browser/issues/257)) ([0a64327](https://github.com/open-telemetry/opentelemetry-browser/commit/0a643273488e05a94b424bf9917a89f29fdc3476))

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
