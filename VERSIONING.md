# Versioning

All packages in this repository are pre-1.0, and every instrumentation is
exported under `./experimental/*`. Until that changes, any minor release may
include breaking changes, in line with the
[Development status](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/versioning-and-stability.md#development)
in the OpenTelemetry specification. Patch releases don't include breaking
changes.

This document will be updated when a package or instrumentation becomes stable.

## What counts as a breaking change

- Removing or renaming an export, config option, or type
- Changing a default value or default behavior
- Changing emitted telemetry: event or span names, attribute names or values, or
  which signal is used

## The instrumentation contract

`@opentelemetry/browser-api` holds `Instrumentation`, `InstrumentationDeps` and
`InstrumentationBase`. The SDK, the instrumentations in this repository and
third-party instrumentations all depend on it as a regular dependency. An app
can have more than one version installed, so these rules apply:

- Prefer to change `Instrumentation` and `InstrumentationDeps` only by adding
  optional fields. An instrumentation must work when a field is missing, and
  must ignore fields it does not know. Before 1.0, a breaking change can ship in
  a minor release, marked as breaking. The PR must say that the SDK and all
  instrumentations, including third-party ones, have to upgrade together.
  TypeScript does not always catch a mismatch. At runtime, the instrumentation
  can throw, use the global API instead of the SDK's providers, or stop sending
  telemetry.
- Code that receives an instrumentation must use only the `Instrumentation`
  interface. It must not check `instanceof InstrumentationBase`, because the
  class can come from a different copy of the package.
- A change to a protected member or hook of `InstrumentationBase` is a breaking
  change for third-party instrumentations, even if the interface stays the same.
  Before 1.0, it can ship in a minor release, marked as breaking. Each
  instrumentation extends the class from its own dependency on
  `@opentelemetry/browser-api`, so the change reaches it only when its author
  upgrades that dependency. A TypeScript author then gets a type error for most
  changes. A change to when a hook is called shows up only in tests or at
  runtime.

## Marking breaking changes

Use `!` in the PR title (for example `feat(user-action)!: ...`) and describe the
migration in the PR description. Release-please then lists the change under
breaking changes in the changelog.

## Deprecation

Exports, config options, and types that have a replacement are deprecated for at
least one minor release before removal. A deprecated API keeps working for the
rest of that minor line: something deprecated in 0.3.1 stays usable through
0.3.x and can be removed in 0.4.0 at the earliest.

To deprecate something:

- Add `@deprecated` to the JSDoc, naming the replacement
- Log a one-time `diag.warn` when it is used
- Note the deprecation in the package README

Remove without deprecating when the old API can't keep working, is unsafe, or
would block a larger change. In that case, the PR description explains why
keeping the old API isn't practical.

Changes to emitted telemetry don't get a deprecation period. Attribute
deprecation is handled in the semantic conventions registry.
