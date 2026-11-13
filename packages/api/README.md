# @opentelemetry/browser-api

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-url]

**Note: This is an experimental package under active development. New releases
may include breaking changes. See [VERSIONING.md](../../VERSIONING.md).**

The contract between browser SDKs and browser instrumentations:

- `Instrumentation`: the interface an SDK accepts. Any object with
  `instrumentationName`, `enable(deps?)`, `disable()` and `isEnabled()`.
- `InstrumentationDeps`: the tracer provider, logger provider and propagator
  that an SDK passes to `enable()`. Each one falls back to the global API.
- `InstrumentationBase`: a base class that implements the lifecycle, so an
  instrumentation only adds its own hooks.

## Which package do I need?

| You use                                  | Install                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The Browser SDK and our instrumentations | `@opentelemetry/browser-sdk` and `@opentelemetry/browser-instrumentation`. This package comes with them. |
| Your own instrumentation                 | `@opentelemetry/browser-api`                                                                             |
| Your own SDK                             | Nothing extra to use our instrumentations. Add `@opentelemetry/browser-api` for the types.               |

Add it as a regular dependency, not a peer dependency. An app can have more than
one version installed, and compatible versions work together. See
[VERSIONING.md](../../VERSIONING.md#the-instrumentation-contract).

```bash
npm install @opentelemetry/browser-api
```

`@opentelemetry/api` is a **peer dependency** (v1.9+).

## Write an instrumentation

**This is only an example.** `DialogInstrumentation` shows the hooks. It is not
part of this package or of `@opentelemetry/browser-instrumentation`, and its
event and attribute names are made up.

The example emits an event when the page calls `alert()` or opens the print
dialog. It patches `alert()` in `_init()`, and listens for `beforeprint` in
`_onEnable()`.

```typescript
import { InstrumentationBase } from '@opentelemetry/browser-api';

export class DialogInstrumentation extends InstrumentationBase {
  private _onBeforePrint = () => this._emitDialogOpen('print');

  constructor() {
    super('@my-org/instrumentation-dialog', '0.1.0', {});
  }

  protected override _init(): void {
    const instrumentation = this;
    this._wrap(
      window,
      'alert',
      (original) =>
        function (this: Window, message?: unknown) {
          if (instrumentation.isEnabled()) {
            instrumentation._emitDialogOpen('alert');
          }
          return original.call(this, message);
        },
    );
  }

  protected override _onEnable(): void {
    window.addEventListener('beforeprint', this._onBeforePrint);
  }

  protected override _onDisable(): void {
    window.removeEventListener('beforeprint', this._onBeforePrint);
  }

  private _emitDialogOpen(type: string): void {
    this._safeExecute('failed to record a dialog', () => {
      this.logger.emit({
        eventName: 'my_org.dialog.open',
        attributes: { 'my_org.dialog.type': type },
      });
    });
  }
}
```

- `_init()` runs once, at the first `enable()`. Use it only to patch browser
  APIs with `_wrap()`, and throw if the browser cannot run the instrumentation.
  A failed `_init()` is final, and `isEnabled()` stays false.
- Patches are never removed, so a patch checks `isEnabled()` and passes the call
  through when it is false.
- `_onEnable()` and `_onDisable()` run each time the instrumentation turns on or
  off. Add listeners in one and remove them in the other.
- `this.tracer`, `this.logger` and `this.propagator` come from the deps passed
  to the first `enable()`, or from the global API for a dep that is left out.
  They throw until the first `enable()` succeeds.
- `_safeExecute()` logs a throw or a rejected promise. It does not pass them to
  the page.

[Writing an instrumentation](../instrumentation/README.md#writing-an-instrumentation)
explains all the rules.

## Use it with the Browser SDK

Pass it in `instrumentations`. The SDK calls `enable()` with its own providers.

```typescript
import { startBrowserSdk } from '@opentelemetry/browser-sdk';

startBrowserSdk({
  instrumentations: [new DialogInstrumentation()],
});
```

## Use it with your own SDK

Call `enable()` with your providers. Any dependency you leave out falls back to
the global API. Only the first `enable()` uses the deps.

```typescript
const instrumentation = new DialogInstrumentation();
instrumentation.enable({ loggerProvider, tracerProvider });

// Stops emitting. A later enable() starts again, unless disable() failed.
instrumentation.disable();
```

An SDK must use only the `Instrumentation` interface. Do not check
`instanceof InstrumentationBase`, because the class can come from another copy
of this package.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For help or feedback on this project, join us in
  [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]:
  https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]:
  https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]:
  https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/browser-api
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fbrowser-api.svg
