# Navigation emitted data changes

This compares `@opentelemetry/instrumentation-browser-navigation` 0.17.0 with
`@opentelemetry/browser-instrumentation` 0.10.0, using
`NavigationInstrumentation` from `experimental/navigation`. Return to
[the migration guide](../migration-guide.md) for configuration and SDK setup.

The tables cover built-in output. Application hooks, SDK processors, resources
and exporters can add or change fields independently.

## Log keys and envelope fields

Both packages emit navigation log records. No built-in attribute key is removed,
added or renamed between these versions. A logs pipeline remains necessary.

| Field or attribute                 | Legacy output                                                                                              | New output                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `eventName`                        | `browser.navigation`                                                                                       | Unchanged                                                           |
| `url.full`                         | Initial document URI or committed route URL, optionally sanitized                                          | Same key and optional `sanitizeUrl` callback                        |
| `browser.navigation.same_document` | `false` on initial load, origin comparison on route changes                                                | Same key and behavior                                               |
| `browser.navigation.hash_change`   | `false` on initial load, whether only the hash changed on route changes                                    | Same key and behavior                                               |
| `browser.navigation.type`          | Omitted on initial load, then `push`, `replace`, `traverse` or `reload` according to the navigation source | Same key, values and initial-load omission                          |
| `severityNumber`                   | Not set by the instrumentation                                                                             | Now set to `9` (`INFO`), an envelope field rather than an attribute |
| Scope name                         | `@opentelemetry/instrumentation-browser-navigation`                                                        | `@opentelemetry/browser-instrumentation/navigation`                 |
| Scope version                      | Legacy package version                                                                                     | New package version                                                 |

Update scope filters. A filter requiring INFO severity will now include these
records even though the old instrumentation did not supply severity. There is no
span-to-log or span-event-to-log change for this package.

Both compared implementations use `currententrychange` when
`useNavigationApiIfAvailable` is enabled and the Navigation API is available.
Canceled navigations that do not commit are not a separate event type. The new
package also emits its initial-load record when enabled after DOMContentLoaded
while the document is still `interactive`, so it can report a load the old
implementation missed at that point.

`defaultSanitizeUrl` is an exported helper in the old package, not an emitted
key. It is not exported by the new package. Keep the application-provided
sanitizer when preserving URL redaction.

## Sources

- [Legacy navigation implementation](https://github.com/open-telemetry/opentelemetry-js-contrib/blob/207b9dd1c7e30c12d5dec0e54e476e361b209484/packages/instrumentation-browser-navigation/src/instrumentation.ts)
- [New navigation implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/navigation/instrumentation.ts)
- [New navigation attribute definitions](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/navigation/semconv.ts)
- [New navigation tests](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/navigation/instrumentation.test.ts)
