/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InMemoryLogRecordExporter } from "@opentelemetry/sdk-logs";
import { setupTestLogExporter } from "@opentelemetry/test-utils";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NavigationTimingInstrumentation } from "./instrumentation.ts";
import {
  ATTR_NAVIGATION_CONNECT_END,
  ATTR_NAVIGATION_CONNECT_START,
  ATTR_NAVIGATION_DECODED_BODY_SIZE,
  ATTR_NAVIGATION_DOM_COMPLETE,
  ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_END,
  ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_START,
  ATTR_NAVIGATION_DOM_INTERACTIVE,
  ATTR_NAVIGATION_DOMAIN_LOOKUP_END,
  ATTR_NAVIGATION_DOMAIN_LOOKUP_START,
  ATTR_NAVIGATION_DURATION,
  ATTR_NAVIGATION_ENCODED_BODY_SIZE,
  ATTR_NAVIGATION_FETCH_START,
  ATTR_NAVIGATION_LOAD_EVENT_END,
  ATTR_NAVIGATION_LOAD_EVENT_START,
  ATTR_NAVIGATION_REDIRECT_COUNT,
  ATTR_NAVIGATION_REQUEST_START,
  ATTR_NAVIGATION_RESPONSE_END,
  ATTR_NAVIGATION_RESPONSE_START,
  ATTR_NAVIGATION_SECURE_CONNECTION_START,
  ATTR_NAVIGATION_TRANSFER_SIZE,
  ATTR_NAVIGATION_TYPE,
  ATTR_NAVIGATION_UNLOAD_EVENT_END,
  ATTR_NAVIGATION_UNLOAD_EVENT_START,
  ATTR_NAVIGATION_URL,
  NAVIGATION_TIMING_EVENT_NAME,
} from "./semconv.ts";

describe("NavigationTimingInstrumentation", () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: NavigationTimingInstrumentation;
  let restoreReadyState: (() => void) | undefined;
  let restoreGetEntriesByType: (() => void) | undefined;
  let getEntriesByTypeSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    getEntriesByTypeSpy = vi
      .spyOn(performance, "getEntriesByType")
      .mockReturnValueOnce([]);

    instrumentation = new NavigationTimingInstrumentation();
  });

  afterEach(() => {
    instrumentation.disable();
    inMemoryExporter.reset();
    getEntriesByTypeSpy.mockRestore();
    document.body.innerHTML = "";
    restoreReadyState?.();
    restoreReadyState = undefined;
    restoreGetEntriesByType?.();
    restoreGetEntriesByType = undefined;
  });

  it("should create an instance of NavigationTimingInstrumentation", () => {
    expect(instrumentation).toBeInstanceOf(NavigationTimingInstrumentation);
  });

  it("should enable and disable without errors", () => {
    expect(() => {
      instrumentation.enable();
      instrumentation.disable();
    }).not.toThrow();
  });

  const getNavigationTimingLogs = () =>
    inMemoryExporter
      .getFinishedLogRecords()
      .filter((log) => log.body === NAVIGATION_TIMING_EVENT_NAME);

  const setReadyState = (state: DocumentReadyState) => {
    const original = Object.getOwnPropertyDescriptor(document, "readyState");
    Object.defineProperty(document, "readyState", {
      value: state,
      configurable: true,
    });

    restoreReadyState = () => {
      if (original) {
        Object.defineProperty(document, "readyState", original);
      } else {
        delete (document as unknown as { readyState?: unknown }).readyState;
      }
    };
  };

  it("should emit immediately when the navigation entry is complete", () => {
    setReadyState("complete");

    const entry = {
      name: "https://example.test/",
      entryType: "navigation",
      startTime: 0,
      duration: 123,
      type: "navigate",
      loadEventEnd: 456,
    };

    getEntriesByTypeSpy.mockReturnValueOnce([entry]);

    instrumentation.enable();

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.body).toBe(NAVIGATION_TIMING_EVENT_NAME);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(456);
  });

  it("should wait for load when the document is loading and entry is incomplete", () => {
    setReadyState("loading");

    let entry = {
      name: "https://example.test/",
      entryType: "navigation",
      startTime: 0,
      duration: 1,
      type: "navigate",
      loadEventEnd: 0,
    };

    getEntriesByTypeSpy.mockReturnValueOnce([entry]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    // Simulate the entry being finalized once the page load completes.
    entry = {
      ...entry,
      loadEventEnd: 999,
    };
    getEntriesByTypeSpy.mockReturnValueOnce([entry]);
    setReadyState("complete");
    window.dispatchEvent(new Event("load"));

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(999);
  });

  it("should delay once when readyState is complete but navigation entry is not finalized yet", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
    });
    setReadyState("complete");

    let entry = {
      name: "https://example.test/",
      entryType: "navigation",
      startTime: 0,
      duration: 1,
      type: "navigate",
      loadEventEnd: 0,
    };

    getEntriesByTypeSpy.mockReturnValueOnce([entry]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    // Simulate the timing entry being finalized after enable().
    entry = {
      ...entry,
      loadEventEnd: 222,
    };
    getEntriesByTypeSpy.mockReturnValueOnce([entry]);
    vi.runOnlyPendingTimers();

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(222);

    vi.useRealTimers();
  });

  it("should emit partial values on pagehide if the page unloads before load completes", () => {
    setReadyState("loading");

    const entry = {
      name: "https://example.test/",
      entryType: "navigation",
      startTime: 0,
      duration: 1,
      type: "navigate",
      loadEventEnd: 0,
    };

    getEntriesByTypeSpy.mockReturnValueOnce([entry]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    window.dispatchEvent(new Event("pagehide"));

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(0);
  });

  it("should not emit twice (load then pagehide)", () => {
    setReadyState("loading");

    let entry = {
      name: "https://example.test/",
      entryType: "navigation",
      startTime: 0,
      duration: 1,
      type: "navigate",
      loadEventEnd: 0,
    };

    getEntriesByTypeSpy.mockReturnValueOnce([entry]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    entry = {
      ...entry,
      loadEventEnd: 111,
    };
    getEntriesByTypeSpy.mockReturnValueOnce([entry]);
    setReadyState("complete");
    window.dispatchEvent(new Event("load"));
    expect(getNavigationTimingLogs().length).toBe(1);

    window.dispatchEvent(new Event("pagehide"));
    expect(getNavigationTimingLogs().length).toBe(1);
  });

  it("should build andemit a complete navigation timing event containing all the attributes", () => {
    setReadyState("complete");

    const entry = {
      name: "https://example.test/",
      entryType: "navigation",
      startTime: 0,
      duration: 5000,
      type: "navigate",
      domComplete: 4800,
      domContentLoadedEventEnd: 3500,
      domContentLoadedEventStart: 3000,
      domInteractive: 2500,
      loadEventEnd: 5000,
      loadEventStart: 4900,
      redirectCount: 2,
      unloadEventEnd: 200,
      unloadEventStart: 100,
      fetchStart: 50,
      domainLookupStart: 60,
      domainLookupEnd: 150,
      connectStart: 150,
      connectEnd: 250,
      secureConnectionStart: 200,
      requestStart: 250,
      responseStart: 300,
      responseEnd: 1000,
      transferSize: 1024,
      encodedBodySize: 800,
      decodedBodySize: 2000,
    };

    getEntriesByTypeSpy.mockReturnValueOnce([entry]);

    instrumentation.enable();

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.body).toBe(NAVIGATION_TIMING_EVENT_NAME);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(5000);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_START]).toBe(4900);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_TYPE]).toBe("navigate");
    expect(logs[0]?.attributes[ATTR_NAVIGATION_URL]).toBe(
      "https://example.test/"
    );
    expect(logs[0]?.attributes[ATTR_NAVIGATION_DURATION]).toBe(5000);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_DOM_COMPLETE]).toBe(4800);
    expect(
      logs[0]?.attributes[ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_END]
    ).toBe(3500);
    expect(
      logs[0]?.attributes[ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_START]
    ).toBe(3000);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_DOM_INTERACTIVE]).toBe(2500);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_REDIRECT_COUNT]).toBe(2);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_UNLOAD_EVENT_END]).toBe(200);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_UNLOAD_EVENT_START]).toBe(100);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_FETCH_START]).toBe(50);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_DOMAIN_LOOKUP_START]).toBe(60);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_DOMAIN_LOOKUP_END]).toBe(150);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_CONNECT_START]).toBe(150);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_CONNECT_END]).toBe(250);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_SECURE_CONNECTION_START]).toBe(
      200
    );
    expect(logs[0]?.attributes[ATTR_NAVIGATION_REQUEST_START]).toBe(250);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_RESPONSE_START]).toBe(300);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_RESPONSE_END]).toBe(1000);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_TRANSFER_SIZE]).toBe(1024);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_ENCODED_BODY_SIZE]).toBe(800);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_DECODED_BODY_SIZE]).toBe(2000);
  });
});
