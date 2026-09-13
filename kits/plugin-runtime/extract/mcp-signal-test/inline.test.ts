import { describe, expect, it } from 'vitest';
import { injectSignal, renderInlineScript, source } from '../src/inline';

// These tests import from `../src/inline`, so `source` is the build-time placeholder, not
// the real bundle (embedded into dist/ post-build). They assert on the generated wrapper
// mechanics — the bootstrap, adapter wiring, JSON encoding, and </script> defusing.

describe('renderInlineScript', () => {
  it('inlines the SDK source and a createSignal bootstrap', () => {
    const html = renderInlineScript({ widgetName: 'weather' });
    expect(html.startsWith('<script>')).toBe(true);
    expect(html.endsWith('</script>')).toBe(true);
    expect(html).toContain(source); // the (placeholder) IIFE bundle
    expect(html).toContain('window.McpSignal');
    expect(html).toContain('S.createSignal(o)');
    expect(html).toContain('try{'); // guarded — never throws into the widget
    expect(html).toContain('catch(e){}');
  });

  it('JSON-encodes scalar options', () => {
    const html = renderInlineScript({ widgetName: 'my"widget', widgetVersion: '1.0.0' });
    expect(html).toContain(JSON.stringify('1.0.0'));
    expect(html).toContain(JSON.stringify('my"widget')); // quotes escaped, not broken
  });

  it('wires the bridge adapter from its descriptor', () => {
    const html = renderInlineScript({ bridge: { toolName: 'record_widget_telemetry' } });
    expect(html).toContain('S.bridgeAdapter({"toolName":"record_widget_telemetry"})');
    expect(html).toContain('o.adapters=[');
  });

  it('supports webhook / posthog / console descriptors, including arrays', () => {
    const html = renderInlineScript({
      webhook: [{ url: 'https://a.example/in' }, { url: 'https://b.example/in' }],
      posthog: { apiKey: 'phc_x', host: 'eu' },
      console: true,
    });
    expect(html).toContain('S.webhookAdapter({"url":"https://a.example/in"})');
    expect(html).toContain('S.webhookAdapter({"url":"https://b.example/in"})');
    expect(html).toContain('S.posthogAdapter({"apiKey":"phc_x","host":"eu"})');
    expect(html).toContain('S.consoleAdapter({})'); // `true` -> defaults
  });

  it('omits the adapters array entirely when none are described', () => {
    const html = renderInlineScript({ widgetName: 'w' });
    expect(html).not.toContain('o.adapters=');
    expect(html).not.toContain('Adapter(');
  });

  it('treats console:false as "no console adapter"', () => {
    const html = renderInlineScript({ bridge: {}, console: false });
    expect(html).toContain('S.bridgeAdapter({})');
    expect(html).not.toContain('S.consoleAdapter');
  });

  it('defuses </script> in payload values so the tag cannot close early', () => {
    const html = renderInlineScript({ widgetName: 'x</script>y' });
    expect(html).toContain('x<\\/script>y'); // defused in the body
    // The only real closing tag is the wrapper's own trailing </script>.
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe('injectSignal', () => {
  const script = renderInlineScript({ bridge: { toolName: 'record_signal' } });

  it('inserts just before </head> when present', () => {
    const out = injectSignal('<html><head><title>t</title></head><body>b</body></html>', {
      bridge: { toolName: 'record_signal' },
    });
    expect(out.indexOf('<script>')).toBeLessThan(out.indexOf('</head>'));
    expect(out).toContain('<title>t</title>'); // original markup intact
    expect(out).toContain('</script></head>'); // script sits immediately before </head>
  });

  it('falls back to </body> when there is no </head>', () => {
    const out = injectSignal('<body>only body</body>', { bridge: { toolName: 'record_signal' } });
    expect(out.indexOf('<script>')).toBeLessThan(out.indexOf('</body>'));
    expect(out.startsWith('<body>only body')).toBe(true);
  });

  it('appends when neither marker exists', () => {
    const out = injectSignal('<div>bare fragment</div>', { bridge: { toolName: 'record_signal' } });
    expect(out.startsWith('<div>bare fragment</div>')).toBe(true);
    expect(out.endsWith('</script>')).toBe(true);
  });

  it('produces the same script body as renderInlineScript', () => {
    const out = injectSignal('<head></head>', { bridge: { toolName: 'record_signal' } });
    expect(out).toContain(script);
  });
});
