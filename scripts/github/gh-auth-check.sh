#!/usr/bin/env bash
set -euo pipefail

echo "== GitHub CLI Automation Auth Check =="

for profile in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.bash_profile"; do
  if [ -f "$profile" ]; then
    source "$profile" >/dev/null 2>&1 || true
  fi
done

if ! command -v git >/dev/null 2>&1; then
  echo "GitHub CLI auth check: FAIL"
  echo "Reason: git is not installed or not in PATH"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI auth check: FAIL"
  echo "Reason: gh is not installed or not in PATH"
  exit 1
fi

GH_STATUS_OUTPUT="$(gh auth status 2>&1 || true)"

GH_TOKEN_AVAILABLE="no"
GITHUB_TOKEN_AVAILABLE="no"

if [ -n "${GH_TOKEN:-}" ]; then
  GH_TOKEN_AVAILABLE="yes"
fi

if [ -n "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN_AVAILABLE="yes"
fi

if [ "$GH_TOKEN_AVAILABLE" = "no" ] && [ "$GITHUB_TOKEN_AVAILABLE" = "yes" ]; then
  export GH_TOKEN="$GITHUB_TOKEN"
  GH_TOKEN_AVAILABLE="yes"
fi

if [ "$GH_TOKEN_AVAILABLE" = "no" ]; then
  if echo "$GH_STATUS_OUTPUT" | grep -qi "Logged in to github.com"; then
    TOKEN_FROM_GH="$(gh auth token 2>/dev/null || true)"
    if [ -n "${TOKEN_FROM_GH:-}" ]; then
      export GH_TOKEN="$TOKEN_FROM_GH"
      GH_TOKEN_AVAILABLE="yes"
    fi
  fi
fi

ACTIVE_ACCOUNT="$(gh api user --jq .login 2>/dev/null || true)"

echo "gh auth status summary:"
echo "$GH_STATUS_OUTPUT" | sed -E 's/(github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+)/[REDACTED]/g' || true
echo "Active account: ${ACTIVE_ACCOUNT:-unknown}"
echo "GH_TOKEN available: $GH_TOKEN_AVAILABLE"
echo "GITHUB_TOKEN available: $GITHUB_TOKEN_AVAILABLE"

if [ -z "${ACTIVE_ACCOUNT:-}" ]; then
  echo "GitHub CLI auth check: FAIL"
  echo "Reason: unable to resolve active GitHub account with gh api user"
  echo "Do not start browser device code flow automatically."
  exit 1
fi

if [ "$GH_TOKEN_AVAILABLE" != "yes" ]; then
  echo "GitHub CLI auth check: FAIL"
  echo "Reason: GH_TOKEN is unavailable in this shell and could not be derived from gh auth token"
  echo "Do not start browser device code flow automatically."
  exit 1
fi

echo "GitHub CLI auth check: PASS"
echo "Recommended checks command: gh pr checks <PR_NUMBER> --watch || { gh run list --branch <branch> --limit 5; gh run watch <RUN_ID>; }"
