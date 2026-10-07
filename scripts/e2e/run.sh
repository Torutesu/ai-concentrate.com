#!/usr/bin/env bash
# Builds the Sites Worker, starts it on a fresh local D1 and runs the browser
# scenario. Screenshots land in .qa/shots. Requires Playwright + Chromium
# (set PLAYWRIGHT_MODULE to its index.mjs when it is installed globally).
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "${1:-}" == "--no-build" ]] || npm run build >/dev/null
node scripts/check-sites-bundle.mjs
rm -rf .qa/state && mkdir -p .qa
for f in $(ls drizzle/*.sql | sort); do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --persist-to .qa/state --config dist/server/wrangler.json --file "$f" -y >/dev/null
done
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json --local --persist-to .qa/state \
  --ip 127.0.0.1 --port 8787 --inspector-port 0 >.qa/server.log 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do grep -q "Ready on" .qa/server.log && break; sleep 1; done
node scripts/e2e/studio.mjs
