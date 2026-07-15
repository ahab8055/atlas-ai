#!/usr/bin/env bash
# Verify that the local machine meets Atlas AI development prerequisites.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

errors=0
warnings=0

ok() { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$1"; warnings=$((warnings + 1)); }
fail() { printf "${RED}✗${NC} %s\n" "$1"; errors=$((errors + 1)); }

# Prefer toolchain installed by rustup even if the shell profile was never updated.
case ":${PATH}:" in
  *:"${HOME}/.cargo/bin":*) ;;
  *) export PATH="${HOME}/.cargo/bin:${PATH}" ;;
esac

# Returns major.minor as integers suitable for comparison: "22.11.0" -> 2211
version_mm() {
  local v="${1#v}"
  local major minor
  IFS=. read -r major minor _ <<<"$v"
  printf '%d%02d' "${major:-0}" "${minor:-0}"
}

require_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    ok "$1 found ($(command -v "$1"))"
  else
    fail "$1 not found — see docs/guides/Development-Setup.md"
  fi
}

echo "Atlas AI — environment check"
echo "=============================="

require_cmd git
require_cmd node
require_cmd pnpm
require_cmd rustc
require_cmd cargo
require_cmd rustup

if command -v node >/dev/null 2>&1; then
  node_v="$(node -v 2>/dev/null || true)"
  node_mm="$(version_mm "$node_v")"
  if (( node_mm >= 2200 && node_mm < 2300 )); then
    ok "Node.js $node_v (required: 22.x)"
  else
    fail "Node.js $node_v — required: 22.x (see .nvmrc)"
  fi
fi

if command -v pnpm >/dev/null 2>&1; then
  # Prefer --version; some installs error on -v when packageManager pinning can't resolve.
  pnpm_v="$(pnpm --version 2>/dev/null || pnpm -v 2>/dev/null || true)"
  pnpm_v="$(echo "$pnpm_v" | head -n1 | tr -d '[:space:]')"
  if [[ -z "$pnpm_v" || "$pnpm_v" == *ERROR* ]]; then
    fail "pnpm is installed but could not report a version — try: corepack prepare pnpm@9.15.9 --activate"
  else
    pnpm_mm="$(version_mm "$pnpm_v")"
    if (( pnpm_mm >= 900 && pnpm_mm < 1000 )); then
      ok "pnpm $pnpm_v (required: 9.x)"
    else
      fail "pnpm $pnpm_v — required: 9.x"
    fi
  fi
fi

if command -v rustc >/dev/null 2>&1; then
  rust_v="$(rustc --version 2>/dev/null | awk '{print $2}')"
  rust_mm="$(version_mm "$rust_v")"
  # Tauri 2 MSRV is 1.77.2
  if (( rust_mm >= 177 )); then
    ok "Rust $rust_v (>= 1.77 required for Tauri 2)"
  else
    fail "Rust $rust_v — required: >= 1.77.2"
  fi
fi

if [[ -f .env ]]; then
  ok ".env present"
else
  warn ".env missing — run: cp .env.example .env"
fi

if [[ -d .data ]]; then
  ok ".data directory present"
else
  warn ".data missing — run: pnpm setup (or mkdir -p .data)"
fi

case "$(uname -s)" in
  Darwin)
    if xcode-select -p >/dev/null 2>&1; then
      ok "Xcode Command Line Tools present"
    else
      fail "Xcode Command Line Tools missing — run: xcode-select --install"
    fi
    ;;
  Linux)
    if pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
      ok "webkit2gtk-4.1 development library present"
    else
      warn "webkit2gtk-4.1 not detected — required for Tauri 2 on Linux (see docs/guides/Development-Setup.md)"
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    warn "Windows detected — ensure MSVC Build Tools + WebView2 are installed"
    ;;
esac

echo "=============================="
if (( errors > 0 )); then
  printf "${RED}Failed:%s error(s), %s warning(s)${NC}\n" "$errors" "$warnings"
  exit 1
fi
if (( warnings > 0 )); then
  printf "${YELLOW}Passed with %s warning(s)${NC}\n" "$warnings"
  exit 0
fi
printf "${GREEN}All checks passed${NC}\n"
