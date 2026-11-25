#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REQUIRED_NODE_MAJOR=22

cd "${PROJECT_ROOT}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js ${REQUIRED_NODE_MAJOR} or later is required: https://nodejs.org" >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < REQUIRED_NODE_MAJOR )); then
  echo "Node.js ${REQUIRED_NODE_MAJOR} or later is required; found $(node --version)." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

if [[ ! -f public/data/current.json ]]; then
  echo "Generating documentation data from XRPLF/rippled develop (first run only)..."
  npm run docs:generate
fi

echo "Starting XRPLD C++ Reference at http://localhost:5173"
npm run dev -- --open
