#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${BROADCAST:-false}" = "true" ] && [ -z "${MULTISIG_ADMIN:-}" ]; then
  echo "MULTISIG_ADMIN is required when BROADCAST=true" >&2
  exit 1
fi

if [ -z "${THIRD_PARTY_AUDIT_REPORT:-}" ]; then
  echo "THIRD_PARTY_AUDIT_REPORT must point to the signed third-party audit report" >&2
  exit 1
fi

if [ ! -f "${THIRD_PARTY_AUDIT_REPORT}" ]; then
  echo "Third-party audit report not found: ${THIRD_PARTY_AUDIT_REPORT}" >&2
  exit 1
fi

forge test

if ! command -v slither >/dev/null 2>&1; then
  echo "slither is required. Install with: pipx install slither-analyzer" >&2
  exit 1
fi

slither . --filter-paths "lib|test|script"
