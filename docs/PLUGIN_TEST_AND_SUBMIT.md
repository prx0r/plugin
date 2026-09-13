# ChatGPT plugin test + submit steps (domains.check)

## 1) Start the remote MCP server

Locally:
```bash
npm install
npm run remote-plugin   # starts on port 2092
```

## 2) Tunnel it to the internet

Pick one:

### Cloudflare Tunnel (recommended)

```bash
cloudflared tunnel --url http://localhost:2092
```

You get a public `https://*.trycloudflare.com` URL.

### ngrok

```bash
ngrok http 2092
```

Copy the generated `https://` base URL.

## 3) Validate locally

Open:
- `http://localhost:2092/healthz`
- `http://localhost:2092/.well-known/agentcom/capabilities.json`
- `http://localhost:2092/llms.txt`
- POST `http://localhost:2092/v1/domains.check` with:
```json
{ "domain": "example.test" }
```

## 4) Test in ChatGPT (Developer Mode)

1. In ChatGPT: Settings → Security and login → turn on **Developer mode**.
2. Add a new connector using your public URL + `/mcp`.
3. Open a new chat and add the connector.
4. Prompt naturally, e.g.:
   - `Is bogusdomain.example available?`
   - `Check these domains: one.test, two.test`
   - `Give me name ideas for acme widgets`

ChatGPT should route to `domains.check`.

## 5) Prepare submission assets

Before submitting, you must have:

- Public HTTPS endpoint (not localhost)
- Domain verification token at `/.well-known/openai-apps-challenge` (OpenAI portal gives you a token)
- Privacy/support/terms URLs live
- 5 positive test cases and 3 negative test cases in `packages/studio/submission/domains.check.json`
- Short/long descriptions and category

## 6) Submit

Open:
- https://platform.openai.com/plugins (Developer Platform)
- Create new plugin
- Paste your public MCP URL (`https://<host>/mcp`)
- Run Scan Tools
- Fill metadata + test cases
- Submit for review

## Notes

- Developer Mode + tunnel = free testing.
- Submission and publication are gated by OpenAI review and policy compliance.
- Keep the plugin boring first: read-only, minimal arguments, deterministic behavior.
- Tool descriptions in user-intent language; accurate annotations; minimal inputs.

## Local quickstart commands

```bash
npm run remote-plugin         # start plugin server
# new terminal
npx cloudflared tunnel --url http://localhost:2092
# use public https URL in ChatGPT
```

## Minimal request examples

```bash
curl http://localhost:2092/healthz

curl -X POST http://localhost:2092/v1/domains.check \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.test"}'
```
