#!/bin/bash
# AgentCom domain-checker: start, tunnel, validate
# Usage: ./scripts/deploy.sh [port]
set -euo pipefail
PORT="${1:-2092}"
URL_BASE=""
cleanup() { kill "${SERVER_PID:-}" 2>/dev/null; }
trap cleanup EXIT
echo "Starting remote plugin on port $PORT..."
npm run remote-plugin -- --port "$PORT" &
SERVER_PID=$!
sleep 2
echo ""
echo "=== Health check ==="
curl -s "http://localhost:$PORT/healthz" | python3 -m json.tool || true
echo ""
echo "=== Capability manifest ==="
curl -s "http://localhost:$PORT/.well-known/agentcom/capabilities.json" | python3 -m json.tool || true
echo ""
echo "=== Domain check ==="
curl -s -X POST "http://localhost:$PORT/v1/domains.check" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.test"}' | python3 -m json.tool || true
echo ""
echo "=== Start tunnel ==="
echo "Run: cloudflared tunnel --url http://localhost:$PORT"
echo "Then add the public URL + /mcp in ChatGPT Developer Mode."
echo ""
wait "${SERVER_PID:-}" 2>/dev/null
