#!/usr/bin/env bash
# Ensure ~/.cargo/bin is on PATH, then exec the remaining args.
# Used so pnpm scripts work even when the shell profile was never updated.
set -euo pipefail

case ":${PATH}:" in
  *:"${HOME}/.cargo/bin":*) ;;
  *) export PATH="${HOME}/.cargo/bin:${PATH}" ;;
esac

if [[ $# -eq 0 ]]; then
  echo "usage: with-cargo-path.sh <command> [args...]" >&2
  exit 2
fi

exec "$@"
