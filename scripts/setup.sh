#!/usr/bin/env bash
# Bootstrap local development files for Atlas AI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Atlas AI — setup"
echo "================"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
else
  echo ".env already exists — leaving unchanged"
fi

mkdir -p .data models
echo "Ensured .data/ and models/ directories exist"

if command -v pnpm >/dev/null 2>&1; then
  echo "Installing workspace dependencies with pnpm..."
  pnpm install
  echo "Building @atlas-ai/config..."
  pnpm config:build
else
  echo "pnpm not found — skip install. See docs/guides/Development-Setup.md"
fi

echo
echo "Next: pnpm check:env"
echo "Config guide: docs/guides/Configuration.md"
echo "Full guide: docs/guides/Development-Setup.md"
