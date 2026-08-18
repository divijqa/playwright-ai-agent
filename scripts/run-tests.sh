#!/usr/bin/env bash
set -euo pipefail

# scripts/run-tests.sh
# Usage: ./scripts/run-tests.sh {local|data|server|all}
# - local: run the single integration test against the local file:// test page
# - data: run all positive and negative data-driven Playwright scenarios
# - server: run the agent against aa.com with explicit local fallback enabled
# - all: run data-driven scenarios and the agent flow

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
BASE_FILE_URL="file://$REPO_ROOT/test-pages/flight-form.html"

case "${1:-}" in
  local)
    echo "Running test against local file URL: $BASE_FILE_URL"
    BASE_URL="$BASE_FILE_URL" npx tsx tests/flightStatus.spec.ts
    ;;
  data)
    echo "Running all positive and negative data-driven scenarios"
    npx playwright test tests/flightSearchData.spec.ts
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
  all)
    echo "Running complete scenario set"
    "$0" data
    "$0" server
    ;;
  *)
    echo "Usage: $0 {local|data|server|all}"
    echo "  local  - run single test against file:// URL"
    echo "  data   - run all positive and negative data-driven scenarios"
    echo "  server - run agent against aa.com with explicit local fallback"
    echo "  all    - run data-driven scenarios and the agent flow"
    exit 2
    ;;
esac
