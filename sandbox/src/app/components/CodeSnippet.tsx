import type { OtelConfig } from '../types/OtelConfig.type.ts';

export function CodeSnippet({
  config,
  attrs,
}: {
  config: OtelConfig;
  attrs: Record<string, string>;
}) {
  const entries = Object.entries(attrs);
  return (
    <div className="code-block">
      <span className="kw">import</span>
      {' { '}
      <span className="fn">startBrowserSdk</span>
      {' } '}
      <span className="kw">from</span>{' '}
      <span className="str">'@opentelemetry/browser-sdk'</span>
      {';\n\n'}
      <span className="fn">startBrowserSdk</span>
      {'({\n'}
      {'  '}
      <span className="prop">serviceName</span>
      {':    '}
      <span className="str">{`'${config.serviceName}'`}</span>
      {',\n'}
      {'  '}
      <span className="prop">serviceVersion</span>
      {': '}
      <span className="str">{`'${config.serviceVersion}'`}</span>
      {',\n'}
      {entries.length > 0 && (
        <>
          {'  '}
          <span className="prop">resourceAttributes</span>
          {': {\n'}
          {entries.map(([k, v]) => (
            <span key={k}>
              {'    '}
              <span className="prop">{k}</span>
              {': '}
              <span className="str">{`'${v}'`}</span>
              {',\n'}
            </span>
          ))}
          {'  },\n'}
        </>
      )}
      {'  '}
      <span className="prop">traces</span>
      {': {\n'}
      {'    '}
      <span className="prop">exportConfig</span>
      {': { '}
      <span className="prop">url</span>
      {': '}
      <span className="str">{`'${config.tracesUrl}'`}</span>
      {' },\n'}
      {'    '}
      <span className="com">
        {'// ...session + console processors, batching, propagators'}
      </span>
      {'\n  },\n'}
      {'  '}
      <span className="prop">logs</span>
      {': {\n'}
      {'    '}
      <span className="prop">exportConfig</span>
      {': { '}
      <span className="prop">url</span>
      {': '}
      <span className="str">{`'${config.logsUrl}'`}</span>
      {' },\n'}
      {'    '}
      <span className="com">
        {'// ...session + console processors, batching'}
      </span>
      {'\n  },\n'}
      {'  '}
      <span className="com">{'// ...more SDK options'}</span>
      {'\n});\n\n'}
      <span className="com">
        {'// ...plus auto-instrumentations: fetch, XHR, web vitals, and more'}
      </span>
    </div>
  );
}
