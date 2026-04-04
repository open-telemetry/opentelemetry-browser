// use-config.js — React hook managing SDK config form state, URL sync, and custom attributes

import { useState, useEffect, useMemo } from 'react'
import { parseConfigFromQueryString } from '../utils/config.js'
import { attrsObject, currentConfig } from './helpers.js'

export function useConfig() {
  const initial = useMemo(() => parseConfigFromQueryString(), [])

  // ── Form state ──────────────────────────────────────────────────────────────
  const [serviceName, setServiceName]       = useState(initial.serviceName)
  const [serviceVersion, setServiceVersion] = useState(initial.serviceVersion)
  const [tracesUrl, setTracesUrl]           = useState(initial.tracesUrl)
  const [logsUrl, setLogsUrl]               = useState(initial.logsUrl)
  const [customAttrs, setCustomAttrs]       = useState(
    () => Object.entries(initial.customAttributes).map(([key, val]) => ({ key, val }))
  )
  const [configDirty, setDirty] = useState(false)

  // ── URL sync ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams()
    if (serviceName)    p.set('serviceName',    serviceName)
    if (serviceVersion) p.set('serviceVersion', serviceVersion)
    if (tracesUrl)      p.set('tracesUrl',      tracesUrl)
    if (logsUrl)        p.set('logsUrl',        logsUrl)
    const attrs = attrsObject(customAttrs)
    if (Object.keys(attrs).length) {
      p.set('attrs', encodeURIComponent(JSON.stringify(attrs)))
    }
    const qs = p.toString()
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''))
  }, [serviceName, serviceVersion, tracesUrl, logsUrl, customAttrs])

  // ── Mutators ────────────────────────────────────────────────────────────────
  function markDirty() { setDirty(true) }

  function updateField(setter) {
    return (e) => { setter(e.target.value); markDirty() }
  }

  function updateAttr(i, field, value) {
    setCustomAttrs(prev => prev.map((a, j) => j === i ? { ...a, [field]: value } : a))
    markDirty()
  }

  function addAttr() {
    setCustomAttrs(prev => [...prev, { key: '', val: '' }])
    markDirty()
  }

  function removeAttr(i) {
    setCustomAttrs(prev => prev.filter((_, j) => j !== i))
    markDirty()
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const config = currentConfig({ serviceName, serviceVersion, tracesUrl, logsUrl })
  const attrs  = attrsObject(customAttrs)

  return {
    // Raw values for controlled inputs
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
  }
}
