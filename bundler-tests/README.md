# Bundler Tests

Standalone tests that verify tree-shaking and bundling behavior of the browser SDK packages. This directory is **not** part of the npm workspace — it has its own `package.json` and installs the local packages as `file:` dependencies, simulating what a real consumer would experience.

## Why a separate package?

Workspace packages resolve modules via symlinks and hoisted `node_modules`, which can mask issues with `exports` maps, missing dependencies, and tree-shaking. Running bundlers from an isolated install surface ensures subpath exports like `@opentelemetry/instrumentation-browser/experimental/user-action` resolve correctly through the standard Node.js algorithm.

## Running

```bash
# From the repo root — build workspace packages first
npm run build

# Then run bundler tests
cd bundler-tests
npm install
npm test
```

## Structure

```
bundler-tests/
  bundlers/         # Bundler adapters (esbuild, rollup)
  scenarios/        # Test scenarios (app code + expected/unexpected strings)
  tests/            # Vitest test runner
```

### Adding a bundler

Create a new file in `bundlers/` that exports a `BundlerAdapter`:

```typescript
export interface BundlerAdapter {
  name: string;
  bundle(entryPoint: string, outFile: string): Promise<void>;
}
```

Then add it to `bundlers/index.ts` and the `bundlers` array in `tests/treeshaking.test.ts`.

### Adding a scenario

Create a new file in `scenarios/` that exports a `BundleScenario`:

```typescript
export interface BundleScenario {
  name: string;
  appCode: string;              // The app code that imports from our packages
  expectedInBundle: string[];   // Strings that MUST appear in the bundle output
  notExpectedInBundle: string[];// Strings that must NOT appear in the bundle output
}
```

Then add it to `scenarios/index.ts` and the `scenarios` array in `tests/treeshaking.test.ts`.
