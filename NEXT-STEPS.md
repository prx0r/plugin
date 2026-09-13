# Next steps — ChatGPT plugin path

1. **Confirm public HTTPS endpoint works**
   - Start `npm run remote-plugin`
   - Tunnel with `cloudflared` or `ngrok`
   - Verify `/mcp`, `/healthz`, `/llms.txt`, `/.well-known/agentcom/capabilities.json`

2. **ChatGPT Developer Mode test**
   - Add connector with public URL + `/mcp`
   - Run direct, indirect, and negative prompts
   - Capture tool selection, latency, and error behavior

3. **Polish plugin assets**
   - Improve `packages/studio/submission/domains.check.json` with final copy
   - Ensure `apps/web/public/llms.txt` remains accurate
   - Confirm `docs/domains/openapi.json` aligns with `/v1/domains.check`

4. **Prepare submission package**
   - Confirm Privacy/Support/Terms pages
   - Set up challenge token at `/.well-known/openai-apps-challenge`
   - Prepare screenshots if custom UI is shown (currently no UI)
   - Prepare final short/long descriptions

5. **Submit on OpenAI Developer Platform**
   - Create plugin, paste MCP URL, run Scan Tools
   - Attach test cases (5 positive / 3 negative)
   - Submit for review

6. **Post-review iteration**
   - Address feedback
   - Fix annotation/description/schema mismatches
   - Iterate capability wording, not features

7. **Optional: WebMCP registration on capability page**
   - If browser-agent coverage is valuable, enable `apps/web/public/domains.check.webmcp.js`
