#!/bin/bash
# AgentCom dev-mode health check
# Usage: ./scripts/check.sh [port]
set -euo pipefail
PORT="${1:-2092}"
BASE="http://localhost:$PORT"
FAILURES=0
echo "=== AgentCom Health Check ==="
echo ""
echo "1. Health endpoint..."
HEALTH=$(curl -sf "$BASE/healthz" 2>/dev/null) && echo "   PASS: $HEALTH" || { echo "   FAIL: $BASE/healthz unreachable"; FAILURES=$((FAILURES+1)); }
echo ""
echo "2. Capability manifest..."
MANIFEST=$(curl -sf "$BASE/.well-known/agentcom/capabilities.json" 2>/dev/null) && echo "   PASS: $(echo "$MANIFEST" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"{len(d.get("capabilities",[]))} capabilities")' 2>/dev/null || echo "parsed")" || { echo "   FAIL: manifest unreachable"; FAILURES=$((FAILURES+1)); }
echo ""
echo "3. llms.txt..."
LLMS=$(curl -sf "$BASE/llms.txt" 2>/dev/null) && echo "   PASS: $(echo "$LLMS" | head -1)" || { echo "   FAIL: llms.txt unreachable"; FAILURES=$((FAILURES+1)); }
echo ""
echo "4. Domain check..."
CHECK=$(curl -sf -X POST "$BASE/v1/domains.check" -H "Content-Type: application/json" -d '{"domain":"example.test"}' 2>/dev/null) && echo "   PASS: $(echo "$CHECK" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"available={d["results"][0]["available"]}, confidence={d["results"][0]["confidence"]}")' 2>/dev/null || echo "parsed")" || { echo "   FAIL: /v1/domains.check unreachable"; FAILURES=$((FAILURES+1)); }
echo ""
echo "5. MCP endpoint (initialize handshake)..."
MCP_INIT=$(curl -sf -X POST "$BASE/mcp" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"healthcheck","version":"0"}}}' 2>/dev/null) && echo "   PASS: $(echo "$MCP_INIT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"server={d["result"]["serverInfo"]["name"]}")' 2>/dev/null || echo "parsed")" || { echo "   FAIL: MCP /mcp unreachable"; FAILURES=$((FAILURES+1)); }
echo ""
echo "=== Result: $FAILURES failures ==="
if [ "$FAILURES" -gt 0 ]; then exit 1; else echo "All checks passed."; fi
