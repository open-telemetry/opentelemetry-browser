# Navigation emitted data changes

This compares `@opentelemetry/instrumentation-browser-navigation` 0.17.0 with
`@opentelemetry/browser-instrumentation` 0.10.0, using
`NavigationInstrumentation` from `experimental/navigation`. Return to
[the migration guide](../migration-guide.md) for configuration and SDK setup.

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

Update scope filters. The old package didn't set a severity, so a filter on INFO
severity now matches these records.

## Sources

- [Legacy navigation implementation](https://github.com/open-telemetry/opentelemetry-js-contrib/blob/207b9dd1c7e30c12d5dec0e54e476e361b209484/packages/instrumentation-browser-navigation/src/instrumentation.ts)
- [New navigation implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/navigation/instrumentation.ts)
- [New navigation attribute definitions](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/navigation/semconv.ts)
- [New navigation tests](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/navigation/instrumentation.test.ts)
