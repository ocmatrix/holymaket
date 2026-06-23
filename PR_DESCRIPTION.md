# PR Description

## What changed

This PR bundles the latest security, deployment, and UI-hardening work into one branch update.

### Security and auth
- Added server-side Privy token verification.
- Tightened auth request payloads with DTOs and validation.
- Hardened JWT/session handling for HTTP and WebSocket flows.
- Removed public `userId` leakage from leaderboard, season, tournament, and live-feed responses.
- Updated frontend identity checks to use public fields like `address` and `username` instead of internal IDs.

### Realtime and market flow
- Hardened Socket.IO auth handling.
- Wired in market chain integration for admin market creation.
- Kept market and portfolio pages aligned with the new auth/session model.

### Deployment and build tooling
- Updated Docker and deployment scripts.
- Added smoke-test tooling for XMarket/indexer verification.
- Updated Nginx and Next config for the current deployment layout.

### UI / app shell
- Refreshed the main app and admin visual shell.
- Updated global layout, fonts, gradients, and background treatment.
- Cleaned up some dashboard pages to match the newer design direction.

## Why

The branch is focused on raising the security launch gate:
- reduce exposure of internal user identifiers
- enforce server-side validation and auth boundaries
- make login/session handling safer
- keep deployment and UI changes aligned with the hardened auth model

## Validation

- `npm run build --prefix server`
- `npm run build`
- `git diff --check`

## Notes

This branch includes the latest commits:
- `chore: update deployment and build tooling`
- `security: tighten admin and auth request shapes`
- `feat: refresh app and admin visuals`
