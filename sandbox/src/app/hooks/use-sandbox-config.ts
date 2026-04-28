// use-sandbox-config.ts — React hook managing SDK config form state, URL sync, and custom attributes

import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { OtelConfigWithAttrs } from '../../utils/sdk-config-parser.ts';
import { parseSDKConfigFromQueryString } from '../../utils/sdk-config-parser.ts';
import type { Attr } from '../helpers.ts';
import { attrsObject, currentConfig } from '../helpers.ts';
import type { OtelConfig } from '../types/OtelConfig.type.ts';

let attrId = 0;

export interface SandboxConfig extends OtelConfig {
  customAttrs: Attr[];
  configDirty: boolean;
  initial: OtelConfigWithAttrs;
  config: OtelConfig;
  attrs: Record<string, string>;
  updateField: (
    setter: (v: string) => void,
  ) => (e: ChangeEvent<HTMLInputElement>) => void;
  updateAttr: (i: number, field: 'key' | 'val', value: string) => void;
  addAttr: () => void;
  removeAttr: (i: number) => void;
  setServiceName: (v: string) => void;
  setServiceVersion: (v: string) => void;
  setTracesUrl: (v: string) => void;
  setLogsUrl: (v: string) => void;
}

export function useSandboxConfig(): SandboxConfig {
  const initial = useMemo(() => parseSDKConfigFromQueryString(), []);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [serviceName, setServiceName] = useState(initial.serviceName);
  const [serviceVersion, setServiceVersion] = useState(initial.serviceVersion);
  const [tracesUrl, setTracesUrl] = useState(initial.tracesUrl);
  const [logsUrl, setLogsUrl] = useState(initial.logsUrl);
  const [customAttrs, setCustomAttrs] = useState<Attr[]>(() =>
    Object.entries(initial.customAttributes).map(([key, val]) => ({
      id: ++attrId,
      key,
      val,
    })),
  );
  const [configDirty, setDirty] = useState(false);

  // ── URL sync ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (serviceName) {
      p.set('serviceName', serviceName);
    }
    if (serviceVersion) {
      p.set('serviceVersion', serviceVersion);
    }
    if (tracesUrl) {
      p.set('tracesUrl', tracesUrl);
    }
    if (logsUrl) {
      p.set('logsUrl', logsUrl);
    }
    const attrs = attrsObject(customAttrs);
    if (Object.keys(attrs).length) {
      p.set('attrs', encodeURIComponent(JSON.stringify(attrs)));
    }
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
  }, [serviceName, serviceVersion, tracesUrl, logsUrl, customAttrs]);

  // ── Mutators ────────────────────────────────────────────────────────────────
  function markDirty() {
    setDirty(true);
  }

  function updateField(setter: (v: string) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      markDirty();
    };
  }

  function updateAttr(i: number, field: 'key' | 'val', value: string) {
    setCustomAttrs((prev) =>
      prev.map((a, j) => (j === i ? { ...a, [field]: value } : a)),
    );
    markDirty();
  }

  function addAttr() {
    setCustomAttrs((prev) => [...prev, { id: ++attrId, key: '', val: '' }]);
    markDirty();
  }

  function removeAttr(i: number) {
    setCustomAttrs((prev) => prev.filter((_, j) => j !== i));
    markDirty();
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const config = currentConfig({
    serviceName,
    serviceVersion,
    tracesUrl,
    logsUrl,
  });
  const attrs = attrsObject(customAttrs);

  return {
    // Raw values for controlled inputs (satisfy OtelConfig)
    serviceName,
    serviceVersion,
    tracesUrl,
    logsUrl,

    customAttrs,
    configDirty,

    // Initial parsed config (for SDK boot)
    initial,

    // Resolved config & attrs
    config,
    attrs,

    // Mutators
    updateField,
    updateAttr,
    addAttr,
    removeAttr,
    setServiceName,
    setServiceVersion,
    setTracesUrl,
    setLogsUrl,
  };
}
