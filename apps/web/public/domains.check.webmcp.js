<script type="module">
  /*
    WebMCP registration snippet for capability domains.check.
    Use in the capability page when the browser agent API is available.
    https://developer.chrome.com/docs/ai/webmcp
  */
  const api = (typeof document !== 'undefined' && document?.modelContext) || (typeof navigator !== 'undefined' && navigator.modelContext);
  if (!api?.registerTool) {
    // Fall back to REST fetch in clients without WebMCP.
    async function fetchDomains(payload) {
      const res = await fetch('/v1/domains.check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res.json();
    }
    window.__agentcom_domains_fetch = fetchDomains;
  } else {
    api.registerTool({
      name: 'domains.check',
      description: 'Check whether one or more domains are available to register and discover available name suggestions.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          domains: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'string' },
          maxResults: { type: 'integer' }
        },
        additionalProperties: false
      },
      async execute(args) {
        const res = await fetch('/v1/domains.check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(args)
        });
        const result = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      }
    });
  }
</script>
