# User interaction emitted data changes

This compares `@opentelemetry/instrumentation-user-interaction` 0.68.0 with
`@opentelemetry/browser-instrumentation` 0.10.0, using
`UserActionInstrumentation` from `experimental/user-action`. Return to
[the migration guide](../migration-guide.md) for configuration and SDK setup.

## Spans become click log records

The old package creates interaction spans, including their duration and
parentage. The new package creates `browser.user_action.click` log records.
Configure a logger provider and a logs export pipeline. It does not create an
interaction span to parent subsequent network requests.

| Legacy span field or attribute                                               | New log field or attribute               | Change                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Span name, normally the DOM event name and sometimes updated to a route name | `eventName: browser.user_action.click`   | Signal and naming change, not a span rename                                                            |
| `event_type`                                                                 | No corresponding attribute               | Removed. The log event name identifies a click, arbitrary configured DOM event names are not supported |
| `target_element`                                                             | `browser.tag_name`                       | Moved from a span attribute to a log attribute, still the element tag name                             |
| `target_xpath`                                                               | `browser.css_selector`                   | Replaced by a CSS selector, not an XPath string. Update consumers that parse or group by XPath         |
| `url.full`                                                                   | No built-in replacement on the click log | Removed. Add a page URL with a `LogRecordProcessor` if required                                        |
| No corresponding attribute                                                   | `browser.mouse_event.button`             | New log attribute, `left`, `middle` or `right`                                                         |
| No corresponding attribute                                                   | `browser.page.x`                         | New log attribute, click `pageX` coordinate                                                            |
| No corresponding attribute                                                   | `browser.page.y`                         | New log attribute, click `pageY` coordinate                                                            |
| No corresponding attribute                                                   | `browser.element.attributes`             | New log attribute, a map of target-element `data-otel-*` attributes with that prefix removed           |
| No log severity                                                              | `severityNumber: 9` (`INFO`)             | New log envelope field                                                                                 |
| Span start/end timestamps, duration and span ID                              | No newly created interaction span        | No direct replacement. A log timestamp does not describe an interaction duration                       |

The scope name changes from `@opentelemetry/instrumentation-user-interaction` to
`@opentelemetry/browser-instrumentation/user-action`.

Attributes added in `shouldPreventSpanCreation` don't carry over. Set them in a
`LogRecordProcessor` registered with the `LoggerProvider` instead.

## Sources

- [Legacy interaction implementation](https://github.com/open-telemetry/opentelemetry-js-contrib/blob/207b9dd1c7e30c12d5dec0e54e476e361b209484/packages/instrumentation-user-interaction/src/instrumentation.ts)
- [Legacy attribute names](https://github.com/open-telemetry/opentelemetry-js-contrib/blob/207b9dd1c7e30c12d5dec0e54e476e361b209484/packages/instrumentation-user-interaction/src/enums/AttributeNames.ts)
- [New user-action implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/user-action/instrumentation.ts)
- [New attribute definitions](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/user-action/semconv.ts)
- [New user-action tests](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/user-action/instrumentation.test.ts)
