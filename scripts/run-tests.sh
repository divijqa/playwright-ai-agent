#!/usr/bin/env bash
set -euo pipefail

# scripts/run-tests.sh
# Usage: ./scripts/run-tests.sh {local|server}
# - local: run the single integration test against the local file:// test page
# - server: run the Playwright test runner (will use playwright.config.ts webServer if configured)

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
BASE_FILE_URL="file://$REPO_ROOT/test-pages/flight-form.html"

case "${1:-}" in
  local)
    echo "Running test against local file URL: $BASE_FILE_URL"
    BASE_URL="$BASE_FILE_URL" npx tsx tests/flightStatus.spec.ts
    ;;
  server)
    echo "Starting static server on port ${TEST_SERVER_PORT:-8081} and running tests"
    npx http-server test-pages -p ${TEST_SERVER_PORT:-8081} >/tmp/playwright-test-server.log 2>&1 &
    SERVER_PID=$!
    trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
    # give server a moment to start
    sleep 1
    ALLOW_LOCAL_FALLBACK=true npx tsx tests/flightStatus.spec.ts
    ;;
  *)
    echo "Usage: $0 {local|server}"
    echo "  local  - run single test against file:// URL"
    echo "  server - run full Playwright test runner (uses webServer if configured)"
    exit 2
    ;;
esac
